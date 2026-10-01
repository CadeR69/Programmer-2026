import { h, icon, hueFor, onVisible } from './ui.js';
import * as offline from './offline.js';

// Square artwork tile: a coloured placeholder until the real cover (cached on-device) loads.
export function cover(track, size = 'sm') {
  const seed = track ? track.album || track.title || '' : '';
  const el = h('div', { class: `cover ${size}`, style: { '--hue': String(hueFor(seed)) } }, icon('note', size === 'lg' ? 56 : 22));
  if (track && track.hasCover) {
    onVisible(el, async () => {
      const url = await offline.coverURL(track);
      if (url) {
        el.style.backgroundImage = `url("${url}")`;
        el.classList.add('has-art');
      }
    });
  }
  return el;
}
