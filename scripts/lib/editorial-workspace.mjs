import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { stableJson } from './files.mjs';
import { informationUrl } from './historical-supplements.mjs';
import { editorialRequirements, editorialSourceReport } from './editorial-policy.mjs';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9][a-z0-9_-]{0,119}$/;
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+08:00$/;
const SHA = /^[a-f0-9]{64}$/;
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const eventIdentity = value => typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
const fail = code => { throw new Error(code); };

export function workspaceDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function workspaceTimestamp(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().replace('Z', '+08:00');
}

function validTimestamp(value, now) {
  return TS.test(value ?? '') && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now.getTime();
}

// Resolve the nearest existing ancestor so nonexistent destinations cannot hide
// inside the public checkout through a symlink. Existing workspace files may not
// themselves be symlinks. A system /tmp alias is resolved before this check.
export async function externalWorkspacePath(repoRoot, supplied, { create = false } = {}) {
  if (!path.isAbsolute(supplied ?? '')) fail('PRIVATE_WORKSPACE_ABSOLUTE_PATH_REQUIRED');
  const root = await realpath(repoRoot);
  let cursor = path.resolve(supplied), remainder = [];
  while (true) {
    try { cursor = await realpath(cursor); break; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      remainder.unshift(path.basename(cursor)); cursor = parent;
    }
  }
  const resolved = path.join(cursor, ...remainder);
  const forbidden = [root];
  try {
    const entries = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const match of entries.matchAll(/^worktree (.+)$/gm)) forbidden.push(await realpath(match[1]));
    const gitDir = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    forbidden.push(await realpath(path.resolve(root, gitDir)));
  } catch (error) {
    // Real repository worktrees must be inspected successfully; test fixtures
    // without Git can still exercise the storage primitive in isolation.
    if (await exists(path.join(root, '.git'))) throw error;
  }
  if (forbidden.some(item => inside(item, resolved))) fail('PRIVATE_WORKSPACE_INSIDE_REPOSITORY');
  if (create) await mkdir(resolved, { recursive: true, mode: 0o700 });
  return resolved;
}

async function exists(file) {
  try { await lstat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function noSymlink(file) {
  try { if ((await lstat(file)).isSymbolicLink()) fail('PRIVATE_WORKSPACE_SYMLINK'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function atomicJson(file, value) {
  await noSymlink(file);
  const temporary = path.join(path.dirname(file), `.write-${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(stableJson(value));
    await handle.sync(); await handle.close(); handle = null;
    await rename(temporary, file);
    const directory = await open(path.dirname(file), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } finally {
    await handle?.close();
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

async function locked(workspace, work) {
  const file = path.join(workspace, '.workspace.lock');
  await noSymlink(file);
  let lock;
  try { lock = await open(file, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') fail('WORKSPACE_LOCKED_INSPECT_BEFORE_RECOVERY'); throw error; }
  try {
    await lock.writeFile(stableJson({ pid: process.pid, started_at: workspaceTimestamp() }));
    await lock.sync();
    return await work();
  } finally { await lock.close(); await unlink(file); }
}

// Publication holds the same lock used by edits so validation and the external
// merge/dispatch handoff cannot race a checkpoint mutation.
export async function withEditorialWorkspaceLock({ repoRoot, workspace }, work) {
  workspace = await externalWorkspacePath(repoRoot, workspace);
  return locked(workspace, work);
}

function envelope(state) {
  return { schema_version: 1, kind: 'private_editorial_workspace', integrity_sha256: hash(state), state };
}

function validateState(record) {
  if (record?.schema_version !== 1 || record.kind !== 'private_editorial_workspace'
    || !SHA.test(record.integrity_sha256 ?? '') || hash(record.state) !== record.integrity_sha256) fail('WORKSPACE_STATE_CORRUPT');
  const s = record.state;
  if (!DATE.test(s?.target_date ?? '') || !Number.isSafeInteger(s.revision) || s.revision < 0
    || !Array.isArray(s.articles) || !Array.isArray(s.article_sources) || !Array.isArray(s.discoveries)
    || !Array.isArray(s.operations) || !Array.isArray(s.checkpoints)) fail('WORKSPACE_STATE_CORRUPT');
  if (s.source_scan !== undefined && !Array.isArray(s.source_scan)
    || s.source_scan_history !== undefined && !Array.isArray(s.source_scan_history)
    || s.archived_articles !== undefined && !Array.isArray(s.archived_articles)) fail('WORKSPACE_STATE_CORRUPT');
  const ids = new Set(), events = new Set();
  for (const article of s.articles) {
    if (!ID.test(article.story_id ?? '') || !nonempty(article.title) || !nonempty(article.canonical_event_id)
      || ids.has(article.story_id) || events.has(eventIdentity(article.canonical_event_id))) fail('WORKSPACE_STATE_CORRUPT');
    ids.add(article.story_id); events.add(eventIdentity(article.canonical_event_id));
    if (article.draft && (!nonempty(article.draft.markdown) || hash(article.draft.markdown) !== article.draft.sha256)) fail('WORKSPACE_DRAFT_CORRUPT');
  }
  if (s.article_sources.length !== s.articles.length || s.article_sources.some(r => !ids.has(r.story_id)
    || !Array.isArray(r.sources) || r.canonical_event_id !== s.articles.find(a => a.story_id === r.story_id)?.canonical_event_id)
    || new Set(s.article_sources.map(r => r.story_id)).size !== s.article_sources.length) fail('WORKSPACE_STATE_CORRUPT');
  return s;
}

export async function readEditorialWorkspace({ repoRoot, workspace }) {
  workspace = await externalWorkspacePath(repoRoot, workspace);
  const file = path.join(workspace, 'state.json');
  await noSymlink(file);
  let record;
  try { record = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') fail('WORKSPACE_NOT_INITIALIZED'); fail('WORKSPACE_STATE_CORRUPT'); }
  return { workspace, state: validateState(record), digest: record.integrity_sha256 };
}

export async function initEditorialWorkspace({ repoRoot, workspace, now = new Date(), date = workspaceDate(now) }) {
  if (!DATE.test(date) || date !== workspaceDate(now)) fail('WORKSPACE_CURRENT_DATE_REQUIRED');
  workspace = await externalWorkspacePath(repoRoot, workspace, { create: true });
  return locked(workspace, async () => {
    if (await exists(path.join(workspace, 'state.json'))) {
      const current = await readEditorialWorkspace({ repoRoot, workspace });
      if (current.state.target_date !== date) fail('WORKSPACE_DATE_IDENTITY');
      return { ...current, created: false };
    }
    const state = { target_date: date, revision: 0, created_at: workspaceTimestamp(now), updated_at: workspaceTimestamp(now),
      articles: [], article_sources: [], discoveries: [], archived_articles: [], source_scan: [], source_scan_history: [],
      operations: [], checkpoints: [], blockers: [], bindings: null };
    await atomicJson(path.join(workspace, 'state.json'), envelope(state));
    return { workspace, state, digest: hash(state), created: true };
  });
}

function sourceIsRead(source, now) {
  return source.kind === 'information' && source.actually_read === true && source.substantive === true
    && nonempty(source.underlying_source_id) && nonempty(source.reading_notes)
    && Array.isArray(source.supports) && source.supports.some(nonempty) && validTimestamp(source.accessed_at, now);
}

function retireArticles(state, input, now) {
  state.archived_articles ??= [];
  for (const supplied of input.retire_articles ?? []) {
    if (!ID.test(supplied?.story_id ?? '') || !nonempty(supplied.reason)) fail('ARTICLE_RETIREMENT_REASON_REQUIRED');
    const article = state.articles.find(a => a.story_id === supplied.story_id);
    if (!article) fail('ARTICLE_RETIREMENT_ID_MISSING');
    const records = state.article_sources.find(r => r.story_id === supplied.story_id);
    state.archived_articles.push({ retired_at: workspaceTimestamp(now), reason: supplied.reason,
      article: copy(article), article_sources: copy(records),
      discoveries: copy(state.discoveries.filter(d => d.story_id === supplied.story_id)) });
    state.articles = state.articles.filter(a => a.story_id !== supplied.story_id);
    state.article_sources = state.article_sources.filter(r => r.story_id !== supplied.story_id);
    state.discoveries = state.discoveries.filter(d => d.story_id !== supplied.story_id);
  }
}

function applyArticles(state, input, now) {
  for (const supplied of input.articles ?? []) {
    if (!ID.test(supplied.story_id ?? '')) fail('ARTICLE_ID_INVALID');
    let article = state.articles.find(a => a.story_id === supplied.story_id);
    if (!article) {
      if (!nonempty(supplied.title) || !nonempty(supplied.canonical_event_id)) fail('ARTICLE_IDENTITY_REQUIRED');
      article = { story_id: supplied.story_id, title: supplied.title.trim(), canonical_event_id: supplied.canonical_event_id.trim(), created_at: workspaceTimestamp(now) };
      state.articles.push(article);
      state.article_sources.push({ story_id: article.story_id, canonical_event_id: article.canonical_event_id, sources: [] });
    }
    if (supplied.canonical_event_id && supplied.canonical_event_id !== article.canonical_event_id) fail('ARTICLE_EVENT_IDENTITY_IMMUTABLE');
    if (supplied.title !== undefined) {
      if (!nonempty(supplied.title)) fail('ARTICLE_TITLE_REQUIRED');
      article.title = supplied.title.trim();
    }
    if (supplied.draft_markdown !== undefined) {
      if (!nonempty(supplied.draft_markdown)) fail('ARTICLE_DRAFT_EMPTY');
      article.draft = { markdown: supplied.draft_markdown, sha256: hash(supplied.draft_markdown), updated_at: workspaceTimestamp(now) };
    }
    if (supplied.revalidated_at !== undefined) {
      if (!validTimestamp(supplied.revalidated_at, now) || !supplied.revalidated_at.startsWith(state.target_date)
        || supplied.reviewed_draft_sha256 !== article.draft?.sha256) fail('DRAFT_REVALIDATION_INVALID');
      article.revalidated_at = supplied.revalidated_at;
      article.reviewed_draft_sha256 = supplied.reviewed_draft_sha256;
    }
    article.updated_at = workspaceTimestamp(now);
  }
  if (new Set(state.articles.map(a => eventIdentity(a.canonical_event_id))).size !== state.articles.length) fail('DUPLICATE_CANONICAL_EVENT');
}

function applySources(state, input, now) {
  for (const supplied of input.sources ?? []) {
    const article = state.articles.find(a => a.story_id === supplied.story_id);
    if (!article) fail('SOURCE_ARTICLE_MISSING');
    let url;
    try { url = informationUrl(supplied.url); } catch { fail('INFORMATION_SOURCE_URL'); }
    if (supplied.actually_read !== true) {
      if (!validTimestamp(supplied.discovered_at, now)) fail('DISCOVERY_TIMESTAMP_REQUIRED');
      const entry = { story_id: supplied.story_id, url: supplied.url, discovered_at: supplied.discovered_at,
        publisher: supplied.publisher ?? null, title: supplied.title ?? null, actually_read: false };
      const index = state.discoveries.findIndex(s => s.story_id === supplied.story_id && informationUrl(s.url) === url);
      if (index < 0) state.discoveries.push(entry); else state.discoveries[index] = entry;
      continue;
    }
    if (!sourceIsRead(supplied, now)) fail('READ_SOURCE_EVIDENCE_INCOMPLETE');
    if (supplied.revalidated_at !== undefined && (!validTimestamp(supplied.revalidated_at, now)
      || !supplied.revalidated_at.startsWith(state.target_date) || Date.parse(supplied.revalidated_at) < Date.parse(supplied.accessed_at))) fail('SOURCE_REVALIDATION_INVALID');
    const { story_id, ...entry } = copy(supplied);
    const sources = state.article_sources.find(r => r.story_id === story_id).sources;
    const index = sources.findIndex(s => informationUrl(s.url) === url);
    if (index < 0) sources.push(entry); else sources[index] = entry;
  }
}

function applySourceScans(state, input, now) {
  const validHttps = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  };
  state.source_scan ??= [];
  state.source_scan_history ??= [];
  for (const supplied of input.source_scan ?? []) {
    if (!ID.test(supplied?.subject_id ?? '') || !validTimestamp(supplied.checked_at, now) || !nonempty(supplied.notes)
      || !['FOUND', 'NO_NEW_SIGNAL', 'ACCESS_LIMITED', 'IDENTITY_UNRESOLVED'].includes(supplied.result)
      || supplied.result !== 'IDENTITY_UNRESOLVED' && !validHttps(supplied.route_url)
      || supplied.detail_urls !== undefined && (!Array.isArray(supplied.detail_urls) || supplied.detail_urls.some(url => !validHttps(url)))
      || supplied.result === 'FOUND' && !(supplied.detail_urls?.length > 0)) fail('SOURCE_SCAN_EVIDENCE_INCOMPLETE');
    const record = { subject_id: supplied.subject_id, checked_at: supplied.checked_at, notes: supplied.notes,
      result: supplied.result, route_url: supplied.route_url ?? null, detail_urls: [...new Set(supplied.detail_urls ?? [])] };
    const index = state.source_scan.findIndex(r => r.subject_id === record.subject_id);
    if (index < 0) state.source_scan.push(record);
    else if (hash(state.source_scan[index]) !== hash(record)) {
      if (Date.parse(record.checked_at) < Date.parse(state.source_scan[index].checked_at)) fail('SOURCE_SCAN_OLDER_THAN_SAVED_CHECK');
      state.source_scan_history.push(state.source_scan[index]);
      state.source_scan[index] = record;
    }
  }
}

export async function mutateEditorialWorkspace({ repoRoot, workspace, input, action = 'apply', now = new Date() }) {
  workspace = await externalWorkspacePath(repoRoot, workspace);
  if (!nonempty(input?.operation_id) || input.operation_id.length > 160 || !Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0) fail('WORKSPACE_OPERATION_AND_REVISION_REQUIRED');
  if (!['apply', 'checkpoint', 'carry'].includes(action)) fail('WORKSPACE_ACTION_INVALID');
  const { expected_revision, ...operation } = input;
  const operationHash = hash({ action, ...operation });
  return locked(workspace, async () => {
    const current = await readEditorialWorkspace({ repoRoot, workspace });
    const state = copy(current.state);
    if (state.target_date !== workspaceDate(now)) fail('WORKSPACE_CURRENT_DATE_REQUIRED');
    const previous = state.operations.find(o => o.operation_id === input.operation_id);
    if (previous) {
      if (previous.sha256 !== operationHash) fail('WORKSPACE_OPERATION_ID_REUSED');
      return { ...current, replayed: true };
    }
    if (state.revision !== expected_revision) fail('WORKSPACE_STALE_REVISION');
    if (action === 'carry') {
      const prior = await readEditorialWorkspace({ repoRoot, workspace: input.source_workspace });
      if (prior.state.target_date >= state.target_date) fail('CARRY_REQUIRES_EARLIER_DATE');
      for (const a of prior.state.articles) {
        if (state.articles.some(existing => existing.story_id === a.story_id || eventIdentity(existing.canonical_event_id) === eventIdentity(a.canonical_event_id))) fail('CARRY_DUPLICATE_ARTICLE');
        state.articles.push({ ...copy(a), carried_from_date: prior.state.target_date, carried_from_digest: prior.digest });
      }
      state.article_sources.push(...copy(prior.state.article_sources));
      state.discoveries.push(...copy(prior.state.discoveries));
      state.source_scan ??= [];
      for (const scan of prior.state.source_scan ?? []) {
        // Existing current-day records always win; old observations retain their
        // actual dates and cannot satisfy the new day's scan obligation.
        if (!state.source_scan.some(currentScan => currentScan.subject_id === scan.subject_id)) state.source_scan.push(copy(scan));
      }
    } else if (action === 'apply') {
      if ((input.articles !== undefined && !Array.isArray(input.articles)) || (input.sources !== undefined && !Array.isArray(input.sources))
        || input.source_scan !== undefined && !Array.isArray(input.source_scan)
        || input.retire_articles !== undefined && !Array.isArray(input.retire_articles)) fail('WORKSPACE_UPDATE_SCHEMA');
      retireArticles(state, input, now);
      applyArticles(state, input, now); applySources(state, input, now); applySourceScans(state, input, now);
      if (input.blockers !== undefined) {
        if (!Array.isArray(input.blockers) || input.blockers.some(b => !nonempty(b.code) || !nonempty(b.detail))) fail('WORKSPACE_BLOCKER_SCHEMA');
        state.blockers = copy(input.blockers);
      }
    } else {
      if (!nonempty(input.note)) fail('CHECKPOINT_NOTE_REQUIRED');
      state.checkpoints.push({ note: input.note, saved_at: workspaceTimestamp(now), revision: state.revision,
        article_count: state.articles.length, source_record_count: state.article_sources.reduce((n, r) => n + r.sources.length, 0) });
    }
    state.revision += 1; state.updated_at = workspaceTimestamp(now);
    // No edit may retain a previously calculated QA/release/evidence binding.
    state.bindings = null;
    state.operations.push({ operation_id: input.operation_id, sha256: operationHash, revision: state.revision, saved_at: workspaceTimestamp(now) });
    const record = envelope(state); validateState(record);
    await atomicJson(path.join(workspace, 'state.json'), record);
    return { workspace, state, digest: record.integrity_sha256, replayed: false };
  });
}

export function editorialWorkspaceStatus({ state, digest, policy, now = new Date() }) {
  const requirements = editorialRequirements(policy, state.target_date);
  const manifest = { publication_date: state.target_date, issue_id: state.target_date,
    stories: state.articles.map(article => ({ id: article.story_id, title: article.title,
      sources: state.article_sources.find(r => r.story_id === article.story_id).sources.map(source => ({ url: source.url })) })) };
  const report = editorialSourceReport({ manifest, privateResearch: state, policy, now, allowUnlocked: true });
  const currentDate = workspaceDate(now);
  const stories = state.articles.map(article => {
    const row = report.stories.find(r => r.story_id === article.story_id);
    const all = state.article_sources.find(r => r.story_id === article.story_id).sources;
    const fresh = all.filter(s => sourceIsRead(s, now) && (s.accessed_at.startsWith(state.target_date)
      || validTimestamp(s.revalidated_at, now) && s.revalidated_at.startsWith(state.target_date)));
    const refreshed = editorialSourceReport({ manifest: { ...manifest, stories: [manifest.stories.find(s => s.id === article.story_id)] },
      privateResearch: { article_sources: [{ story_id: article.story_id, canonical_event_id: article.canonical_event_id, sources: fresh }] },
      policy, now, allowUnlocked: true }).stories[0]?.qualifying_source_count ?? 0;
    const drafted = Boolean(article.draft?.markdown.trim());
    const draftFresh = drafted && (article.draft.updated_at.startsWith(state.target_date)
      || article.revalidated_at?.startsWith(state.target_date) && article.reviewed_draft_sha256 === article.draft.sha256);
    const required = row?.required_source_count ?? requirements.minimum_sources_per_story ?? 10;
    const read = row?.qualifying_source_count ?? 0;
    const rowBlockers = row?.blockers ?? ['SOURCE_LEDGER_MISSING'];
    const stage = rowBlockers.some(b => b.startsWith('EVENT_DEDUPLICATION_FAILED')) ? 'REPAIR_EVENT_IDENTITY'
      : rowBlockers.some(b => b.startsWith('SOURCE_LEDGER_MISSING')) ? 'REPAIR_SOURCE_LEDGER'
      : read < required ? 'READ_SOURCES' : refreshed < required || drafted && !draftFresh ? 'REVALIDATE_CARRIED_EVIDENCE'
      : !drafted ? 'DRAFT_ARTICLE' : 'PACKAGE_REVIEW';
    return { story_id: article.story_id, title: article.title, canonical_event_id: article.canonical_event_id,
      discovered_source_count: state.discoveries.filter(s => s.story_id === article.story_id).length,
      read_source_count: read, current_issue_verified_source_count: refreshed, required_source_count: required,
      drafted, draft_current: Boolean(draftFresh), draft_sha256: article.draft?.sha256 ?? null, stage, blockers: rowBlockers,
      source_ready_for_package: requirements.policy_valid && currentDate === state.target_date && drafted && draftFresh
        && refreshed >= required && Array.isArray(row?.blockers) && row.blockers.length === 0 };
  });
  const requiredStories = requirements.exact_story_count ?? 10;
  const next = stories.find(s => !s.source_ready_for_package);
  const pending = [...state.blockers.map(b => b.code), ...report.blockers];
  if (currentDate !== state.target_date) pending.unshift('WORKSPACE_REQUIRES_CURRENT_DATE_CARRY');
  if (stories.length !== requiredStories) pending.push('FORMAL_STORY_COUNT_MISMATCH');
  if (stories.some(s => !s.source_ready_for_package)) pending.push('ARTICLE_WORK_INCOMPLETE');
  return { schema_version: 1, kind: 'editorial_workspace_progress', date: state.target_date, checked_at: workspaceTimestamp(now),
    revision: state.revision, workspace_digest: digest ?? hash(state), discovered_articles: stories.length,
    archived_article_count: state.archived_articles?.length ?? 0,
    discovered_sources: state.discoveries.length, qualifying_read_sources: stories.reduce((n, s) => n + s.read_source_count, 0),
    checked_scan_records: (state.source_scan ?? []).filter(scan => scan.checked_at.startsWith(state.target_date) && validTimestamp(scan.checked_at, now)).length,
    drafted_articles: stories.filter(s => s.drafted).length,
    source_ready_for_package: stories.filter(s => s.source_ready_for_package).length, required_articles: requiredStories,
    issue_source_ready_for_package: stories.length === requiredStories && stories.every(s => s.source_ready_for_package) && pending.length === 0,
    stories, blockers: [...new Set(pending)],
    next_action: currentDate !== state.target_date ? { action: 'CARRY_TO_CURRENT_DATE', date: currentDate }
      : next ? { action: next.stage, story_id: next.story_id, sources_remaining: Math.max(0, next.required_source_count - next.current_issue_verified_source_count), blockers: next.blockers }
      : stories.length < requiredStories ? { action: 'DISCOVER_NEXT_ARTICLE', remaining: requiredStories - stories.length }
      : stories.length > requiredStories ? { action: 'SELECT_EXACT_ARTICLE_COUNT', excess: stories.length - requiredStories }
      : state.blockers.length ? { action: 'REPAIR_RECORDED_BLOCKERS', blockers: state.blockers.map(blocker => blocker.code) }
      : { action: 'VALIDATE_COMPLETE_PUBLIC_PACKAGE_AND_RESEARCH_GATES' },
    publication_eligible: false,
    limitation: 'Progress and source counts do not certify truth, editorial quality, coverage, HarryTone, official media, rights, QA, CI or publication.' };
}

export async function exportEditorialResearch({ repoRoot, workspace, output }) {
  const current = await readEditorialWorkspace({ repoRoot, workspace });
  const destination = await externalWorkspacePath(repoRoot, output);
  if (inside(destination, current.workspace) || destination === path.join(current.workspace, 'state.json')
    || destination === path.join(current.workspace, '.workspace.lock')) fail('WORKSPACE_EXPORT_DESTINATION_INVALID');
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await atomicJson(destination, { schema_version: 1, kind: 'private_editorial_research', target_date: current.state.target_date,
    workspace_path: current.workspace, workspace_revision: current.state.revision, workspace_digest: current.digest,
    drafts: current.state.articles.map(article => ({ story_id: article.story_id,
      sha256: article.draft ? hash(article.draft.markdown.replace(/\r\n?/g, '\n').trim()) : null })),
    article_sources: current.state.article_sources });
  return { path: destination, revision: current.state.revision, sha256: hash(await readFile(destination, 'utf8')) };
}
