import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDailyPreflight } from "../scripts/lib/daily.mjs";
import { evaluateDateSemantics } from "../scripts/lib/dates.mjs";
import { assertOfficialStoryImages } from "../scripts/lib/official-media.mjs";

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
  assert.equal(policy.schedule.start_time, "09:30");
  assert.equal(policy.schedule.research_lock_deadline_effective_from, "2026-08-26");
  assert.equal(policy.schedule.historical_research_lock_deadline, "08:30");
  assert.deepEqual(policy.official_image_gate, {
    required: true,
    effective_from: "2026-08-25",
    required_origin_authority: "first_party_official",
    required_source_relationship: "first_party_official",
    original_visual_satisfies: false,
    preview_external_allowed: true,
    production_requires_cleared_rights: true,
  });
  assert.deepEqual(policy.daily_radar.categories, ["fashion", "music", "objects", "city"]);
  assert.equal(policy.daily_radar.minimum_items_per_category, 2);
  assert.equal(policy.daily_radar.supplemental_to_issue, true);
  assert.equal(policy.daily_radar.changes_issue_selection, false);
  assert.equal(policy.daily_radar.first_party_official_media_required, true);
  assert.equal(policy.daily_radar.official_video_preferred_when_available, true);
  assert.equal(policy.daily_radar.included_in_rss, false);
  assert.equal(policy.dry_run_base_ref, "preview-build-v1");
  assert.ok(policy.required_runtime_checks.includes("live_public_source_and_media_health"));
});

test("weekly health audit is read-only and aligned to the current publication base", async () => {
  const policy = JSON.parse(await readFile(path.join(repoRoot, "automation/weekly-health-policy.json"), "utf8"));
  assert.equal(policy.mode, "read_only_health_audit");
  assert.equal(policy.timezone, "Asia/Shanghai");
  assert.equal(policy.base_ref, "preview-build-v1");
  assert.deepEqual(policy.schedule, { weekday: "Sunday", start_time: "16:30" });
  assert.ok(Object.values(policy.output).every((value) => value === false));
  assert.equal(policy.failure.preserve_previous_good, true);
  assert.ok(policy.required_checks.includes("all_published_source_and_media_links"));
});

test("official image gate accepts a linked first-party official Preview image", () => {
  const origin = "https://official.example/events/story";
  const manifest = {
    issue_id: "2026-08-25",
    publication_date: "2026-08-25",
    stories: [{
      id: "verified-story",
      sources: [{ url: origin, relationship: "first_party_official" }],
      media: {
        kind: "source_image",
        origin_url: origin,
        external_image_url: "https://official.example/assets/story.jpg",
        origin_authority: "first_party_official",
        rights_basis: "preview_user_authorized_external",
      },
    }],
  };
  const gate = {
    required: true,
    effective_from: "2026-08-25",
    required_origin_authority: "first_party_official",
    required_source_relationship: "first_party_official",
  };
  assert.doesNotThrow(() => assertOfficialStoryImages(manifest, gate));
});

test("official image gate rejects an owned diagram as the only story visual", () => {
  const manifest = {
    issue_id: "2026-08-25",
    publication_date: "2026-08-25",
    stories: [{ id: "diagram-only", sources: [], media: { kind: "data_diagram", rights_basis: "owned_original" } }],
  };
  assert.throws(
    () => assertOfficialStoryImages(manifest, { required: true, effective_from: "2026-08-25", required_origin_authority: "first_party_official", required_source_relationship: "first_party_official" }),
    /editorial visuals cannot satisfy the gate/,
  );
});

test("official image gate rejects media and search sources posing as official", () => {
  const origin = "https://media.example/story";
  const manifest = {
    issue_id: "2026-08-25",
    publication_date: "2026-08-25",
    stories: [{
      id: "third-party-image",
      sources: [{ url: origin, relationship: "independent_reporting" }],
      media: {
        kind: "source_image",
        origin_url: origin,
        external_image_url: "https://media.example/story.jpg",
        origin_authority: "independent_media",
        rights_basis: "preview_user_authorized_external",
      },
    }],
  };
  assert.throws(
    () => assertOfficialStoryImages(manifest, { required: true, effective_from: "2026-08-25", required_origin_authority: "first_party_official", required_source_relationship: "first_party_official" }),
    /not marked first-party official/,
  );
});

test("official image gate rejects an official-looking page absent from the story source chain", () => {
  const origin = "https://official.example/events/missing";
  const manifest = {
    issue_id: "2026-08-25",
    publication_date: "2026-08-25",
    stories: [{
      id: "missing-source-chain",
      sources: [{ url: "https://media.example/story", relationship: "independent_reporting" }],
      media: {
        kind: "source_image",
        origin_url: origin,
        external_image_url: "https://official.example/assets/story.jpg",
        origin_authority: "first_party_official",
        rights_basis: "preview_user_authorized_external",
      },
    }],
  };
  assert.throws(
    () => assertOfficialStoryImages(manifest, { required: true, effective_from: "2026-08-25", required_origin_authority: "first_party_official", required_source_relationship: "first_party_official" }),
    /must match a first-party official story source/,
  );
});

test("daily preflight verifies the existing manual-only Preview and privacy defenses", async () => {
  const report = await evaluateDailyPreflight({
    repoRoot,
    issueDate: "2026-08-24",
    now: new Date("2026-08-23T22:15:00Z"),
  });
  assert.equal(report.status, "READY_FOR_DRY_RUN");
  assert.doesNotMatch(report.blockers.join("\n"), /Preview workflow|privacy ignore/);
  assert.equal(report.base_ref, "preview-build-v1");
  assert.deepEqual(report.schedule, { primary: "09:30", deadline: "08:30" });
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
