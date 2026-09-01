import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { exists, readJson, sha256File } from "./files.mjs";
import { researchWindowFor } from "./dates.mjs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHA1_PATTERN = /^[0-9a-f]{40}$/;

function shanghaiParts(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: value("weekday"),
    time: `${value("hour")}:${value("minute")}`,
  };
}

function minutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function selectedBeats(policy, weekday) {
  return policy.standing_beats.filter((beat) => beat.cadence === "daily" || (beat.cadence === "thursday" && weekday === "Thursday"));
}

function selectedBrandCohort(radar, targetDate) {
  const day = Math.floor(Date.parse(`${targetDate}T00:00:00Z`) / 86_400_000);
  return radar.cohorts[day % radar.cohorts.length];
}

function validateBrandRadar({ policy, radar, blockers }) {
  if (policy.brand_radar?.registry !== "automation/brand-radar.json") blockers.push("brand radar registry path is invalid");
  const expectedMode = "full_registry_daily_quick_scan_plus_focus_cohort_and_standing_beats";
  if (policy.brand_radar?.selection !== expectedMode || radar.rotation?.mode !== expectedMode) blockers.push("brand radar selection mode is invalid");
  if (policy.brand_radar?.full_registry_daily_quick_scan !== true || radar.rotation?.full_registry_daily_quick_scan !== true) {
    blockers.push("brand radar must quick-scan the full active registry every day");
  }
  if (policy.brand_radar?.publication_quota !== false || policy.brand_radar?.social_following_required !== false) {
    blockers.push("brand radar cannot require publication or social following");
  }
  if (radar.rules?.publication_quota !== false || radar.rules?.social_following_required !== false) {
    blockers.push("brand radar rules cannot require publication or social following");
  }
  if (!Array.isArray(radar.cohorts) || radar.cohorts.length !== radar.rotation?.full_cycle_days) {
    blockers.push("brand radar cohorts must match the declared full cycle");
    return;
  }
  const subjects = radar.cohorts.flatMap((cohort) => cohort.subjects ?? []);
  if (subjects.length === 0 || subjects.some((subject) => typeof subject !== "string" || subject.trim() === "")) {
    blockers.push("brand radar subjects must be non-empty names");
  }
  if (new Set(subjects).size !== subjects.length) blockers.push("brand radar subjects must be unique");
}

async function priorIssueDates(repoRoot, issueDate) {
  const issueRoot = path.join(repoRoot, "src/issues");
  if (!(await exists(issueRoot))) return [];
  const dates = (await readdir(issueRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && DATE_PATTERN.test(entry.name) && entry.name < issueDate)
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));
  return dates.slice(0, 7);
}

export async function evaluateDailyPreflight({ repoRoot, now = new Date(), issueDate } = {}) {
  if (!repoRoot) throw new Error("repoRoot is required");
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error("now must be a valid Date");

  const policyPath = path.join(repoRoot, "automation/daily-policy.json");
  const brandRadarPath = path.join(repoRoot, "automation/brand-radar.json");
  const contractDependencyPath = path.join(repoRoot, "dependencies/contract.json");
  const harrytoneDependencyPath = path.join(repoRoot, "dependencies/harrytone.json");
  const previewWorkflowPath = path.join(repoRoot, ".github/workflows/preview.yml");
  const gitignorePath = path.join(repoRoot, ".gitignore");
  const policy = await readJson(policyPath);
  const brandRadar = await readJson(brandRadarPath);
  const contract = await readJson(contractDependencyPath);
  const harrytone = await readJson(harrytoneDependencyPath);
  const shanghai = shanghaiParts(now);
  const targetDate = issueDate ?? shanghai.date;
  const blockers = [];

  if (!DATE_PATTERN.test(targetDate)) blockers.push("issue date must use YYYY-MM-DD");
  if (targetDate !== shanghai.date) blockers.push("issue date must match the current Asia/Shanghai calendar date");
  if (policy.timezone !== "Asia/Shanghai") blockers.push("daily policy timezone must remain Asia/Shanghai");
  if (policy.mode !== "scheduled_dry_run_candidate") blockers.push("daily policy may authorize dry-run candidates only");
  if (policy.dry_run_base_ref !== "preview-build-v1") blockers.push("daily candidates must use the current preview-build-v1 publication base");
  const closingPaletteGate = policy.closing_palette_gate;
  if (!closingPaletteGate?.required
    || !DATE_PATTERN.test(closingPaletteGate.effective_from)
    || closingPaletteGate.comparison_window_issues !== 7
    || closingPaletteGate.text_contrast_minimum < 4.5
    || closingPaletteGate.accent_contrast_minimum < 3) {
    blockers.push("daily closing palette gate must remain locked, contrast-safe, and compared against seven issues");
  }
  validateBrandRadar({ policy, radar: brandRadar, blockers });

  const currentMinute = minutes(shanghai.time);
  const researchWindow = researchWindowFor(targetDate, policy.schedule);
  const windowStart = minutes(researchWindow.start);
  const windowEnd = minutes(researchWindow.deadline);
  if (targetDate >= policy.schedule.research_lock_deadline_effective_from) {
    for (const [name, value] of [
      ["start_time", policy.schedule.start_time],
      ...(policy.schedule.recovery_check_times ?? []).map((value, index) => [`recovery_check_times[${index}]`, value]),
    ]) {
      if (typeof value !== "string" || minutes(value) < windowStart || minutes(value) > windowEnd) {
        blockers.push(`${name} must remain inside the publication-day ${researchWindow.start}–${researchWindow.deadline} final-refresh window`);
      }
    }
    if (policy.schedule.recover_when_current_candidate_missing !== true) {
      blockers.push("same-day candidate recovery must remain enabled before the final-refresh deadline");
    }
  }
  if (currentMinute < windowStart || currentMinute > windowEnd) {
    blockers.push(`run is outside the publication-day ${researchWindow.start}–${researchWindow.deadline} final-refresh window`);
  }

  if (contract.repository !== "GUAiZzz/culture-taste-daily" || contract.path !== "docs/PRODUCTION_CONTRACT_V3.md") {
    blockers.push("canonical contract dependency identity does not match Culture & Taste V3");
  }
  if (!SHA1_PATTERN.test(contract.canonical_main_commit) || !SHA1_PATTERN.test(contract.activation_commit)) {
    blockers.push("canonical contract dependency commits are invalid");
  }
  const contractPath = path.join(repoRoot, contract.path);
  if (!(await exists(contractPath))) {
    blockers.push("canonical contract file is missing");
  } else if ((await sha256File(contractPath)) !== contract.sha256) {
    blockers.push("canonical contract file hash does not match dependencies/contract.json");
  }
  for (const amendment of contract.amendments ?? []) {
    if (!SHA1_PATTERN.test(amendment.commit)) blockers.push(`contract amendment ${amendment.id} commit is invalid`);
    const amendmentPath = path.join(repoRoot, amendment.path);
    if (!(await exists(amendmentPath))) {
      blockers.push(`contract amendment ${amendment.id} file is missing`);
    } else if ((await sha256File(amendmentPath)) !== amendment.sha256) {
      blockers.push(`contract amendment ${amendment.id} hash does not match dependencies/contract.json`);
    }
  }

  if (harrytone.repository !== "GUAiZzz/harry-tone" || harrytone.branch !== "main" || !SHA1_PATTERN.test(harrytone.commit)) {
    blockers.push("HarryTone dependency identity is invalid");
  }
  if (harrytone.source_copied !== false || harrytone.integration !== "reference-only") {
    blockers.push("HarryTone must remain a reference-only private dependency");
  }

  for (const [key, value] of Object.entries(policy.output)) {
    if (["merge", "deploy_preview", "deploy_production", "modify_pages_settings", "modify_legacy_repository"].includes(key) && value !== false) {
      blockers.push(`daily dry-run policy cannot authorize ${key}`);
    }
  }
  if (policy.failure.preserve_previous_good !== true || policy.failure.allow_partial_publish !== false) {
    blockers.push("failure policy must preserve the previous good release and forbid partial publication");
  }

  const previewWorkflow = await readFile(previewWorkflowPath, "utf8");
  if (/^\s*schedule:/m.test(previewWorkflow) || /^\s+push:/m.test(previewWorkflow)) {
    blockers.push("Preview workflow must not gain a schedule or push-triggered deployment");
  }
  if (!/if: github\.event_name == 'workflow_dispatch'/.test(previewWorkflow)) {
    blockers.push("Preview deployment must remain guarded by explicit workflow dispatch");
  }
  if (!new RegExp(`branches: \\[main, ${policy.dry_run_base_ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`).test(previewWorkflow)) {
    blockers.push("Preview pull-request verification must include the configured daily base ref");
  }

  const gitignore = await readFile(gitignorePath, "utf8");
  for (const requiredIgnore of ["private/", "research-private/", "source-ledger*.json", ".env", "credentials*.json", "vendor/harry-tone/"]) {
    if (!gitignore.split(/\r?\n/).includes(requiredIgnore)) blockers.push(`missing privacy ignore protection: ${requiredIgnore}`);
  }

  const issueExists = await exists(path.join(repoRoot, "src/issues", targetDate));
  const status = blockers.length === 0 ? "READY_FOR_DRY_RUN" : "BLOCKED";
  const brandCohort = brandRadar.cohorts.length > 0 ? selectedBrandCohort(brandRadar, targetDate) : null;
  return {
    schema_version: 1,
    kind: "daily_candidate_preflight",
    status,
    production_authority: false,
    target_date: targetDate,
    shanghai_now: `${shanghai.date}T${shanghai.time}:00+08:00`,
    weekday: shanghai.weekday,
    mode: policy.mode,
    schedule: {
      primary: policy.schedule.start_time,
      recovery_checks: policy.schedule.recovery_check_times ?? [],
      deadline: researchWindow.deadline,
      recover_when_current_candidate_missing: policy.schedule.recover_when_current_candidate_missing === true,
    },
    candidate_action: issueExists ? "repair_or_refresh_existing_candidate" : "create_new_candidate",
    branch_name: `${policy.branch_prefix}-${targetDate}`,
    base_ref: policy.dry_run_base_ref,
    source_lanes: policy.required_source_lanes,
    standing_beats: selectedBeats(policy, shanghai.weekday).map((beat) => beat.id),
    brand_radar: brandCohort
      ? {
          registry: policy.brand_radar.registry,
          full_registry_daily_quick_scan: true,
          full_registry_subjects: brandRadar.cohorts.flatMap((cohort) => cohort.subjects),
          focus_cohort_id: brandCohort.id,
          focus_subjects: brandCohort.subjects,
          publication_quota: false,
          social_following_required: false,
        }
      : null,
    previous_issue_dates: await priorIssueDates(repoRoot, targetDate),
    runtime_checks_required: policy.required_runtime_checks,
    deployment: {
      merge: false,
      preview: false,
      production: false,
      preserve_previous_good: true,
    },
    blockers,
  };
}
