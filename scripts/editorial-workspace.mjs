import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  initEditorialWorkspace, readEditorialWorkspace, mutateEditorialWorkspace,
  editorialWorkspaceStatus, exportEditorialResearch, externalWorkspacePath,
} from './lib/editorial-workspace.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  workspace: { type: 'string' }, date: { type: 'string' }, input: { type: 'string' }, output: { type: 'string' },
} });
const action = positionals[0] ?? 'status';
const repoRoot = process.cwd();
try {
  if (positionals.length > 1 || !['init', 'status', 'plan', 'apply', 'checkpoint', 'carry', 'export'].includes(action)) throw new Error('EDITORIAL_WORKSPACE_COMMAND_INVALID');
  if (!values.workspace) throw new Error('PRIVATE_WORKSPACE_ABSOLUTE_PATH_REQUIRED');
  const policy = JSON.parse(await readFile(path.join(repoRoot, 'automation/daily-policy.json'), 'utf8'));
  let current;
  if (action === 'init') current = await initEditorialWorkspace({ repoRoot, workspace: values.workspace, date: values.date });
  else if (['apply', 'checkpoint', 'carry'].includes(action)) {
    if (!values.input) throw new Error('PRIVATE_OPERATION_INPUT_REQUIRED');
    const source = await externalWorkspacePath(repoRoot, values.input);
    const input = JSON.parse(await readFile(source, 'utf8'));
    current = await mutateEditorialWorkspace({ repoRoot, workspace: values.workspace, input, action });
  } else if (action === 'export') {
    if (!values.output) throw new Error('PRIVATE_EXPORT_OUTPUT_REQUIRED');
    console.log(JSON.stringify({ status: 'PRIVATE_LEDGER_EXPORTED', ...await exportEditorialResearch({ repoRoot, workspace: values.workspace, output: values.output }) }, null, 2));
    process.exit(0);
  } else current = await readEditorialWorkspace({ repoRoot, workspace: values.workspace });
  if (values.date && values.date !== current.state.target_date) throw new Error('WORKSPACE_DATE_IDENTITY');
  console.log(JSON.stringify({ ...editorialWorkspaceStatus({ ...current, policy }),
    ...(current.created !== undefined ? { created: current.created } : {}),
    ...(current.replayed !== undefined ? { replayed: current.replayed } : {}) }, null, 2));
} catch (error) {
  // Do not print private draft/source bodies or raw JSON parser excerpts.
  const safe = /^[A-Z][A-Z0-9_]+$/.test(error.message ?? '') ? error.message : 'EDITORIAL_WORKSPACE_IO_OR_INPUT_ERROR';
  console.error(JSON.stringify({ status: 'BLOCKED', code: safe, publication_eligible: false }));
  process.exitCode = 1;
}
