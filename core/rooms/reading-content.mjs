import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: false });
export const categoryNames = Object.freeze({ fashion: '时装', music: '音乐', objects: '物件', city: '城市' });
export const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const externalLinks = html => html.replace(/<a\b([^>]*)>/g, (tag, attributes) => /\btarget\s*=/.test(attributes) ? tag : `<a target="_blank" rel="noopener noreferrer"${attributes}>`);
export const renderMarkdown = value => externalLinks(markdown.render(value || ''));

export function parseStoryContent(value, english = {}) {
  let body = value.trim();
  const sourceMatch = /^来源[：:]\s*/m.exec(body);
  let sourcesMarkdown = '';
  if (sourceMatch) {
    const suffix = body.slice(sourceMatch.index + sourceMatch[0].length);
    const followingLanguage = /^### (?:中文|English)\s*$/m.exec(suffix);
    sourcesMarkdown = (followingLanguage ? suffix.slice(0, followingLanguage.index) : suffix).trim();
    body = body.slice(0, sourceMatch.index).trim() + (followingLanguage ? '\n\n' + suffix.slice(followingLanguage.index).trim() : '');
  }
  const firstBreak = body.indexOf('\n\n');
  const first = (firstBreak < 0 ? body : body.slice(0, firstBreak)).trim();
  if (first === english.title?.trim()) body = firstBreak < 0 ? '' : body.slice(firstBreak + 2).trim();
  const zhMarker = /^### 中文\s*$/m.exec(body);
  const enMarker = /^### English\s*$/m.exec(body);
  if (Boolean(zhMarker) !== Boolean(enMarker) || (zhMarker && enMarker.index < zhMarker.index)) throw Error('Incomplete bilingual story blocks');
  const zhMarkdown = zhMarker ? body.slice(zhMarker.index + zhMarker[0].length, enMarker.index).trim() : body;
  const hasFullEnglish = Boolean(enMarker);
  const enMarkdown = enMarker ? body.slice(enMarker.index + enMarker[0].length).trim() : [...new Set([english.deck, english.abstract].filter(Boolean))].join('\n\n');
  if (!zhMarkdown) throw Error('Empty Chinese story body');
  return { zhMarkdown, enMarkdown, sourcesMarkdown, hasFullEnglish, zhHtml: renderMarkdown(zhMarkdown), enHtml: renderMarkdown(enMarkdown) };
}

export function paragraphCount(value) {
  return markdown.parse(value || '', {}).filter(token => token.type === 'paragraph_close' && token.level === 0).length;
}

// Figures are inserted between top-level paragraphs; locked text is never rewritten.
export function renderWithInsertions(value, insertions = new Map()) {
  const tokens = markdown.parse(value || '', {});
  let html = '', start = 0, paragraph = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === 'paragraph_close' && token.level === 0) {
      html += markdown.renderer.render(tokens.slice(start, index + 1), markdown.options, {});
      html += insertions.get(++paragraph) || '';
      start = index + 1;
    }
  }
  html += markdown.renderer.render(tokens.slice(start), markdown.options, {});
  return externalLinks(html);
}

function publicHttps(value, name) {
  let url;
  try { url = new URL(value); } catch { throw Error(`Invalid ${name}`); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname)) throw Error(`Invalid public HTTPS ${name}`);
  return url.href;
}

export function validateQuotePool(pool) {
  if (pool?.version !== 1 || pool.timezone !== 'Asia/Shanghai' || !Array.isArray(pool.quotes) || !pool.quotes.length) throw Error('Invalid public quotation pool');
  const ids = new Set();
  for (const quote of pool.quotes) {
    for (const key of ['id', 'text', 'translation', 'author', 'authorZh', 'sourceTitle', 'sourceUrl']) if (typeof quote[key] !== 'string' || !quote[key].trim()) throw Error(`Missing quote ${key}`);
    if (ids.has(quote.id) || !/^[a-z0-9-]+$/.test(quote.id)) throw Error('Duplicate or invalid quote id');
    ids.add(quote.id);
    publicHttps(quote.sourceUrl, 'quotation source');
    if (!Number.isInteger(quote.sourceYear) || quote.sourceYear < 1 || quote.sourceYear > 2100 || quote.translationNote !== '中文为本刊译文') throw Error('Invalid quotation attribution');
    if (quote.text.trim().split(/\s+/).length > 20) throw Error('Quotation exceeds twenty words');
  }
  return pool;
}

export function selectDailyQuote(pool, date) {
  validateQuotePool(pool);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw Error('Invalid quotation date');
  const day = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse('2026-10-28T00:00:00Z')) / 86400000);
  return pool.quotes[((day % pool.quotes.length) + pool.quotes.length) % pool.quotes.length];
}

export function validateReadingMedia(rows, story) {
  if (!Array.isArray(rows)) throw Error(`Invalid reading media for ${story.id}`);
  const seen = new Set();
  for (const row of rows) {
    publicHttps(row.external_image_url, 'inline image');
    publicHttps(row.origin_url, 'inline origin');
    if (row.origin_authority !== 'first_party_official' || row.rights_basis !== 'preview_user_authorized_external') throw Error(`Unapproved inline media provenance for ${story.id}`);
    const source = story.sources.find(item => item.url === row.origin_url && (item.relationship === 'first_party_official' || (story.media?.origin_authority === 'first_party_official' && story.media.origin_url === item.url)));
    if (!source) throw Error(`Inline image has no bound first-party source for ${story.id}`);
    const imageHosts = new Set([new URL(row.origin_url).hostname, new URL(story.media.external_image_url).hostname]);
    if (!imageHosts.has(new URL(row.external_image_url).hostname)) throw Error(`Inline image host is not bound to its official source for ${story.id}`);
    for (const key of ['alt', 'credit', 'caption']) if (typeof row[key] !== 'string' || !row[key].trim()) throw Error(`Missing inline ${key} for ${story.id}`);
    if (row.external_image_url === story.media?.external_image_url || seen.has(row.external_image_url)) throw Error(`Repeated inline image for ${story.id}`);
    seen.add(row.external_image_url);
    for (const [key, sourceText] of [['after_zh_paragraph', story.zhMarkdown], ['after_en_paragraph', story.enMarkdown]]) if (!Number.isInteger(row[key]) || row[key] < 1 || row[key] > paragraphCount(sourceText)) throw Error(`Invalid ${key} for ${story.id}`);
  }
  return rows;
}

async function optionalJson(file, fallback = {}) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function loadReadingModel({ repoRoot, validatedIssues, publicationIssues }) {
  const root = path.join(repoRoot, 'core/rooms');
  const [editorialIntros, summaries, corrections, legacyCategories, centralMedia, quotePool, historicalIndex] = await Promise.all([
    optionalJson(path.join(root, 'editorial-intros.json')), optionalJson(path.join(root, 'reading-summaries.public.json')), optionalJson(path.join(root, 'media-corrections.json')), optionalJson(path.join(root, 'legacy-categories.json')), optionalJson(path.join(root, 'reading-media.json')), optionalJson(path.join(root, 'daily-quotes.public.json')),
    optionalJson(path.join(root, 'historical-reading-index.public.json')),
  ]);
  validateQuotePool(quotePool);
  const issues = [];
  for (const validated of validatedIssues.filter(issue => issue.issueId >= '2026-08-25' && issue.manifest.visibility !== 'future_draft').sort((a, b) => a.issueId.localeCompare(b.issueId))) {
    const date = validated.issueId, manifest = validated.manifest;
    const radar = validated.dailyRadar || validated.retrospectiveIndex;
    if (!radar) throw Error(`Missing verified reading index ${date}`);
    const parts = validated.content.split(/^## /m);
    const introParts = parts.shift().trim().split('\n\n');
    const title = introParts.shift().replace(/^# /, ''), en = introParts.shift();
    const sections = parts.map(section => ({ title: section.slice(0, section.indexOf('\n')).trim(), markdown: section.slice(section.indexOf('\n') + 1).trim() }));
    const localMedia = await optionalJson(path.join(repoRoot, 'src/issues', date, 'reading-media.public.json'));
    const stories = manifest.stories.map((story, index) => {
      const section = sections[index];
      if (section?.title !== story.title) throw Error(`Section mismatch ${date} ${story.id}`);
      const record = radar.items.find(item => item.included_story_id === story.id || item.id === story.id);
      if (!categoryNames[record?.category]) throw Error(`Missing exact category ${story.id}`);
      const key = `${date}/${story.id}`, correction = corrections[key];
      const media = correction ? { ...story.media, external_image_url: correction.external_image_url, alt: correction.alt, origin_url: correction.origin_url } : story.media;
      const parsed = parseStoryContent(section.markdown, story.english);
      if (date >= '2026-10-28' && !parsed.hasFullEnglish) throw Error(`Complete source-authored English is required for ${date}/${story.id}`);
      const result = { ...story, ...parsed, media, markdown: section.markdown, date, index, issueTitle: title, category: record.category, url: `/issues/${date}/stories/${story.id}/` };
      const local = localMedia[story.id] ?? localMedia[key];
      if (local && centralMedia[key]) throw Error(`Conflicting reading media ${key}`);
      result.inlineMedia = validateReadingMedia(local ?? centralMedia[key] ?? [], result);
      result.intro = summaries[key]?.text || editorialIntros[key]?.text || parsed.zhMarkdown.split('\n\n').find(part => !part.startsWith('#'))?.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_]/g, '') || '';
      return result;
    });
    for (const key of Object.keys(localMedia)) if (!stories.some(story => key === story.id || key === `${date}/${story.id}`)) throw Error(`Unknown reading media story ${date}/${key}`);
    const closingSections = sections.slice(stories.length);
    const cover = await readFile(path.join(repoRoot, 'src/site/assets/covers', `${date}.svg`), 'utf8');
    issues.push({ date, title, en, position: manifest.editorial_position, intro: renderMarkdown(introParts.join('\n\n')), stories, extras: radar.items.filter(item => !manifest.stories.some(story => story.id === (item.included_story_id || item.id))), cover, closing: renderMarkdown(closingSections.map(section => `## ${section.title}\n\n${section.markdown}`).join('\n\n')), hash: manifest.source_hashes.content_sha256, locked: manifest.content_lock.sha256, raw: validated.content, url: `/issues/${date}/`, manifest });
  }
  for (const key of Object.keys(centralMedia)) {
    if (!/^\d{4}-\d{2}-\d{2}\/[a-z0-9-]+$/.test(key)) throw Error(`Invalid central reading media key ${key}`);
    if (issues.some(issue => issue.date === key.slice(0, 10)) && !issues.some(issue => issue.stories.some(story => `${issue.date}/${story.id}` === key))) throw Error(`Unknown central reading media ${key}`);
  }
  const dates = issues.map(issue => issue.date);
  const preserved = [];
  for (const issue of publicationIssues.filter(issue => !dates.includes(issue.issue_id))) {
    if (issue.preservation_kind !== 'historical_original') { preserved.push(issue); continue; }
    const index = historicalIndex[issue.issue_id];
    if (!index || !Number.isInteger(index.article_count) || index.article_count < 1 || !index.count_label?.trim() || !Array.isArray(index.categories) || !index.categories.length || index.categories.some(category => !categoryNames[category]) || index.categories.some(category => !index.category_evidence?.some(evidence => evidence.category === category && evidence.title?.trim() && evidence.original_label?.trim()))) throw Error(`Missing reviewed historical reading index ${issue.issue_id}`);
    const historicalRoot = path.join(repoRoot, 'src/historical', issue.issue_id);
    const meta = await optionalJson(path.join(historicalRoot, 'meta.json'));
    if (index.source_file !== meta.original_file || index.source_sha256 !== meta.source_sha256 || createHash('sha256').update(await readFile(path.join(historicalRoot, meta.original_file))).digest('hex') !== index.source_sha256) throw Error(`Historical reading index source mismatch ${issue.issue_id}`);
    preserved.push({ ...issue, categories: index.categories, article_count: index.article_count, count_label: index.count_label });
  }
  const legacyStories = preserved.slice().reverse().flatMap(issue => (issue.stories || []).map((story, index) => ({ ...story, date: issue.issue_id, issueTitle: issue.title, index, category: legacyCategories[story.id], url: `/issues/${issue.issue_id}/stories/${story.id}/` })));
  for (const story of legacyStories) if (!categoryNames[story.category]) throw Error(`Missing reviewed original category ${story.id}`);
  return { issues, latest: issues.at(-1), dates, preserved, legacyStories, allStories: issues.slice().reverse().flatMap(issue => issue.stories), quotePool };
}
