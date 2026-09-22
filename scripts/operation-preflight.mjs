import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { assertRepository, git, gh } from './lib/github-scope.mjs';
import { REPOSITORY, PREVIEW_BASE, checkScope, shanghaiDate } from './lib/preview-policy.mjs';
const { values } = parseArgs({ options: { date: { type: 'string' }, daily: { type: 'boolean' }, online: { type: 'boolean' } } });
const state = assertRepository();
state.base_ref = PREVIEW_BASE;
state.base_commit = git(['rev-parse', `origin/${PREVIEW_BASE}`]);
state.paths = git(['diff', '--name-only', `origin/${PREVIEW_BASE}...HEAD`]).split('\n').filter(Boolean);
state.blockers = values.daily ? checkScope({ ...state, base: PREVIEW_BASE, date: values.date ?? shanghaiDate() }) : [];
if (state.dirty) state.blockers.push('DIRTY_WORKTREE');
if (values.online) {
  const meta = JSON.parse(gh(['api', `repos/${REPOSITORY}`]));
  const base = JSON.parse(gh(['api', `repos/${REPOSITORY}/git/ref/heads/${PREVIEW_BASE}`]));
  if (meta.full_name !== REPOSITORY) state.blockers.push('REPOSITORY_IDENTITY');
  if (base.object.sha !== state.base_commit) state.blockers.push('STALE_BASE');
  state.push_permission = meta.permissions?.push === true;
  if (!state.push_permission) state.blockers.push('GITHUB_PUSH_PERMISSION');
}
await mkdir('.stage4/operations', { recursive: true });
await writeFile('.stage4/operations/preflight.json', JSON.stringify(state, null, 2)+'\n');
console.log(JSON.stringify(state, null, 2));
if (state.blockers.length) process.exitCode = 1;
