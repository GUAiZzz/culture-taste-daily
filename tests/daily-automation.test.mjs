import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDailyPreflight } from "../scripts/lib/daily.mjs";
import { evaluateDateSemantics } from "../scripts/lib/dates.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("daily preflight is ready only inside the Shanghai final-refresh window", async () => {
  const report = await evaluateDailyPreflight({
    repoRoot,
    issueDate: "2026-08-24",
    now: new Date("2026-08-23T22:15:00Z"),
  });
  assert.equal(report.status, "READY_FOR_DRY_RUN");
  assert.equal(report.production_authority, false);
  assert.deepEqual(report.deployment, {
    merge: false,
    preview: false,
    production: false,
    preserve_previous_good: true,
  });
  assert.equal(report.shanghai_now, "2026-08-24T06:15:00+08:00");
});

test("daily preflight blocks an out-of-window run and preserves the previous good release", async () => {
  const report = await evaluateDailyPreflight({
    repoRoot,
    issueDate: "2026-08-24",
    now: new Date("2026-08-24T07:00:00Z"),
  });
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.deployment.preserve_previous_good, true);
  assert.match(report.blockers.join("\n"), /outside the publication-day 06:00–08:30/);
});

test("A1 allows the final refresh through 15:00 from 2026-08-26", async () => {
  const beforeDeadline = await evaluateDailyPreflight({
    repoRoot,
    issueDate: "2026-08-26",
    now: new Date("2026-08-26T06:59:00Z"),
  });
  const atDeadline = await evaluateDailyPreflight({
    repoRoot,
    issueDate: "2026-08-26",
    now: new Date("2026-08-26T07:00:00Z"),
  });
  const afterDeadline = await evaluateDailyPreflight({
    repoRoot,
    issueDate: "2026-08-26",
    now: new Date("2026-08-26T07:01:00Z"),
  });

  assert.equal(beforeDeadline.status, "READY_FOR_DRY_RUN");
  assert.equal(atDeadline.status, "READY_FOR_DRY_RUN");
  assert.equal(afterDeadline.status, "BLOCKED");
  assert.match(afterDeadline.blockers.join("\n"), /outside the publication-day 06:00–15:00/);
});

test("date semantics use A1 prospectively without reclassifying the historical window", async () => {
  const policy = JSON.parse(await readFile(path.join(repoRoot, "automation/daily-policy.json"), "utf8"));
  const manifest = {
    publication_date: "2026-08-26",
    candidate_created_at: "2026-08-25T18:00:00+08:00",
    research_locked_at: "2026-08-26T14:59:00+08:00",
    content_locked_at: "2026-08-26T15:00:00+08:00",
    content_lock: { locked_at: "2026-08-26T15:00:00+08:00" },
  };

  assert.equal(evaluateDateSemantics(manifest, policy.schedule).production_candidate_valid, true);
  const historical = {
    ...manifest,
    publication_date: "2026-08-25",
    candidate_created_at: "2026-08-24T18:00:00+08:00",
    research_locked_at: "2026-08-25T14:59:00+08:00",
    content_locked_at: "2026-08-25T15:00:00+08:00",
    content_lock: { locked_at: "2026-08-25T15:00:00+08:00" },
  };
  const historicalResult = evaluateDateSemantics(historical, policy.schedule);
  assert.equal(historicalResult.production_candidate_valid, false);
  assert.match(historicalResult.reasons.join("\n"), /06:00–08:30/);
});

test("daily preflight blocks a date that is not today's Shanghai date", async () => {
  const report = await evaluateDailyPreflight({
    repoRoot,
    issueDate: "2026-08-25",
    now: new Date("2026-08-23T22:15:00Z"),
  });
  assert.equal(report.status, "BLOCKED");
  assert.match(report.blockers.join("\n"), /must match the current Asia\/Shanghai calendar date/);
});

test("Thursday adds the Supreme drop beat without making it a publication quota", async () => {
  const report = await evaluateDailyPreflight({
    repoRoot,
    issueDate: "2026-08-27",
    now: new Date("2026-08-26T22:15:00Z"),
  });
  assert.equal(report.weekday, "Thursday");
  assert.ok(report.standing_beats.includes("supreme-thursday-drop"));
  const policy = JSON.parse(await readFile(path.join(repoRoot, "automation/daily-policy.json"), "utf8"));
  assert.equal(policy.standing_beats.find((beat) => beat.id === "supreme-thursday-drop").publication_quota, false);
});

test("daily policy cannot merge, deploy, alter Pages, or touch the legacy repository", async () => {
  const policy = JSON.parse(await readFile(path.join(repoRoot, "automation/daily-policy.json"), "utf8"));
  assert.deepEqual(policy.output, {
    open_pull_request: true,
    merge: false,
    deploy_preview: false,
    deploy_production: false,
    modify_pages_settings: false,
    modify_legacy_repository: false,
  });
  assert.equal(policy.failure.preserve_previous_good, true);
  assert.equal(policy.failure.allow_partial_publish, false);
  assert.equal(policy.schedule.research_lock_deadline, "15:00");
  assert.equal(policy.schedule.research_lock_deadline_effective_from, "2026-08-26");
  assert.equal(policy.schedule.historical_research_lock_deadline, "08:30");
});

test("daily preflight verifies the existing manual-only Preview and privacy defenses", async () => {
  const report = await evaluateDailyPreflight({
    repoRoot,
    issueDate: "2026-08-24",
    now: new Date("2026-08-23T22:15:00Z"),
  });
  assert.equal(report.status, "READY_FOR_DRY_RUN");
  assert.doesNotMatch(report.blockers.join("\n"), /Preview workflow|privacy ignore/);
});

test("brand radar is deterministic, complete, and independent from social following", async () => {
  const report = await evaluateDailyPreflight({
    repoRoot,
    issueDate: "2026-08-24",
    now: new Date("2026-08-23T22:15:00Z"),
  });
  const radar = JSON.parse(await readFile(path.join(repoRoot, "automation/brand-radar.json"), "utf8"));
  const subjects = radar.cohorts.flatMap((cohort) => cohort.subjects);
  const requiredAdditions = [
    "Stüssy",
    "Palace",
    "Brain Dead",
    "Aimé Leon Dore",
    "Noah",
    "Corteiz",
    "Denim Tears",
    "UNDERCOVER",
    "WTAPS",
    "NEIGHBORHOOD",
    "sacai",
    "Needles",
    "visvim",
    "AURALEE",
    "Hender Scheme",
    "POST ARCHIVE FACTION",
    "ADER ERROR",
    "thisisneverthat",
    "Gentle Monster",
    "KUSIKOHC",
    "ROARINGWILD",
    "Randomevent",
    "STAFFONLY",
    "SHUSHU/TONG",
    "SANKUANZ",
    "HAMCUS",
    "GOOPiMADE",
    "Guerrilla-Group",
    "INVINCIBLE",
    "Loewe",
    "Miu Miu",
    "Rick Owens",
    "Stone Island",
    "C.P. Company",
    "Martine Rose",
    "Wales Bonner",
    "Dries Van Noten",
    "Lemaire",
    "ASICS SportStyle",
    "New Balance",
    "HOKA",
    "Merrell 1TRL",
    "Nike ACG"
  ];
  assert.equal(new Set(subjects).size, subjects.length);
  for (const subject of requiredAdditions) assert.ok(subjects.includes(subject), `missing brand radar subject: ${subject}`);
  assert.equal(radar.rules.publication_quota, false);
  assert.equal(radar.rules.social_following_required, false);
  assert.equal(report.brand_radar.registry, "automation/brand-radar.json");
  assert.equal(report.brand_radar.publication_quota, false);
  assert.equal(report.brand_radar.social_following_required, false);
  assert.ok(report.brand_radar.subjects.length > 0);
});
