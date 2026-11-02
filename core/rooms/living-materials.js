import { materialMotion, materialSpring, fragmentSeeds, fragmentPoint, clamp01 } from './living-materials-physics.js';
import { createPaperLayer } from './paper-layer.js';

// An explicit, occasional artwork gesture. It never owns image navigation,
// scrolling, the Coverflow clock, or a persistent animation loop.
export function createArtworkMaterials({ stage, controls, getArtwork, getPalette, isBusy, feedback }) {
  const motion = matchMedia('(prefers-reduced-motion:reduce)');
  const transparency = matchMedia('(prefers-reduced-transparency:reduce)');
  const layer = document.createElement('div'); layer.className = 'living-material-layer'; layer.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas'); layer.append(canvas); stage.append(layer);
  const ctx = canvas.getContext('2d');
  const button = document.createElement('button'); button.type = 'button'; button.className = 'living-material-trigger'; button.dataset.ctControl = 'icon';
  button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="7.5" stroke-dasharray="1 3" stroke-linecap="round"/><circle cx="12" cy="12" r="3"/><path d="M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2"/></svg>';
  controls.append(button);
  const status = document.createElement('span'); status.className = 'sr-only'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); controls.append(status);
  const paper = createPaperLayer(layer);
  let raf = 0, start = 0, lastTime = null, lastStart = -Infinity, run = 0, disposed = false, inView = true;
  let spring = { x: 0, v: 0 }, target = 0, layout = null, image = null, artSurface = null, seeds = [], quality = 1, expensiveFrames = 0, phase = 'idle', renders = 0;
  const removers = [];
  const on = (node, event, callback, options) => { node.addEventListener(event, callback, options); removers.push(() => node.removeEventListener(event, callback, options)); };
  const english = () => document.documentElement.dataset.locale === 'en';
  const say = (zh, en) => { status.textContent = english() ? en : zh; };
  function sync() {
    const title = english() ? 'Unfold this artwork' : '展开这张作品'; button.setAttribute('aria-label', title); button.title = title;
    button.hidden = !ctx || motion.matches || transparency.matches;
    const art = getArtwork(), available = art?.dataset.image === 'loaded';
    button.disabled = !available || isBusy() || phase === 'loading' || disposed;
  }
  function clear() {
    if (raf) cancelAnimationFrame(raf); raf = 0; lastTime = null;
    if (artSurface) artSurface.style.removeProperty('opacity');
    artSurface = null; paper.hide(); layer.hidden = true;
    if (ctx && layout) ctx.clearRect(0, 0, layout.width, layout.height);
    layer.removeAttribute('data-active'); button.removeAttribute('aria-busy'); spring = { x: 0, v: 0 }; target = 0; phase = 'idle';
  }
  function cancel() { run++; clear(); sync(); }
  function measure(art) {
    const s = stage.getBoundingClientRect(), a = art.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.25);
    const radius = Math.min(s.width * .38, s.height * .44);
    layout = { width: s.width, height: s.height, cx: a.left - s.left + a.width / 2, cy: a.top - s.top + a.height / 2, artWidth: a.width, artHeight: a.height, radius, dpr };
    canvas.width = Math.max(1, Math.round(s.width * dpr)); canvas.height = Math.max(1, Math.round(s.height * dpr));
    canvas.style.width = s.width + 'px'; canvas.style.height = s.height + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seeds = fragmentSeeds(innerWidth <= 740 ? 16 : 22); paper.layout(layout);
  }
  function fallbackSphere(p, palette) {
    const { cx, cy, radius } = layout, r = radius * (.62 + .38 * p), step = innerWidth <= 740 ? 8 : 9;
    ctx.fillStyle = palette[1] || palette[0];
    for (let y = -r; y <= r; y += step) for (let x = -r; x <= r; x += step) {
      const nx = x / r, ny = y / r, rr = nx * nx + ny * ny; if (rr > 1) continue;
      const z = Math.sqrt(1 - rr), shade = Math.max(0, -.35 * nx - .4 * ny + .72 * z);
      const rank = ((Math.round((x + r) / step) * 73 + Math.round((y + r) / step) * 151) % 16) / 16;
      if (rank > shade) continue;
      const size = 1.5 + 1.8 * shade; ctx.globalAlpha = (.2 + .55 * shade) * p;
      ctx.fillRect(cx + x - size / 2, cy + y - size / 2, size, size);
    }
  }
  function draw(now) {
    renders++; const p = clamp01(spring.x), palette = getPalette();
    ctx.clearRect(0, 0, layout.width, layout.height); artSurface.style.opacity = String(1 - .78 * p);
    const official = paper.render(p, now, palette);
    if (!official && p > .001) fallbackSphere(p, palette);
    const stride = quality < 1 ? 3 : 1, iw = image.naturalWidth, ih = image.naturalHeight;
    const geom = { cx: layout.cx, cy: layout.cy, width: layout.artWidth, height: layout.artHeight, radius: layout.radius };
    for (let i = 0; i < seeds.length; i += stride) {
      const seed = seeds[i], point = fragmentPoint(seed, p, geom), projection = 700 / (700 - point.z);
      const w = layout.artWidth / seed.grid * projection * (1 - .18 * p), h = layout.artHeight / seed.grid * projection * (1 - .18 * p);
      ctx.globalAlpha = .8 - .44 * p;
      ctx.drawImage(image, seed.col / seed.grid * iw, seed.row / seed.grid * ih, iw / seed.grid, ih / seed.grid, point.x - w / 2, point.y - h / 2, w + .25, h + .25);
    }
    ctx.globalAlpha = 1;
  }
  function tick(now) {
    raf = 0;
    if (disposed || document.hidden || !inView || motion.matches || transparency.matches || isBusy() || document.querySelector('dialog[open]')) { cancel(); return; }
    const gap = lastTime === null ? 0 : now - lastTime; lastTime = now;
    if (gap > 65) { expensiveFrames++; quality = .4; paper.reduce(); }
    if (expensiveFrames >= 3 || now - start > materialMotion.maximumMs) { cancel(); return; }
    if (now - start >= materialMotion.releaseAtMs) { target = 0; phase = 'gathering'; }
    spring = materialSpring(spring, target, Math.max(0, Math.min(gap, 50)) / 1000);
    draw(now);
    if (target === 0 && Math.abs(spring.x) < .0015 && Math.abs(spring.v) < .012) {
      clear(); sync(); say('已合拢，点图片即可阅读。', 'Artwork restored. Open the image to read.'); return;
    }
    raf = requestAnimationFrame(tick);
  }
  async function trigger() {
    sync(); if (button.disabled || button.hidden || document.hidden || !inView) return false;
    const now = performance.now(); if (now - lastStart < materialMotion.cooldownMs) return false;
    cancel(); const token = ++run; const art = getArtwork(); image = art?.querySelector('.living-official');
    if (!image?.naturalWidth || !image?.naturalHeight) return false;
    phase = 'loading'; button.setAttribute('aria-busy', 'true'); sync(); feedback?.('selection.step');
    // Dynamic import/compilation happens only after an explicit request. The
    // unresolved promise cannot restart an abandoned or navigated-away gesture.
    await paper.ensure(() => !disposed && token === run && !isBusy() && !document.hidden && inView && !motion.matches && !transparency.matches);
    if (disposed || token !== run || art !== getArtwork() || isBusy() || document.hidden || !inView || motion.matches || transparency.matches) { if (token === run) cancel(); return false; }
    layer.hidden = false; measure(art); artSurface = art.querySelector('.living-art-surface');
    layer.dataset.active = 'true'; phase = 'dispersing';
    button.removeAttribute('aria-busy'); spring = { x: 0, v: 2.4 }; target = 1; quality = 1; expensiveFrames = 0;
    start = lastStart = performance.now(); lastTime = start; say('作品向四周展开，再聚合。', 'Artwork unfolds in all directions, then gathers.');
    sync(); raf = requestAnimationFrame(tick); return true;
  }
  on(button, 'click', trigger);
  on(stage, 'pointerdown', cancel, { passive: true });
  on(window, 'scroll', () => { if (phase !== 'idle') cancel(); }, { passive: true });
  on(window, 'resize', cancel, { passive: true });
  on(window, 'blur', cancel);
  on(document, 'visibilitychange', () => { if (document.hidden) cancel(); });
  on(document, 'ct:locale-change', sync);
  on(motion, 'change', cancel); on(transparency, 'change', cancel);
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => { inView = entries[0].isIntersecting; if (!inView) cancel(); }, { threshold: .05 }) : null;
  observer?.observe(stage);
  const modalObserver = new MutationObserver(() => { if (document.querySelector('dialog[open]')) cancel(); });
  document.querySelectorAll('dialog').forEach(dialog => modalObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  on(window, 'pagehide', event => { cancel(); if (!event.persisted) dispose(); });
  function dispose() { if (disposed) return; cancel(); disposed = true; removers.splice(0).forEach(remove => remove()); observer?.disconnect(); modalObserver.disconnect(); paper.dispose(); layer.remove(); button.remove(); status.remove(); }
  function state() { return { phase, rafScheduled: !!raf, renders, run, quality, expensiveFrames, spring: { ...spring }, paper: paper.state(), optional: true, autoplay: false, noPixelReadback: true }; }
  clear(); sync(); return { trigger, cancel, sync, state, dispose };
}
