# Culture & Taste Daily candidate run

Status: `AUTHORIZED DAILY DRY RUN / NO DEPLOYMENT AUTHORITY`

This runbook is the auditable instruction surface for the scheduled Culture & Taste candidate task. It produces a dated review branch and pull request. It never merges, changes Pages, deploys Preview or production, edits the legacy repository, or treats generator output as approval.

## Schedule and date

- Start the primary run at `09:30` in `Asia/Shanghai` every day.
- Recheck at `11:30`, `13:30`, and `14:30`. If today's complete candidate and pull request are missing, stale, or previously blocked, recover automatically before `15:00` on the same dated branch and pull request. Passing the primary start time is never itself a blocker.
- A same-day manual recovery run is also allowed before `15:00`; it must update the same dated branch and pull request rather than create a duplicate.
- Run `npm run daily:preflight` before browsing or editing.
- The target issue date must equal the current Shanghai calendar date.
- For publication dates on or after `2026-08-26`, research must be refreshed and locked between `06:00` and `15:00` Shanghai time. Earlier dates retain the historical `08:30` deadline and are never reclassified.
- If the run starts late, misses the window, or cannot finish an honest refresh, report `BLOCKED`; do not backdate timestamps.

## Git boundary

- Stable dry-run base ref: `preview-build-v1`. This is the current shared publication container and front-end baseline.
- Create or update only `automation/culture-taste-YYYY-MM-DD`.
- Never commit directly to `main`, `preview-build-v1`, or `gh-pages`.
- Open or update one pull request from the dated branch to the configured dry-run base ref.
- Never merge the pull request or dispatch `.github/workflows/preview.yml`.
- If the base ref, repository identity, or worktree state is ambiguous, stop `BLOCKED`.
- A daily content run may change only `src/issues/YYYY-MM-DD/` and narrowly required date-specific tests. It must not redesign or modify `core/`, historical issues, schemas, workflows, Pages settings, automation policy, or the publication container.

## Private workspace

Create a fresh ephemeral research workspace outside the public repository for the run. Store candidate records, source-ledger instances, reference cards, rejected items, access notes, image-rights evidence, and HarryTone loading evidence only there.

Before any public source is written:

1. verify access to canonical private `GUAiZzz/harry-tone`;
2. verify branch `main` and the pinned commit in `dependencies/harrytone.json`;
3. read the required canonical HarryTone material completely;
4. record the exact identity and load time privately;
5. fail `BLOCKED` if the repository, branch, commit, or required content cannot be verified.

Never copy HarryTone source, private ledgers, cookies, credentials, screenshots, or research notes into this repository, the PR, Actions logs, or a Pages artifact.

## Research sequence

Follow `docs/CULTURE_TASTE_SOURCE_MAP.md` and use detail pages rather than headlines or snippets.

1. Scan P0 official calendars, institutions, brands, designers, artists, labels, venues, and organizers.
2. Scan strong independent fashion/culture, art/design, and relevant specialist sources.
3. Complete all five regional lanes from `automation/daily-policy.json`; an empty lane is allowed when recorded privately.
4. Load `automation/brand-radar.json`, complete a lightweight current-status scan of every active subject, then deeply verify the deterministic focus cohort reported by `npm run daily:preflight` and apply the standing beats below. The complete registry is a daily discovery obligation, not a publication quota.
5. Resolve each selected subject to its current official public route. Instagram following, login, or private access is never required. An exact official detail page is still required before a brand announcement can become P0 evidence.
6. Check direct community evidence only as a bounded discovery signal.
7. Deduplicate by underlying event and separate publication date, event date, access time, and current status.
8. Assign evidence confidence before editorial weight.
9. Apply the trend, breakout-object, sensitive-news, and commercial-content gates when relevant.

Standing checks are research obligations, never publication quotas:

- Supreme Thursday drop check on Thursday;
- Stüssy release radar every day;
- active luxury runway calendars every day;
- exhibitions and cultural programmes every day;
- small breakout objects and observable cultural shifts every day.

Every active subject in the maintained brand-and-culture radar receives a lightweight daily status scan. One deterministic cohort receives the deeper official-detail-page pass each day, so every subject gets a deep pass once per seven-day rotation. A subject's presence in the radar never proves relevance, independence, cultural impact, or image rights, and it never requires a social-media follow.

The issue may publish none of these when evidence or editorial relevance is weak.

## Editorial and reference lock

- Select the smallest strong issue; do not fill a numerical quota.
- Separate fact, attributable source rationale, and Culture & Taste inference.
- Chinese carries the complete argument; English adds no unsupported fact or certainty.
- Run the canonical HarryTone audit before content lock.
- Compare up to seven previous valid issues before art direction.
- Generate and lock `closing_palette` from the day's `quiet_ending`, `dominant_mood`, and `palette_logic`; record background, foreground, accent, and a public editorial rationale. This is authored daily input, never browser randomness.
- Keep body-text contrast at or above 4.5:1, structural accent contrast at or above 3:1, and do not repeat the exact three-color set from the previous seven issues.
- Lock today's editorial/design problem before visual browsing.
- Reopen and verify at least one detail-level project, live work, or case-study article; use at most two new deep cases by default.
- Complete the reference chain: original problem → transferable principle → today's problem → independent expression → do-not-copy surface.

## Supplemental daily radar

Build the homepage radar separately from the formal issue. The issue must still select the smallest strong set and must never be padded to satisfy the radar count.

- Create `daily-radar.public.json` for the current date with at least two verified items in each of Fashion, Music, Objects, and City.
- The radar must include a public coverage attestation: all five regional lanes checked, full brand registry quick-scan completed, the exact focus cohort and standing beats checked, and the configured prior-issue deduplication window applied. Item-level rejected research remains private.
- An item may reference a story already selected for the issue or remain an extra signal that links directly to its official page. Extra signals do not enter `content.md`, the issue manifest, RSS, or the archive issue count.
- Every radar item must display first-party official media. Reuse the issue's verified official image for referenced stories. For extra signals, record the official detail page, exact official image or video URL, publisher, dates, alt text, credit, source authority, and rights basis.
- Prefer an official video and official poster when the source provides a useful moving-image asset. A screenshot may be used only when its public-use basis is documented; a self-created illustration, generic placeholder, search thumbnail, or media repost cannot satisfy the radar.
- If any category has fewer than two honest items or any item lacks verified official media, fail the radar check. Do not weaken the formal issue or fabricate a visual to fill the grid.
- From 2026-08-26 onward, an event, official detail URL, or canonical item key already used in either of the previous two issues cannot be reused as a fresh Daily Select. A genuine continuation needs a new event key, new dated evidence, and an explicit continuation rationale in the private ledger.

## Images

- Every selected story must resolve and verify at least one story-specific image from a first-party official source before editorial lock. Use the subject, brand, designer, artist, institution, venue, organizer, or another directly responsible canonical public channel.
- A media publication, discovery index, search result, repost, social mirror, stock image, AI image, owned diagram, or editorial illustration cannot satisfy the official-image gate.
- Record the official origin page, exact image URL, verification time, source relationship, documentary or contextual role, credit, and usage-rights basis separately. A contextual official image must be labeled and cannot impersonate current documentary evidence.
- Credit never substitutes for permission.
- If rights are cleared for the intended use, copy the image locally and preserve the evidence privately. If rights are unknown, do not download or package it: a visibly non-production Preview may use only the linked external-image treatment that opens the official origin page, keeps the rights summary `blocked`, and cannot enter production.
- An owned diagram, clearly labeled non-documentary illustration, or text-led treatment may supplement an official image but cannot replace it. If no accurate official image can be verified, hold or omit the story.
- Never fabricate documentary evidence, a person, product, show, campaign, or event.
- Apply the same origin and rights separation to supplemental radar media. A video must link to the official host and include an official poster image for the static, no-JavaScript card.

## Public promotion and validation

Promote only reader-facing, publishable material into `src/issues/YYYY-MM-DD/`:

- `content.md`;
- `art-direction.json`;
- `issue-manifest.public.json`;
- `daily-radar.public.json` for the supplemental homepage index;
- scoped `issue.css` and optional progressive enhancement;
- local assets with a valid public rights basis.

Then run:

```text
npm ci
npm run daily:preflight
npm run verify
npm run health:daily -- --date YYYY-MM-DD
npm audit --audit-level=high
git diff --check
```

`health:daily` must verify every public source page, first-party official image, radar image, official video route, and static video poster for the dated issue. It retries transient failures, then uses a real-browser fallback for anti-bot responses. It writes ignored evidence under `.stage4/health/` and fails closed when a required media response or public route is genuinely unavailable. A `REVIEW_REQUIRED` page must be opened and read in the connected interactive browser; record that verification privately or stop `BLOCKED`. Availability does not grant image rights.

Confirm privacy scanning rejects private material and confirm the issue is fully readable on desktop, mobile, reduced motion, and without JavaScript. The QA evidence must include complete desktop and mobile captures of the current homepage and issue plus story-reader coverage. Re-run every dependent check after a material content, source, image, style, or interaction change.

From 2026-08-26 onward, every current issue also needs a local, issue-specific archive cover. Falling back to the generic blue/lime type card is a build failure. Compare the cover against the previous seven issues, and fail visual QA when the homepage Chinese headline uses a line-height below the collision-safe threshold or overflows its container.

## Result

On success:

- commit only the dated public issue and necessary public test updates;
- push the dated branch;
- open or update one pull request;
- report source/issue/artifact digests, live-source health, QA result, unresolved rights, and the exact human decisions still required;
- stop before merge or deployment.

On any failure:

- report `BLOCKED` with the smallest actionable reason;
- do not push private or incomplete material;
- do not change Preview or production;
- preserve the previous good website exactly as it is.
