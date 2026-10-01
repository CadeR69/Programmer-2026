// Adding music: read tags and artwork in the browser, then send the file to the Worker (-> R2).
import * as api from './api.js';
import { addLocalTrack, updateLocalTrack } from './core.js';

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
export const MAX_BYTES = 100 * 1024 * 1024; // Cloudflare Workers request body limit

const extOf = (name) => (/\.([a-z0-9]{2,5})$/i.exec(name) || [])[1]?.toLowerCase() || '';
export const isAudioFile = (file) => !!MIME_BY_EXT[extOf(file.name)];

function readTags(file) {
  return new Promise((resolve) => {
    if (!window.jsmediatags) return resolve(null);
    try {
      window.jsmediatags.read(file, { onSuccess: (tag) => resolve(tag.tags || null), onError: () => resolve(null) });
    } catch {
      resolve(null);
    }
  });
}

function readDuration(file) {
  return new Promise((resolve) => {
    const el = new Audio();
    const url = URL.createObjectURL(file);
    const done = (value) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : 0);
    el.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    el.src = url;
  });
}

// Shrink embedded art to a 600px JPEG so covers stay small to store and fast to load.
async function coverBlob(picture) {
  if (!picture || !picture.data || !picture.data.length) return null;
  const original = new Blob([new Uint8Array(picture.data)], { type: picture.format || 'image/jpeg' });
  try {
    const bitmap = await createImageBitmap(original);
    const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return jpeg || original;
  } catch {
    return original.size < 5 * 1024 * 1024 ? original : null;
  }
}

const firstNumber = (v) => parseInt(String(v || '').split('/')[0], 10) || 0;

// Uploads files one at a time. onEvent({ file, status, pct?, error?, track? }) drives the UI.
export async function uploadFiles(files, onEvent, shouldStop = () => false) {
  const totals = { done: 0, duplicate: 0, failed: 0 };
  for (const file of files) {
    if (shouldStop()) break;
    if (!isAudioFile(file)) {
      totals.failed++;
      onEvent({ file, status: 'error', error: 'Not a supported audio file' });
      continue;
    }
    if (file.size > MAX_BYTES) {
      totals.failed++;
      onEvent({ file, status: 'error', error: 'Over the 100 MB per-file limit' });
      continue;
    }
    try {
      onEvent({ file, status: 'reading' });
      const [tags, duration] = await Promise.all([readTags(file), readDuration(file)]);
      const stem = file.name.replace(/\.[a-z0-9]{2,5}$/i, '');
      const meta = {
        title: (tags && tags.title) || stem,
        artist: (tags && tags.artist) || '',
        album: (tags && tags.album) || '',
        trackNo: firstNumber(tags && tags.track),
        year: firstNumber(tags && tags.year),
        duration: duration ? duration.toFixed(2) : '',
      };
      onEvent({ file, status: 'uploading', pct: 0 });
      const mime = MIME_BY_EXT[extOf(file.name)];
      const res = await api.uploadTrack(file, meta, mime, (pct) => onEvent({ file, status: 'uploading', pct }));
      if (res.duplicate) {
        totals.duplicate++;
        onEvent({ file, status: 'duplicate' });
        continue;
      }
      addLocalTrack(res.track);
      const cover = await coverBlob(tags && tags.picture);
      if (cover) {
        try {
          await api.putCover(res.track.id, cover);
          updateLocalTrack({ id: res.track.id, hasCover: true });
        } catch {
          /* art is optional; the track is already saved */
        }
      }
      totals.done++;
      onEvent({ file, status: 'done', track: res.track });
    } catch (err) {
      totals.failed++;
      const offline = err instanceof api.OfflineError;
      onEvent({ file, status: 'error', error: offline ? 'No connection' : err.code || err.message });
      if (offline) break;
    }
  }
  return totals;
}

// For libraries copied into the bucket under import/ (e.g. with rclone): register them in the database.
export async function importFromBucket(onProgress) {
  let cursor;
  let added = 0;
  let scanned = 0;
  do {
    const res = await api.importBucket(cursor);
    added += res.added;
    scanned += res.scanned;
    cursor = res.cursor;
    if (onProgress) onProgress({ added, scanned });
  } while (cursor);
  return { added, scanned };
}
