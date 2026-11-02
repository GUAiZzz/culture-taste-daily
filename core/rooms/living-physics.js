/** Living Edition candidate M01/M02. No DOM, clocks, timers, or dependencies.
 * q and v exposed by this module are DISPLAY coordinates, in items and items/s.
 * Boundary mapping is applied here exactly once; consumers must not rubber q.
 * The bounded display is a C2 tanh chart over one analytic critical spring.
 */
export const motionConfig = Object.freeze({
  version: 'living-m01-m02-2026-10-29.2',
  specVersion: '2.1',
  status: 'CANDIDATE_MATH_VERIFIED_DEVICE_PENDING',
  maxReleaseItemsPerSecond: 10,
  maxBoundaryRawItemsPerSecond: 10,
  projectionHorizonSeconds: 1 / 6,
  explicitTargetPolicy: 'legal integer options.target overrides projection; fixed target and preserved q/v',
  boundaryItems: 0.30,
  rubberMapping: 'identity-inside; R*tanh(overflow/R)-outside; C2',
  boundaryVelocityPolicy: 'inverse-chart then cap raw velocity at +/-10; report displayed adjustment',
  spring: Object.freeze({
    zeta: 1, mass: 1, restOmega: 14, minOmega: 4.5, maxOmega: 18,
    towardTargetOmega: 'clamp(2*abs(rawV0)/abs(rawQ0-target),4.5,18)',
    lowSpeedBlendEnd: 0.5,
    policy: 'smoothstep blend restOmega to towardTargetOmega over speed 0..0.5; fixed per release',
  }),
  settle: Object.freeze({ errorItems: 0.0015, speedItemsPerSecond: 0.02, checkStepSeconds: 1 / 120, consecutiveChecks: 2 }),
  clock: Object.freeze({ maxForegroundGapMs: 50, pauseGapMs: 250 }),
});

const R = motionConfig.boundaryItems;
const EPS = 1e-9;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const count = n => Math.max(0, Math.trunc(finite(n)));
const smoothstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

function chart(raw, n) {
  const edge = n - 1;
  if (raw >= 0 && raw <= edge) return { q: raw, derivative: 1, second: 0 };
  const boundary = raw < 0 ? 0 : edge;
  const sign = raw < 0 ? -1 : 1;
  // The numerical ceiling only avoids atanh(1); it is <0.000001 CSS px.
  const z = Math.min(1 - EPS, Math.tanh(Math.abs(raw - boundary) / R));
  const derivative = 1 - z * z;
  return { q: boundary + sign * R * z, derivative, second: -2 * sign * z * derivative / R };
}

export function rubber(raw, n) {
  n = count(n);
  return n <= 1 ? 0 : chart(finite(raw), n).q;
}

export function unrubber(displayed, n) {
  n = count(n);
  if (n <= 1) return 0;
  const q = finite(displayed), edge = n - 1;
  if (q >= 0 && q <= edge) return q;
  const boundary = q < 0 ? 0 : edge, sign = q < 0 ? -1 : 1;
  const ratio = Math.min(1 - EPS, Math.abs(q - boundary) / R);
  return boundary + sign * R * Math.atanh(ratio);
}

export function projectTarget(q, v, n, active = 0) {
  n = count(n);
  if (!n) return null;
  if (n === 1) return 0;
  const maxV = motionConfig.maxReleaseItemsPerSecond;
  q = finite(q); v = clamp(finite(v), -maxV, maxV);
  const projected = clamp(q + v * motionConfig.projectionHorizonSeconds, 0, n - 1);
  const lo = Math.floor(projected), hi = Math.ceil(projected);
  if (Math.abs(projected - lo - 0.5) < 1e-9) {
    return v > 0 ? hi : v < 0 ? lo : active === lo || active === hi ? active : lo;
  }
  return Math.floor(projected + 0.5);
}

function omegaFor(rawQ, rawV, target) {
  const { restOmega, minOmega, maxOmega, lowSpeedBlendEnd } = motionConfig.spring;
  const e = rawQ - target, speed = Math.abs(rawV);
  if (e * rawV >= 0 || Math.abs(e) < EPS) return restOmega;
  const velocityMatched = clamp(2 * speed / Math.abs(e), minOmega, maxOmega);
  const blend = smoothstep(speed / lowSpeedBlendEnd);
  return restOmega + (velocityMatched - restOmega) * blend;
}

export function createRelease(q, v, n, active = 0, options = {}) {
  n = count(n);
  const requestedQ0 = finite(q), requestedV0 = finite(v);
  if (n <= 1) return Object.freeze({ n, target: n ? 0 : null, omega: 0, q0: 0, v0: 0, rawQ0: 0, rawV0: 0, requestedQ0, requestedV0, boundaryVelocityAdjusted: false, disabled: true });
  const rawQ0 = unrubber(requestedQ0, n);
  const mapped = chart(rawQ0, n), q0 = mapped.q;
  const maxV = motionConfig.maxReleaseItemsPerSecond;
  const boundedDisplayV = clamp(requestedV0, -maxV, maxV);
  const desiredRawV = boundedDisplayV / mapped.derivative;
  // Explicit M02 exception: overscrolled releases cap latent pointer velocity.
  // This preserves every legal-interval release q/v, but does NOT claim full
  // displayed-v continuity for extreme already-overscrolled releases.
  const maxRawV = motionConfig.maxBoundaryRawItemsPerSecond;
  const rawV0 = clamp(desiredRawV, -maxRawV, maxRawV);
  const v0 = rawV0 * mapped.derivative;
  const explicitTarget = Number.isInteger(options?.target) && options.target >= 0 && options.target < n;
  const target = explicitTarget ? options.target : projectTarget(q0, boundedDisplayV, n, active);
  const omega = omegaFor(rawQ0, rawV0, target);
  return Object.freeze({
    n, target, omega, q0, v0, rawQ0, rawV0, requestedQ0, requestedV0,
    projectionV0: boundedDisplayV,
    targetSource: explicitTarget ? 'explicit' : 'projected',
    boundaryVelocityAdjusted: Math.abs(v0 - boundedDisplayV) > 1e-9,
    inputPositionNormalized: Math.abs(q0 - requestedQ0) > 1e-8,
    disabled: false,
  });
}

function analytic(release, t) {
  const { target, omega, rawQ0, rawV0, n } = release;
  const e0 = rawQ0 - target, b = rawV0 + omega * e0;
  const decay = Math.exp(-omega * t);
  const raw = target + (e0 + b * t) * decay;
  const rawV = (rawV0 - omega * b * t) * decay;
  const rawA = -omega * omega * (raw - target) - 2 * omega * rawV;
  const mapped = chart(raw, n);
  return { q: mapped.q, v: mapped.derivative * rawV, a: mapped.second * rawV * rawV + mapped.derivative * rawA, raw, rawV };
}

export function sampleRelease(release, tSeconds) {
  if (!release || release.disabled) return { q: 0, v: 0, a: 0, done: true, raw: 0, rawV: 0 };
  const t = Math.max(0, finite(tSeconds)), current = analytic(release, t);
  const { errorItems, speedItemsPerSecond, checkStepSeconds: h, consecutiveChecks } = motionConfig.settle;
  const atRest = s => Math.abs(s.q - release.target) <= errorItems && Math.abs(s.v) <= speedItemsPerSecond;
  const initiallyStill = Math.abs(release.q0 - release.target) < EPS && Math.abs(release.v0) < EPS;
  const done = initiallyStill || (t >= consecutiveChecks * h && Array.from({ length: consecutiveChecks }, (_, i) => i === 0 ? current : analytic(release, t - i * h)).every(atRest));
  return done ? { ...current, q: release.target, v: 0, a: 0, done: true } : { ...current, done: false };
}

/** Feed the resulting elapsedSeconds to sampleRelease. Pauses are not caught up. */
export function advanceMotionClock(elapsedSeconds, gapMs, hidden = false) {
  const elapsed = Math.max(0, finite(elapsedSeconds));
  const gap = Math.max(0, finite(gapMs));
  if (hidden || gap >= motionConfig.clock.pauseGapMs) return { elapsedSeconds: elapsed, paused: true, droppedMs: gap };
  const used = Math.min(gap, motionConfig.clock.maxForegroundGapMs);
  return { elapsedSeconds: elapsed + used / 1000, paused: false, droppedMs: gap - used };
}
