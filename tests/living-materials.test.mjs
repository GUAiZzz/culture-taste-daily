import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { materialSpring, materialMotion, fragmentSeeds, fragmentPoint, materialBudget } from '../core/rooms/living-materials-physics.js';

test('material release retains position and velocity and converges inside the bounded gesture', () => {
  const opened = materialSpring({ x: 0, v: 2.4 }, 1, .72);
  assert.ok(opened.x > .99 && opened.x < 1);
  const release = materialSpring(opened, 0, 0);
  assert.deepEqual(release, opened);
  const epsilon = 1e-7, first = materialSpring(opened, 0, epsilon);
  assert.ok(Math.abs((first.x - opened.x) / epsilon - opened.v) < .001);
  const resting = materialSpring(opened, 0, (materialMotion.maximumMs - materialMotion.releaseAtMs) / 1000);
  assert.ok(Math.abs(resting.x) < .0015 && Math.abs(resting.v) < .012);
});

test('spring uses the same continuous solution regardless of frame subdivisions', () => {
  const initial = { x: .42, v: -1.8 }, whole = materialSpring(initial, 0, .12);
  const split = materialSpring(materialSpring(initial, 0, .03), 0, .09);
  assert.ok(Math.abs(whole.x - split.x) < 1e-12);
  assert.ok(Math.abs(whole.v - split.v) < 1e-12);
  for (const seconds of [-1, Infinity, NaN]) assert.throws(() => materialSpring(initial, 0, seconds), RangeError);
});

test('stable artwork fragments occupy all quadrants and return exactly to source cells', () => {
  const seeds = fragmentSeeds(16), geometry = { cx: 195, cy: 160, width: 224, height: 224, radius: 140 };
  assert.deepEqual(fragmentSeeds(16), seeds);
  const distribution = { nw: 0, ne: 0, sw: 0, se: 0 };
  let minDepth = Infinity, maxDepth = -Infinity;
  for (const seed of seeds) {
    const rest = fragmentPoint(seed, 0, geometry), expanded = fragmentPoint(seed, 1, geometry);
    assert.equal(rest.x, geometry.cx + seed.u * geometry.width);
    assert.equal(rest.y, geometry.cy + seed.w * geometry.height);
    assert.ok(Math.abs(rest.z) < 1e-12);
    distribution[(expanded.y < geometry.cy ? 'n' : 's') + (expanded.x < geometry.cx ? 'w' : 'e')]++;
    minDepth = Math.min(minDepth, expanded.z); maxDepth = Math.max(maxDepth, expanded.z);
    assert.ok(Number.isFinite(expanded.x) && Number.isFinite(expanded.y));
    assert.ok(Math.hypot(expanded.x - geometry.cx, expanded.y - geometry.cy) < 190);
  }
  assert.deepEqual(distribution, { nw: 64, ne: 64, sw: 64, se: 64 });
  assert.ok(minDepth < -20 && maxDepth > 20);
});

test('mobile shader pixel budget is bounded and actually decreases with quality', () => {
  const normal = materialBudget({ width: 600, height: 600, mobile: true });
  const degraded = materialBudget({ width: 600, height: 600, mobile: true, quality: .4 });
  assert.equal(normal, 72000);
  assert.ok(degraded < 12000 && degraded >= 10000);
  assert.ok(materialBudget({ width: 2000, height: 1000 }) <= 150000);
});

test('official Paper modules and license remain original and traceable', async () => {
  const root = new URL('../core/rooms/official-paper/', import.meta.url);
  const provenance = JSON.parse(await readFile(new URL('provenance.json', root), 'utf8'));
  assert.equal(provenance.package, '@paper-design/shaders'); assert.equal(provenance.version, '0.0.82');
  assert.equal(provenance.license, 'Apache-2.0');
  assert.equal(Object.keys(provenance.modules).length, 7);
  for (const [name, record] of Object.entries(provenance.modules)) {
    const bytes = await readFile(new URL('vendor/paper-shaders-0.0.82/' + name, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, name);
    assert.equal(bytes.length, record.bytes, name);
  }
});
