/**
 * P16 effect-only frame budget. Pure timestamp accounting: no DOM or timers.
 * Default T is a FIXED 60Hz engineering budget, not measured device refresh.
 * The caller supplies consecutive foreground/active rAF timestamps. On idle,
 * hidden or resumed segments it calls resetClock(); this preserves the window.
 * A continuous foreground gap >=250ms disables smear, without adding that gap
 * to the ordinary slot window. This helper never changes motion q/v/targets.
 */
export function createFrameBudget({ T = 1000 / 60, minimumSamples = 12, windowSize = 32 } = {}) {
  if (!Number.isFinite(T) || T <= 0) throw new RangeError('T must be a positive finite number');
  if (!Number.isInteger(minimumSamples) || minimumSamples < 1) throw new RangeError('minimumSamples must be a positive integer');
  if (!Number.isInteger(windowSize) || windowSize < minimumSamples) throw new RangeError('windowSize must be an integer >= minimumSamples');

  const intervals = [];
  let lastTimestamp = null, totalSamples = 0, duplicateSamples = 0, invalidSamples = 0;
  let disabled = false, reason = null, trigger = null;

  function metrics() {
    const slots = intervals.reduce((sum, dt) => sum + Math.max(1, Math.round(dt / T)), 0);
    const missedSlots = slots - intervals.length;
    const sorted = intervals.slice().sort((a, b) => a - b);
    // Match the P38 comparator's explicit upper empirical percentile, including
    // small-window behavior. Do not silently use a different interpolation.
    const p95FrameMs = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : 0;
    return {
      validSamples: intervals.length,
      slots,
      missedSlots,
      missedFrameFraction: slots ? missedSlots / slots : 0,
      over50msFraction: intervals.length ? intervals.filter(dt => dt > 50).length / intervals.length : 0,
      p95FrameMs,
    };
  }

  function copyTrigger() {
    return trigger ? { ...trigger, violations: trigger.violations.slice(), window: trigger.window.slice() } : null;
  }

  function snapshot() {
    return {
      T, minimumSamples, windowSize,
      baseline: 'fixed-engineering-budget-not-device-refresh-verification',
      disabled, reason, trigger: copyTrigger(),
      ...metrics(), totalSamples, duplicateSamples, invalidSamples,
      lastTimestamp, window: intervals.slice(),
    };
  }

  function latch(why, violations, extra = {}) {
    if (!disabled) {
      disabled = true;
      reason = why;
      trigger = { at: lastTimestamp, reason, violations: violations.slice(), ...metrics(), window: intervals.slice(), ...extra };
    }
    return snapshot();
  }

  function disable(why = 'manual') {
    const label = typeof why === 'string' && why.length ? why : 'manual';
    return latch(label, [label]);
  }

  function resetClock() {
    lastTimestamp = null;
    return snapshot();
  }

  function sample(timestamp) {
    if (disabled) return snapshot();
    if (!Number.isFinite(timestamp) || timestamp < 0) {
      invalidSamples++;
      return snapshot();
    }
    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
      return snapshot();
    }
    if (timestamp === lastTimestamp) {
      duplicateSamples++;
      return snapshot();
    }
    if (timestamp < lastTimestamp) {
      invalidSamples++;
      return snapshot();
    }
    const dt = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    if (dt >= 250) return latch('long-frame', ['long-frame'], { gapMs: dt });

    intervals.push(dt);
    if (intervals.length > windowSize) intervals.shift();
    totalSamples++;
    if (intervals.length < minimumSamples) return snapshot();

    const current = metrics(), violations = [];
    if (current.missedFrameFraction > .05) violations.push('missed-slots');
    if (current.over50msFraction > .01) violations.push('over-50ms');
    if (current.p95FrameMs > 1.5 * T) violations.push('p95-frame-time');
    return violations.length ? latch(violations[0], violations) : snapshot();
  }

  return Object.freeze({ sample, resetClock, disable, snapshot });
}
