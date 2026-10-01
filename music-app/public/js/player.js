// Playback engine: one <audio> element (so iOS keeps background playback going between tracks),
// a queue with shuffle/repeat, lock-screen controls via the Media Session API, and resume.
import { getTrack, isPlayable, setOnline, state } from './core.js';
import * as offline from './offline.js';
import * as api from './api.js';
import { kvGet, kvSet } from './store.js';

const audio = new Audio();
audio.preload = 'auto';

export const events = new EventTarget();
const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));

let base = []; // ids in the order they were handed to us
let queue = []; // ids in play order (shuffled when shuffle is on)
let index = -1;
let shuffle = false;
let repeat = 'off'; // 'off' | 'all' | 'one'
let current = null;
let loadToken = 0;
let activeBlob = null;
let ahead = null; // { id, url }: next track already decoded from the offline cache
let lastPersist = 0;

export const get = () => ({
  track: current,
  playing: !audio.paused && !audio.ended,
  time: audio.currentTime || 0,
  duration: Number.isFinite(audio.duration) ? audio.duration : current ? current.duration : 0,
  queue,
  index,
  shuffle,
  repeat,
});
export const currentTrack = () => current;

function shuffled(ids) {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function persist(force) {
  const now = Date.now();
  if (!force && now - lastPersist < 5000) return;
  lastPersist = now;
  kvSet('player', { base, queue, index, shuffle, repeat, time: audio.currentTime || 0 });
}

// ---------- loading a track ----------

async function resolve(track) {
  if (ahead && ahead.id === track.id) {
    const hit = ahead;
    ahead = null;
    return { url: hit.url, blob: true };
  }
  if (offline.isDownloaded(track.id)) {
    const url = await offline.audioBlobURL(track.id);
    if (url) return { url, blob: true };
  }
  if (state.online) {
    try {
      return { url: await api.streamUrl(track.id), blob: false };
    } catch (err) {
      if (err instanceof api.OfflineError) setOnline(false);
      else throw err;
    }
  }
  return null;
}

async function load(i, { autoplay = true, startAt = 0, quiet = false } = {}) {
  const track = getTrack(queue[i]);
  if (!track) return false;
  const token = ++loadToken;
  index = i;
  current = track;
  emit('track');

  let src = null;
  try {
    src = await resolve(track);
  } catch {
    src = null;
  }
  if (token !== loadToken) {
    if (src && src.blob) URL.revokeObjectURL(src.url);
    return false;
  }
  if (!src) {
    audio.pause();
    if (!quiet) emit('message', "Can't play that while offline. It isn't downloaded.");
    emit('state');
    return false;
  }

  const previous = activeBlob;
  activeBlob = src.blob ? src.url : null;
  audio.src = src.url;
  if (startAt) audio.addEventListener('loadedmetadata', () => (audio.currentTime = startAt), { once: true });
  if (previous) setTimeout(() => URL.revokeObjectURL(previous), 1500);

  if (autoplay) {
    try {
      await audio.play();
    } catch (err) {
      if (err && err.name !== 'AbortError') emit('message', 'Tap play to start. The browser blocked autoplay.');
    }
  }
  updateMediaSession();
  preloadAhead();
  persist(true);
  emit('state');
  return true;
}

async function preloadAhead() {
  const i = findIndex(index, 1, repeat === 'all');
  if (i < 0) return;
  const id = queue[i];
  if (!offline.isDownloaded(id) || (ahead && ahead.id === id)) return;
  const url = await offline.audioBlobURL(id);
  if (!url) return;
  if (ahead) URL.revokeObjectURL(ahead.url);
  ahead = { id, url };
}

function findIndex(from, dir, wrap) {
  const n = queue.length;
  for (let step = 1; step <= n; step++) {
    let i = from + dir * step;
    if (i < 0 || i >= n) {
      if (!wrap) return -1;
      i = ((i % n) + n) % n;
    }
    const track = getTrack(queue[i]);
    if (track && isPlayable(track.id)) return i;
  }
  return -1;
}

// ---------- public controls ----------

export function playList(ids, start = 0, { shuffleOn } = {}) {
  if (!ids.length) return;
  if (typeof shuffleOn === 'boolean') shuffle = shuffleOn;
  base = ids.slice();
  if (shuffle) {
    const first = ids[start];
    queue = [first, ...shuffled(ids.filter((_, i) => i !== start))];
    index = 0;
  } else {
    queue = base.slice();
    index = start;
  }
  load(index);
}

export function shufflePlay(ids) {
  playList(ids, Math.floor(Math.random() * ids.length), { shuffleOn: true });
}

export function jump(i) {
  if (i >= 0 && i < queue.length) load(i);
}

export async function next(auto = false) {
  if (!queue.length) return;
  if (auto && repeat === 'one') {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  const i = findIndex(index, 1, repeat === 'all');
  if (i < 0) {
    if (auto) {
      audio.pause();
      audio.currentTime = 0;
      emit('state');
    }
    return;
  }
  load(i);
}

export function prev() {
  if (!queue.length) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const i = findIndex(index, -1, repeat === 'all');
  if (i < 0) audio.currentTime = 0;
  else load(i);
}

export function toggle() {
  if (!current) return;
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

export const seek = (t) => {
  if (Number.isFinite(t)) audio.currentTime = t;
};

export function setShuffle(on) {
  shuffle = on;
  const id = queue[index];
  if (on) {
    queue = id ? [id, ...shuffled(base.filter((x) => x !== id))] : shuffled(base);
    index = id ? 0 : -1;
  } else {
    queue = base.slice();
    index = Math.max(0, queue.indexOf(id));
  }
  emit('state');
  persist(true);
}

export function cycleRepeat() {
  repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
  emit('state');
  persist(true);
}

export function playNext(id) {
  if (!queue.length) return playList([id]);
  queue.splice(index + 1, 0, id);
  const at = base.indexOf(queue[index]);
  base.splice(at + 1, 0, id);
  emit('state');
}

export function enqueue(id) {
  if (!queue.length) return playList([id]);
  queue.push(id);
  base.push(id);
  emit('state');
}

export function trackRemoved(id) {
  base = base.filter((x) => x !== id);
  const wasCurrent = queue[index] === id;
  queue = queue.filter((x) => x !== id);
  if (wasCurrent) {
    audio.pause();
    current = null;
    index = -1;
    emit('track');
  } else {
    index = queue.indexOf(current && current.id);
  }
  emit('state');
}

export async function restore() {
  const saved = await kvGet('player');
  if (!saved || !Array.isArray(saved.queue) || !saved.queue.length) return;
  const currentId = saved.queue[saved.index];
  queue = saved.queue.filter((id) => getTrack(id));
  base = (saved.base || saved.queue).filter((id) => getTrack(id));
  index = queue.indexOf(currentId);
  if (index < 0) {
    queue = [];
    base = [];
    return;
  }
  shuffle = !!saved.shuffle;
  repeat = saved.repeat || 'off';
  await load(index, { autoplay: false, startAt: saved.time || 0, quiet: true });
}

// ---------- audio element events ----------

audio.addEventListener('ended', () => next(true));
audio.addEventListener('play', () => emit('state'));
audio.addEventListener('playing', () => emit('state'));
audio.addEventListener('waiting', () => emit('state'));
audio.addEventListener('pause', () => {
  emit('state');
  persist(true);
});
audio.addEventListener('timeupdate', () => {
  emit('time');
  persist(false);
  updatePosition();
});
audio.addEventListener('loadedmetadata', () => {
  emit('time');
  if (current && Number.isFinite(audio.duration) && Math.abs(audio.duration - current.duration) > 2) {
    emit('duration', { track: current, duration: audio.duration });
  }
});
audio.addEventListener('error', () => {
  if (audio.src && current) emit('message', 'That track failed to play.');
});

// ---------- lock screen / media keys ----------

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !current) return;
  const track = current;
  const meta = (artwork) => new MediaMetadata({ title: track.title, artist: track.artist, album: track.album, artwork });
  navigator.mediaSession.metadata = meta([]);
  offline.coverURL(track).then((url) => {
    if (url && current === track) navigator.mediaSession.metadata = meta([{ src: url, sizes: '600x600', type: 'image/jpeg' }]);
  });
}

let lastPosition = 0;
function updatePosition() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  const now = Date.now();
  if (now - lastPosition < 1000 || !Number.isFinite(audio.duration)) return;
  lastPosition = now;
  try {
    navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: audio.playbackRate });
  } catch {}
}

if ('mediaSession' in navigator) {
  const set = (action, fn) => {
    try {
      navigator.mediaSession.setActionHandler(action, fn);
    } catch {}
  };
  set('play', () => audio.play().catch(() => {}));
  set('pause', () => audio.pause());
  set('previoustrack', () => prev());
  set('nexttrack', () => next());
  set('seekto', (d) => seek(d.seekTime));
  set('seekbackward', (d) => seek(audio.currentTime - (d.seekOffset || 10)));
  set('seekforward', (d) => seek(audio.currentTime + (d.seekOffset || 10)));
}
