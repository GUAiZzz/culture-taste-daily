import test from 'node:test';
import assert from 'node:assert/strict';
import { motionConfig, rubber, unrubber, projectTarget, createRelease, sampleRelease, advanceMotionClock } from '../core/rooms/living-physics.js';

const close = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);

test('finite target projection and half-index rules are independent of omega', () => {
  assert.equal(projectTarget(0, 3, 10, 0), 1);
  assert.equal(projectTarget(1, -3, 10, 1), 0);
  assert.equal(projectTarget(.5, 0, 10, 1), 1);
  assert.equal(projectTarget(.5, 0, 10, 7), 0);
  assert.equal(projectTarget(9, 10, 10), 9);
  assert.equal(projectTarget(0, -10, 10), 0);
});

test('0/1/N fixtures are finite and non-circular', () => {
  for (const n of [0, 1]) {
    assert.equal(projectTarget(4, 7, n), n ? 0 : null);
    assert.equal(rubber(4, n), 0);
    assert.equal(unrubber(4, n), 0);
    assert.deepEqual(sampleRelease(createRelease(2, 9, n), 0), { q: 0, v: 0, a: 0, done: true, raw: 0, rawV: 0 });
  }
});

test('C2 rubber is invertible within numerical precision and bounded without hard truncation', () => {
  const R = motionConfig.boundaryItems;
  for (const q of [-.299, -.29, -.1, 0, .1, 5.5, 9, 9.1, 9.29, 9.299]) close(rubber(unrubber(q, 10), 10), q);
  for (let x = -20; x <= 30; x += .03125) assert.ok(rubber(x, 10) > -R && rubber(x, 10) < 9 + R);
  const h = 1e-5;
  for (const edge of [0, 9]) {
    close((rubber(edge + h, 10) - rubber(edge - h, 10)) / (2 * h), 1, 1e-7);
    close((rubber(edge + h, 10) - 2 * edge + rubber(edge - h, 10)) / h ** 2, 0, .001);
  }
});

test('normal release preserves position and displayed velocity including fast outward edge releases', () => {
  for (const q of [0, .05, .25, .49, .5, 1, 4.5, 8.95, 9]) for (const v of [-10, -3, -.1, 0, .1, 1.5, 3, 10]) {
    const release = createRelease(q, v, 10);
    const sample = sampleRelease(release, 0);
    close(sample.q, q); close(sample.v, v);
    assert.equal(release.boundaryVelocityAdjusted, false);
  }
});

test('explicit keyboard targets retain pending destination without changing current q/v', () => {
  const q = .22, v = 2.5;
  const projected = createRelease(q, v, 10, 0);
  const first = createRelease(q, v, 10, 0, { target: 1 });
  const second = createRelease(q, v, 10, 0, { target: 2 });
  assert.equal(projected.target, 1);
  assert.equal(first.target, 1);
  assert.equal(second.target, 2);
  assert.equal(second.targetSource, 'explicit');
  close(sampleRelease(second, 0).q, q);
  close(sampleRelease(second, 0).v, v);
  assert.notEqual(first.omega, second.omega, 'omega is derived once from selected destination');
  const moving = sampleRelease(first, .08);
  const interrupted = createRelease(moving.q, moving.v, 10, 0, { target: 3 });
  assert.equal(interrupted.target, 3);
  close(sampleRelease(interrupted, 0).q, moving.q);
  close(sampleRelease(interrupted, 0).v, moving.v);
  for (const target of [-1, 10, 1.2, NaN, Infinity, '2', null]) {
    const r = createRelease(q, v, 10, 0, { target });
    assert.equal(r.target, projected.target);
    assert.equal(r.targetSource, 'projected');
  }
  assert.equal(createRelease(q, v, 10, 0, { target: 0 }).target, 0);
  assert.equal(createRelease(q, v, 10, 0, { target: 9 }).target, 9);
});

test('overscrolled velocity adjustment is explicit and does not zero all releases', () => {
  for (const q of [-.29, -.10, 9.10, 9.29]) for (const v of [-10, -3, 3, 10]) {
    const release = createRelease(q, v, 10), s = sampleRelease(release, 0);
    close(s.q, q); close(s.v, release.v0);
    assert.ok(Math.abs(release.rawV0) <= 10);
    assert.ok(Math.abs(release.v0) > 0);
    const nearLimit = q < -.2 || q > 9.2;
    assert.equal(release.boundaryVelocityAdjusted, nearLimit || Math.abs(v) === 10);
  }
});

test('continuous critical spring agrees with independent RK4, including the boundary chart', () => {
  for (const [q, v] of [[0, 3], [.25, 1.5], [.05, -10], [8.95, 10], [-.29, -10], [9.29, -10]]) {
    const release = createRelease(q, v, 10); let x = release.rawQ0, u = release.rawV0;
    const h = 1 / 4000, acc = (x, u) => -(release.omega ** 2) * (x - release.target) - 2 * release.omega * u;
    for (let step = 1; step <= 2000; step++) {
      const k1x = u, k1v = acc(x, u);
      const k2x = u + h * k1v / 2, k2v = acc(x + h * k1x / 2, k2x);
      const k3x = u + h * k2v / 2, k3v = acc(x + h * k2x / 2, k3x);
      const k4x = u + h * k3v, k4v = acc(x + h * k3x, k4x);
      x += h * (k1x + 2 * k2x + 2 * k3x + k4x) / 6;
      u += h * (k1v + 2 * k2v + 2 * k3v + k4v) / 6;
      if (step % 40 === 0) {
        const s = sampleRelease(release, step * h);
        close(s.raw, x, 1e-8); close(s.rawV, u, 1e-7);
        if (!s.done) close(s.q, rubber(x, 10), 1e-8);
      }
    }
  }
});

test('counterexample fixed18 surge is reduced without discarding initial speed', () => {
  const r = createRelease(0, 3, 10), samples = Array.from({ length: 2001 }, (_, i) => sampleRelease(r, i / 2000));
  close(r.v0, 3);
  assert.ok(Math.max(...samples.map(s => Math.abs(s.v))) < 3.05);
  const fixed18 = { ...r, omega: 18 };
  close(sampleRelease(fixed18, 2 / 45).v, 6.739934461758324, 1e-9);
  const sameTarget = createRelease(0, 2, 10);
  assert.equal(sameTarget.target, 0);
  assert.ok(sampleRelease(sameTarget, .05).q > 0, 'nonzero initial velocity is not silently removed');
});

test('same-time 60/120Hz trajectories match at intermediate positions and velocities', () => {
  for (const [q, v] of [[0, 3], [.25, 1.5], [.05, -10], [8.95, 10], [-.29, -10]]) {
    const r = createRelease(q, v, 10);
    let elapsed60 = 0, elapsed120 = 0;
    for (let frame = 0; frame <= 180; frame++) {
      const at60 = sampleRelease(r, elapsed60), at120 = sampleRelease(r, elapsed120);
      close(at60.q, at120.q, 1e-12); close(at60.v, at120.v, 1e-12);
      assert.equal(at60.done, at120.done);
      elapsed60 = advanceMotionClock(elapsed60, 1000 / 60).elapsedSeconds;
      elapsed120 = advanceMotionClock(elapsed120, 1000 / 120).elapsedSeconds;
      elapsed120 = advanceMotionClock(elapsed120, 1000 / 120).elapsedSeconds;
    }
  }
});

test('grid trajectories remain bounded, finite and settle; no discarded boundary velocities hidden in tests', () => {
  const R = motionConfig.boundaryItems;
  for (const n of [2, 10, 20]) for (const q of [-.299, -.1, 0, .05, .25, .49, .5, (n - 1) / 2, n - 1, n - .9, n - .701]) {
    for (const v of [-10, -3, -1, 0, 1, 1.5, 3, 10]) {
      const r = createRelease(q, v, n);
      for (let i = 0; i <= 360; i++) {
        const s = sampleRelease(r, i / 120);
        assert.ok(Number.isFinite(s.q) && Number.isFinite(s.v) && Number.isFinite(s.a));
        assert.ok(s.q > -R && s.q < n - 1 + R);
      }
      assert.equal(sampleRelease(r, 4).done, true, `not settled q=${q},v=${v},n=${n}`);
    }
  }
});

test('foreground stalls cap effective time; background and >=250ms gaps pause without replay', () => {
  assert.deepEqual(advanceMotionClock(.1, 16), { elapsedSeconds: .116, paused: false, droppedMs: 0 });
  assert.deepEqual(advanceMotionClock(.1, 100), { elapsedSeconds: .15000000000000002, paused: false, droppedMs: 50 });
  assert.deepEqual(advanceMotionClock(.1, 250), { elapsedSeconds: .1, paused: true, droppedMs: 250 });
  assert.deepEqual(advanceMotionClock(.1, 10, true), { elapsedSeconds: .1, paused: true, droppedMs: 10 });
});
