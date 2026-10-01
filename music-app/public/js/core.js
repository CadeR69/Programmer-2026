// App state: the library, playlists, downloads and sync. Everything the UI shows is read from
// the local copy (IndexedDB + Cache API) so the app works fully offline; the network only
// refreshes it.
import * as api from './api.js';
import * as offline from './offline.js';
import { kvGet, kvSet } from './store.js';

export const bus = new EventTarget();
const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

export const state = {
  tracks: [],
  byId: new Map(),
  playlists: [], // includes deleted tombstones so deletions sync
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  lastRefresh: 0,
};

export const LIKED = 'liked';
export const getTrack = (id) => state.byId.get(id);
export const isPlayable = (id) => offline.isDownloaded(id) || state.online;

export function setOnline(value) {
  if (state.online === value) return;
  state.online = value;
  emit('online');
}

function setTracks(tracks) {
  state.tracks = tracks;
  state.byId = new Map(tracks.map((t) => [t.id, t]));
  albumMemo = null;
}

// ---------- loading and syncing ----------

export async function loadCached() {
  const [tracks, playlists] = await Promise.all([kvGet('library', []), kvGet('playlists', [])]);
  setTracks(tracks);
  state.playlists = playlists;
  await offline.loadDownloaded();
  emit('library');
}

function mergePlaylists(local, remote) {
  const byId = new Map(remote.map((p) => [p.id, p]));
  for (const p of local) {
    const other = byId.get(p.id);
    if (!other || p.updatedAt > other.updatedAt) byId.set(p.id, p);
  }
  return [...byId.values()];
}

export async function refresh() {
  if (state.syncing || !api.hasToken()) return;
  state.syncing = true;
  emit('syncing');
  try {
    const synced = await api.syncPlaylists(state.playlists);
    const lib = await api.getLibrary();
    state.playlists = mergePlaylists(state.playlists, synced.playlists);
    setTracks(lib.tracks);
    state.lastRefresh = Date.now();
    await Promise.all([kvSet('library', lib.tracks), kvSet('playlists', state.playlists)]);
    setOnline(true);
    emit('library');
    emit('playlists');
  } catch (err) {
    if (err instanceof api.OfflineError) setOnline(false);
    else if (!(err instanceof api.ApiError && err.status === 401)) console.warn('refresh failed', err);
  } finally {
    state.syncing = false;
    emit('syncing');
  }
}

let syncTimer = 0;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    state.lastRefresh = 0;
    refresh();
  }, 1500);
}

export async function resetLocal() {
  setTracks([]);
  state.playlists = [];
  await Promise.all([kvSet('library', []), kvSet('playlists', []), kvSet('player', null), offline.removeAllDownloads()]);
  emit('library');
  emit('playlists');
}

// ---------- albums / artists ----------

let albumMemo = null;

export function albums() {
  if (albumMemo) return albumMemo;
  const map = new Map();
  for (const t of state.tracks) {
    const key = `${(t.album || '').toLowerCase()}\u0001${(t.artist || '').toLowerCase()}`;
    let a = map.get(key);
    if (!a) {
      a = { key, album: t.album || 'Unknown album', artist: t.artist || 'Unknown artist', tracks: [] };
      map.set(key, a);
    }
    a.tracks.push(t);
  }
  const list = [...map.values()];
  for (const a of list) {
    a.tracks.sort((x, y) => x.trackNo - y.trackNo || x.title.localeCompare(y.title));
    a.coverTrack = a.tracks.find((t) => t.hasCover) || a.tracks[0];
  }
  list.sort((x, y) => x.album.localeCompare(y.album) || x.artist.localeCompare(y.artist));
  return (albumMemo = list);
}

export function artists() {
  const map = new Map();
  for (const t of state.tracks) {
    const name = t.artist || 'Unknown artist';
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(t);
  }
  return [...map.entries()].map(([name, tracks]) => ({ name, tracks })).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- playlists ----------

function touch(playlist) {
  playlist.updatedAt = Date.now();
  kvSet('playlists', state.playlists);
  emit('playlists');
  scheduleSync();
}

export function liked() {
  let p = state.playlists.find((x) => x.id === LIKED);
  if (!p) {
    p = { id: LIKED, name: 'Liked Songs', trackIds: [], updatedAt: 0, deleted: false };
    state.playlists.push(p);
  }
  return p;
}

export const userPlaylists = () => state.playlists.filter((p) => !p.deleted && p.id !== LIKED).sort((a, b) => b.updatedAt - a.updatedAt);
export const getPlaylist = (id) => (id === LIKED ? liked() : state.playlists.find((p) => p.id === id && !p.deleted));
export const playlistTracks = (p) => p.trackIds.map(getTrack).filter(Boolean);
export const isLiked = (id) => liked().trackIds.includes(id);

export function toggleLike(id) {
  const p = liked();
  p.trackIds = p.trackIds.includes(id) ? p.trackIds.filter((x) => x !== id) : [id, ...p.trackIds];
  p.deleted = false;
  touch(p);
}

export function createPlaylist(name, trackIds = []) {
  const p = { id: `pl-${crypto.randomUUID()}`, name, trackIds: [...new Set(trackIds)], updatedAt: 0, deleted: false };
  state.playlists.push(p);
  touch(p);
  return p;
}

export function renamePlaylist(id, name) {
  const p = getPlaylist(id);
  if (!p) return;
  p.name = name;
  touch(p);
}

export function deletePlaylist(id) {
  const p = getPlaylist(id);
  if (!p) return;
  p.deleted = true;
  p.trackIds = [];
  touch(p);
}

export function addToPlaylist(id, trackIds) {
  const p = getPlaylist(id);
  if (!p) return 0;
  const fresh = trackIds.filter((t) => !p.trackIds.includes(t));
  p.trackIds = [...p.trackIds, ...fresh];
  touch(p);
  return fresh.length;
}

export function removeFromPlaylist(id, trackId) {
  const p = getPlaylist(id);
  if (!p) return;
  p.trackIds = p.trackIds.filter((t) => t !== trackId);
  touch(p);
}

// ---------- track edits ----------

export function addLocalTrack(track) {
  if (state.byId.has(track.id)) return;
  setTracks([...state.tracks, track].sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || a.trackNo - b.trackNo));
  kvSet('library', state.tracks);
  emit('library');
}

export function updateLocalTrack(track) {
  setTracks(state.tracks.map((t) => (t.id === track.id ? { ...t, ...track } : t)));
  kvSet('library', state.tracks);
  emit('library');
}

export async function editTrack(id, patch) {
  const { track } = await api.patchTrack(id, patch);
  updateLocalTrack(track);
}

export async function removeTrack(id) {
  await api.deleteTrack(id);
  await Promise.all([offline.removeDownload(id), offline.forgetCover(id)]);
  setTracks(state.tracks.filter((t) => t.id !== id));
  kvSet('library', state.tracks);
  emit('library');
  emit('downloads');
  emit('removed', id);
}

// ---------- downloads ----------

export const dl = new Map(); // id -> { loaded, total } for in-flight downloads
let emitTimer = 0;
function emitDownloadsSoon() {
  if (emitTimer) return;
  emitTimer = setTimeout(() => {
    emitTimer = 0;
    emit('downloads');
  }, 200);
}

export async function download(ids) {
  const queue = ids.filter((id) => getTrack(id) && !offline.isDownloaded(id) && !dl.has(id));
  const result = { ok: 0, failed: 0, quota: false, offline: false };
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      const track = getTrack(id);
      const entry = { loaded: 0, total: track.size };
      dl.set(id, entry);
      emit('downloads');
      try {
        await offline.downloadTrack(track, (loaded) => {
          entry.loaded = loaded;
          emitDownloadsSoon();
        });
        result.ok++;
      } catch (err) {
        result.failed++;
        if (err && err.name === 'QuotaExceededError') {
          result.quota = true;
          queue.length = 0;
        }
        if (err instanceof api.OfflineError) {
          result.offline = true;
          queue.length = 0;
        }
      }
      dl.delete(id);
      emit('downloads');
    }
  };
  await Promise.all([worker(), worker()]);
  return result;
}

export async function removeDownloads(ids) {
  await Promise.all(ids.map((id) => offline.removeDownload(id)));
  emit('downloads');
}
