// API smoke test against a running `wrangler dev` (default http://127.0.0.1:8787).
// Needs ffmpeg to synthesise a short test tone; fixtures are gitignored.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787';
const PASSWORD = process.env.APP_PASSWORD || 'test-password-123';
const FIX = new URL('./fixtures/', import.meta.url).pathname;

mkdirSync(FIX, { recursive: true });
const mp3 = FIX + 'tone.mp3';
if (!existsSync(mp3)) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-b:a', '96k', mp3]);
}
const audioBytes = readFileSync(mp3);
// 1x1 PNG
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let passed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log('  ok  ', name);
  } catch (e) {
    console.error('  FAIL', name, '\n      ', e.message);
    process.exitCode = 1;
  }
};
const api = (path, opts = {}) => fetch(BASE + path, opts);

let token = '';
const auth = () => ({ authorization: `Bearer ${token}` });
let trackId = '';

console.log('API tests against', BASE);

await step('health is public and configured', async () => {
  const r = await api('/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, configured: true });
});

await step('library requires auth', async () => {
  assert.equal((await api('/api/library')).status, 401);
  assert.equal((await api('/api/library', { headers: { authorization: 'Bearer 1.abc' } })).status, 401);
});

await step('wrong password rejected', async () => {
  const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: 'nope' }) });
  assert.equal(r.status, 401);
});

await step('login returns a token', async () => {
  const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: PASSWORD }) });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.token && j.exp > Date.now() / 1000);
  token = j.token;
  assert.equal((await api('/api/me', { headers: auth() })).status, 200);
});

await step('upload a track', async () => {
  const q = new URLSearchParams({ filename: 'tone.mp3', title: 'Test Tone', artist: 'Test Artist', album: 'Test Album', trackNo: '1', year: '2026', duration: '3' });
  const r = await api('/api/upload?' + q, { method: 'PUT', headers: { ...auth(), 'content-type': 'audio/mpeg' }, body: audioBytes });
  assert.equal(r.status, 201, await r.clone().text());
  const j = await r.json();
  assert.equal(j.track.title, 'Test Tone');
  assert.equal(j.track.size, audioBytes.length);
  trackId = j.track.id;
});

await step('duplicate upload is detected', async () => {
  const q = new URLSearchParams({ filename: 'tone.mp3', title: 'Test Tone', artist: 'Test Artist', album: 'Test Album' });
  const r = await api('/api/upload?' + q, { method: 'PUT', headers: { ...auth(), 'content-type': 'audio/mpeg' }, body: audioBytes });
  const j = await r.json();
  assert.equal(j.duplicate, true);
  assert.equal(j.id, trackId);
});

await step('non-audio upload rejected', async () => {
  const r = await api('/api/upload?filename=notes.txt', { method: 'PUT', headers: { ...auth(), 'content-type': 'text/plain' }, body: 'hello' });
  assert.equal(r.status, 415);
});

await step('library lists the track', async () => {
  const j = await (await api('/api/library', { headers: auth() })).json();
  assert.equal(j.tracks.length, 1);
  assert.equal(j.tracks[0].artist, 'Test Artist');
});

await step('full audio download with bearer token', async () => {
  const r = await api(`/api/audio/${trackId}`, { headers: auth() });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('accept-ranges'), 'bytes');
  assert.equal(Buffer.compare(Buffer.from(await r.arrayBuffer()), audioBytes), 0);
});

await step('range request returns 206 with exact bytes', async () => {
  const r = await api(`/api/audio/${trackId}`, { headers: { ...auth(), range: 'bytes=100-299' } });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), `bytes 100-299/${audioBytes.length}`);
  assert.equal(Buffer.compare(Buffer.from(await r.arrayBuffer()), audioBytes.subarray(100, 300)), 0);
});

await step('open-ended and suffix ranges work, bad range is 416', async () => {
  let r = await api(`/api/audio/${trackId}`, { headers: { ...auth(), range: 'bytes=0-' } });
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, audioBytes.length);
  r = await api(`/api/audio/${trackId}`, { headers: { ...auth(), range: 'bytes=-50' } });
  assert.equal((await r.arrayBuffer()).byteLength, 50);
  r = await api(`/api/audio/${trackId}`, { headers: { ...auth(), range: `bytes=${audioBytes.length + 10}-` } });
  assert.equal(r.status, 416);
});

await step('signed stream URL works without headers and tampering fails', async () => {
  const { url } = await (await api(`/api/tracks/${trackId}/stream-url`, { headers: auth() })).json();
  const r = await api(url, { headers: { range: 'bytes=0-9' } });
  assert.equal(r.status, 206);
  const bad = await api(url.replace(/sig=./, 'sig=X'));
  assert.equal(bad.status, 401);
  assert.equal((await api(`/api/audio/${trackId}`)).status, 401);
});

await step('cover art upload and fetch', async () => {
  let r = await api(`/api/tracks/${trackId}/cover`, { method: 'PUT', headers: { ...auth(), 'content-type': 'image/png' }, body: png });
  assert.equal(r.status, 200);
  r = await api(`/api/tracks/${trackId}/cover`, { headers: auth() });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  const lib = await (await api('/api/library', { headers: auth() })).json();
  assert.equal(lib.tracks[0].hasCover, true);
});

await step('edit track metadata', async () => {
  const r = await api(`/api/tracks/${trackId}`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ title: 'Renamed Tone', duration: 3.2 }) });
  const j = await r.json();
  assert.equal(j.track.title, 'Renamed Tone');
  assert.equal(j.track.duration, 3.2);
});

await step('playlist sync is last-write-wins', async () => {
  const post = (playlists) => api('/api/sync', { method: 'POST', headers: auth(), body: JSON.stringify({ playlists }) }).then((r) => r.json());
  let j = await post([{ id: 'pl1', name: 'Road trip', trackIds: [trackId], updatedAt: 1000 }]);
  assert.equal(j.playlists.length, 1);
  j = await post([{ id: 'pl1', name: 'Stale edit', trackIds: [], updatedAt: 500 }]);
  assert.equal(j.playlists[0].name, 'Road trip');
  j = await post([{ id: 'pl1', name: 'Road trip 2', trackIds: [trackId], updatedAt: 2000 }]);
  assert.equal(j.playlists[0].name, 'Road trip 2');
  j = await post([{ id: 'pl1', name: 'Road trip 2', trackIds: [], updatedAt: 3000, deleted: true }]);
  assert.equal(j.playlists[0].deleted, true);
});

await step('bucket import endpoint runs (nothing to import)', async () => {
  const j = await (await api('/api/import', { method: 'POST', headers: auth(), body: '{}' })).json();
  assert.equal(j.done, true);
  assert.equal(j.added, 0);
});

await step('delete removes track and file', async () => {
  assert.equal((await api(`/api/tracks/${trackId}`, { method: 'DELETE', headers: auth() })).status, 200);
  assert.equal((await api(`/api/audio/${trackId}`, { headers: auth() })).status, 404);
  const lib = await (await api('/api/library', { headers: auth() })).json();
  assert.equal(lib.tracks.length, 0);
});

await step('login throttles after repeated failures', async () => {
  let last = 0;
  for (let i = 0; i < 12; i++) {
    last = (await api('/api/login', { method: 'POST', body: JSON.stringify({ password: 'bad' + i }) })).status;
  }
  assert.equal(last, 429);
});

console.log(`\n${passed} step(s) passed${process.exitCode ? ', some FAILED' : ''}`);
console.log('Note: the last step trips the login throttle on purpose. Run `npm run db:unlock:local` before signing in from a browser.');
