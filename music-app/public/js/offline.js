// On-device storage for downloaded audio and cover art, using the Cache API.
// Audio is played back by turning the cached Response into a blob: URL, which avoids the
// service-worker range-request problems Safari has with <audio> and cached media.
import * as api from './api.js';

const AUDIO_CACHE = 'cadence-audio-v1';
const COVER_CACHE = 'cadence-covers-v1';

const have = new Set();
const audioReq = (id) => new Request(`${location.origin}/_offline/audio/${id}`);
const coverReq = (id) => new Request(`${location.origin}/_offline/cover/${id}`);

export const isDownloaded = (id) => have.has(id);
export const downloadedIds = () => [...have];

export async function loadDownloaded() {
  try {
    const cache = await caches.open(AUDIO_CACHE);
    have.clear();
    for (const req of await cache.keys()) have.add(req.url.split('/').pop());
  } catch {
    /* Cache API unavailable: downloads simply won't work */
  }
}

export async function downloadTrack(track, onProgress) {
  const res = await api.fetchAudio(track.id);
  const total = Number(res.headers.get('content-length')) || track.size;
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (onProgress) onProgress(loaded, total);
  }
  if (track.size && loaded !== track.size) throw new Error('Download was incomplete');

  const blob = new Blob(chunks, { type: track.mime });
  const cache = await caches.open(AUDIO_CACHE);
  await cache.put(audioReq(track.id), new Response(blob, { headers: { 'content-type': track.mime, 'content-length': String(blob.size) } }));
  have.add(track.id);
  coverURL(track).catch(() => {}); // keep artwork available offline too
}

export async function removeDownload(id) {
  try {
    await (await caches.open(AUDIO_CACHE)).delete(audioReq(id));
  } catch {}
  have.delete(id);
}

export async function removeAllDownloads() {
  try {
    await caches.delete(AUDIO_CACHE);
  } catch {}
  have.clear();
}

export async function audioBlobURL(id) {
  try {
    const res = await (await caches.open(AUDIO_CACHE)).match(audioReq(id));
    if (res) return URL.createObjectURL(await res.blob());
  } catch {}
  have.delete(id); // index said we had it but the cache disagrees (e.g. iOS cleared storage)
  return null;
}

// ---------- cover art ----------

let active = 0;
const waiters = [];
async function withSlot(fn) {
  if (active >= 4) await new Promise((resolve) => waiters.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    const next = waiters.shift();
    if (next) next();
  }
}

const coverMemo = new Map();

export function coverURL(track) {
  if (!track || !track.hasCover) return Promise.resolve(null);
  if (coverMemo.has(track.id)) return coverMemo.get(track.id);
  const promise = (async () => {
    try {
      const cache = await caches.open(COVER_CACHE);
      const req = coverReq(track.id);
      let res = await cache.match(req);
      if (!res) {
        res = await withSlot(async () => {
          const fresh = await api.fetchCover(track.id);
          await cache.put(req, fresh.clone());
          return fresh;
        });
      }
      return URL.createObjectURL(await res.blob());
    } catch {
      coverMemo.delete(track.id); // try again next time (e.g. we were offline)
      return null;
    }
  })();
  coverMemo.set(track.id, promise);
  return promise;
}

export async function forgetCover(id) {
  coverMemo.delete(id);
  try {
    await (await caches.open(COVER_CACHE)).delete(coverReq(id));
  } catch {}
}

// ---------- storage info ----------

export async function usage() {
  try {
    const est = await navigator.storage.estimate();
    return { used: est.usage || 0, quota: est.quota || 0 };
  } catch {
    return { used: 0, quota: 0 };
  }
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch {}
  return false;
}
