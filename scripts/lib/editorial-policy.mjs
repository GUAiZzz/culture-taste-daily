import { informationUrl } from './historical-supplements.mjs';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+08:00$/;
const EXACT_COUNT_FROM = '2026-10-12';
const SOURCE_COUNT_FROM = '2026-09-16';
const text = value => typeof value === 'string' && value.trim().length > 0;
const identity = value => text(value) ? value.normalize('NFKC').trim().toLowerCase() : '';
const unique = values => [...new Set(values)];

// These requirements govern a new release, not a rebuild of already-live
// historical content. Build/archive validation deliberately does not call them.
export function editorialRequirements(policy, publicationDate, { unpublished = true } = {}) {
  const rule = policy?.editorial;
  return {
    policy_valid: rule?.formal_story_count === 10
      && rule?.exact_count_effective_from === EXACT_COUNT_FROM
      && rule?.minimum_substantive_sources_per_story === 10
      && rule?.sources_effective_from === SOURCE_COUNT_FROM,
    exact_story_count: DATE.test(publicationDate ?? '') && (unpublished || publicationDate >= EXACT_COUNT_FROM) ? 10 : null,
    minimum_sources_per_story: DATE.test(publicationDate ?? '') && publicationDate >= SOURCE_COUNT_FROM ? 10 : 0,
  };
}

export function validEditorialTimestamp(value, now = new Date()) {
  return typeof value === 'string' && TIMESTAMP.test(value)
    && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now.getTime()
    && new Date(Date.parse(value) + 8 * 60 * 60 * 1000).toISOString().slice(0, 19) === value.slice(0, 19);
}

// Normalizing fragments/tracking parameters does not establish independence.
// The private underlying_source_id provides a second, separate deduplication key.
export function substantiveInformationUrl(value) {
  const normalized = informationUrl(value);
  const url = new URL(normalized);
  if (url.username || url.password || !url.pathname.replace(/\//g, '')
    || /\.(?:avif|gif|jpe?g|png|svg|webp|mp4|mov|mp3|wav)$/i.test(url.pathname)
    || /\/(?:search|tag|tags|category|categories)\/?$/i.test(url.pathname)
    || /^(?:www\.)?(?:google|bing|duckduckgo)\./i.test(url.hostname)
    || (/^(?:www\.)?instagram\.com$/i.test(url.hostname) && !/^\/(?:p|reel|tv)\/[^/]+/i.test(url.pathname))) {
    throw new Error('INFORMATION_SOURCE_DISCOVERY_OR_MEDIA');
  }
  return normalized;
}

function publicInformationUrls(story, blockers) {
  const urls = new Set();
  if (!Array.isArray(story?.sources)) return urls;
  for (const source of story.sources) {
    try { urls.add(substantiveInformationUrl(source?.url)); }
    catch {
      // Discovery/credit routes may remain visible for readers but never count.
      try { informationUrl(source?.url); }
      catch { blockers.push(`INFORMATION_SOURCE_URL:${story?.id ?? 'unknown'}`); }
    }
  }
  return urls;
}

function sectionsFor(content) {
  if (typeof content !== 'string') return [];
  const matches = [...content.matchAll(/^##[\t ]+([^\n]+)\r?$/gm)];
  return matches.map((match, index) => ({
    title: match[1].trim(),
    body: content.slice(match.index + match[0].length, matches[index + 1]?.index ?? content.length).trim(),
  }));
}

export function editorialPackageBlockers({ manifest, content, policy, now = new Date() } = {}) {
  const blockers = [];
  const requirements = editorialRequirements(policy, manifest?.publication_date);
  if (!DATE.test(manifest?.publication_date ?? '')) blockers.push('EDITORIAL_DATE_IDENTITY');
  if (!requirements.policy_valid) blockers.push('EDITORIAL_POLICY_INVALID');
  const stories = Array.isArray(manifest?.stories) ? manifest.stories : [];
  if (requirements.exact_story_count !== null && stories.length !== requirements.exact_story_count) blockers.push('FORMAL_STORY_COUNT_MISMATCH');
  const ids = stories.map(story => identity(story?.id));
  const titles = stories.map(story => identity(story?.title));
  if (ids.some(id => !id) || titles.some(title => !title)
    || new Set(ids).size !== ids.length || new Set(titles).size !== titles.length) blockers.push('FORMAL_STORY_IDENTITY_MISMATCH');
  const sections = sectionsFor(content);
  for (const story of stories) {
    const matching = sections.filter(section => section.title === story?.title);
    if (matching.length !== 1 || !text(matching[0]?.body) || !['cover', 'major', 'signal'].includes(story?.level)
      || !text(story?.english?.title) || !text(story?.english?.deck) || !text(story?.english?.abstract)) {
      blockers.push(`ARTICLE_PACKAGE_INCOMPLETE:${story?.id ?? 'unknown'}`);
    }
    if (publicInformationUrls(story, blockers).size < requirements.minimum_sources_per_story) blockers.push(`SUBSTANTIVE_SOURCE_COUNT_MISMATCH:${story?.id ?? 'unknown'}`);
  }
  if (!validEditorialTimestamp(manifest?.research_locked_at, now)
    || !validEditorialTimestamp(manifest?.candidate_created_at, now)
    || !validEditorialTimestamp(manifest?.content_locked_at, now)
    || Date.parse(manifest?.research_locked_at) < Date.parse(manifest?.candidate_created_at)
    || Date.parse(manifest?.content_locked_at) < Date.parse(manifest?.research_locked_at)
    || manifest?.content_lock?.locked_at !== manifest?.content_locked_at) blockers.push('EDITORIAL_ACTUAL_TIMESTAMPS');
  return unique(blockers);
}

/**
 * Pure report shared by private checkpoints and release validation.
 * privateResearch.article_sources = [{ story_id, canonical_event_id, sources:
 * [{ url, kind:'information', actually_read:true, substantive:true,
 *    underlying_source_id, supports:[claim], reading_notes, accessed_at }] }].
 * These records are consistency evidence, never an automated truth certificate.
 * allowUnlocked is only for provisional progress; the release keeps it false.
 */
export function editorialSourceReport({ manifest, privateResearch, policy, now = new Date(), allowUnlocked = false } = {}) {
  const blockers = [];
  const requirements = editorialRequirements(policy, manifest?.publication_date);
  if (!requirements.policy_valid) blockers.push('EDITORIAL_POLICY_INVALID');
  const manifestStories = Array.isArray(manifest?.stories) ? manifest.stories : [];
  const ledger = privateResearch?.article_sources;
  const locked = validEditorialTimestamp(manifest?.research_locked_at, now);
  const cutoff = locked ? Date.parse(manifest.research_locked_at) : now.getTime();
  if (!locked && !allowUnlocked) blockers.push('EDITORIAL_ACTUAL_TIMESTAMPS');
  if (!Array.isArray(ledger)) blockers.push('SOURCE_LEDGER_MISSING');
  const events = new Set();
  const stories = manifestStories.map(story => {
    const publicUrls = publicInformationUrls(story, blockers);
    const records = Array.isArray(ledger) ? ledger.filter(record => record?.story_id === story?.id) : [];
    const record = records[0];
    const event = identity(record?.canonical_event_id);
    const rowBlockers = [];
    const urls = new Set(), underlying = new Set();
    if (records.length !== 1 || !Array.isArray(record?.sources)) rowBlockers.push(`SOURCE_LEDGER_MISSING:${story?.id ?? 'unknown'}`);
    if (!event || events.has(event)) rowBlockers.push(`EVENT_DEDUPLICATION_FAILED:${story?.id ?? 'unknown'}`);
    if (event) events.add(event);
    for (const source of Array.isArray(record?.sources) ? record.sources : []) {
      let url;
      try { url = substantiveInformationUrl(source?.url); } catch { continue; }
      const sourceIdentity = identity(source?.underlying_source_id);
      if (!publicUrls.has(url) || source.kind !== 'information' || source.actually_read !== true
        || source.substantive !== true || source.discovery_only === true || !sourceIdentity
        || !Array.isArray(source.supports) || !source.supports.some(text) || !text(source.reading_notes)
        || !validEditorialTimestamp(source.accessed_at, now) || Date.parse(source.accessed_at) > cutoff
        || (!locked && !allowUnlocked) || urls.has(url) || underlying.has(sourceIdentity)) continue;
      urls.add(url); underlying.add(sourceIdentity);
    }
    if (underlying.size < requirements.minimum_sources_per_story) rowBlockers.push(`SUBSTANTIVE_SOURCE_COUNT_MISMATCH:${story?.id ?? 'unknown'}`);
    blockers.push(...rowBlockers);
    return { story_id: story?.id, canonical_event_id: text(record?.canonical_event_id) ? record.canonical_event_id : null,
      qualifying_source_count: underlying.size, required_source_count: requirements.minimum_sources_per_story,
      blockers: rowBlockers };
  });
  if (Array.isArray(ledger) && ledger.some(record => !manifestStories.some(story => story?.id === record?.story_id))) blockers.push('SOURCE_LEDGER_STORY_MISMATCH');
  return { blockers: unique(blockers), stories, provisional: allowUnlocked && !locked };
}

export function editorialBlockers(input) {
  return unique([...editorialPackageBlockers(input), ...editorialSourceReport(input).blockers]);
}
