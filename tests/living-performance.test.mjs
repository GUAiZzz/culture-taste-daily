import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameBudget } from '../core/rooms/living-performance.js';

const T = 1000 / 60;
const feed = (budget, gaps, start = 0) => {
  let at = start;
  budget.sample(at);
  for (const gap of gaps) { at += gap; budget.sample(at); }
  return { at, state: budget.snapshot() };
};

test('normal 60Hz jitter does not become missed slots and the window stays bounded', () => {
  const budget = createFrameBudget();
  const { state } = feed(budget, Array.from({ length: 200 }, (_, i) => [16.5, 16.8, 16.68, 16.69][i % 4]));
  assert.equal(state.disabled, false);
  assert.equal(state.T, T);
  assert.equal(state.validSamples, 32);
  assert.equal(state.totalSamples, 200);
  assert.equal(state.slots, 32);
  assert.equal(state.missedSlots, 0);
  assert.ok(Math.abs(state.p95FrameMs - 16.8) < 1e-9);
});

test('duplicate and invalid timestamps never poison the baseline or add intervals', () => {
  const budget = createFrameBudget();
  budget.sample(0); budget.sample(0); budget.sample(NaN); budget.sample(-1);
  budget.sample('16.7'); budget.sample(T); budget.sample(T - 1); budget.sample(T); budget.sample(2 * T);
  const state = budget.snapshot();
  assert.equal(state.validSamples, 2);
  assert.equal(state.duplicateSamples, 2);
  assert.equal(state.invalidSamples, 4);
  assert.equal(state.missedSlots, 0);
  assert.equal(state.lastTimestamp, 2 * T);
  assert.equal(state.disabled, false);
});

test('threshold evaluation waits for twelve intervals, not twelve callbacks', () => {
  const budget = createFrameBudget();
  const first = feed(budget, Array(11).fill(2 * T));
  assert.equal(first.state.validSamples, 11);
  assert.equal(first.state.disabled, false);
  const state = budget.sample(first.at + 2 * T);
  assert.equal(state.disabled, true);
  assert.equal(state.reason, 'missed-slots');
  assert.equal(state.trigger.validSamples, 12);
  assert.equal(state.trigger.missedSlots, 12);
  assert.deepEqual(state.trigger.violations, ['missed-slots', 'p95-frame-time']);
});

test('idle resets preserve short-interaction history and discard the idle gap', () => {
  const budget = createFrameBudget();
  feed(budget, Array(6).fill(2 * T));
  budget.resetClock();
  const baseline = budget.sample(60000);
  assert.equal(baseline.disabled, false);
  assert.equal(baseline.validSamples, 6);
  for (let i = 1; i <= 6; i++) budget.sample(60000 + i * 2 * T);
  const state = budget.snapshot();
  assert.equal(state.disabled, true);
  assert.equal(state.trigger.validSamples, 12);
  assert.ok(state.window.every(gap => gap < 34));
  assert.equal(state.trigger.gapMs, undefined);
});

test('strict missed-slot ratio and the independent p95 gate are observable', () => {
  // At N=19 one double frame is exactly 1/20=5% missed slots: that test is
  // strictly >5%, while the P38 upper empirical p95 independently fails.
  const budget = createFrameBudget({ minimumSamples: 19, windowSize: 19 });
  const { state } = feed(budget, [...Array(18).fill(T), 2 * T]);
  assert.equal(state.disabled, true);
  assert.equal(state.missedFrameFraction, .05);
  assert.deepEqual(state.trigger.violations, ['p95-frame-time']);
  assert.equal(state.reason, 'p95-frame-time');
});

test('over-50ms fraction uses a strict threshold and cannot hide behind good p95', () => {
  const budget = createFrameBudget({ minimumSamples: 100, windowSize: 100 });
  const first = feed(budget, [...Array(99).fill(T), 50.1]);
  assert.equal(first.state.over50msFraction, .01);
  assert.equal(first.state.disabled, false);
  const state = budget.sample(first.at + 50.1);
  assert.equal(state.disabled, true);
  assert.deepEqual(state.trigger.violations, ['over-50ms']);
  assert.ok(state.missedFrameFraction < .05);
  assert.ok(state.p95FrameMs < 1.5 * T);
});

test('rolling eviction removes old cost while retaining a fixed engineering T', () => {
  const budget = createFrameBudget({ minimumSamples: 32, windowSize: 32 });
  const first = feed(budget, [2 * T, ...Array(31).fill(T)]);
  assert.equal(first.state.disabled, false);
  assert.equal(first.state.missedSlots, 1);
  const state = budget.sample(first.at + T);
  assert.equal(state.validSamples, 32);
  assert.equal(state.missedSlots, 0);
  assert.equal(state.T, T);
  assert.equal(state.disabled, false);
});

test('percentile reads and idle boundaries preserve chronological FIFO eviction', () => {
  const budget = createFrameBudget({ minimumSamples: 32, windowSize: 32 });
  feed(budget, [2 * T, ...Array(5).fill(T)]);
  budget.resetClock();
  let at = 60000;
  budget.sample(at);
  for (let i = 0; i < 26; i++) { at += T; budget.sample(at); }
  assert.equal(budget.snapshot().validSamples, 32);
  assert.equal(budget.snapshot().missedSlots, 1);
  assert.ok(Math.abs(budget.snapshot().window[0] - 2 * T) < 1e-9);
  const after = budget.sample(at + T);
  assert.equal(after.disabled, false);
  assert.equal(after.missedSlots, 0);
});

test('a visible active long gap immediately latches without contaminating the slot window', () => {
  for (const gap of [250, 310, 10000]) {
    const budget = createFrameBudget();
    const before = feed(budget, [10, 10]);
    const state = budget.sample(before.at + gap);
    assert.equal(state.reason, 'long-frame');
    assert.equal(state.disabled, true);
    assert.equal(state.trigger.gapMs, gap);
    assert.equal(state.validSamples, 2);
    assert.equal(state.totalSamples, 2);
    assert.equal(state.trigger.missedSlots, 0);
    assert.deepEqual(state.window, before.state.window);
  }
  // Caller marks hidden/idle by resetting the clock; returning after a long
  // wall-clock pause is only a new baseline, not a foreground long frame.
  const hidden = createFrameBudget();
  feed(hidden, [T, T]); hidden.resetClock();
  assert.equal(hidden.sample(100000).disabled, false);
});

test('first disable evidence is latched and all snapshots are mutation-safe', () => {
  const budget = createFrameBudget();
  feed(budget, [T, T]);
  const first = budget.disable('reduced-motion');
  assert.equal(first.reason, 'reduced-motion');
  first.window.push(999);
  first.trigger.window.push(999);
  first.trigger.violations.push('tampered');
  first.trigger.reason = 'tampered';
  const actual = budget.snapshot();
  assert.equal(actual.window.length, 2);
  assert.equal(actual.trigger.window.length, 2);
  assert.deepEqual(actual.trigger.violations, ['reduced-motion']);
  assert.equal(actual.trigger.reason, 'reduced-motion');
  budget.sample(10000); budget.disable('second-reason'); budget.resetClock();
  assert.equal(budget.snapshot().disabled, true);
  assert.deepEqual(budget.snapshot().trigger, actual.trigger);
  assert.equal(budget.snapshot().totalSamples, 2);
});

test('upper empirical p95 retains the P38 N20/N21 boundary convention', () => {
  const twenty = createFrameBudget({ minimumSamples: 20, windowSize: 20 });
  const a = feed(twenty, [...Array(19).fill(T), 27]).state;
  assert.equal(a.disabled, true);
  assert.deepEqual(a.trigger.violations, ['p95-frame-time']);
  const twentyOne = createFrameBudget({ minimumSamples: 21, windowSize: 21 });
  const b = feed(twentyOne, [...Array(20).fill(T), 27]).state;
  assert.equal(b.disabled, false);
  assert.ok(Math.abs(b.p95FrameMs - T) < 1e-9);
});

test('malformed configuration fails explicitly instead of silently changing the budget', () => {
  for (const T of [0, -1, NaN, Infinity, '16.7']) assert.throws(() => createFrameBudget({ T }), RangeError);
  for (const minimumSamples of [0, 1.5, NaN]) assert.throws(() => createFrameBudget({ minimumSamples }), RangeError);
  for (const windowSize of [0, 11, 12.5, Infinity]) assert.throws(() => createFrameBudget({ windowSize }), RangeError);
});
