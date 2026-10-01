// Mini player bar and the full-screen Now Playing sheet.
import { h, icon, clear, fmtTime } from './ui.js';
import { cover } from './art.js';
import * as player from './player.js';
import * as core from './core.js';
import * as offline from './offline.js';

const on = (type, fn) => player.events.addEventListener(type, fn);
const off = (type, fn) => player.events.removeEventListener(type, fn);

export function mountMiniPlayer(host) {
  const art = h('div', { class: 'mini-art' });
  const title = h('div', { class: 'title' });
  const sub = h('div', { class: 'sub' });
  const toggle = h('button', { class: 'icon-btn', 'aria-label': 'Play or pause', onclick: (e) => { e.stopPropagation(); player.toggle(); } });
  const fill = h('div', { class: 'fill' });
  host.append(h('div', { class: 'mini-progress' }, fill), h('div', { class: 'mini-body' }, art, h('div', { class: 'meta' }, title, sub), toggle));
  host.addEventListener('click', openNowPlaying);

  const paintState = () => {
    const s = player.get();
    host.hidden = !s.track;
    if (!s.track) return;
    clear(toggle);
    toggle.appendChild(icon(s.playing ? 'pause' : 'play', 30));
  };
  const paintTrack = () => {
    const t = player.currentTrack();
    clear(art);
    if (t) art.appendChild(cover(t, 'sm'));
    title.textContent = t ? t.title : '';
    sub.textContent = t ? t.artist || t.album || ' ' : '';
    paintState();
  };
  const paintTime = () => {
    const s = player.get();
    fill.style.width = s.duration ? `${Math.min(100, (s.time / s.duration) * 100)}%` : '0%';
  };
  on('track', paintTrack);
  on('state', paintState);
  on('time', paintTime);
  paintTrack();
}

export function openNowPlaying() {
  if (document.getElementById('np') || !player.currentTrack()) return;

  const artBox = h('div', { class: 'np-art' });
  const titleEl = h('h2');
  const artistEl = h('p', { class: 'muted' });
  const likeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Like' });
  const savedEl = h('span', { class: 'np-saved muted small' });
  const cur = h('span', { class: 'small muted' }, '0:00');
  const dur = h('span', { class: 'small muted' }, '0:00');
  const range = h('input', { type: 'range', min: '0', max: '1000', value: '0', class: 'seek', 'aria-label': 'Seek' });
  const playBtn = h('button', { class: 'play-btn', 'aria-label': 'Play or pause', onclick: () => player.toggle() });
  const shuffleBtn = h('button', { class: 'icon-btn', 'aria-label': 'Shuffle', onclick: () => player.setShuffle(!player.get().shuffle) }, icon('shuffle', 24));
  const repeatBtn = h('button', { class: 'icon-btn', 'aria-label': 'Repeat', onclick: () => player.cycleRepeat() }, icon('repeat', 24));
  const repeatBadge = h('span', { class: 'badge' });
  repeatBtn.appendChild(repeatBadge);
  const queueEl = h('div', { class: 'np-queue', hidden: true });
  const queueBtn = h('button', { class: 'icon-btn', 'aria-label': 'Queue', onclick: () => { queueEl.hidden = !queueEl.hidden; queueBtn.classList.toggle('on', !queueEl.hidden); } }, icon('queue', 24));

  let dragging = false;
  range.addEventListener('input', () => {
    dragging = true;
    paintRange();
    cur.textContent = fmtTime((range.value / 1000) * (player.get().duration || 0));
  });
  range.addEventListener('change', () => {
    player.seek((range.value / 1000) * (player.get().duration || 0));
    dragging = false;
  });

  likeBtn.addEventListener('click', () => {
    const t = player.currentTrack();
    if (t) core.toggleLike(t.id);
    paintLike();
  });

  const paintLike = () => {
    const t = player.currentTrack();
    const liked = !!t && core.isLiked(t.id);
    clear(likeBtn);
    likeBtn.appendChild(icon(liked ? 'heart-fill' : 'heart', 28));
    likeBtn.classList.toggle('liked', liked);
    savedEl.textContent = t && offline.isDownloaded(t.id) ? 'Downloaded' : t && !core.state.online ? 'Streaming unavailable offline' : '';
  };

  const paintQueue = () => {
    const s = player.get();
    clear(queueEl);
    const upcoming = s.queue.slice(s.index + 1, s.index + 51);
    queueEl.appendChild(h('h3', null, upcoming.length ? 'Next up' : 'End of queue'));
    upcoming.forEach((id, k) => {
      const t = core.getTrack(id);
      if (!t) return;
      queueEl.appendChild(
        h('div', { class: 'row' + (core.isPlayable(id) ? '' : ' dim'), role: 'button', tabindex: '0', onclick: () => player.jump(s.index + 1 + k) }, cover(t, 'sm'), h('div', { class: 'meta' }, h('div', { class: 'title' }, t.title), h('div', { class: 'sub' }, t.artist))),
      );
    });
  };

  const paintTrack = () => {
    const t = player.currentTrack();
    if (!t) return close();
    clear(artBox);
    artBox.appendChild(cover(t, 'xl'));
    titleEl.textContent = t.title;
    artistEl.textContent = [t.artist, t.album].filter(Boolean).join(' · ');
    paintLike();
    paintQueue();
  };

  const paintState = () => {
    const s = player.get();
    clear(playBtn);
    playBtn.appendChild(icon(s.playing ? 'pause' : 'play', 40));
    shuffleBtn.classList.toggle('on', s.shuffle);
    repeatBtn.classList.toggle('on', s.repeat !== 'off');
    repeatBadge.textContent = s.repeat === 'one' ? '1' : '';
    paintQueue();
  };

  const paintTime = () => {
    if (dragging) return;
    const s = player.get();
    cur.textContent = fmtTime(s.time);
    dur.textContent = fmtTime(s.duration);
    range.value = s.duration ? String(Math.round((s.time / s.duration) * 1000)) : '0';
    paintRange();
  };
  const paintRange = () => range.style.setProperty('--pct', `${range.value / 10}%`);

  const onKey = (e) => e.key === 'Escape' && close();
  const onLikes = () => paintLike();
  function close() {
    off('track', paintTrack);
    off('state', paintState);
    off('time', paintTime);
    core.bus.removeEventListener('playlists', onLikes);
    core.bus.removeEventListener('downloads', onLikes);
    document.removeEventListener('keydown', onKey);
    el.remove();
  }

  const el = h(
    'div',
    { class: 'np', id: 'np', role: 'dialog', 'aria-label': 'Now playing' },
    h('div', { class: 'np-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon('down', 30)), h('span', { class: 'muted small' }, 'Now playing'), queueBtn),
    artBox,
    h('div', { class: 'np-info' }, h('div', { class: 'np-titles' }, titleEl, artistEl, savedEl), likeBtn),
    h('div', { class: 'np-seek' }, range, h('div', { class: 'np-times' }, cur, dur)),
    h('div', { class: 'np-controls' }, shuffleBtn, h('button', { class: 'icon-btn', 'aria-label': 'Previous', onclick: () => player.prev() }, icon('prev', 34)), playBtn, h('button', { class: 'icon-btn', 'aria-label': 'Next', onclick: () => player.next() }, icon('next', 34)), repeatBtn),
    queueEl,
  );

  on('track', paintTrack);
  on('state', paintState);
  on('time', paintTime);
  core.bus.addEventListener('playlists', onLikes);
  core.bus.addEventListener('downloads', onLikes);
  document.addEventListener('keydown', onKey);
  document.getElementById('overlays').appendChild(el);
  paintTrack();
  paintState();
  paintTime();
}
