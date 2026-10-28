import path from 'node:path';
import { sha256, stableJson, readJson } from './files.mjs';
import { sourcePlan } from './source-library.mjs';
import { readEditorialWorkspace, editorialWorkspaceStatus, workspaceDate } from './editorial-workspace.mjs';

const SHA = /^[a-f0-9]{64}$/;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

export const normalizeEditorialBody = value => typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : '';

function articleBodies(content) {
  const source = normalizeEditorialBody(content);
  const headings = [...source.matchAll(/^##[\t ]+([^\n]+)$/gm)];
  return headings.map((heading, index) => ({ title: heading[1].trim(),
    body: normalizeEditorialBody(source.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? source.length)) }));
}

// Validate the current saved state, the exact export and the public article
// bodies as one binding. A stale export cannot be revived by reusing its hash.
// This is separate from truth/editorial/source-health and publication approval.
export function editorialBindingBlockers({ manifest, content, privateResearch, current, policy, now = new Date() } = {}) {
  const blockers = [];
  const exported = privateResearch;
  const state = current?.state;
  if (exported?.schema_version !== 1 || exported?.kind !== 'private_editorial_research'
    || !nonempty(exported.workspace_path) || exported.workspace_path !== current?.workspace
    || !Number.isSafeInteger(exported.workspace_revision) || !SHA.test(exported.workspace_digest ?? '')) blockers.push('WORKSPACE_EXPORT_IDENTITY');
  if (!state || exported?.workspace_revision !== state.revision || exported?.workspace_digest !== current?.digest) blockers.push('WORKSPACE_EXPORT_STALE');
  if (exported?.target_date !== manifest?.publication_date || state?.target_date !== manifest?.publication_date
    || state?.target_date !== workspaceDate(now)) blockers.push('WORKSPACE_CURRENT_DATE_REQUIRED');
  if (!Array.isArray(exported?.article_sources) || !Array.isArray(state?.article_sources)
    || stableJson(exported.article_sources) !== stableJson(state.article_sources)) blockers.push('WORKSPACE_LEDGER_MISMATCH');
  let progress;
  try { progress = editorialWorkspaceStatus({ ...current, policy, now }); }
  catch { blockers.push('WORKSPACE_STATE_INVALID'); }
  if (progress?.issue_source_ready_for_package !== true || progress?.source_ready_for_package !== 10
    || progress?.blockers.length !== 0) blockers.push('WORKSPACE_NOT_READY');
  const stories = Array.isArray(manifest?.stories) ? manifest.stories : [];
  const articles = Array.isArray(state?.articles) ? state.articles : [];
  const drafts = Array.isArray(exported?.drafts) ? exported.drafts : [];
  if (stories.length !== articles.length || drafts.length !== articles.length
    || new Set(drafts.map(draft => draft?.story_id)).size !== drafts.length) blockers.push('WORKSPACE_ARTICLE_IDENTITY');
  const bodies = articleBodies(content);
  for (const story of stories) {
    const saved = articles.filter(article => article.story_id === story.id);
    const matching = bodies.filter(section => section.title === story.title);
    const exportedDraft = drafts.filter(draft => draft?.story_id === story.id);
    const savedBody = normalizeEditorialBody(saved[0]?.draft?.markdown);
    const bodyHash = savedBody ? sha256(savedBody) : null;
    if (saved.length !== 1 || saved[0]?.title !== story.title || matching.length !== 1
      || exportedDraft.length !== 1 || !bodyHash || !SHA.test(exportedDraft[0]?.sha256 ?? '')
      || exportedDraft[0].sha256 !== bodyHash || sha256(matching[0]?.body ?? '') !== bodyHash) {
      blockers.push(`WORKSPACE_DRAFT_BINDING:${story.id}`);
    }
  }
  return [...new Set(blockers)];
}

export async function validateEditorialBinding({ repoRoot, manifest, content, privateResearch, policy, now = new Date() }) {
  if (!nonempty(privateResearch?.workspace_path)) return ['PRIVATE_WORKSPACE_REQUIRED'];
  let current;
  try { current = await readEditorialWorkspace({ repoRoot, workspace: privateResearch.workspace_path }); }
  catch {
    // Do not serialize private drafts, file bodies, paths or parser excerpts.
    return ['WORKSPACE_BINDING_UNAVAILABLE'];
  }
  const blockers = editorialBindingBlockers({ manifest, content, privateResearch, current, policy, now });
  try {
    const library = await readJson(path.join(repoRoot, 'automation/source-library.json'));
    const radar = await readJson(path.join(repoRoot, 'automation/brand-radar.json'));
    const scan = sourcePlan({ library, radar, date: manifest.publication_date, scan: current.state.source_scan ?? [], now });
    blockers.push(...scan.blockers);
    // Every subject requires a real dated attempt; an inaccessible unselected
    // brand does not itself veto otherwise complete selected stories.
    if (scan.checked_subjects !== scan.total_subjects) blockers.push('SOURCE_SCAN_INCOMPLETE');
  } catch { blockers.push('SOURCE_LIBRARY_UNAVAILABLE'); }
  return [...new Set(blockers)];
}
