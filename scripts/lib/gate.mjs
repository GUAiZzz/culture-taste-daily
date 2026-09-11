import path from "node:path";
import { digestMap, fileDigestMap, readJson, stableJson, writeJson } from "./files.mjs";
import { validateJsonFile } from "./schema.mjs";
import { REQUIRED_TECHNICAL_CHECKS } from "./qa.mjs";

const REQUIRED_REVIEW_CHECKS = [
  "editorial_truth_judgment",
  "harrytone",
  "cultural_appropriateness",
  "image_rights_disposition",
  "hierarchy",
  "reference_integrity",
  "visual_authorship",
  "desktop_mobile_translation",
  "historical_fidelity",
];

function addMismatch(reasons, label, actual, expected) {
  if (actual !== expected) reasons.push(`${label} mismatch`);
}

export async function evaluateGate({ repoRoot, distDir, issueId, technicalEvidence, reviewEvidence, previousGoodRelease = null }) {
  const reasons = [];
  const buildReport = await readJson(path.join(distDir, "build-report.json"));
  const issueReport = buildReport.issues.find((issue) => issue.issue_id === issueId);
  if (!issueReport) throw new Error(`Build report has no issue ${issueId}`);
  const manifest = await readJson(path.join(distDir, "issues", issueId, "issue-manifest.public.json"));
  const contract = await readJson(path.join(repoRoot, "dependencies/contract.json"));
  const currentArtifactDigest = digestMap(await fileDigestMap(distDir, { exclude: ["build-report.json"] }));

  addMismatch(reasons, "current artifact digest", currentArtifactDigest, buildReport.artifact_digest);
  addMismatch(reasons, "canonical contract repository", buildReport.contract.repository, contract.repository);
  addMismatch(reasons, "canonical contract commit", buildReport.contract.commit, contract.canonical_main_commit);
  addMismatch(reasons, "canonical contract activation commit", buildReport.contract.activation_commit, contract.activation_commit);
  addMismatch(reasons, "canonical contract hash", buildReport.contract.sha256, contract.sha256);
  addMismatch(reasons, "canonical contract amendments", stableJson(buildReport.contract.amendments ?? []), stableJson(contract.amendments ?? []));
  if (!issueReport.date_semantics.production_candidate_valid) {
    reasons.push(...issueReport.date_semantics.reasons.map((reason) => `date semantics: ${reason}`));
  }

  if (manifest.status === "BLOCKED") reasons.push("public manifest reports BLOCKED");
  if (manifest.status === "DEGRADED") reasons.push("DEGRADED has no approved allowlist in Stage ④A");
  if (manifest.rights_summary.status !== "clear" || manifest.rights_summary.unknown_required_assets !== 0) {
    reasons.push("required image/media rights are not fully cleared");
  }

  if (!technicalEvidence) {
    reasons.push("independent technical evidence is missing");
  } else {
    await validateJsonFile(technicalEvidence, path.join(repoRoot, "schemas/technical-evidence.schema.json"), "technical evidence");
    addMismatch(reasons, "technical issue id", technicalEvidence.issue_id, issueId);
    addMismatch(reasons, "technical candidate digest", technicalEvidence.candidate_digest, issueReport.candidate_digest);
    addMismatch(reasons, "technical artifact digest", technicalEvidence.artifact_digest, buildReport.artifact_digest);
    if (technicalEvidence.status !== "PASS") reasons.push("independent technical evidence did not PASS");
    const technicalChecks = new Map(technicalEvidence.checks.map((check) => [check.id, check.status]));
    for (const id of REQUIRED_TECHNICAL_CHECKS) {
      if (technicalChecks.get(id) !== "PASS") reasons.push(`required technical check did not pass: ${id}`);
    }
  }

  if (!reviewEvidence) {
    reasons.push("named editorial/visual review is missing");
  } else {
    await validateJsonFile(reviewEvidence, path.join(repoRoot, "schemas/editorial-review.schema.json"), "editorial/visual review");
    addMismatch(reasons, "review issue id", reviewEvidence.issue_id, issueId);
    addMismatch(reasons, "review candidate digest", reviewEvidence.candidate_digest, issueReport.candidate_digest);
    addMismatch(reasons, "review artifact digest", reviewEvidence.artifact_digest, buildReport.artifact_digest);
    if (reviewEvidence.decision !== "APPROVE") reasons.push("named editorial/visual review is not APPROVE");
    if (!reviewEvidence.reviewed_at) reasons.push("named editorial/visual review has no review timestamp");
    if (/replace|generator/i.test(reviewEvidence.reviewer.name)) reasons.push("reviewer identity is not an approved named human");
    for (const id of REQUIRED_REVIEW_CHECKS) {
      const value = reviewEvidence.checks[id];
      if (id === "historical_fidelity" && value === "NOT_APPLICABLE") continue;
      if (value !== "APPROVE") reasons.push(`required editorial/visual review did not approve: ${id}`);
    }
  }

  const decision = reasons.length === 0 ? "AUTHORIZED" : "BLOCKED";
  const selectedRelease = decision === "AUTHORIZED" ? issueReport.candidate_digest : previousGoodRelease;
  return {
    schema_version: 1,
    kind: "evidence_gate_decision",
    scope: "local_non_production_simulation",
    production_authority: false,
    issue_id: issueId,
    candidate_digest: issueReport.candidate_digest,
    artifact_digest: buildReport.artifact_digest,
    decision,
    reasons,
    previous_good_release: previousGoodRelease,
    selected_release: selectedRelease,
  };
}

export async function writeGateDecision({ repoRoot, outPath, ...options }) {
  const decision = await evaluateGate({ repoRoot, ...options });
  await validateJsonFile(decision, path.join(repoRoot, "schemas/gate-decision.schema.json"), "gate decision");
  if (outPath) await writeJson(outPath, decision);
  return decision;
}
