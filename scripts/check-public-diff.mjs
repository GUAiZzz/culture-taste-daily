import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { assertRepository, git } from './lib/github-scope.mjs';
import { checkScope } from './lib/preview-policy.mjs';
import { assertPublicTree } from './lib/privacy.mjs';
const { values } = parseArgs({ options: { base: { type: 'string' }, branch: { type: 'string' } } });
assertRepository();
const base = values.base ?? 'origin/preview-build-v1';
if (!/^(?:origin\/(?:main|preview-build-v1)|[a-f0-9]{40})$/.test(base)) throw new Error('Invalid comparison base');
const paths = git(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]).split('\n').filter(Boolean);
const allPaths = git(['diff', '--name-only', `${base}...HEAD`]).split('\n').filter(Boolean);
const branch = values.branch ?? git(['branch', '--show-current']);
if (branch.startsWith('automation/culture-taste-')) {
  const reasons = checkScope({ repository: 'GUAiZzz/culture-taste-daily', base: 'preview-build-v1', branch,
    date: branch.slice('automation/culture-taste-'.length), paths: allPaths });
  if (reasons.length) throw new Error(reasons.join(', '));
}
for (const file of allPaths) {
  if (file.startsWith('src/historical/') || file.startsWith('candidate/')) throw new Error(`PRESERVED_ORIGINAL ${file}`);
}
const scratch = await mkdtemp(path.join(tmpdir(), 'ctd-public-diff-'));
try {
  for (const file of paths) {
    if (!/^(?:(?:src|core|schemas|scripts|tests|deployment|automation|dependencies|docs|\.github|\.agents)\/|(?:README\.md|AGENTS\.md|package(?:-lock)?\.json|\.gitignore)$)/.test(file)) throw new Error(`PUBLIC_ALLOWLIST ${file}`);
    if (/^(?:dist|\.stage4|node_modules|release|production|\.firecrawl)\//.test(file)) throw new Error(`GENERATED_FILE ${file}`);
    if (file.startsWith('src/historical/') || file.startsWith('candidate/')) throw new Error(`PRESERVED_ORIGINAL ${file}`);
    // Read committed bytes; don't follow working-tree symlinks.
    const mode = git(['ls-tree', 'HEAD', '--', file]).split(' ')[0];
    if (mode === '120000' || mode === '160000') throw new Error(`UNSAFE_FILE_MODE ${file}`);
    const destination = path.join(scratch, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, execFileSync('git', ['show', `HEAD:${file}`], { maxBuffer: 20 * 1024 * 1024 }));
  }
  await assertPublicTree(scratch);
  console.log(JSON.stringify({ status: 'PASS', branch, base, checked_files: paths.length }));
} finally { await rm(scratch, { recursive: true, force: true }); }
