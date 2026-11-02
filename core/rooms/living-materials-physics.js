// One bounded material gesture. These functions do not own a clock or a DOM.
export const materialMotion = Object.freeze({ omega: 11, releaseAtMs: 720, maximumMs: 2400, cooldownMs: 1600 });
export const clamp01 = value => Math.max(0, Math.min(1, value));

export function materialSpring({ x, v }, target, seconds, omega = materialMotion.omega) {
  if (![x, v, target, seconds, omega].every(Number.isFinite) || seconds < 0 || omega <= 0) throw new RangeError('Invalid material spring input');
  const y = x - target, b = v + omega * y, decay = Math.exp(-omega * seconds);
  return { x: target + (y + b * seconds) * decay, v: (v - omega * b * seconds) * decay };
}

export function fragmentSeeds(grid) {
  if (!Number.isInteger(grid) || grid < 2 || grid > 32) throw new RangeError('Invalid fragment grid');
  const seeds = [];
  for (let row = 0; row < grid; row++) for (let col = 0; col < grid; col++) {
    const i = row * grid + col, u = (col + .5) / grid - .5, w = (row + .5) / grid - .5;
    const noise = salt => { const s = Math.sin((i + 1) * (salt * 12.9898 + 7.233)) * 43758.5453; return s - Math.floor(s); };
    seeds.push({ row, col, grid, u, w, angle: Math.atan2(w, u), radius: Math.hypot(u, w), depth: noise(2) * 2 - 1, speed: .72 + noise(3) * .5, spin: (noise(4) - .5) * .38 });
  }
  return seeds;
}

export function fragmentPoint(seed, progress, { cx, cy, width, height, radius }) {
  const p = clamp01(progress), angle = seed.angle + seed.spin * Math.sin(Math.PI * p);
  const ox = cx + seed.u * width, oy = cy + seed.w * height;
  // Each source quadrant moves outward before resolving around the sphere.
  // A small second harmonic avoids a mechanically uniform radial fan.
  const targetR = radius * (.68 + .32 * Math.min(1, seed.radius * Math.SQRT2)) * seed.speed;
  const tx = cx + Math.cos(angle) * targetR, ty = cy + Math.sin(angle) * targetR;
  const burst = Math.sin(Math.PI * p) * radius * .20 * seed.speed;
  return {
    x: ox + (tx - ox) * p + Math.cos(angle) * burst,
    y: oy + (ty - oy) * p + Math.sin(angle) * burst,
    z: seed.depth * radius * .22 * p,
  };
}

export function materialBudget({ width, height, mobile = false, quality = 1 }) {
  return Math.max(1, Math.round(Math.min(mobile ? 72000 : 150000, width * height * 1.15 ** 2) * Math.max(.14, Math.min(1, quality) ** 2)));
}
