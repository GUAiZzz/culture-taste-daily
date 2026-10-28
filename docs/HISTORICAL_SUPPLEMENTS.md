# Bounded historical supplements — October 14, 2026

The owner explicitly authorized “授权制作逐日历史补刊，保留全部质量门槛” after reviewing the 30-issue live inventory and its 26 missing dates. The exact dates and Preview-only authority are recorded in `automation/historical-supplements.json`.

This is a bounded exception to the former prohibition on preparing locked past dates. It permits a newly researched, clearly labeled supplement for each listed gap. It does not make an original candidate contemporaneous, approve a partial issue, rewrite a live issue, or reuse the September 5–6 maintenance exceptions.

Every supplement requires exactly ten substantive formal articles and at least ten distinct, actually read substantive information sources per article, including the September 12–13 dates. Sources remain visible in the public article and have a dated private reading record. Search snippets, image credits, duplicate URLs and multiple links to one underlying source do not count.

`historical_supplement` public metadata records the coverage date, actual preparation time, authorization ID and Chinese/English disclosure. The actual candidate, research and content lock times remain in the normal manifest fields. Every article and archive description must display the retrospective boundary. Production's original window remains blocked.

All ordinary research, official registry, historical focus cohort and standing beats, five regional lanes, event deduplication, prior-two-issue deduplication, pinned HarryTone, Chinese/English editing, detail-reference, seven-issue variation, official media, rights, ten-to-twenty-item radar, cover, source health, browser review, accessibility, technical QA, privacy and exact-head CI gates remain required. Read current evidence and distinguish what was known during the coverage period from later developments.

Insertion must also preserve the next two already-live issues' event/official-URL deduplication. Inspect those issues before selecting the supplement radar and avoid collisions that would invalidate their frozen coverage. Choose a cover and coda palette distinct from existing neighboring issues; repair the new supplement rather than a previously published issue if the growing-inventory build rejects it.

Research resumes only at eligible collection checkpoints. The scheduled 18:00 checkpoint remains reconciliation only. Normal current-day issue preparation continues alongside this bounded queue.

Use the existing unique dated branches/PRs for October 8–12. Preserve their original commits and private evidence; a new supplement version must disclose its actual later preparation. Do not force-push or create a duplicate dated PR. New gap dates use one dated branch and one PR from the fetched Preview base.

The supplement release path must independently check the fixed authorization, its digest, public disclosure, actual timestamps, private per-article source records, absence of the date on the existing Preview base, complete technical evidence and every ordinary Preview requirement. It retains the same release lock, merge-head binding, exact-SHA dispatch and original receipt for recovery. An ordinary daily release cannot silently become a supplement.

Historical live verification checks the new issue and every story against the deployed SHA while independently verifying the homepage's actual latest issue. Inserting an older issue need not replace the homepage's current issue.

The shared reading-room renderer, supplied historical originals, Production workflows, Pages settings, default branch and schedule remain outside this exception.

## Commands and private evidence

Start with `npm run supplement:preflight -- --date YYYY-MM-DD` at an eligible collection checkpoint. It preserves current-day runtime checks, selects the historical coverage date's focus cohort and standing beats, and rejects already-live or unlisted dates. Use the regular online repository/base checks before research.

The private research JSON must contain `article_sources`, one record per story with `story_id`, distinct `canonical_event_id` and its `sources`. Every counted source records its public `url`, stable `underlying_source_id`, `kind: information`, actual `accessed_at`, `actually_read: true`, `substantive: true`, nonempty `supports`, and `reading_notes`. These are evidence records, never a checklist to fill without reading. The whole private file is hash-bound to the release attestation.

The ordinary attestation additionally includes `historical_supplement.authorization_id` and `authorization_digest`. Its `policy_digest` is calculated over `historicalPreviewPolicy(dailyPolicy, authorization)`. The date remains the historical coverage date; checked, source-health/browser and official-media provenance timestamps use the actual preparation day.

Run ordinary `preview:release` first without `--execute`. A supplement must opt into the bounded authority in its public manifest and private attestation; a past date without both still fails. Resume only its original receipt using `preview:resume -- --date YYYY-MM-DD --historical-supplement`. Read-only verification uses `preview:live -- --sha MERGE_SHA --issue-date YYYY-MM-DD`; ordinary `--date` retains its latest-issue requirement.
