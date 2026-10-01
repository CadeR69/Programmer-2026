// Thin client for the Worker API. Network failures become OfflineError so callers can tell
// "no connection" apart from "server said no".
const TOKEN_KEY = 'cadence.token';
const JSON_HEADERS = { 'content-type': 'application/json' };

export class ApiError extends Error {
  constructor(status, code) {
    super(code || `HTTP ${status}`);
    this.status = status;
    this.code = code || '';
  }
}
export class OfflineError extends Error {}

let token = '';
try {
  token = localStorage.getItem(TOKEN_KEY) || '';
} catch {}

const unauthorizedHandlers = new Set();
export const onUnauthorized = (fn) => unauthorizedHandlers.add(fn);
export const hasToken = () => !!token;
export const authHeaders = () => ({ authorization: `Bearer ${token}` });

export function signOut() {
  token = '';
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function expired() {
  if (!token) return;
  signOut();
  unauthorizedHandlers.forEach((fn) => fn());
}

async function send(path, init) {
  try {
    return await fetch(path, init);
  } catch {
    throw new OfflineError('offline');
  }
}

async function errorFrom(res) {
  let code = '';
  try {
    code = (await res.json()).error || '';
  } catch {}
  return new ApiError(res.status, code);
}

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await send(path, { method, body, headers: { ...authHeaders(), ...headers } });
  if (res.status === 401) expired();
  if (!res.ok) throw await errorFrom(res);
  return res;
}

const callJson = async (path, opts) => (await call(path, opts)).json();

export async function login(password) {
  const res = await send('/api/login', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ password }) });
  if (!res.ok) throw await errorFrom(res);
  token = (await res.json()).token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export const getLibrary = () => callJson('/api/library');
export const streamUrl = async (id) => (await callJson(`/api/tracks/${id}/stream-url`)).url;
export const syncPlaylists = (playlists) => callJson('/api/sync', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ playlists }) });
export const patchTrack = (id, patch) => callJson(`/api/tracks/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(patch) });
export const deleteTrack = (id) => callJson(`/api/tracks/${id}`, { method: 'DELETE' });
export const importBucket = (cursor) => callJson('/api/import', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ cursor }) });
export const putCover = (id, blob) => call(`/api/tracks/${id}/cover`, { method: 'PUT', headers: { 'content-type': blob.type || 'image/jpeg' }, body: blob });
export const fetchCover = (id) => call(`/api/tracks/${id}/cover`);
export const fetchAudio = (id) => call(`/api/audio/${id}`);

// XHR (not fetch) so we get upload progress events.
export function uploadTrack(file, meta, mime, onProgress) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ filename: file.name });
    for (const [k, v] of Object.entries(meta)) if (v !== '' && v != null) params.set(k, String(v));
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/upload?${params}`);
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('content-type', mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
      if (xhr.status === 401) expired();
      reject(new ApiError(xhr.status, body.error));
    };
    xhr.onerror = () => reject(new OfflineError('offline'));
    xhr.send(file);
  });
}
