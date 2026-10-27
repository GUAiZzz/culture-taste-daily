import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { readJson, sha256 } from './lib/files.mjs';
import { editorialPackageBlockers, editorialSourceReport } from './lib/editorial-policy.mjs';
import { validateEditorialBinding } from './lib/editorial-binding.mjs';
import { externalWorkspacePath } from './lib/editorial-workspace.mjs';

const { values } = parseArgs({ options: {
  date: { type: 'string' }, 'private-evidence': { type: 'string' },
  'public-only': { type: 'boolean' },
} });
try {
const root = process.cwd();
const policy = await readJson(path.join(root, 'automation/daily-policy.json'));
const baselineBytes = await readFile(path.join(root, 'automation/published-baseline.json'));
if (sha256(baselineBytes) !== '76944302f8f7cb3b6e3d589672dafba5b6e799977cac4b3f62e6581adf70f733') throw new Error('PUBLISHED_BASELINE_CHANGED');
const baseline = JSON.parse(baselineBytes);
if (baseline.schema_version !== 1 || baseline.kind !== 'immutable_published_issue_baseline'
  || baseline.source_commit !== 'ac7de074d36ed554f2cf6f079cae7b57c2d26401') throw new Error('PUBLISHED_BASELINE_IDENTITY');
if (values.date && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)) throw new Error('DATE_IDENTITY');
if (values['private-evidence'] && values['public-only']) throw new Error('Choose private validation or public-only validation');
const dates = values.date ? [values.date] : (await readdir(path.join(root, 'src/issues')))
  .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
const checks = [];
for (const date of dates) {
  const folder = path.join(root, 'src/issues', date);
  const bytes = await readFile(path.join(folder, 'issue-manifest.public.json'));
  const manifest = JSON.parse(bytes);
  const preserved = baseline.issues.find(issue => issue.date === date);
  if (preserved) {
    checks.push({ date, status: sha256(bytes) === preserved.manifest_sha256 ? 'PRESERVED_ALREADY_LIVE' : 'FAIL',
      blockers: sha256(bytes) === preserved.manifest_sha256 ? [] : ['PUBLISHED_ISSUE_CHANGED'] });
    continue;
  }
  const content = await readFile(path.join(folder, 'content.md'), 'utf8');
  const blockers = editorialPackageBlockers({ manifest, content, policy, unpublished: true });
  let sources;
  if (values['private-evidence']) {
    const actualPath = await externalWorkspacePath(root, path.resolve(values['private-evidence']));
    const privateResearch = await readJson(actualPath);
    sources = editorialSourceReport({ manifest, privateResearch, policy });
    blockers.push(...sources.blockers);
    if (!manifest.historical_supplement && policy.editorial?.private_workspace_required === true) {
      blockers.push(...await validateEditorialBinding({ repoRoot: root, manifest, content, privateResearch, policy }));
    }
  }
  checks.push({ date, status: blockers.length ? 'FAIL' : values['private-evidence'] ? 'EDITORIAL_EVIDENCE_COMPLETE' : 'PUBLIC_PACKAGE_VALID',
    blockers: [...new Set(blockers)], stories: sources?.stories,
    private_reading_verified: Boolean(values['private-evidence']) && !sources?.blockers.length });
}
const failed = checks.some(check => check.blockers.length);
console.log(JSON.stringify({ status: failed ? 'FAIL' : 'PASS', scope: values['private-evidence'] ? 'package_and_private_read_sources' : 'public_package_only',
  publication_authority: false, checks }, null, 2));
if (failed) process.exitCode = 1;
} catch (error) {
  const code = /^[A-Z][A-Z0-9_]+$/.test(error.message ?? '') ? error.message : 'EDITORIAL_INPUT_OR_IO_ERROR';
  console.error(JSON.stringify({ status: 'BLOCKED', code, publication_authority: false }));
  process.exitCode = 1;
}
