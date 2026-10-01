// Cadence API: a single-user music library on Cloudflare Workers (R2 for files, D1 for metadata).
// The PWA in ./public is served as static assets; only /api/* reaches this Worker.

const MAX_UPLOAD = 100 * 1024 * 1024; // Workers request body limit
const MAX_COVER = 5 * 1024 * 1024;
const APP_TOKEN_TTL = 90 * 24 * 3600; // seconds; long, so a phone stays signed in while offline
const STREAM_TTL = 6 * 3600;
const LOGIN_WINDOW = 15 * 60;
const LOGIN_MAX_FAILURES = 10;
const IMPORT_PREFIX = 'import/';
const IMPORT_PAGE = 500;

const MIME_BY_EXT = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
};

const enc = new TextEncoder();
const nowSec = () => Math.floor(Date.now() / 1000);

// ---------- helpers ----------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0);
const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);

function extOf(name) {
  const m = /\.([a-z0-9]{2,5})$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function mintToken(env) {
  const exp = nowSec() + APP_TOKEN_TTL;
  return { token: `${exp}.${await hmac(env.AUTH_SECRET, `app:${exp}`)}`, exp };
}

async function authed(request, env) {
  if (!env.AUTH_SECRET) return false;
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!exp || !sig || exp < nowSec()) return false;
  return safeEqual(sig, await hmac(env.AUTH_SECRET, `app:${exp}`));
}

function trackJson(r) {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    album: r.album,
    trackNo: r.track_no,
    year: r.year,
    duration: r.duration,
    size: r.size,
    mime: r.mime,
    hasCover: !!r.has_cover,
    addedAt: r.added_at,
  };
}

function playlistJson(r) {
  let trackIds = [];
  try {
    trackIds = JSON.parse(r.track_ids);
  } catch {}
  return { id: r.id, name: r.name, trackIds, updatedAt: r.updated_at, deleted: !!r.deleted };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// ---------- entry ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, url);
    } catch (err) {
      console.error('api error', err && err.stack ? err.stack : err);
      return json({ error: 'server_error' }, 500);
    }
  },
};

async function route(request, env, url) {
  const { pathname } = url;
  const method = request.method;

  if (pathname === '/api/health' && method === 'GET') {
    return json({ ok: true, configured: !!(env.APP_PASSWORD && env.AUTH_SECRET) });
  }
  if (pathname === '/api/login' && method === 'POST') return login(request, env);

  let m = pathname.match(/^\/api\/audio\/([\w-]+)$/);
  if (m && (method === 'GET' || method === 'HEAD')) return audio(request, env, url, m[1]);

  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);

  if (pathname === '/api/me' && method === 'GET') return json({ ok: true });
  if (pathname === '/api/library' && method === 'GET') return library(env);
  if (pathname === '/api/upload' && method === 'PUT') return upload(request, env, url);
  if (pathname === '/api/sync' && method === 'POST') return syncPlaylists(request, env);
  if (pathname === '/api/import' && method === 'POST') return importFromBucket(request, env);

  m = pathname.match(/^\/api\/tracks\/([\w-]+)\/(cover|stream-url)$/);
  if (m) {
    if (m[2] === 'cover' && method === 'PUT') return putCover(request, env, m[1]);
    if (m[2] === 'cover' && method === 'GET') return getCover(env, m[1]);
    if (m[2] === 'stream-url' && method === 'GET') return streamUrl(env, m[1]);
  }

  m = pathname.match(/^\/api\/tracks\/([\w-]+)$/);
  if (m && method === 'PATCH') return patchTrack(request, env, m[1]);
  if (m && method === 'DELETE') return deleteTrack(env, m[1]);

  return json({ error: 'not_found' }, 404);
}

// ---------- auth ----------

async function login(request, env) {
  if (!env.APP_PASSWORD || !env.AUTH_SECRET) return json({ error: 'not_configured' }, 500);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const since = nowSec() - LOGIN_WINDOW;

  const failures = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND ts > ?').bind(ip, since).first();
  if (failures && failures.n >= LOGIN_MAX_FAILURES) return json({ error: 'too_many_attempts' }, 429);

  const body = await readJson(request);
  const given = body && typeof body.password === 'string' ? body.password : '';
  // Compare HMACs so the comparison is constant-time and length-independent.
  const ok = safeEqual(await hmac(env.AUTH_SECRET, `pw:${given}`), await hmac(env.AUTH_SECRET, `pw:${env.APP_PASSWORD}`));

  if (!ok) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO login_attempts (ip, ts) VALUES (?, ?)').bind(ip, nowSec()),
      env.DB.prepare('DELETE FROM login_attempts WHERE ts < ?').bind(since),
    ]);
    return json({ error: 'bad_password' }, 401);
  }
  return json(await mintToken(env));
}

// ---------- library ----------

async function library(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM tracks ORDER BY artist COLLATE NOCASE, album COLLATE NOCASE, track_no, title COLLATE NOCASE',
  ).all();
  return json({ tracks: results.map(trackJson), serverTime: Date.now() });
}

async function upload(request, env, url) {
  const len = Number(request.headers.get('content-length'));
  if (!len) return json({ error: 'length_required' }, 411);
  if (len > MAX_UPLOAD) return json({ error: 'too_large', max: MAX_UPLOAD }, 413);

  const q = url.searchParams;
  const filename = str(q.get('filename'), 255);
  const ext = extOf(filename);
  const headerType = (request.headers.get('content-type') || '').split(';')[0].trim();
  const mime = headerType.startsWith('audio/') ? headerType : MIME_BY_EXT[ext];
  if (!mime) return json({ error: 'not_audio' }, 415);

  const stem = filename.replace(/\.[a-z0-9]{2,5}$/i, '');
  const title = str(q.get('title')) || stem || 'Untitled';
  const artist = str(q.get('artist'));
  const album = str(q.get('album'));

  const dupe = await env.DB.prepare('SELECT id FROM tracks WHERE title = ? AND artist = ? AND album = ? AND size = ?')
    .bind(title, artist, album, len)
    .first();
  if (dupe) return json({ duplicate: true, id: dupe.id }, 200);

  const id = crypto.randomUUID();
  const key = `audio/${id}${ext ? '.' + ext : ''}`;
  await env.MUSIC.put(key, request.body, { httpMetadata: { contentType: mime } });

  const row = {
    id,
    r2_key: key,
    title,
    artist,
    album,
    track_no: int(q.get('trackNo')),
    year: int(q.get('year')),
    duration: num(q.get('duration')),
    size: len,
    mime,
    has_cover: 0,
    added_at: Date.now(),
  };
  try {
    await env.DB.prepare(
      'INSERT INTO tracks (id, r2_key, title, artist, album, track_no, year, duration, size, mime, has_cover, added_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    )
      .bind(row.id, row.r2_key, row.title, row.artist, row.album, row.track_no, row.year, row.duration, row.size, row.mime, row.has_cover, row.added_at)
      .run();
  } catch (err) {
    await env.MUSIC.delete(key); // don't orphan the file if the row failed
    throw err;
  }
  return json({ track: trackJson(row) }, 201);
}

async function patchTrack(request, env, id) {
  const body = await readJson(request);
  if (!body) return json({ error: 'bad_json' }, 400);
  const sets = [];
  const vals = [];
  const add = (col, v) => {
    sets.push(`${col} = ?`);
    vals.push(v);
  };
  if ('title' in body && str(body.title)) add('title', str(body.title));
  if ('artist' in body) add('artist', str(body.artist));
  if ('album' in body) add('album', str(body.album));
  if ('trackNo' in body) add('track_no', int(body.trackNo));
  if ('year' in body) add('year', int(body.year));
  if ('duration' in body) add('duration', num(body.duration));
  if (!sets.length) return json({ error: 'nothing_to_update' }, 400);

  const res = await env.DB.prepare(`UPDATE tracks SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id).run();
  if (!res.meta.changes) return json({ error: 'not_found' }, 404);
  const row = await env.DB.prepare('SELECT * FROM tracks WHERE id = ?').bind(id).first();
  return json({ track: trackJson(row) });
}

async function deleteTrack(env, id) {
  const row = await env.DB.prepare('SELECT r2_key, has_cover FROM tracks WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'not_found' }, 404);
  await env.MUSIC.delete(row.has_cover ? [row.r2_key, `cover/${id}`] : row.r2_key);
  await env.DB.prepare('DELETE FROM tracks WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ---------- cover art ----------

async function putCover(request, env, id) {
  const len = Number(request.headers.get('content-length'));
  if (!len) return json({ error: 'length_required' }, 411);
  if (len > MAX_COVER) return json({ error: 'too_large' }, 413);
  const type = (request.headers.get('content-type') || '').split(';')[0].trim();
  if (!type.startsWith('image/')) return json({ error: 'not_image' }, 415);

  const exists = await env.DB.prepare('SELECT 1 AS ok FROM tracks WHERE id = ?').bind(id).first();
  if (!exists) return json({ error: 'not_found' }, 404);

  await env.MUSIC.put(`cover/${id}`, request.body, { httpMetadata: { contentType: type } });
  await env.DB.prepare('UPDATE tracks SET has_cover = 1 WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function getCover(env, id) {
  const obj = await env.MUSIC.get(`cover/${id}`);
  if (!obj) return json({ error: 'not_found' }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'private, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
}

// ---------- audio streaming ----------

async function streamUrl(env, id) {
  const exists = await env.DB.prepare('SELECT 1 AS ok FROM tracks WHERE id = ?').bind(id).first();
  if (!exists) return json({ error: 'not_found' }, 404);
  const exp = nowSec() + STREAM_TTL;
  const sig = await hmac(env.AUTH_SECRET, `audio:${id}:${exp}`);
  return json({ url: `/api/audio/${id}?exp=${exp}&sig=${sig}`, exp });
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

// Authorised either by the bearer token (offline downloads) or a short-lived signed URL (<audio src>).
async function audio(request, env, url, id) {
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig');
  let ok = false;
  if (sig && exp > nowSec() && env.AUTH_SECRET) ok = safeEqual(sig, await hmac(env.AUTH_SECRET, `audio:${id}:${exp}`));
  if (!ok) ok = await authed(request, env);
  if (!ok) return json({ error: 'unauthorized' }, 401);

  const row = await env.DB.prepare('SELECT r2_key, mime, size FROM tracks WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'not_found' }, 404);

  const headers = new Headers({
    'content-type': row.mime,
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
  });

  if (request.method === 'HEAD') {
    headers.set('content-length', String(row.size));
    return new Response(null, { headers });
  }

  const range = parseRange(request.headers.get('range'), row.size);
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { 'content-range': `bytes */${row.size}` } });
  }

  const obj = range
    ? await env.MUSIC.get(row.r2_key, { range: { offset: range.start, length: range.end - range.start + 1 } })
    : await env.MUSIC.get(row.r2_key);
  if (!obj) return json({ error: 'file_missing' }, 404);

  headers.set('etag', obj.httpEtag);
  if (range) {
    headers.set('content-range', `bytes ${range.start}-${range.end}/${row.size}`);
    headers.set('content-length', String(range.end - range.start + 1));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(obj.body, { headers });
}

// ---------- playlists (last-write-wins by updatedAt) ----------

async function syncPlaylists(request, env) {
  const body = await readJson(request);
  const incoming = body && Array.isArray(body.playlists) ? body.playlists.slice(0, 500) : [];

  const { results } = await env.DB.prepare('SELECT * FROM playlists').all();
  const current = new Map(results.map((r) => [r.id, r]));

  const writes = [];
  for (const p of incoming) {
    const id = str(p && p.id, 64);
    if (!id || !/^[\w-]+$/.test(id)) continue;
    const updatedAt = int(p.updatedAt);
    const existing = current.get(id);
    if (existing && existing.updated_at >= updatedAt) continue;
    const trackIds = Array.isArray(p.trackIds) ? p.trackIds.filter((t) => typeof t === 'string').slice(0, 5000) : [];
    writes.push(
      env.DB.prepare(
        'INSERT INTO playlists (id, name, track_ids, updated_at, deleted) VALUES (?,?,?,?,?) ' +
          'ON CONFLICT(id) DO UPDATE SET name = excluded.name, track_ids = excluded.track_ids, updated_at = excluded.updated_at, deleted = excluded.deleted',
      ).bind(id, str(p.name, 120) || 'Untitled', JSON.stringify(trackIds), updatedAt, p.deleted ? 1 : 0),
    );
  }
  if (writes.length) await env.DB.batch(writes);

  const { results: merged } = await env.DB.prepare('SELECT * FROM playlists ORDER BY updated_at DESC').all();
  return json({ playlists: merged.map(playlistJson), serverTime: Date.now() });
}

// ---------- bulk import (files copied straight into the bucket under import/ with rclone) ----------

function metaFromKey(key) {
  const parts = key.slice(IMPORT_PREFIX.length).split('/').filter(Boolean);
  const file = parts[parts.length - 1] || key;
  let stem = file.replace(/\.[a-z0-9]{2,5}$/i, '');
  let trackNo = 0;
  const lead = /^(\d{1,3})\s*[-._ ]\s*(.+)$/.exec(stem);
  if (lead) {
    trackNo = Number(lead[1]);
    stem = lead[2];
  }
  const artist = parts.length >= 2 ? parts[0] : '';
  const album = parts.length >= 3 ? parts[parts.length - 2] : '';
  return { title: stem.trim() || file, artist, album, trackNo };
}

async function importFromBucket(request, env) {
  const body = (await readJson(request)) || {};
  const cursor = typeof body.cursor === 'string' && body.cursor ? body.cursor : undefined;
  const page = await env.MUSIC.list({ prefix: IMPORT_PREFIX, limit: IMPORT_PAGE, cursor });

  const objects = page.objects.filter((o) => MIME_BY_EXT[extOf(o.key)]);
  const known = new Set();
  for (let i = 0; i < objects.length; i += 90) {
    const chunk = objects.slice(i, i + 90);
    const marks = chunk.map(() => '?').join(',');
    const { results } = await env.DB.prepare(`SELECT r2_key FROM tracks WHERE r2_key IN (${marks})`).bind(...chunk.map((o) => o.key)).all();
    for (const r of results) known.add(r.r2_key);
  }

  const stmts = [];
  for (const o of objects) {
    if (known.has(o.key)) continue;
    const meta = metaFromKey(o.key);
    stmts.push(
      env.DB.prepare(
        'INSERT OR IGNORE INTO tracks (id, r2_key, title, artist, album, track_no, year, duration, size, mime, has_cover, added_at) VALUES (?,?,?,?,?,?,0,0,?,?,0,?)',
      ).bind(crypto.randomUUID(), o.key, meta.title, meta.artist, meta.album, meta.trackNo, o.size, MIME_BY_EXT[extOf(o.key)], Date.now()),
    );
  }
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));

  return json({
    scanned: page.objects.length,
    added: stmts.length,
    done: !page.truncated,
    cursor: page.truncated ? page.cursor : null,
  });
}
