import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { mutateEditorialWorkspace, workspaceTimestamp, workspaceDate } from '../scripts/lib/editorial-workspace.mjs';
const root = path.resolve(new URL('..', import.meta.url).pathname);
test('actual daily-cycle process resumes saved source scan and article without granting publication', async () => {
  const privateRoot = await mkdtemp(path.join(os.tmpdir(), 'ctd-cycle-'));
  try {
    const date = workspaceDate(), now = new Date(), timestamp = workspaceTimestamp(now);
    const run = () => spawnSync(process.execPath, ['scripts/daily-cycle.mjs', '--workspace-root', privateRoot], { cwd: root, encoding: 'utf8' });
    const first = run(); assert.ok([0, 1].includes(first.status), first.stderr); const initialized = JSON.parse(first.stdout);
    assert.equal(initialized.progress.revision, 0);
    const library = JSON.parse(await readFile(path.join(root, 'automation/source-library.json')));
    const nike = library.subjects.find(s => s.name === 'Nike');
    await mutateEditorialWorkspace({ repoRoot: root, workspace: path.join(privateRoot, date, 'editorial'), now, input: {
      operation_id: 'synthetic-cycle-resume', expected_revision: 0,
      articles: [{ story_id: 'synthetic-resume', title: 'Synthetic test article', canonical_event_id: 'synthetic-event', draft_markdown: 'Synthetic draft for checkpoint testing only.' }],
      sources: [{ story_id: 'synthetic-resume', url: 'https://example.invalid/source/one', kind: 'information', actually_read: true, substantive: true, underlying_source_id: 'synthetic-one', supports: ['Synthetic assertion'], reading_notes: 'PRIVATE_SYNTHETIC_NOTES_NOT_PRINTED', accessed_at: timestamp }],
      source_scan: [{ subject_id: nike.id, route_url: nike.routes[0].url, checked_at: timestamp, notes: 'PRIVATE_SYNTHETIC_SCAN_NOT_PRINTED', result: 'NO_NEW_SIGNAL' }],
    } });
    const second = run(); assert.ok([0, 1].includes(second.status), second.stderr); const resumed = JSON.parse(second.stdout);
    assert.equal(resumed.progress.revision, 1); assert.equal(resumed.progress.qualifying_read_sources, 1);
    assert.equal(resumed.source_library.checked_subjects, 1); assert.equal(resumed.progress.drafted_articles, 1);
    assert.equal(resumed.progress.source_ready_for_package, 0); assert.equal(resumed.publication_eligible, false);
    assert.doesNotMatch(second.stdout + second.stderr, /PRIVATE_SYNTHETIC_/);
  } finally { await rm(privateRoot, { recursive: true, force: true }); }
});
