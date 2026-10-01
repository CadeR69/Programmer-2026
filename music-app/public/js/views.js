// Screens. Each view function returns a DOM element; listeners are registered through listen()
// so they can be dropped when the user navigates away.
import { h, icon, clear, fmtBytes, toast, sheet, askText, confirmBox, onVisible } from './ui.js';
import { cover } from './art.js';
import * as core from './core.js';
import * as player from './player.js';
import * as offline from './offline.js';
import * as upload from './upload.js';
import * as api from './api.js';

let disposers = [];
function listen(target, type, fn) {
  target.addEventListener(type, fn);
  disposers.push(() => target.removeEventListener(type, fn));
}
export function disposeView() {
  disposers.forEach((fn) => fn());
  disposers = [];
}

// Keep rows in sync with playback / download / connectivity changes without re-rendering lists.
export function repaintRows() {
  document.querySelectorAll('.row[data-id]').forEach(paintRow);
}

function paintRow(row) {
  const id = row.dataset.id;
  const cur = player.currentTrack();
  row.classList.toggle('dim', !core.isPlayable(id));
  row.classList.toggle('current', !!cur && cur.id === id);
  const status = row.querySelector('.status');
  if (!status) return;
  clear(status);
  const d = core.dl.get(id);
  if (d) status.appendChild(h('span', { class: 'pct' }, d.total ? `${Math.min(99, Math.floor((d.loaded / d.total) * 100))}%` : '…'));
  else if (offline.isDownloaded(id)) status.appendChild(h('span', { class: 'saved', title: 'Downloaded for offline' }, icon('check', 18)));
}

// ---------- building blocks ----------

function pagedList(items, make, cls = 'list', chunk = 100) {
  const box = h('div', { class: cls });
  const sentinel = h('div', { class: 'sentinel' });
  let shown = 0;
  const more = () => {
    sentinel.remove();
    const end = Math.min(items.length, shown + chunk);
    for (; shown < end; shown++) box.appendChild(make(items[shown], shown));
    if (shown < items.length) {
      box.appendChild(sentinel);
      onVisible(sentinel, more);
    }
  };
  more();
  return box;
}

function empty(title, text) {
  return h('div', { class: 'empty' }, icon('note', 40), h('h3', null, title), text ? h('p', { class: 'muted' }, text) : null);
}

function pageHeader(title, ...right) {
  return h('div', { class: 'page-head' }, h('h1', null, title), right);
}

function backButton() {
  return h('button', { class: 'back', onclick: () => history.back(), 'aria-label': 'Back' }, icon('down', 22), 'Back');
}

const firstPlayable = (ids) => Math.max(0, ids.findIndex((id) => core.isPlayable(id)));

function trackRow(track, ids, i, extra = {}) {
  const row = h(
    'div',
    { class: 'row', 'data-id': track.id, role: 'button', tabindex: '0' },
    cover(track, 'sm'),
    h('div', { class: 'meta' }, h('div', { class: 'title' }, track.title), h('div', { class: 'sub' }, [track.artist, track.album].filter(Boolean).join(' · ') || 'Unknown artist')),
    h('span', { class: 'status' }),
    h('button', { class: 'icon-btn', 'aria-label': `More options for ${track.title}`, onclick: (e) => { e.stopPropagation(); trackMenu(track, extra); } }, icon('more', 22)),
  );
  row.addEventListener('click', () => {
    if (!core.isPlayable(track.id)) return toast("Not downloaded, so it can't play offline.");
    player.playList(ids, i);
  });
  row.addEventListener('keydown', (e) => e.key === 'Enter' && row.click());
  paintRow(row);
  return row;
}

async function runDownload(ids) {
  const need = ids.filter((id) => !offline.isDownloaded(id));
  if (!need.length) return toast('Already downloaded');
  if (!core.state.online) return toast('Connect to the internet to download music.');
  offline.requestPersistence();
  toast(`Downloading ${need.length} track${need.length > 1 ? 's' : ''}…`);
  const res = await core.download(need);
  if (res.quota) toast('Device storage is full. Remove some downloads first.');
  else if (res.offline) toast('Lost connection. Downloads stopped.');
  else if (res.failed) toast(`${res.ok} downloaded, ${res.failed} failed`);
  else toast(`Downloaded ${res.ok} track${res.ok > 1 ? 's' : ''}`);
}

async function removeDownloads(ids) {
  await core.removeDownloads(ids);
  toast('Removed from this device');
}

function pickPlaylist(ids) {
  const items = [
    {
      label: 'New playlist…',
      icon: 'plus',
      fn: async () => {
        const name = await askText({ title: 'New playlist', placeholder: 'Playlist name', okLabel: 'Create' });
        if (name) {
          core.createPlaylist(name, ids);
          toast(`Added to ${name}`);
        }
      },
    },
    ...core.userPlaylists().map((p) => ({
      label: p.name,
      icon: 'queue',
      fn: () => {
        const n = core.addToPlaylist(p.id, ids);
        toast(n ? `Added ${n} to ${p.name}` : 'Already in that playlist');
      },
    })),
  ];
  sheet('Add to playlist', items);
}

function needOnline(action) {
  if (!core.state.online) {
    toast(`Connect to the internet to ${action}.`);
    return false;
  }
  return true;
}

function trackMenu(track, { onRemove } = {}) {
  const liked = core.isLiked(track.id);
  const saved = offline.isDownloaded(track.id);
  const items = [
    { label: 'Play next', icon: 'queue', fn: () => player.playNext(track.id) },
    { label: 'Add to queue', icon: 'queue', fn: () => { player.enqueue(track.id); toast('Added to queue'); } },
    { label: liked ? 'Remove from Liked Songs' : 'Add to Liked Songs', icon: liked ? 'heart-fill' : 'heart', fn: () => core.toggleLike(track.id) },
    { label: 'Add to playlist…', icon: 'plus', fn: () => pickPlaylist([track.id]) },
    saved ? { label: 'Remove download', icon: 'trash', fn: () => removeDownloads([track.id]) } : { label: 'Download for offline', icon: 'download', fn: () => runDownload([track.id]) },
    onRemove && { label: 'Remove from this playlist', icon: 'close', fn: onRemove },
    {
      label: 'Edit info',
      icon: 'edit',
      fn: async () => {
        if (!needOnline('edit track info')) return;
        const title = await askText({ title: 'Title', value: track.title });
        if (!title) return;
        const artist = await askText({ title: 'Artist', value: track.artist, okLabel: 'Next' });
        const album = await askText({ title: 'Album', value: track.album });
        try {
          await core.editTrack(track.id, { title, artist: artist ?? track.artist, album: album ?? track.album });
        } catch {
          toast("Couldn't save changes.");
        }
      },
    },
    {
      label: 'Delete from library',
      icon: 'trash',
      danger: true,
      fn: async () => {
        if (!needOnline('delete tracks')) return;
        const ok = await confirmBox({ title: 'Delete this track?', message: `"${track.title}" will be removed from the cloud and every device.`, okLabel: 'Delete', danger: true });
        if (!ok) return;
        try {
          await core.removeTrack(track.id);
          toast('Deleted');
        } catch {
          toast("Couldn't delete that track.");
        }
      },
    },
  ].filter(Boolean);
  sheet(track.title, items);
}

function collectionHeader({ title, subtitle, coverTrack, tracks, extra = [] }) {
  const ids = tracks.map((t) => t.id);
  const dlBtn = h('button', { class: 'btn ghost' });
  const paint = () => {
    const all = ids.length > 0 && ids.every((id) => offline.isDownloaded(id));
    clear(dlBtn);
    dlBtn.append(icon('download', 20), all ? 'Remove downloads' : core.dl.size ? 'Downloading…' : 'Download');
    dlBtn.onclick = () => (all ? removeDownloads(ids) : runDownload(ids));
  };
  paint();
  listen(core.bus, 'downloads', paint);
  return h(
    'div',
    { class: 'hero' },
    cover(coverTrack, 'lg'),
    h(
      'div',
      { class: 'hero-text' },
      h('h1', null, title),
      h('p', { class: 'muted' }, subtitle),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn', onclick: () => ids.length && player.playList(ids, firstPlayable(ids), { shuffleOn: false }) }, icon('play', 20), 'Play'),
        h('button', { class: 'btn ghost', onclick: () => ids.length && player.shufflePlay(ids.filter(core.isPlayable)) }, icon('shuffle', 20), 'Shuffle'),
        dlBtn,
        extra,
      ),
    ),
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------- Songs ----------

const songsFilter = { q: '', only: null };

export function songsView() {
  const host = h('div');
  const chip = h('button', { class: 'chip', type: 'button' }, icon('check', 16), 'Downloaded only');
  const search = h('input', { class: 'search', type: 'search', placeholder: 'Search songs, artists, albums', value: songsFilter.q, 'aria-label': 'Search your library' });
  const count = h('span', { class: 'muted count' });

  const draw = () => {
    const only = songsFilter.only ?? !core.state.online;
    chip.classList.toggle('on', only);
    const q = songsFilter.q.trim().toLowerCase();
    let tracks = core.state.tracks;
    if (only) tracks = tracks.filter((t) => offline.isDownloaded(t.id));
    if (q) tracks = tracks.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q));
    count.textContent = plural(tracks.length, 'song');
    clear(host);
    if (!tracks.length) {
      if (q) host.appendChild(empty('No matches', 'Try a different search.'));
      else if (only) host.appendChild(empty('Nothing downloaded yet', 'Open a song, album or playlist and tap Download to keep it for offline.'));
      else host.appendChild(empty('Your library is empty', 'Open More and add some music files.'));
      return;
    }
    const ids = tracks.map((t) => t.id);
    host.appendChild(pagedList(tracks, (t, i) => trackRow(t, ids, i)));
  };

  let timer = 0;
  search.addEventListener('input', () => {
    songsFilter.q = search.value;
    clearTimeout(timer);
    timer = setTimeout(draw, 120);
  });
  chip.addEventListener('click', () => {
    songsFilter.only = !(songsFilter.only ?? !core.state.online);
    draw();
  });
  listen(core.bus, 'library', draw);
  listen(core.bus, 'online', draw);
  listen(core.bus, 'downloads', () => {
    if (!core.dl.size && (songsFilter.only ?? !core.state.online)) draw();
  });

  draw();
  return h('div', null, pageHeader('Songs', count), h('div', { class: 'toolbar' }, h('div', { class: 'search-wrap' }, icon('search', 20), search), chip), host);
}

// ---------- Albums / Artists ----------

export function albumsView() {
  const host = h('div');
  const draw = () => {
    clear(host);
    let list = core.albums();
    if (!core.state.online) list = list.filter((a) => a.tracks.some((t) => offline.isDownloaded(t.id)));
    if (!list.length) return host.appendChild(empty(core.state.online ? 'No albums yet' : 'No downloaded albums', core.state.online ? 'Add music from the More tab.' : 'Download something while online.'));
    host.appendChild(
      pagedList(
        list,
        (a) =>
          h('a', { class: 'card', href: `#/album/${encodeURIComponent(a.key)}` }, cover(a.coverTrack, 'tile'), h('div', { class: 'title' }, a.album), h('div', { class: 'sub' }, a.artist)),
        'grid',
        60,
      ),
    );
  };
  listen(core.bus, 'library', draw);
  listen(core.bus, 'online', draw);
  draw();
  return h('div', null, pageHeader('Albums', h('a', { class: 'chip', href: '#/artists' }, 'Artists')), host);
}

function tracksSection(tracks, extra) {
  const ids = tracks.map((t) => t.id);
  return pagedList(tracks, (t, i) => trackRow(t, ids, i, extra && extra(t)));
}

export function albumView(key) {
  const a = core.albums().find((x) => x.key === key);
  if (!a) return h('div', null, backButton(), empty('Album not found'));
  return h('div', null, backButton(), collectionHeader({ title: a.album, subtitle: `${a.artist} · ${plural(a.tracks.length, 'song')}`, coverTrack: a.coverTrack, tracks: a.tracks }), tracksSection(a.tracks));
}

export function artistsView() {
  const list = core.artists();
  if (!list.length) return h('div', null, pageHeader('Artists'), empty('No artists yet', 'Add music from the More tab.'));
  return h(
    'div',
    null,
    pageHeader('Artists'),
    pagedList(list, (a) =>
      h('a', { class: 'row link', href: `#/artist/${encodeURIComponent(a.name)}` }, cover(a.tracks.find((t) => t.hasCover) || a.tracks[0], 'sm'), h('div', { class: 'meta' }, h('div', { class: 'title' }, a.name), h('div', { class: 'sub' }, plural(a.tracks.length, 'song')))),
    ),
  );
}

export function artistView(name) {
  const tracks = core.state.tracks.filter((t) => (t.artist || 'Unknown artist') === name);
  if (!tracks.length) return h('div', null, backButton(), empty('Artist not found'));
  const sorted = [...tracks].sort((x, y) => x.album.localeCompare(y.album) || x.trackNo - y.trackNo || x.title.localeCompare(y.title));
  return h('div', null, backButton(), collectionHeader({ title: name, subtitle: plural(tracks.length, 'song'), coverTrack: tracks.find((t) => t.hasCover) || tracks[0], tracks: sorted }), tracksSection(sorted));
}

// ---------- Playlists ----------

export function playlistsView() {
  const host = h('div');
  const draw = () => {
    clear(host);
    const entry = (p) => {
      const tracks = core.playlistTracks(p);
      return h(
        'a',
        { class: 'row link', href: `#/playlist/${p.id}` },
        p.id === core.LIKED ? h('div', { class: 'cover sm liked-art' }, icon('heart-fill', 22)) : cover(tracks.find((t) => t.hasCover) || tracks[0], 'sm'),
        h('div', { class: 'meta' }, h('div', { class: 'title' }, p.name), h('div', { class: 'sub' }, plural(tracks.length, 'song'))),
      );
    };
    host.appendChild(h('div', { class: 'list' }, entry(core.liked()), core.userPlaylists().map(entry)));
  };
  listen(core.bus, 'playlists', draw);
  listen(core.bus, 'library', draw);
  draw();
  const add = h(
    'button',
    {
      class: 'btn',
      onclick: async () => {
        const name = await askText({ title: 'New playlist', placeholder: 'Playlist name', okLabel: 'Create' });
        if (name) location.hash = `#/playlist/${core.createPlaylist(name).id}`;
      },
    },
    icon('plus', 20),
    'New playlist',
  );
  return h('div', null, pageHeader('Playlists', add), host);
}

export function playlistView(id) {
  if (!core.getPlaylist(id)) return h('div', null, backButton(), empty('Playlist not found'));
  const host = h('div');
  const head = h('div');

  const draw = () => {
    const p = core.getPlaylist(id);
    if (!p) return void (location.hash = '#/playlists');
    const tracks = core.playlistTracks(p);
    clear(head);
    clear(host);
    const extra =
      id === core.LIKED
        ? []
        : [
            h(
              'button',
              {
                class: 'btn ghost',
                onclick: () =>
                  sheet(p.name, [
                    { label: 'Rename', icon: 'edit', fn: async () => { const n = await askText({ title: 'Rename playlist', value: p.name }); if (n) core.renamePlaylist(id, n); } },
                    { label: 'Delete playlist', icon: 'trash', danger: true, fn: async () => { if (await confirmBox({ title: 'Delete playlist?', message: 'The songs stay in your library.', okLabel: 'Delete', danger: true })) core.deletePlaylist(id); } },
                  ]),
              },
              icon('more', 20),
              'Manage',
            ),
          ];
    head.appendChild(collectionHeader({ title: p.name, subtitle: plural(tracks.length, 'song'), coverTrack: tracks.find((t) => t.hasCover) || tracks[0], tracks, extra }));
    host.appendChild(tracks.length ? tracksSection(tracks, (t) => ({ onRemove: () => core.removeFromPlaylist(id, t.id) })) : empty('Nothing here yet', 'Use ⋯ on any song and choose Add to playlist.'));
  };
  listen(core.bus, 'playlists', draw);
  listen(core.bus, 'library', draw);
  draw();
  return h('div', null, backButton(), head, host);
}

// ---------- Downloads ----------

export function downloadsView() {
  const host = h('div');
  const usageLine = h('p', { class: 'muted' }, 'Checking storage…');
  const draw = () => {
    clear(host);
    const tracks = core.state.tracks.filter((t) => offline.isDownloaded(t.id));
    const pending = [...core.dl.keys()].map(core.getTrack).filter(Boolean);
    const all = [...pending, ...tracks.filter((t) => !core.dl.has(t.id))];
    if (!all.length) return host.appendChild(empty('No downloads yet', 'Downloaded music plays with no connection. Tap Download on any song, album or playlist.'));
    const ids = all.map((t) => t.id);
    host.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => player.playList(ids, firstPlayable(ids)) }, icon('play', 20), 'Play all'), h('button', { class: 'btn ghost danger-text', onclick: async () => { if (await confirmBox({ title: 'Remove all downloads?', message: 'Music stays in your cloud library; it just won’t play offline.', okLabel: 'Remove', danger: true })) { await offline.removeAllDownloads(); core.bus.dispatchEvent(new CustomEvent('downloads')); } } }, icon('trash', 20), 'Remove all')));
    host.appendChild(pagedList(all, (t, i) => trackRow(t, ids, i)));
    const bytes = tracks.reduce((n, t) => n + (t.size || 0), 0);
    usageLine.textContent = `${plural(tracks.length, 'song')} saved on this device (${fmtBytes(bytes)})`;
  };
  offline.usage().then((u) => {
    if (u.quota) usageLine.textContent += ` · device allows about ${fmtBytes(u.quota)} for this app`;
  });
  listen(core.bus, 'downloads', () => {
    if (!core.dl.size) draw();
  });
  listen(core.bus, 'library', draw);
  draw();
  return h('div', null, pageHeader('Downloads'), usageLine, host);
}

// ---------- More: add music, storage, account ----------

const job = { running: false, total: 0, done: 0, duplicate: 0, failed: 0, name: '', pct: 0, errors: [], stop: false };
const jobEvents = new EventTarget();
const changed = () => jobEvents.dispatchEvent(new Event('change'));

async function startUpload(fileList) {
  const all = [...fileList];
  const files = all.filter(upload.isAudioFile);
  if (!files.length) return toast('No supported audio files in that selection.');
  if (job.running) return toast('An upload is already running.');
  if (!core.state.online) return toast('Connect to the internet to add music.');
  Object.assign(job, { running: true, total: files.length, done: 0, duplicate: 0, failed: 0, name: '', pct: 0, errors: [], stop: false });
  changed();
  await upload.uploadFiles(
    files,
    (ev) => {
      if (ev.status === 'reading' || ev.status === 'uploading') {
        job.name = ev.file.name;
        job.pct = ev.pct || 0;
      } else if (ev.status === 'done') job.done++;
      else if (ev.status === 'duplicate') job.duplicate++;
      else if (ev.status === 'error') {
        job.failed++;
        job.errors.push(`${ev.file.name}: ${ev.error}`);
      }
      changed();
    },
    () => job.stop,
  );
  job.running = false;
  changed();
  toast(`Added ${job.done}${job.duplicate ? `, ${job.duplicate} already there` : ''}${job.failed ? `, ${job.failed} failed` : ''}`);
}

function uploadPanel() {
  const input = h('input', { type: 'file', multiple: true, accept: 'audio/*,.mp3,.m4a,.aac,.flac,.wav,.ogg,.opus', hidden: true });
  const folder = h('input', { type: 'file', multiple: true, hidden: true });
  folder.setAttribute('webkitdirectory', '');
  const status = h('div', { class: 'upload-status' });
  const zone = h(
    'div',
    { class: 'dropzone' },
    icon('upload', 32),
    h('p', null, 'Drop audio files here, or choose them below'),
    h('div', { class: 'actions center' }, h('button', { class: 'btn', onclick: () => input.click() }, 'Choose files'), h('button', { class: 'btn ghost', onclick: () => folder.click() }, 'Choose folder')),
    h('p', { class: 'muted small' }, 'MP3, M4A, AAC, FLAC, WAV · up to 100 MB each. Keep this screen open while uploading.'),
  );
  input.addEventListener('change', () => { startUpload(input.files); input.value = ''; });
  folder.addEventListener('change', () => { startUpload(folder.files); folder.value = ''; });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); startUpload(e.dataTransfer.files); });

  const paint = () => {
    clear(status);
    if (!job.total) return;
    const finished = job.done + job.duplicate + job.failed;
    status.append(
      h('div', { class: 'bar' }, h('div', { class: 'fill', style: { width: `${(finished / job.total) * 100}%` } })),
      h('p', { class: 'small' }, `${finished} of ${job.total} · ${job.done} added${job.duplicate ? ` · ${job.duplicate} duplicates` : ''}${job.failed ? ` · ${job.failed} failed` : ''}`),
      job.running ? h('p', { class: 'muted small' }, `${job.name} ${Math.round(job.pct * 100)}%`) : null,
      job.running ? h('button', { class: 'btn ghost', onclick: () => (job.stop = true) }, 'Stop after this file') : null,
      job.errors.slice(-5).map((e) => h('p', { class: 'error small' }, e)),
    );
  };
  listen(jobEvents, 'change', paint);
  paint();
  return h('section', { class: 'panel' }, h('h2', null, 'Add music'), zone, input, folder, status);
}

function importPanel() {
  const out = h('p', { class: 'muted small' });
  const btn = h('button', { class: 'btn ghost' }, icon('download', 20), 'Import from bucket');
  btn.addEventListener('click', async () => {
    if (!needOnline('import')) return;
    btn.disabled = true;
    out.textContent = 'Scanning…';
    try {
      const res = await upload.importFromBucket((p) => (out.textContent = `Scanned ${p.scanned}, added ${p.added}…`));
      out.textContent = `Done: found ${res.scanned} files, added ${res.added} new.`;
      await core.refresh();
    } catch {
      out.textContent = 'Import failed. Check your connection and try again.';
    }
    btn.disabled = false;
  });
  return h('section', { class: 'panel' }, h('h2', null, 'Bulk import'), h('p', { class: 'muted small' }, 'For a big library, copy your files into the bucket’s import/ folder with rclone (see the README), then register them here. Tags are taken from the folder and file names (Artist/Album/01 Title.mp3).'), btn, out);
}

export function moreView() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const stats = h('p', { class: 'muted small' }, 'Checking storage…');
  offline.usage().then(async (u) => {
    const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    stats.textContent = `This app is using ${fmtBytes(u.used)} of about ${fmtBytes(u.quota)} on this device. Protected from automatic clean-up: ${persisted ? 'yes' : 'not yet'}.`;
  });
  const sync = h('p', { class: 'muted small' });
  const paintSync = () => {
    sync.textContent = core.state.online ? (core.state.lastRefresh ? `Online · synced ${new Date(core.state.lastRefresh).toLocaleTimeString()}` : 'Online') : 'Offline · using the copy saved on this device';
  };
  paintSync();
  listen(core.bus, 'online', paintSync);
  listen(core.bus, 'syncing', paintSync);

  return h(
    'div',
    null,
    pageHeader('More'),
    h('section', { class: 'panel' }, h('h2', null, 'Status'), sync, h('button', { class: 'btn ghost', onclick: () => { core.state.lastRefresh = 0; core.refresh().then(() => toast(core.state.online ? 'Library synced' : 'Still offline')); } }, 'Sync now')),
    uploadPanel(),
    importPanel(),
    h('section', { class: 'panel' }, h('h2', null, 'Storage'), stats),
    standalone ? null : h('section', { class: 'panel' }, h('h2', null, 'Install on your phone'), h('p', { class: 'muted small' }, 'iPhone: open this page in Safari, tap Share, then Add to Home Screen. Open it from the new icon, and download your music while connected so it plays offline.')),
    h('section', { class: 'panel' }, h('h2', null, 'Account'), h('button', { class: 'btn ghost', onclick: async () => { if (await confirmBox({ title: 'Sign out?', message: 'Downloads stay on this device. You’ll need your password to sign back in.', okLabel: 'Sign out' })) { api.signOut(); core.bus.dispatchEvent(new CustomEvent('signedout')); } } }, icon('logout', 20), 'Sign out')),
  );
}
