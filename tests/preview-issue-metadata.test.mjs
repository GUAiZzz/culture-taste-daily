import test from 'node:test';
import assert from 'node:assert/strict';
import {previewIssueMetadata,liveIssueDisposition,reconcileLiveState,liveReconciliationAction} from '../scripts/lib/preview-issue-metadata.mjs';
test('latest public Preview reflects the displayed provisional issue without relabelling formal history',()=>{
 assert.deepEqual(previewIssueMetadata({issues:[{date:'2026-11-10',status:'preview'},{date:'2026-11-03'},{date:'2026-11-11',status:'preview'}]}),{latest_issue:'2026-11-11',latest_issue_status:'preview',latest_formal_issue:'2026-11-03'});
});
test('formal issue precedence and malformed or duplicate index identity',()=>{
 assert.deepEqual(previewIssueMetadata({issues:[{date:'2026-11-10',status:'preview'},{date:'2026-11-11'}]}),{latest_issue:'2026-11-11',latest_issue_status:'formal',latest_formal_issue:'2026-11-11'});
 assert.throws(()=>previewIssueMetadata({issues:[{date:'2026-11-11'},{date:'2026-11-11',status:'preview'}]}),/DUPLICATE/);
 assert.throws(()=>previewIssueMetadata({issues:[{date:'2026-11-11',status:'draft'}]}),/INVALID/);
});


test('visible provisional feature does not become a formal daily issue',()=>{
 const repository='GUAiZzz/culture-taste-daily',date='2026-11-11';
 assert.equal(liveIssueDisposition({repository,latest_issue:date,latest_issue_status:'preview',latest_formal_issue:'2026-11-03'},repository,date),'provisional');
 assert.equal(liveIssueDisposition({repository,latest_issue:date,latest_issue_status:'formal',latest_formal_issue:date},repository,date),'formal');
 assert.equal(liveIssueDisposition({repository,latest_issue:date},repository,date),'formal','legacy stamps remain compatible');
 assert.equal(liveIssueDisposition({repository,latest_issue:date,latest_issue_status:'unexpected'},repository,date),'unknown');
 assert.equal(liveIssueDisposition({repository:'other/repo',latest_issue:date,latest_issue_status:'formal'},repository,date),'other');
 assert.equal(liveIssueDisposition({repository,latest_issue:'2026-11-10',latest_issue_status:'preview'},repository,date),'other');
});


test('provisional visibility preserves formal preparation, but malformed status stops automatic action',()=>{
 assert.equal(reconcileLiveState('MISSING_DAY','provisional'),'MISSING_DAY');
 assert.equal(reconcileLiveState('PACKAGE_PRESENT_UNVERIFIED','provisional'),'PACKAGE_PRESENT_UNVERIFIED');
 assert.equal(reconcileLiveState('PR_OPEN','provisional'),'PR_OPEN');
 assert.equal(liveReconciliationAction(reconcileLiveState('MISSING_DAY','provisional')),null);
 assert.equal(reconcileLiveState('MISSING_DAY','formal'),'LIVE_DATE_PRESENT_REQUIRES_HASH_VERIFICATION');
 assert.deepEqual(liveReconciliationAction(reconcileLiveState('MISSING_DAY','formal')),{action:'VERIFY_EXISTING_LIVE_HASHES'});
 assert.equal(reconcileLiveState('MISSING_DAY','unknown'),'LIVE_METADATA_INVALID');
 assert.deepEqual(liveReconciliationAction(reconcileLiveState('MISSING_DAY','unknown')),{action:'RESOLVE_LIVE_METADATA',publication_eligible:false});
});
