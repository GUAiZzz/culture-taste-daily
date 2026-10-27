import { informationUrl } from './historical-supplements.mjs';

export function validateSourceLibrary(library, radar) {
  const blockers = [];
  if (library?.schema_version !== 1 || library?.kind !== 'culture_taste_source_library') blockers.push('SOURCE_LIBRARY_SCHEMA');
  const subjects = library?.subjects ?? [];
  const required = radar.cohorts.flatMap(cohort => cohort.subjects);
  if (subjects.length !== required.length || new Set(subjects.map(s => s.id)).size !== subjects.length
    || required.some(name => subjects.filter(s => s.name === name).length !== 1)) blockers.push('SOURCE_LIBRARY_COVERAGE');
  for (const subject of [...subjects, ...(library?.additional_sources ?? [])]) {
    if (!subject.id || !Array.isArray(subject.routes)) { blockers.push(`SOURCE_LIBRARY_SUBJECT:${subject.name}`); continue; }
    if (subject.routes.length === 0 && subject.status !== 'UNRESOLVED') blockers.push(`UNRESOLVED_IDENTITY_HIDDEN:${subject.id}`);
    for (const route of subject.routes) {
      try {
        const url = new URL(route.url);
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
        const proof = new URL(route.identity_evidence_url);
        if (proof.protocol !== 'https:' || proof.username || proof.password || !route.verified_on?.match(/^\d{4}-\d{2}-\d{2}$/)
          || !['official_site', 'official_news', 'official_instagram'].includes(route.kind)
          || route.discovery_only !== true) throw new Error();
        if (route.kind === 'official_instagram' && (!/^(?:www\.)?instagram\.com$/i.test(url.hostname)
          || /(^|\.)instagram\.com$/i.test(proof.hostname))) throw new Error();
      } catch { blockers.push(`SOURCE_ROUTE_IDENTITY:${subject.id}`); }
    }
  }
  return [...new Set(blockers)];
}

// A source plan is a queue, not proof that a person read the listed sources.
// Public account identity and source availability are deliberately separate.
export function sourcePlan({ library, radar, date, scan = [], now = new Date() }) {
  const blockers = validateSourceLibrary(library, radar);
  const allowedResults = ['FOUND', 'NO_NEW_SIGNAL', 'ACCESS_LIMITED', 'IDENTITY_UNRESOLVED'];
  const subjects = library.subjects.map(subject => {
    const records = scan.filter(record => record.subject_id === subject.id
      && typeof record.checked_at === 'string' && record.checked_at.startsWith(date)
      && /\+08:00$/.test(record.checked_at) && Date.parse(record.checked_at) <= now.getTime()
      && allowedResults.includes(record.result) && typeof record.notes === 'string' && record.notes.trim()
      && (record.result === 'IDENTITY_UNRESOLVED' || subject.routes.some(route => route.url === record.route_url)));
    const latest = records.sort((a, b) => b.checked_at.localeCompare(a.checked_at))[0];
    const detailUrls = (latest?.detail_urls ?? []).filter(url => {
      try { informationUrl(url); return true; } catch { return false; }
    });
    const usefulResult = latest?.result !== 'FOUND' || detailUrls.length > 0;
    return { id: subject.id, name: subject.name, cohort: subject.cohort,
      identity: subject.routes.length ? 'HAS_VERIFIED_ROUTE' : 'UNRESOLVED',
      scan_status: latest && usefulResult ? latest.result : 'PENDING',
      detail_urls: detailUrls, discovery_only: true,
      next_action: latest?.result === 'IDENTITY_UNRESOLVED' ? 'RESOLVE_OFFICIAL_IDENTITY'
        : latest?.result === 'ACCESS_LIMITED' ? 'USE_ALTERNATIVE_ROUTE'
        : !subject.routes.length ? 'RESOLVE_OFFICIAL_IDENTITY'
          : latest && usefulResult ? 'REVIEW_DISCOVERED_DETAILS_OR_CONTINUE' : 'SCAN_CURRENT_OFFICIAL_SIGNALS',
      routes: subject.routes };
  });
  const checked = subjects.filter(subject => subject.scan_status !== 'PENDING').length;
  const unresolved = subjects.filter(subject => subject.identity === 'UNRESOLVED').length;
  const limited = subjects.filter(subject => ['ACCESS_LIMITED', 'IDENTITY_UNRESOLVED'].includes(subject.scan_status)).length;
  return { schema_version: 1, date, status: blockers.length ? 'INVALID_LIBRARY' : checked === subjects.length && !limited ? 'SCAN_RECORDED' : 'RESEARCH_PENDING',
    publication_authority: false, completed_research_attestation: false, blockers,
    total_subjects: subjects.length, checked_subjects: checked, unresolved_identities: unresolved, access_limited_subjects: limited,
    next_subject: (subjects.find(subject => subject.scan_status === 'PENDING')
      ?? subjects.find(subject => subject.next_action === 'USE_ALTERNATIVE_ROUTE'))?.id ?? null,
    subjects };
}
