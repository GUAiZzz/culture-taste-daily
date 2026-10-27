import { readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { sha256 } from './files.mjs';
import { externalWorkspacePath } from './editorial-workspace.mjs';
import { validateEditorialBinding } from './editorial-binding.mjs';
import { editorialBlockers } from './editorial-policy.mjs';
import { evaluatePreview, DIGEST, shanghaiDate } from './preview-policy.mjs';
import { historicalPackageBlockers, historicalSourceBlockers } from './historical-supplements.mjs';

// Reuse only the exact private inputs that authorized the genuine execute
// attempt. This helper never writes or dispatches; callers hold the workspace
// lock around a new external side effect.
export async function loadResumeEvidence({ repoRoot, receipt, pr, policy, manifest, content,
  authorization = null, now = new Date(), bindingValidator = validateEditorialBinding }) {
  const inputs = receipt?.private_inputs;
  if (!inputs || !DIGEST.test(inputs.attestation_sha256 ?? '') || !DIGEST.test(inputs.research_sha256 ?? '')) {
    return { blockers: ['RESUME_PRIVATE_INPUTS_REQUIRED'] };
  }
  let evidence, privateResearch;
  try {
    const attestationPath = await externalWorkspacePath(repoRoot, inputs.attestation_path);
    const researchPath = await externalWorkspacePath(repoRoot, inputs.research_path);
    const attestationBytes = await readFile(attestationPath), researchBytes = await readFile(researchPath);
    if (sha256(attestationBytes) !== inputs.attestation_sha256 || sha256(researchBytes) !== inputs.research_sha256) {
      return { blockers: ['RESUME_PRIVATE_INPUTS_CHANGED'] };
    }
    evidence = JSON.parse(attestationBytes.toString('utf8'));
    privateResearch = JSON.parse(researchBytes.toString('utf8'));
  } catch { return { blockers: ['RESUME_PRIVATE_INPUTS_UNAVAILABLE'] }; }
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || !privateResearch || typeof privateResearch !== 'object' || Array.isArray(privateResearch)) {
    return { blockers: ['RESUME_PRIVATE_INPUTS_INVALID'] };
  }
  const blockers = [];
  if (evidence.target_date !== receipt.date || evidence.source_commit !== pr?.headRefOid
    || evidence.base_commit !== receipt.base_commit || evidence.candidate_digest !== receipt.candidate_digest
    || evidence.artifact_digest !== receipt.artifact_digest || evidence.policy_digest !== receipt.policy_digest) blockers.push('RESUME_EVIDENCE_BINDING');
  let editorialChecks = [], historicalChecks = [];
  if (authorization) {
    historicalChecks = [...historicalPackageBlockers({ manifest, content, authorization, now }),
      ...historicalSourceBlockers({ manifest, privateResearch, authorization, now })];
    if (manifest?.research_locked_at?.slice(0, 10) !== shanghaiDate(now)) historicalChecks.push('HISTORICAL_REFRESH_REQUIRED');
  } else {
    editorialChecks = editorialBlockers({ manifest, content, privateResearch, policy, now });
    if (policy.editorial?.private_workspace_required === true) editorialChecks.push(...await bindingValidator({
      repoRoot, manifest, content, privateResearch, policy, now,
    }));
  }
  const previous = receipt.validated_runtime;
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) blockers.push('RESUME_VALIDATED_RUNTIME_REQUIRED');
  const runtime = { ...previous, source_commit: pr?.headRefOid, base_commit: receipt.base_commit,
    candidate_digest: receipt.candidate_digest, artifact_digest: receipt.artifact_digest,
    formal_story_count: manifest?.stories?.length,
    private_evidence_matches: inputs.research_sha256 === evidence.research?.private_evidence_sha256,
    editorial_valid: !editorialChecks.length, editorial_blockers: editorialChecks,
    historical_supplement_valid: authorization ? !historicalChecks.length : false,
    historical_supplement_blockers: historicalChecks };
  const decision = evaluatePreview({ evidence, runtime, policy, now });
  blockers.push(...decision.blockers);
  return { blockers: [...new Set(blockers)], evidence, privateResearch };
}

// Paths and detailed run inputs stay in the ignored local receipt, never in
// console output or a public Actions artifact.
export function displayReleaseReceipt(receipt) {
  const { private_inputs, validated_runtime, ...display } = receipt;
  return display;
}

export async function saveReleaseReceipt(file, receipt) {
  const temporary = path.join(path.dirname(file), `.receipt-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600, flush: true });
    await rename(temporary, file);
    const directory = await open(path.dirname(file), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
