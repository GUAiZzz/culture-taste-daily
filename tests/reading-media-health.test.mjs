import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectIssueReadingMedia, collectIssueReleaseUrls, collectPublicHealthTargets } from '../scripts/lib/site-health.mjs';
import { evaluatePreview, policyDigest, PREVIEW_BASE, REPOSITORY, RESEARCH_CHECKS } from '../scripts/lib/preview-policy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const issueDate = '2026-09-06';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ct-reading-health-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const issueRoot = path.join(root, 'src/issues', issueDate), sharedRoot = path.join(root, 'core/rooms');
  await Promise.all([mkdir(issueRoot, { recursive: true }), mkdir(sharedRoot, { recursive: true })]);
  const story = { id: 'official-event', title: '正文标题', english: { title: 'Story title' }, sources: [{ url: 'https://official.example/event', relationship: 'first_party_official' }], media: { external_image_url: 'https://official.example/hero.jpg', origin_url: 'https://official.example/event', origin_authority: 'first_party_official' } };
  const manifest = { issue_id: issueDate, stories: [story] }, radar = { items: [] };
  const image = { external_image_url: 'https://official.example/inline.jpg', origin_url: story.sources[0].url, origin_authority: 'first_party_official', rights_basis: 'preview_user_authorized_external', alt: '作品图', credit: 'Official', caption: '作品及出处', after_zh_paragraph: 2, after_en_paragraph: 2 };
  const json = (file, value) => writeFile(file, JSON.stringify(value));
  const setCentral = value => json(path.join(sharedRoot, 'reading-media.json'), value);
  const setLocal = value => json(path.join(issueRoot, 'reading-media.public.json'), value);
  await Promise.all([
    json(path.join(issueRoot, 'issue-manifest.public.json'), manifest),
    writeFile(path.join(issueRoot, 'content.md'), '# 本期\n\n## 正文标题\n\n### 中文\n\n第一段。\n\n第二段。\n\n### English\n\nFirst paragraph.\n\nSecond paragraph.\n\n来源：\n\n1. [Official](https://official.example/event)\n'),
  ]);
  return { root, story, manifest, radar, image, setCentral, setLocal, options: { repoRoot: root, issueDate, manifest } };
}

test('the four published supplementary images enter both health and release inventories', async () => {
  const date = '2026-10-28';
  const manifest = JSON.parse(await readFile(path.join(repoRoot, 'src/issues', date, 'issue-manifest.public.json')));
  const radar = JSON.parse(await readFile(path.join(repoRoot, 'src/issues', date, 'daily-radar.public.json')));
  const images = await collectIssueReadingMedia({ repoRoot, issueDate: date, manifest });
  assert.equal(images.length, 4);
  const health = await collectPublicHealthTargets({ repoRoot, issueDate: date, scope: 'daily' });
  const release = await collectIssueReleaseUrls({ repoRoot, issueDate: date, manifest, radar });
  for (const image of images) {
    assert.ok(health.targets.some(target => target.expect === 'image' && target.url === image.external_image_url && target.references.some(ref => ref.story_id === image.story_id && ref.field === 'reading_media.external_image_url')));
    assert.ok(health.targets.some(target => target.expect === 'page' && target.url === image.origin_url));
    assert.ok(release.media_urls.includes(image.external_image_url));
    assert.ok(release.source_urls.includes(image.origin_url));
  }
});

for (const qualified of [false, true]) test(`dated issue media accepts the ${qualified ? 'qualified' : 'short'} exact-story key`, async t => {
  const f = await fixture(t);
  await f.setLocal({ [qualified ? `${issueDate}/${f.story.id}` : f.story.id]: [f.image] });
  const images = await collectIssueReadingMedia(f.options);
  assert.equal(images.length, 1);
  assert.equal(images[0].story_id, f.story.id);
  assert.equal(images[0].issue_id, issueDate);
});

test('central/local conflicts and unknown story keys fail closed in health and release collection', async t => {
  const f = await fixture(t), key = `${issueDate}/${f.story.id}`;
  const cases = [
    { central: { [key]: [f.image] }, local: { [f.story.id]: [f.image] }, error: /Conflicting/ },
    { central: {}, local: { [f.story.id]: [], [key]: [f.image] }, error: /Conflicting/ },
    { central: { [`${issueDate}/missing-story`]: [f.image] }, local: {}, error: /Unknown central/ },
    { central: {}, local: { 'missing-story': [f.image] }, error: /Unknown issue/ },
    { central: { malformed: [] }, local: {}, error: /Invalid central/ },
    { central: {}, local: { [f.story.id]: null }, error: /Invalid reading media/ },
  ];
  for (const item of cases) {
    await f.setCentral(item.central); await f.setLocal(item.local);
    await assert.rejects(collectPublicHealthTargets({ repoRoot: f.root, issueDate, scope: 'daily' }), item.error);
    await assert.rejects(collectIssueReleaseUrls({ ...f.options, radar: f.radar }), item.error);
  }
});

test('supplementary media reuses renderer provenance, source, host, uniqueness and real-paragraph constraints', async t => {
  const f = await fixture(t);
  for (const patch of [
    { rights_basis: 'cleared-without-evidence' },
    { origin_url: 'https://official.example/unlisted' },
    { external_image_url: 'https://unrelated.example/image.jpg' },
    { external_image_url: f.story.media.external_image_url },
    { caption: '' }, { credit: '' }, { alt: '' },
    { after_zh_paragraph: 3 }, { after_en_paragraph: 3 },
  ]) {
    await f.setLocal({ [f.story.id]: [{ ...f.image, ...patch }] });
    await assert.rejects(collectIssueReadingMedia(f.options));
  }
  await f.setLocal({ [f.story.id]: [f.image, f.image] });
  await assert.rejects(collectIssueReadingMedia(f.options), /Repeated inline image/);
  await assert.rejects(collectIssueReadingMedia({ ...f.options, issueDate: '2026-09-07' }), /identity mismatch/);
});

test('release cannot borrow the hero attestation for an unverified supplementary image', async t => {
  const f = await fixture(t);
  await f.setLocal({ [f.story.id]: [f.image] });
  const urls = await collectIssueReleaseUrls({ ...f.options, radar: f.radar });
  const policy = JSON.parse(await readFile(path.join(repoRoot, 'automation/daily-policy.json')));
  const a = 'a'.repeat(40), b = 'b'.repeat(40), d = 'd'.repeat(64), verified = `${issueDate}T13:00:00+08:00`;
  const mediaEvidence = url => ({ url, provenance_verified_at: verified, linked_origin: true, fallback_verified: true, status: 'PASS', production_rights: 'unknown' });
  const input = {
    policy, now: new Date(`${issueDate}T14:00:00+08:00`),
    evidence: { schema_version: 1, kind: 'preview_run_attestation', target_date: issueDate, source_commit: a, base_commit: b, candidate_digest: d, artifact_digest: d, policy_digest: policyDigest(policy), checked_at: verified,
      research: { complete: true, private_evidence_sha256: d, harrytone_commit: a, checks: [...RESEARCH_CHECKS], within_production_window: true },
      health: { source_pages: urls.source_urls.map(url => ({ url, status: 'PASS' })), media: [mediaEvidence(f.story.media.external_image_url)] } },
    runtime: { repository: REPOSITORY, base_ref: PREVIEW_BASE, branch: `automation/culture-taste-${issueDate}`, scope_ok: true, clean: true, source_commit: a, base_commit: b, candidate_digest: d, artifact_digest: d, harrytone_commit: a, private_evidence_matches: true, technical_qa: 'PASS', deterministic: true, privacy_scan: 'PASS', ci: 'success', push_permission: true, package_complete: true, ...urls },
  };
  const blocked = evaluatePreview(input);
  assert.equal(blocked.preview_eligible, false);
  assert.ok(blocked.blockers.includes('OFFICIAL_MEDIA_UNVERIFIED'));
  input.evidence.health.media.push(mediaEvidence(f.image.external_image_url));
  assert.equal(evaluatePreview(input).preview_eligible, true);
  assert.equal(evaluatePreview(input).production_eligible, false);
});
