// The official Paper modules below remain byte-for-byte original; see NOTICE.
import { materialBudget } from './living-materials-physics.js';

export function createPaperLayer(parent) {
  let mount = null, host = null, task = null, status = 'idle', reason = null;
  let disposed = false, renders = 0, frame = 0, lastRender = -Infinity, quality = 1, colorKey = '';
  const mobile = () => innerWidth <= 740;
  const state = () => ({ status, reason, renders, frame, quality, width: mount?.canvasElement.width || 0, height: mount?.canvasElement.height || 0, ownAnimationLoop: false });
  const budget = () => materialBudget({ width: host?.clientWidth || 1, height: host?.clientHeight || 1, mobile: mobile(), quality });
  function hide() { if (host) host.style.opacity = '0'; lastRender = -Infinity; }
  function fallback(why) { reason = why; status = 'fallback'; hide(); try { mount?.dispose(); } catch {} mount = null; }
  async function ensure(shouldProceed = () => true) {
    if (disposed) return false;
    if (task) return task;
    status = 'loading'; host = document.createElement('div'); host.className = 'living-paper-sphere';
    host.setAttribute('aria-hidden', 'true'); parent.prepend(host);
    task = (async () => {
      try {
        const [{ ShaderMount }, { ditheringFragmentShader, DitheringShapes, DitheringTypes }, { ShaderFitOptions }] = await Promise.all([
          import('./official-paper/vendor/paper-shaders-0.0.82/dist/shader-mount.js'),
          import('./official-paper/vendor/paper-shaders-0.0.82/dist/shaders/dithering.js'),
          import('./official-paper/vendor/paper-shaders-0.0.82/dist/shader-sizing.js'),
        ]);
        if (disposed || !shouldProceed()) {
          host?.remove(); host = null; task = null;
          if (!disposed) status = 'idle';
          return false;
        }
        mount = new ShaderMount(host, ditheringFragmentShader, {
          u_colorBack: [0, 0, 0, 0], u_colorFront: [0, 0, 0, 0],
          u_shape: DitheringShapes.sphere, u_type: DitheringTypes['4x4'], u_pxSize: 2,
          u_scale: .94, u_rotation: 0, u_offsetX: 0, u_offsetY: 0,
          u_originX: .5, u_originY: .5, u_worldWidth: 0, u_worldHeight: 0, u_fit: ShaderFitOptions.contain,
        }, { alpha: true, powerPreference: 'low-power' }, 0, 0, 1, budget());
        const gl = mount.canvasElement.getContext('webgl2');
        if (!gl || gl.isContextLost() || !gl.getParameter(gl.CURRENT_PROGRAM)) throw new Error('WebGL2 unavailable');
        mount.canvasElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback('context-lost'); }, { once: true });
        status = 'official'; return true;
      } catch { fallback('webgl-unavailable'); return false; }
    })();
    return task;
  }
  function layout({ cx, cy, radius }) {
    if (!host) return;
    const size = radius * 2.18;
    host.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;opacity:0`;
    mount?.setMaxPixelCount(budget());
  }
  function render(progress, now, palette) {
    if (status !== 'official' || disposed || progress < .001) { hide(); return false; }
    host.style.opacity = String(Math.min(1, progress) * .8);
    // The canvas's bounded clock is supplied by the one material gesture.
    // 24fps is enough for a small optical layer; the image fragments remain 60Hz.
    if (now - lastRender < 1000 / 24) return true;
    const key = palette.join(',');
    if (key !== colorKey) {
      colorKey = key; const hex = palette[1] || palette[0];
      const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
      mount.setUniforms({ u_colorFront: [...rgb, 1] });
    }
    frame += lastRender === -Infinity ? 0 : Math.min(65, now - lastRender);
    lastRender = now; mount.setFrame(frame); renders++; return true;
  }
  function reduce() { if (quality > .45) { quality = .4; mount?.setMaxPixelCount(budget()); } else fallback('frame-budget'); }
  function dispose() { disposed = true; hide(); try { mount?.dispose(); } catch {} mount = null; host?.remove(); status = 'disposed'; }
  return { ensure, layout, render, hide, reduce, dispose, state };
}
