// The visible reading index includes both formally admitted issues and
// provisional editions. Keep the two identities distinct in release stamps.
export function previewIssueMetadata(index) {
  if (!Array.isArray(index?.issues) || !index.issues.length) throw new Error('PREVIEW_INDEX_ISSUES_MISSING');
  const issues = index.issues.map(issue => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issue?.date ?? '') || (issue.status !== undefined && issue.status !== 'preview')) throw new Error('PREVIEW_INDEX_ISSUE_INVALID');
    return issue;
  }).sort((a,b) => a.date.localeCompare(b.date));
  if (new Set(issues.map(issue => issue.date)).size !== issues.length) throw new Error('PREVIEW_INDEX_DUPLICATE_DATE');
  const latest=issues.at(-1), formal=issues.filter(issue=>issue.status!=='preview').at(-1);
  if (!formal) throw new Error('PREVIEW_INDEX_FORMAL_MISSING');
  return {latest_issue:latest.date,latest_issue_status:latest.status==='preview'?'preview':'formal',latest_formal_issue:formal.date};
}

// A provisional reading edition must never be mistaken for an admitted formal
// daily issue, or prevent the saved daily workspace from continuing.
export function liveIssueDisposition(stamp, repository, date) {
  if (stamp?.repository !== repository || stamp.latest_issue !== date) return 'other';
  if (stamp.latest_issue_status === 'preview') return 'provisional';
  if (stamp.latest_issue_status === 'formal' || stamp.latest_issue_status === undefined) return 'formal';
  return 'unknown';
}

export function reconcileLiveState(currentState, disposition) {
  if (disposition === 'formal') return 'LIVE_DATE_PRESENT_REQUIRES_HASH_VERIFICATION';
  if (disposition === 'unknown') return 'LIVE_METADATA_INVALID';
  return currentState;
}

export function liveReconciliationAction(state) {
  if (state === 'LIVE_METADATA_INVALID') return {action:'RESOLVE_LIVE_METADATA',publication_eligible:false};
  if (state === 'LIVE_DATE_PRESENT_REQUIRES_HASH_VERIFICATION') return {action:'VERIFY_EXISTING_LIVE_HASHES'};
  return null;
}
