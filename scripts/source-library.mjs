import path from 'node:path';
import { parseArgs } from 'node:util';
import { readJson } from './lib/files.mjs';
import { sourcePlan } from './lib/source-library.mjs';
import { shanghaiDate } from './lib/preview-policy.mjs';
import { externalWorkspacePath } from './lib/editorial-workspace.mjs';
const { values } = parseArgs({ options: { date: { type: 'string' }, scan: { type: 'string' }, subject: { type: 'string' }, summary: { type: 'boolean' } } });
try {
const date = values.date ?? shanghaiDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('DATE_IDENTITY');
let scan = [];
if (values.scan) {
  const file = await externalWorkspacePath(process.cwd(), path.resolve(values.scan));
  scan = await readJson(file);
  if (!Array.isArray(scan)) throw new Error('SOURCE_SCAN_SCHEMA');
}
const report = sourcePlan({ library: await readJson('automation/source-library.json'), radar: await readJson('automation/brand-radar.json'), date, scan });
if (values.subject) {
  const subject = report.subjects.find(s => s.id === values.subject || s.name === values.subject);
  if (!subject) throw new Error('UNKNOWN_SOURCE_SUBJECT');
  report.subjects = [subject];
}
if (values.summary) delete report.subjects;
console.log(JSON.stringify(report, null, 2));
if (report.blockers.length) process.exitCode = 1;
} catch (error) {
  const code = /^[A-Z][A-Z0-9_]+$/.test(error.message ?? '') ? error.message : 'SOURCE_SCAN_INPUT_OR_IO_ERROR';
  console.error(JSON.stringify({ status: 'BLOCKED', code, publication_authority: false }));
  process.exitCode = 1;
}
