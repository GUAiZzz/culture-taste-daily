import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { readJson } from './lib/files.mjs';
import { assertRepository, gh } from './lib/github-scope.mjs';
import { REPOSITORY, PREVIEW_BASE, shanghaiDate } from './lib/preview-policy.mjs';
const { values } = parseArgs({ options: { online: { type: 'boolean' }, date: { type: 'string' } } });
const state = assertRepository();
const date = values.date ?? shanghaiDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('DATE_IDENTITY');
const dirs = (await readdir('src/issues')).filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort();
const manifests = await Promise.all(dirs.map(name => readJson(`src/issues/${name}/issue-manifest.public.json`)));
state.latest_issue = manifests.filter(m => m.visibility === 'published_preview').at(-1)?.issue_id;
state.formal_stories = manifests.reduce((total, m) => total + m.stories.length, 0);
state.issue_packages = manifests.length;
state.target_date = date;
state.candidate_exists_locally = dirs.includes(date);
state.state = state.candidate_exists_locally ? 'PACKAGE_PRESENT_UNVERIFIED' : 'MISSING_DAY';
state.production_eligible = false;
if (values.online) {
  const prs = JSON.parse(gh(['pr', 'list', '--repo', REPOSITORY, '--head', `automation/culture-taste-${date}`, '--base', PREVIEW_BASE, '--state', 'all', '--json', 'number,state,headRefOid,mergeCommit,url']));
  state.prs = prs;
  if (prs.filter(pr => pr.state === 'OPEN').length > 1) state.state = 'DUPLICATE_PR';
  else if (prs.some(pr => pr.state === 'MERGED')) state.state = 'PREVIEW_MERGED_UNVERIFIED';
  else if (prs.some(pr => pr.state === 'OPEN')) state.state = 'PR_OPEN';
  state.base_commit = JSON.parse(gh(['api', `repos/${REPOSITORY}/git/ref/heads/${PREVIEW_BASE}`])).object.sha;
  state.recent_runs = JSON.parse(gh(['api', `repos/${REPOSITORY}/actions/workflows/preview.yml/runs?per_page=5`])).workflow_runs.map(run => ({ id: run.id, sha: run.head_sha, event: run.event, status: run.status, conclusion: run.conclusion }));
  try {
    const response = await fetch('https://guaizzz.github.io/culture-taste-daily/preview-release.json', { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (response.ok) {
      const live = await response.json();
      state.live = { source_commit: live.source_commit, latest_issue: live.latest_issue };
      if (live.repository === REPOSITORY && live.latest_issue === date) state.state = 'LIVE_DATE_PRESENT_REQUIRES_HASH_VERIFICATION';
    } else state.live_status = `HTTP_${response.status}`;
  } catch { state.live_status = 'UNAVAILABLE'; }
}
state.checked_at = new Date().toISOString();
await mkdir('.stage4/operations', { recursive: true });
await writeFile('.stage4/operations/current-state.json', JSON.stringify(state, null, 2)+'\n');
console.log(JSON.stringify(state, null, 2));
