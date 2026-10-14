import { execFileSync } from 'node:child_process';
import { REPOSITORY } from './preview-policy.mjs';

export function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
export function assertRepository(cwd = process.cwd()) {
  const remote = git(['remote', 'get-url', 'origin'], cwd);
  if (![`https://github.com/${REPOSITORY}.git`, `https://github.com/${REPOSITORY}`, `git@github.com:${REPOSITORY}.git`].includes(remote)) {
    throw new Error('REPOSITORY_IDENTITY: origin is not the authorized Culture & Taste repository');
  }
  // A push URL can differ from the fetch URL. Verify both before any write.
  const push = git(['remote', 'get-url', '--push', '--all', 'origin'], cwd).split('\n');
  if (push.length !== 1 || ![`https://github.com/${REPOSITORY}.git`, `https://github.com/${REPOSITORY}`, `git@github.com:${REPOSITORY}.git`].includes(push[0])) {
    throw new Error('REPOSITORY_IDENTITY: push destination differs');
  }
  return { repository: REPOSITORY, root: git(['rev-parse', '--show-toplevel'], cwd),
    branch: git(['branch', '--show-current'], cwd), head: git(['rev-parse', 'HEAD'], cwd),
    dirty: Boolean(git(['status', '--porcelain'], cwd)) };
}
export function gh(args) {
  // Every call must explicitly identify the only writable/readable task repository.
  const api = args[0] === 'api';
  if (api ? !args[1]?.startsWith(`repos/${REPOSITORY}/`) && args[1] !== `repos/${REPOSITORY}`
    : !args.some((value, i) => value === '--repo' && args[i + 1] === REPOSITORY)) {
    throw new Error('GITHUB_SCOPE: explicit repository required');
  }
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 }).trim();
}
