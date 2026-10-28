import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const cli = path.join(root, 'scripts/editorial-check.mjs');
test('actual editorial CLI preserves the pinned live package and rejects edits or a short new issue', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'ctd-editorial-cli-'));
  try {
    await mkdir(path.join(temp, 'automation')); await mkdir(path.join(temp, 'src/issues/2026-09-22'), { recursive: true });
    for (const file of ['daily-policy.json', 'published-baseline.json']) await writeFile(path.join(temp, 'automation', file), await readFile(path.join(root, 'automation', file)));
    const file = path.join(temp, 'src/issues/2026-09-22/issue-manifest.public.json');
    const bytes = await readFile(path.join(root, 'src/issues/2026-09-22/issue-manifest.public.json')); await writeFile(file, bytes);
    const run = date => spawnSync(process.execPath, [cli, '--date', date, '--public-only'], { cwd: temp, encoding: 'utf8' });
    const preserved = run('2026-09-22'); assert.equal(preserved.status, 0); assert.equal(JSON.parse(preserved.stdout).checks[0].status, 'PRESERVED_ALREADY_LIVE');
    await writeFile(file, Buffer.concat([bytes, Buffer.from(' ')]));
    const changed = run('2026-09-22'); assert.equal(changed.status, 1); assert.ok(JSON.parse(changed.stdout).checks[0].blockers.includes('PUBLISHED_ISSUE_CHANGED'));
    const date = '2026-10-27'; await mkdir(path.join(temp, 'src/issues', date));
    const manifest = JSON.parse(bytes); manifest.publication_date = date; manifest.issue_id = date;
    await writeFile(path.join(temp, 'src/issues', date, 'issue-manifest.public.json'), JSON.stringify(manifest));
    await writeFile(path.join(temp, 'src/issues', date, 'content.md'), '# Synthetic missing content');
    const short = run(date); assert.equal(short.status, 1); assert.ok(JSON.parse(short.stdout).checks[0].blockers.includes('FORMAL_STORY_COUNT_MISMATCH'));
  } finally { await rm(temp, { recursive: true, force: true }); }
});
