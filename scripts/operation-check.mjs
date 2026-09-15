import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { readJson } from './lib/files.mjs';
import { checkSchedule } from './lib/schedule.mjs';
const { values } = parseArgs({ options: { 'automation-file': { type: 'string' } } });
const policy = await readJson('automation/daily-policy.json');
const issues = [];
const times = [policy.schedule.start_time, ...policy.schedule.recovery_check_times, policy.schedule.final_check_time];
const expected = policy.schedule.scheduler_hours.map(hour => `${String(hour).padStart(2, '0')}:00`);
if (JSON.stringify(times) !== JSON.stringify(expected)) issues.push('INTERNAL_SCHEDULE_DRIFT');
if (policy.timezone !== 'Asia/Shanghai' || policy.output.deploy_production !== false || policy.output.modify_pages_settings !== false || policy.output.modify_legacy_repository !== false) issues.push('AUTHORITY_DRIFT');
for (const file of ['docs/PRODUCTION_STATUS.md', 'docs/PREVIEW_BUILD.md']) {
  const text = await readFile(file, 'utf8');
  if (!text.includes('ops:state')) issues.push(`LIVE_STATE_SOURCE_MISSING:${file}`);
  if (/2026-08-25.{0,30}(?:current|latest)|(?:current|latest).{0,30}2026-08-25/i.test(text)) issues.push(`STALE_LATEST_DATE:${file}`);
}
const workflow = await readFile('.github/workflows/preview.yml', 'utf8');
if (/^\s+(?:schedule|push):/m.test(workflow) || !workflow.includes('expected_sha')) issues.push('WORKFLOW_AUTHORITY_DRIFT');
if (values['automation-file']) {
  const config = await readFile(values['automation-file'], 'utf8');
  const recurrence = config.match(/^rrule = "([^"]+)"/m)?.[1];
  if (!recurrence || !checkSchedule(policy, recurrence)) issues.push('SCHEDULER_DRIFT');
  if (!/^status = "ACTIVE"$/m.test(config)) issues.push('SCHEDULER_NOT_ACTIVE');
  if (!config.includes('npm run ops:state') || !config.includes('automation/daily-policy.json')) issues.push('SCHEDULER_RUNBOOK_DRIFT');
}
console.log(JSON.stringify({ status: issues.length ? 'FAIL' : 'PASS', issues, scheduler_checked: Boolean(values['automation-file']) }, null, 2));
if (issues.length) process.exitCode = 1;
