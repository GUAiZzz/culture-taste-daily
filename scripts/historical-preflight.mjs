import path from 'node:path';
import { parseArgs } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { evaluateDailyPreflight } from './lib/daily.mjs';
import { assertRepository, git } from './lib/github-scope.mjs';
import { shanghaiDate } from './lib/preview-policy.mjs';
import { isAuthorizedHistoricalDate, historicalAuthorizationDigest } from './lib/historical-supplements.mjs';

const { values } = parseArgs({ options: { date: { type: 'string' } } });
const now = new Date();
const identity = assertRepository();
const authorization = JSON.parse(await readFile('automation/historical-supplements.json', 'utf8'));
const daily = await evaluateDailyPreflight({ repoRoot: path.resolve(process.cwd()), now });
const policy = JSON.parse(await readFile('automation/daily-policy.json', 'utf8'));
const radar = JSON.parse(await readFile('automation/brand-radar.json', 'utf8'));
const date = values.date;
const blockers = [...daily.blockers];
if (!isAuthorizedHistoricalDate(authorization, date) || date > shanghaiDate(now)) blockers.push('HISTORICAL_AUTHORITY');
if (identity.dirty) blockers.push('DIRTY_WORKTREE');
const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
if (localTime >= policy.schedule.final_check_time) blockers.push('FINAL_CHECKPOINT_RECONCILIATION_ONLY');
if (isAuthorizedHistoricalDate(authorization, date)) {
  if (git(['ls-tree', 'origin/preview-build-v1', '--', `src/issues/${date}/issue-manifest.public.json`])) blockers.push('HISTORICAL_ALREADY_LIVE');
}
const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
const focus = Number.isFinite(day) ? radar.cohorts[day % radar.cohorts.length] : null;
const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
const issueDates = (await readdir('src/issues', { withFileTypes: true })).filter(entry => entry.isDirectory()
  && /^\d{4}-\d{2}-\d{2}$/.test(entry.name)).map(entry => entry.name).sort();
const previousDates = issueDates.filter(d => d < date).reverse().slice(0, 7);
const followingDates = issueDates.filter(d => d > date).slice(0, 2);
const report = { ...daily, kind: 'historical_supplement_preflight', target_date: date,
  research_date: shanghaiDate(now), branch_name: `automation/culture-taste-${date}`,
  candidate_action: issueDates.includes(date) ? 'repair_disclosed_supplement' : 'create_disclosed_supplement',
  authorization_id: authorization.authorization_id, authorization_digest: historicalAuthorizationDigest(authorization),
  status: blockers.length ? 'BLOCKED' : 'READY_FOR_HISTORICAL_RESEARCH', blockers: [...new Set(blockers)],
  previous_issue_dates: previousDates,
  following_issue_dates_for_deduplication: followingDates,
  standing_beats: policy.standing_beats.filter(b => b.cadence === 'daily' || (b.cadence === 'thursday' && weekday === 4)).map(b => b.id),
  brand_radar: { ...daily.brand_radar, focus_cohort_id: focus?.id, focus_subjects: focus?.subjects },
};
console.log(JSON.stringify(report, null, 2));
if (blockers.length) process.exitCode = 1;
