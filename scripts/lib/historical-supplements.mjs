import { createHash } from 'node:crypto';

export const HISTORICAL_AUTHORIZATION_ID = 'historical-supplements-2026-10-14';
export const HISTORICAL_AUTHORIZED_AT = '2026-10-14T18:43:59+08:00';
export const HISTORICAL_DATES = Object.freeze([
  '2026-09-12', '2026-09-13', '2026-09-18', '2026-09-19',
  '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
  '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12',
  '2026-10-13', '2026-10-14',
]);
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+08:00$/;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const historicalAuthorizationDigest = digest;
export const historicalPreviewPolicy = (policy, authorization) => ({ ...policy, historical_supplements: authorization });

export function isAuthorizedHistoricalDate(authorization, date) {
  return authorization?.schema_version === 1
    && authorization.kind === 'owner_authorized_historical_supplements'
    && authorization.authorization_id === HISTORICAL_AUTHORIZATION_ID
    && authorization.repository === 'GUAiZzz/culture-taste-daily'
    && authorization.base_ref === 'preview-build-v1'
    && authorization.preview_only === true
    && authorization.formal_story_count === 10
    && authorization.minimum_substantive_sources_per_story === 10
    && authorization.authorized_at === HISTORICAL_AUTHORIZED_AT
    && JSON.stringify(authorization.authorized_dates) === JSON.stringify(HISTORICAL_DATES)
    && HISTORICAL_DATES.includes(date);
}

export function informationUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('INFORMATION_SOURCE_URL');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.href.replace(/\/$/, '');
}

function timestamp(value, authorization, now) {
  return TIMESTAMP.test(value ?? '') && Number.isFinite(Date.parse(value))
    && Date.parse(value) >= Date.parse(authorization.authorized_at) && Date.parse(value) <= now.getTime();
}

// Public disclosure and package completeness are independently derived from the
// actual package. Neither metadata nor source counts certify editorial truth.
export function historicalPackageBlockers({ manifest, content, authorization, now = new Date() }) {
  const blockers = [];
  const meta = manifest?.historical_supplement;
  const date = manifest?.publication_date;
  if (!isAuthorizedHistoricalDate(authorization, date)) return ['HISTORICAL_AUTHORITY'];
  if (meta?.authorization_id !== authorization.authorization_id || meta.coverage_date !== date
    || meta.kind !== 'historical_supplement') blockers.push('HISTORICAL_DISCLOSURE');
  if (!timestamp(meta?.prepared_at, authorization, now)
    || manifest.candidate_created_at !== meta?.prepared_at
    || !timestamp(manifest.research_locked_at, authorization, now)
    || !timestamp(manifest.content_locked_at, authorization, now)
    || Date.parse(manifest.research_locked_at) < Date.parse(meta?.prepared_at)
    || Date.parse(manifest.content_locked_at) < Date.parse(manifest.research_locked_at)
    || manifest.content_lock?.locked_at !== manifest.content_locked_at
    || date > meta?.prepared_at?.slice(0, 10)) blockers.push('HISTORICAL_ACTUAL_TIMESTAMPS');
  const zh = meta?.disclosure_zh, en = meta?.disclosure_en;
  if (typeof zh !== 'string' || !zh.includes('历史补刊') || !zh.includes(date)
    || !zh.includes(meta?.prepared_at?.slice(0, 10) ?? 'INVALID')
    || typeof en !== 'string' || !/retrospective/i.test(en) || !en.includes(date)
    || !en.includes(meta?.prepared_at?.slice(0, 10) ?? 'INVALID')
    || !content?.includes(zh) || !content?.includes(en)
    || !manifest.editorial_position?.includes('历史补刊')) blockers.push('HISTORICAL_DISCLOSURE');
  const stories = manifest.stories ?? [];
  if (stories.length !== 10) blockers.push('FORMAL_STORY_COUNT_MISMATCH');
  if (new Set(stories.map(s => s.id)).size !== stories.length
    || new Set(stories.map(s => s.title?.normalize('NFKC').trim())).size !== stories.length) blockers.push('FORMAL_STORY_IDENTITY_MISMATCH');
  const sections = (content ?? '').split(/^##\s+/m).slice(1).map(section => ({
    title: section.split('\n')[0].trim(), body: section,
  }));
  for (const story of stories) {
    const section = sections.find(s => s.title === story.title);
    if (!section?.body.includes(zh ?? 'INVALID') || story.level === 'watch'
      || !story.english?.title || !story.english?.abstract || !story.english?.deck?.includes(en ?? 'INVALID')) {
      blockers.push(`ARTICLE_PACKAGE_INCOMPLETE:${story.id}`);
    }
    try {
      const sources = new Set((story.sources ?? []).map(s => informationUrl(s.url)));
      if (sources.size < 10) blockers.push(`SUBSTANTIVE_SOURCE_COUNT_MISMATCH:${story.id}`);
    } catch { blockers.push(`INFORMATION_SOURCE_URL:${story.id}`); }
  }
  return [...new Set(blockers)];
}

// The private file is hash-bound by preview:release. Each counted record must
// refer to a public information link, a read time and an underlying source.
export function historicalSourceBlockers({ manifest, privateResearch, authorization, now = new Date() }) {
  const blockers = [];
  const events = new Set();
  for (const story of manifest?.stories ?? []) {
    const records = privateResearch?.article_sources?.filter(r => r.story_id === story.id) ?? [];
    const publicUrls = new Set((story.sources ?? []).map(s => informationUrl(s.url)));
    const urls = new Set(), underlying = new Set();
    if (records.length !== 1) { blockers.push(`SOURCE_LEDGER_MISSING:${story.id}`); continue; }
    const event = records[0].canonical_event_id;
    if (typeof event !== 'string' || !event.trim() || events.has(event)) {
      blockers.push(`EVENT_DEDUPLICATION_FAILED:${story.id}`); continue;
    }
    events.add(event);
    if (!Array.isArray(records[0].sources)) { blockers.push(`SOURCE_LEDGER_MISSING:${story.id}`); continue; }
    for (const source of records[0].sources) {
      let url;
      try { url = informationUrl(source.url); } catch { continue; }
      if (!publicUrls.has(url) || source.kind !== 'information' || source.actually_read !== true
        || source.substantive !== true || typeof source.underlying_source_id !== 'string' || !source.underlying_source_id.trim()
        || !Array.isArray(source.supports) || !source.supports.some(s => typeof s === 'string' && s.trim())
        || typeof source.reading_notes !== 'string' || !source.reading_notes.trim() || !timestamp(source.accessed_at, authorization, now)
        || Date.parse(source.accessed_at) > Date.parse(manifest.research_locked_at)) continue;
      if (urls.has(url) || underlying.has(source.underlying_source_id)) continue;
      urls.add(url); underlying.add(source.underlying_source_id);
    }
    if (underlying.size < 10) blockers.push(`SUBSTANTIVE_SOURCE_COUNT_MISMATCH:${story.id}`);
  }
  return [...new Set(blockers)];
}
