import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  initEditorialWorkspace, readEditorialWorkspace, mutateEditorialWorkspace,
  editorialWorkspaceStatus, exportEditorialResearch, workspaceDate, workspaceTimestamp,
  withEditorialWorkspaceLock,
} from '../scripts/lib/editorial-workspace.mjs';

const base = await mkdtemp(path.join(tmpdir(), 'ctd-editorial-workspace-tests-'));
after(() => rm(base, { recursive: true, force: true }));
const now = new Date('2026-10-27T13:00:00+08:00');
const policy = { editorial: { formal_story_count: 10, exact_count_effective_from: '2026-10-12', minimum_substantive_sources_per_story: 10, sources_effective_from: '2026-09-16' } };
let serial = 0;
async function fixture(date = '2026-10-27', at = now) {
  const parent = path.join(base, String(++serial));
  const repoRoot = path.join(parent, 'public-repo'), workspace = path.join(parent, 'private', date);
  await mkdir(path.join(repoRoot, 'automation'), { recursive: true });
  await writeFile(path.join(repoRoot, 'automation/daily-policy.json'), JSON.stringify(policy));
  const current = await initEditorialWorkspace({ repoRoot, workspace, date, now: at });
  return { repoRoot, workspace, current };
}
const article = { story_id: 'test-event', title: 'Synthetic fixture for workflow checks', canonical_event_id: 'test-fixture-event' };
const op = (expected_revision, operation_id, extra = {}) => ({ expected_revision, operation_id, ...extra });
const source = (index, accessed_at = '2026-10-27T12:00:00+08:00') => ({
  story_id: article.story_id, url: `https://official.example/report/${index}`, kind: 'information', actually_read: true,
  substantive: true, underlying_source_id: `synthetic-source-${index}`, supports: ['Synthetic fixture claim, not real reporting'],
  reading_notes: 'Test fixture only. No real source was researched.', accessed_at,
});

test('workspace initialization is idempotent and private files are owner-only', async () => {
  const f = await fixture();
  const second = await initEditorialWorkspace({ ...f, now });
  assert.equal(second.created, false); assert.equal(second.state.revision, 0);
  assert.equal((await stat(path.join(f.workspace, 'state.json'))).mode & 0o777, 0o600);
  assert.equal(second.digest, f.current.digest);
});

test('private workspace rejects public checkout and symlink into it', async () => {
  const f = await fixture();
  await assert.rejects(initEditorialWorkspace({ ...f, workspace: path.join(f.repoRoot, 'private'), now }), /INSIDE_REPOSITORY/);
  const alias = path.join(path.dirname(f.repoRoot), 'alias'); await symlink(f.repoRoot, alias);
  await assert.rejects(initEditorialWorkspace({ ...f, workspace: path.join(alias, 'research'), now }), /INSIDE_REPOSITORY/);
});

test('read records and hashed drafts survive reload while zero research stays incomplete', async () => {
  const f = await fixture();
  const result = await mutateEditorialWorkspace({ ...f, now, input: op(0, 'draft-1', { articles: [{ ...article, draft_markdown: 'Synthetic draft. This is not researched culture reporting.' }] }) });
  const reloaded = await readEditorialWorkspace(f);
  assert.equal(reloaded.state.articles[0].draft.sha256, result.state.articles[0].draft.sha256);
  const status = editorialWorkspaceStatus({ ...reloaded, policy, now });
  assert.equal(status.drafted_articles, 1); assert.equal(status.qualifying_read_sources, 0);
  assert.equal(status.source_ready_for_package, 0); assert.equal(status.publication_eligible, false);
  assert.equal(status.next_action.action, 'READ_SOURCES'); assert.equal(status.next_action.sources_remaining, 10);
});

test('replayed operation never duplicates a source or advances revision twice', async () => {
  const f = await fixture();
  const input = op(0, 'one-source', { articles: [article], sources: [source(1)] });
  const first = await mutateEditorialWorkspace({ ...f, now, input });
  const second = await mutateEditorialWorkspace({ ...f, now, input });
  assert.equal(second.replayed, true); assert.equal(second.state.revision, 1);
  assert.equal(second.digest, first.digest); assert.equal(second.state.article_sources[0].sources.length, 1);
  await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: { ...input, sources: [source(2)] } }), /OPERATION_ID_REUSED/);
});

test('stale writer is rejected without losing the saved draft', async () => {
  const f = await fixture();
  await mutateEditorialWorkspace({ ...f, now, input: op(0, 'a', { articles: [article] }) });
  await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(0, 'b', { sources: [source(1)] }) }), /STALE_REVISION/);
  assert.equal((await readEditorialWorkspace(f)).state.revision, 1);
});

test('concurrent writers have a single winner and retained explicit lock prevents retry', async () => {
  const f = await fixture();
  const results = await Promise.allSettled(['a', 'b'].map(id => mutateEditorialWorkspace({ ...f, now, input: op(0, id, { articles: [article] }) })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await readEditorialWorkspace(f)).state.revision, 1);
  await writeFile(path.join(f.workspace, '.workspace.lock'), '{"pid":0}');
  await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(1, 'c', { sources: [source(1)] }) }), /LOCKED_INSPECT/);
});

test('publication handoff freezes checkpoint writes and releases the lock even on failure', async () => {
  const f = await fixture();
  await assert.rejects(withEditorialWorkspaceLock(f, async () => {
    await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(0, 'blocked-during-release', { articles: [article] }) }), /LOCKED_INSPECT/);
    assert.equal((await readEditorialWorkspace(f)).state.revision, 0);
    throw new Error('SYNTHETIC_HANDOFF_FAILURE');
  }), /SYNTHETIC_HANDOFF_FAILURE/);
  const result = await mutateEditorialWorkspace({ ...f, now, input: op(0, 'after-release', { articles: [article] }) });
  assert.equal(result.state.revision, 1);
});

test('invalid read-source assertions fail before state is changed', async () => {
  const f = await fixture();
  await mutateEditorialWorkspace({ ...f, now, input: op(0, 'article', { articles: [article] }) });
  for (const mutation of [{ reading_notes: '' }, { substantive: false }, { supports: [] }, { underlying_source_id: '' }, { accessed_at: '2026-10-28T12:00:00+08:00' }]) {
    await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(1, JSON.stringify(mutation), { sources: [{ ...source(1), ...mutation }] }) }), /READ_SOURCE_EVIDENCE_INCOMPLETE/);
  }
  assert.equal((await readEditorialWorkspace(f)).state.article_sources[0].sources.length, 0);
});

test('discovery is stored separately and is never counted as a read source', async () => {
  const f = await fixture();
  const current = await mutateEditorialWorkspace({ ...f, now, input: op(0, 'discover', { articles: [article], sources: [{ story_id: article.story_id, url: 'https://official.example/news/', actually_read: false, discovered_at: workspaceTimestamp(now) }] }) });
  const status = editorialWorkspaceStatus({ ...current, policy, now });
  assert.equal(status.discovered_sources, 1); assert.equal(status.qualifying_read_sources, 0);
});

test('brand quick-scan observations survive restart but never count as read information sources', async () => {
  const f = await fixture();
  const scan = { subject_id: 'test-brand', checked_at: workspaceTimestamp(now), notes: 'Synthetic scan fixture, not actual research.',
    result: 'FOUND', route_url: 'https://official.example/news', detail_urls: ['https://official.example/news/announcement'] };
  const input = op(0, 'scan', { source_scan: [scan] });
  await mutateEditorialWorkspace({ ...f, now, input });
  const reloaded = await readEditorialWorkspace(f);
  assert.deepEqual(reloaded.state.source_scan[0], scan);
  const status = editorialWorkspaceStatus({ ...reloaded, policy, now });
  assert.equal(status.checked_scan_records, 1); assert.equal(status.qualifying_read_sources, 0); assert.equal(status.discovered_sources, 0);
  assert.ok(!JSON.stringify(status).includes(scan.notes)); assert.ok(!JSON.stringify(status).includes(scan.route_url));
  assert.equal((await mutateEditorialWorkspace({ ...f, now, input })).replayed, true);
});

test('source scans require an honest timestamp, route, result and specific discovery detail', async () => {
  const f = await fixture();
  const scan = { subject_id: 'test-brand', checked_at: workspaceTimestamp(now), notes: 'Synthetic scan fixture.', result: 'FOUND',
    route_url: 'https://official.example/news', detail_urls: ['https://official.example/news/event'] };
  for (const change of [{ notes: '' }, { checked_at: '2026-10-28T13:00:00+08:00' }, { route_url: 'http://official.example/' },
    { detail_urls: [] }, { result: 'PASS' }]) {
    await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(0, JSON.stringify(change), { source_scan: [{ ...scan, ...change }] }) }), /SOURCE_SCAN_EVIDENCE_INCOMPLETE/);
  }
  const unresolved = await mutateEditorialWorkspace({ ...f, now, input: op(0, 'identity', { source_scan: [{ subject_id: 'test-brand',
    checked_at: workspaceTimestamp(now), notes: 'Exact identity could not be resolved in this synthetic fixture.', result: 'IDENTITY_UNRESOLVED' }] }) });
  assert.equal(unresolved.state.source_scan[0].route_url, null);
});

test('updating a scan preserves earlier observations and rejects older replacement', async () => {
  const f = await fixture();
  const scan = { subject_id: 'test-brand', checked_at: '2026-10-27T12:00:00+08:00', notes: 'Earlier synthetic unavailable route.', result: 'ACCESS_LIMITED', route_url: 'https://official.example/news' };
  await mutateEditorialWorkspace({ ...f, now, input: op(0, 'scan', { source_scan: [scan] }) });
  const next = await mutateEditorialWorkspace({ ...f, now, input: op(1, 'scan-next', { source_scan: [{ ...scan, checked_at: workspaceTimestamp(now), result: 'NO_NEW_SIGNAL' }] }) });
  assert.equal(next.state.source_scan.length, 1); assert.equal(next.state.source_scan_history[0].checked_at, scan.checked_at);
  await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(2, 'scan-stale', { source_scan: [scan] }) }), /OLDER_THAN_SAVED_CHECK/);
});

test('source counting shares URL/underlying-source deduplication with release rules', async () => {
  const f = await fixture();
  const sources = Array.from({ length: 10 }, (_, i) => source(i));
  sources.push({ ...source(0), url: 'https://official.example/report/0?utm_source=duplicate#part' });
  sources.push({ ...source(99), underlying_source_id: sources[0].underlying_source_id });
  sources.push({ ...source(100), url: 'https://www.instagram.com/brand/' });
  const current = await mutateEditorialWorkspace({ ...f, now, input: op(0, 'read', { articles: [{ ...article, draft_markdown: 'Synthetic draft for persistence check.' }], sources }) });
  const status = editorialWorkspaceStatus({ ...current, policy, now });
  assert.equal(status.stories[0].read_source_count, 10); assert.equal(status.stories[0].current_issue_verified_source_count, 10);
  assert.equal(status.source_ready_for_package, 1); assert.equal(status.publication_eligible, false);
  assert.equal(status.next_action.action, 'DISCOVER_NEXT_ARTICLE');
});

test('duplicate events cannot create additional article slots', async () => {
  const f = await fixture();
  await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(0, 'duplicate-event', { articles: [article, { ...article, story_id: 'another-id' }] }) }), /DUPLICATE_CANONICAL_EVENT/);
  await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(0, 'normalized-duplicate', { articles: [article,
    { ...article, story_id: 'another-id', canonical_event_id: 'ＴＥＳＴ-ＦＩＸＴＵＲＥ-ＥＶＥＮＴ' }] }) }), /DUPLICATE_CANONICAL_EVENT/);
  assert.equal((await readEditorialWorkspace(f)).state.articles.length, 0);
});

test('weak candidate replacement is atomic, archived and idempotent without counting retired sources', async () => {
  const f = await fixture();
  const original = await mutateEditorialWorkspace({ ...f, now, input: op(0, 'weak-candidate', {
    articles: [{ ...article, draft_markdown: 'Earlier private draft that must be preserved.' }], sources: [source(1)],
  }) });
  await mutateEditorialWorkspace({ ...f, now, input: op(1, 'weak-discovery', { sources: [{ story_id: article.story_id,
    url: 'https://official.example/weak/discovery', actually_read: false, discovered_at: workspaceTimestamp(now) }] }) });
  const replacement = { story_id: 'replacement-event', title: 'Replacement synthetic fixture', canonical_event_id: 'replacement-event' };
  const input = op(2, 'replace-weak', { retire_articles: [{ story_id: article.story_id, reason: 'Insufficient qualifying primary evidence in this synthetic fixture.' }], articles: [replacement] });
  const replaced = await mutateEditorialWorkspace({ ...f, now, input });
  assert.equal(replaced.state.articles.length, 1); assert.equal(replaced.state.articles[0].story_id, replacement.story_id);
  assert.equal(replaced.state.article_sources.length, 1); assert.equal(replaced.state.article_sources[0].sources.length, 0);
  assert.equal(replaced.state.discoveries.length, 0); assert.equal(replaced.state.archived_articles.length, 1);
  const archived = replaced.state.archived_articles[0];
  assert.equal(archived.article.draft.sha256, original.state.articles[0].draft.sha256);
  assert.equal(archived.article_sources.sources[0].url, source(1).url); assert.equal(archived.discoveries.length, 1);
  assert.equal(archived.retired_at, workspaceTimestamp(now)); assert.ok(archived.reason.includes('Insufficient'));
  const status = editorialWorkspaceStatus({ ...replaced, policy, now });
  assert.equal(status.archived_article_count, 1); assert.equal(status.qualifying_read_sources, 0); assert.equal(status.discovered_articles, 1);
  assert.ok(!JSON.stringify(status).includes('Earlier private draft'));
  const replayed = await mutateEditorialWorkspace({ ...f, now, input });
  assert.equal(replayed.replayed, true); assert.equal(replayed.state.revision, 3); assert.equal(replayed.state.archived_articles.length, 1);
  await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(2, 'stale-retirement', { retire_articles: [{ story_id: replacement.story_id, reason: 'Stale writer.' }] }) }), /STALE_REVISION/);
  assert.equal((await readEditorialWorkspace(f)).state.articles[0].story_id, replacement.story_id);
});

test('retirement requires an existing article and explicit reason and never commits partial replacement', async () => {
  const f = await fixture();
  await mutateEditorialWorkspace({ ...f, now, input: op(0, 'article', { articles: [article] }) });
  for (const retirement of [{ story_id: article.story_id, reason: '' }, { story_id: 'missing', reason: 'Not selected.' }]) {
    await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(1, JSON.stringify(retirement), { retire_articles: [retirement] }) }), /ARTICLE_RETIREMENT/);
  }
  await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(1, 'invalid-replacement', {
    retire_articles: [{ story_id: article.story_id, reason: 'Replacement attempt.' }], articles: [{ story_id: 'new-incomplete' }],
  }) }), /ARTICLE_IDENTITY_REQUIRED/);
  const saved = await readEditorialWorkspace(f);
  assert.equal(saved.state.revision, 1); assert.equal(saved.state.articles[0].story_id, article.story_id);
  assert.equal(saved.state.archived_articles.length, 0);
});

test('row-level and workspace blockers cannot become ready through counters', async () => {
  const f = await fixture();
  const first = await mutateEditorialWorkspace({ ...f, now, input: op(0, 'ready-source', { articles: [{ ...article, draft_markdown: 'Synthetic test draft.' }],
    sources: Array.from({ length: 10 }, (_, i) => source(i)), blockers: [{ code: 'OFFICIAL_MEDIA_PENDING', detail: 'Synthetic blocker.' }] }) });
  const status = editorialWorkspaceStatus({ ...first, policy, now });
  assert.equal(status.source_ready_for_package, 1); assert.equal(status.issue_source_ready_for_package, false);
  assert.ok(status.blockers.includes('OFFICIAL_MEDIA_PENDING'));
  const malformed = structuredClone(first.state);
  malformed.article_sources[0].canonical_event_id = '';
  const blocked = editorialWorkspaceStatus({ state: malformed, policy, now });
  assert.equal(blocked.stories[0].read_source_count, 10); assert.equal(blocked.stories[0].source_ready_for_package, false);
  assert.equal(blocked.issue_source_ready_for_package, false);
  const invalidPolicy = editorialWorkspaceStatus({ ...first, policy: {}, now });
  assert.equal(invalidPolicy.source_ready_for_package, 0); assert.ok(invalidPolicy.blockers.includes('EDITORIAL_POLICY_INVALID'));
});

test('truncated or altered state is blocked and never silently reset', async () => {
  const f = await fixture();
  await writeFile(path.join(f.workspace, 'state.json'), '{"schema_version":');
  await assert.rejects(readEditorialWorkspace(f), /STATE_CORRUPT/);
  await assert.rejects(initEditorialWorkspace({ ...f, now }), /STATE_CORRUPT/);
  assert.equal(await readFile(path.join(f.workspace, 'state.json'), 'utf8'), '{"schema_version":');
});

test('state and draft integrity is checked on every read', async () => {
  const f = await fixture();
  const record = JSON.parse(await readFile(path.join(f.workspace, 'state.json'), 'utf8'));
  record.state.revision = 6;
  await writeFile(path.join(f.workspace, 'state.json'), JSON.stringify(record));
  await assert.rejects(readEditorialWorkspace(f), /STATE_CORRUPT/);
});

test('state-file symlink is refused', async () => {
  const f = await fixture();
  const outside = path.join(path.dirname(f.workspace), 'original.json');
  await writeFile(outside, await readFile(path.join(f.workspace, 'state.json')));
  await rm(path.join(f.workspace, 'state.json')); await symlink(outside, path.join(f.workspace, 'state.json'));
  await assert.rejects(readEditorialWorkspace(f), /SYMLINK/);
});

test('cross-day carry preserves original timestamps and requires fresh evidence and draft review', async () => {
  const oldNow = new Date('2026-10-26T13:00:00+08:00');
  const f = await fixture('2026-10-26', oldNow);
  await mutateEditorialWorkspace({ ...f, now: oldNow, input: op(0, 'old-article', { articles: [{ ...article, draft_markdown: 'Earlier synthetic draft.' }], sources: Array.from({ length: 10 }, (_, i) => source(i, '2026-10-26T12:00:00+08:00')) }) });
  await mutateEditorialWorkspace({ ...f, now: oldNow, input: op(1, 'old-scan', { source_scan: [{ subject_id: 'test-brand', checked_at: workspaceTimestamp(oldNow),
    notes: 'Previous-day synthetic observation.', result: 'NO_NEW_SIGNAL', route_url: 'https://official.example/news' }] }) });
  const old = await readEditorialWorkspace(f);
  const workspace = path.join(path.dirname(f.workspace), '2026-10-27');
  await initEditorialWorkspace({ ...f, workspace, now });
  const carried = await mutateEditorialWorkspace({ ...f, workspace, now, action: 'carry', input: op(0, 'carry', { source_workspace: f.workspace }) });
  assert.equal(carried.state.article_sources[0].sources[0].accessed_at, '2026-10-26T12:00:00+08:00');
  assert.equal((await readEditorialWorkspace(f)).digest, old.digest);
  const stale = editorialWorkspaceStatus({ ...carried, policy, now });
  assert.equal(stale.checked_scan_records, 0); assert.equal(carried.state.source_scan[0].checked_at, workspaceTimestamp(oldNow));
  assert.equal(stale.stories[0].read_source_count, 10); assert.equal(stale.stories[0].current_issue_verified_source_count, 0);
  assert.equal(stale.source_ready_for_package, 0); assert.equal(stale.next_action.action, 'REVALIDATE_CARRIED_EVIDENCE');
  const revalidated = await mutateEditorialWorkspace({ ...f, workspace, now, input: op(1, 'refresh', {
    articles: [{ story_id: article.story_id, revalidated_at: workspaceTimestamp(now), reviewed_draft_sha256: carried.state.articles[0].draft.sha256 }],
    sources: carried.state.article_sources[0].sources.map(s => ({ ...s, story_id: article.story_id, revalidated_at: workspaceTimestamp(now) })),
  }) });
  assert.equal(editorialWorkspaceStatus({ ...revalidated, policy, now }).source_ready_for_package, 1);
  await assert.rejects(mutateEditorialWorkspace({ ...f, now, input: op(2, 'edit-past') }), /CURRENT_DATE_REQUIRED/);
});

test('checkpoint and research export bind to revision without copying drafts', async () => {
  const f = await fixture();
  await mutateEditorialWorkspace({ ...f, now, input: op(0, 'article', { articles: [{ ...article, draft_markdown: 'PRIVATE SYNTHETIC DRAFT BODY' }], sources: [source(1)] }) });
  const current = await mutateEditorialWorkspace({ ...f, now, action: 'checkpoint', input: op(1, 'checkpoint', { note: 'One synthetic source saved; nine still missing.' }) });
  assert.equal(current.state.bindings, null); assert.equal(current.state.checkpoints[0].source_record_count, 1);
  const output = path.join(f.workspace, 'research.json');
  const result = await exportEditorialResearch({ ...f, output });
  const exported = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(result.revision, 2); assert.equal(exported.workspace_digest, current.digest);
  assert.equal(exported.workspace_path, current.workspace);
  assert.equal(exported.drafts[0].story_id, article.story_id);
  assert.equal(exported.drafts[0].sha256, current.state.articles[0].draft.sha256);
  assert.equal(exported.article_sources[0].sources.length, 1);
  assert.ok(!(await readFile(output, 'utf8')).includes('PRIVATE SYNTHETIC DRAFT BODY'));
  await assert.rejects(exportEditorialResearch({ ...f, output: path.join(f.repoRoot, 'research.json') }), /INSIDE_REPOSITORY/);
  const changed = await mutateEditorialWorkspace({ ...f, now, input: op(2, 'updated-draft', { articles: [{ story_id: article.story_id, draft_markdown: 'Changed synthetic body.' }] }) });
  assert.notEqual(exported.workspace_revision, changed.state.revision);
  assert.notEqual(exported.workspace_digest, changed.digest);
  assert.notEqual(exported.drafts[0].sha256, changed.state.articles[0].draft.sha256);
});

test('export draft binding trims section body but leaves absent drafts null', async () => {
  const f = await fixture();
  await mutateEditorialWorkspace({ ...f, now, input: op(0, 'article-without-draft', { articles: [article] }) });
  const output = path.join(f.workspace, 'research.json');
  await exportEditorialResearch({ ...f, output });
  assert.equal(JSON.parse(await readFile(output, 'utf8')).drafts[0].sha256, null);
  await mutateEditorialWorkspace({ ...f, now, input: op(1, 'trimmed-body', { articles: [{ story_id: article.story_id, draft_markdown: '\r\n  Synthetic section body.\r\nSecond line.\r\n' }] }) });
  await exportEditorialResearch({ ...f, output });
  const first = JSON.parse(await readFile(output, 'utf8')).drafts[0].sha256;
  await mutateEditorialWorkspace({ ...f, now, input: op(2, 'clean-body', { articles: [{ story_id: article.story_id, draft_markdown: 'Synthetic section body.\nSecond line.' }] }) });
  await exportEditorialResearch({ ...f, output });
  assert.equal(JSON.parse(await readFile(output, 'utf8')).drafts[0].sha256, first);
});

test('real CLI processes resume the same saved draft and source; malformed input stays private', async () => {
  const at = new Date();
  const f = await fixture(workspaceDate(at), at);
  const cli = fileURLToPath(new URL('../scripts/editorial-workspace.mjs', import.meta.url));
  const run = args => JSON.parse(execFileSync(process.execPath, [cli, ...args, '--workspace', f.workspace], { cwd: f.repoRoot, encoding: 'utf8' }));
  const input = path.join(f.workspace, 'operation.json');
  await writeFile(input, JSON.stringify(op(0, 'cli-smoke', { articles: [{ ...article, draft_markdown: 'Synthetic CLI interruption exercise only.' }], sources: [source(1, workspaceTimestamp(at))],
    source_scan: [{ subject_id: 'test-brand', checked_at: workspaceTimestamp(at), notes: 'Synthetic CLI scan only.', result: 'NO_NEW_SIGNAL', route_url: 'https://official.example/news' }] })));
  const applied = run(['apply', '--input', input]);
  const resumed = run(['plan']);
  assert.equal(resumed.revision, applied.revision); assert.equal(resumed.stories[0].draft_sha256, applied.stories[0].draft_sha256);
  assert.equal(resumed.qualifying_read_sources, 1); assert.equal(resumed.source_ready_for_package, 0);
  assert.equal(resumed.checked_scan_records, 1);
  assert.equal(run(['apply', '--input', input]).replayed, true);
  await writeFile(input, '{"PRIVATE_INPUT_MUST_NOT_BE_ECHOED":');
  const bad = spawnSync(process.execPath, [cli, 'apply', '--workspace', f.workspace, '--input', input], { cwd: f.repoRoot, encoding: 'utf8' });
  assert.equal(bad.status, 1); assert.ok(!bad.stderr.includes('PRIVATE_INPUT_MUST_NOT_BE_ECHOED'));
});
