// Entry point: sign-in, routing, connectivity, and service worker registration.
import * as api from './api.js';
import * as core from './core.js';
import * as player from './player.js';
import * as views from './views.js';
import { mountMiniPlayer } from './playerui.js';
import { clear, toast } from './ui.js';

const $ = (id) => document.getElementById(id);
const view = $('view');
const TAB_FOR = { songs: 'songs', albums: 'albums', album: 'albums', artists: 'artists', artist: 'artists', playlists: 'playlists', playlist: 'playlists', downloads: 'downloads', more: 'more' };

// ---------- routing ----------

function route() {
  const m = /^#\/([a-z]+)(?:\/(.*))?$/.exec(location.hash) || [];
  const name = m[1] || 'songs';
  const arg = m[2] ? decodeURIComponent(m[2]) : '';
  const screens = {
    songs: () => views.songsView(),
    albums: () => views.albumsView(),
    album: () => views.albumView(arg),
    artists: () => views.artistsView(),
    artist: () => views.artistView(arg),
    playlists: () => views.playlistsView(),
    playlist: () => views.playlistView(arg),
    downloads: () => views.downloadsView(),
    more: () => views.moreView(),
  };
  views.disposeView();
  clear(view);
  view.appendChild((screens[name] || screens.songs)());
  view.scrollTop = 0;
  const tab = TAB_FOR[name] || 'songs';
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
}

// ---------- sign-in ----------

function showLogin(message = '') {
  $('app').hidden = true;
  $('login').hidden = false;
  $('login-error').textContent = message;
  setTimeout(() => $('password').focus(), 50);
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = $('login-button');
  button.disabled = true;
  $('login-error').textContent = '';
  try {
    await api.login($('password').value);
    $('password').value = '';
    await startApp();
  } catch (err) {
    $('login-error').textContent =
      err instanceof api.OfflineError ? 'No connection. The first sign-in on a device needs internet.' : err.status === 429 ? 'Too many attempts. Try again in 15 minutes.' : err.code === 'not_configured' ? 'The server has no password set up yet.' : err.status === 401 ? 'Wrong password.' : 'Could not sign in.';
  }
  button.disabled = false;
});

api.onUnauthorized(() => showLogin('Your session ended. Sign in again.'));
core.bus.addEventListener('signedout', () => showLogin());

// ---------- app ----------

let started = false;

function paintBanner() {
  $('banner').hidden = core.state.online;
  document.body.classList.toggle('offline', !core.state.online);
}

async function startApp() {
  $('login').hidden = true;
  $('app').hidden = false;
  if (started) return route(), void core.refresh();
  started = true;

  await core.loadCached();
  mountMiniPlayer($('mini'));
  route();
  await player.restore();
  paintBanner();
  core.refresh();

  window.addEventListener('hashchange', route);
  core.bus.addEventListener('online', () => {
    paintBanner();
    views.repaintRows();
  });
  core.bus.addEventListener('downloads', views.repaintRows);
  core.bus.addEventListener('removed', (e) => player.trackRemoved(e.detail));
  player.events.addEventListener('track', views.repaintRows);

  window.addEventListener('online', () => {
    core.setOnline(true);
    core.refresh();
  });
  window.addEventListener('offline', () => core.setOnline(false));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - core.state.lastRefresh > 60_000) core.refresh();
  });
  // A failed request can flag us offline while the browser still reports a connection (weak signal,
  // iOS missing an "online" event). Keep trying quietly so the app recovers on its own.
  setInterval(() => {
    if (!core.state.online && document.visibilityState === 'visible') core.refresh();
  }, 30_000);

  player.events.addEventListener('message', (e) => toast(e.detail));
  player.events.addEventListener('duration', (e) => {
    const { track, duration } = e.detail;
    if (core.state.online && core.getTrack(track.id)) core.editTrack(track.id, { duration }).catch(() => {});
  });

  // Space toggles playback on a keyboard (laptop), unless typing in a field.
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || /^(INPUT|TEXTAREA|BUTTON|SELECT|A)$/.test(e.target.tagName)) return;
    e.preventDefault();
    player.toggle();
  });
}

// ---------- boot ----------

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) toast('A new version is ready.', { label: 'Reload', fn: () => location.reload() });
      });
    });
  }).catch(() => {});
}

registerServiceWorker();
if (api.hasToken()) startApp();
else showLogin();
