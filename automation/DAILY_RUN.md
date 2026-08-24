# Culture & Taste Daily candidate run

Status: `AUTHORIZED DAILY DRY RUN / NO DEPLOYMENT AUTHORITY`

This runbook is the auditable instruction surface for the scheduled Culture & Taste candidate task. It produces a dated review branch and pull request. It never merges, changes Pages, deploys Preview or production, edits the legacy repository, or treats generator output as approval.

## Schedule and date

- Start at `06:15` in `Asia/Shanghai` every day.
- Run `npm run daily:preflight` before browsing or editing.
- The target issue date must equal the current Shanghai calendar date.
- Research must be refreshed and locked between `06:00` and `08:30` Shanghai time.
- If the run starts late, misses the window, or cannot finish an honest refresh, report `BLOCKED`; do not backdate timestamps.

## Git boundary

- Initial dry-run base ref: `codex/daily-automation-v1`.
- Create or update only `automation/culture-taste-YYYY-MM-DD`.
- Never commit directly to `main`, `preview-build-v1`, or `gh-pages`.
- Open or update one pull request from the dated branch to the configured dry-run base ref.
- Never merge the pull request or dispatch `.github/workflows/preview.yml`.
- If the base ref, repository identity, or worktree state is ambiguous, stop `BLOCKED`.

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
4. Check direct community evidence only as a bounded discovery signal.
5. Deduplicate by underlying event and separate publication date, event date, access time, and current status.
6. Assign evidence confidence before editorial weight.
7. Apply the trend, breakout-object, sensitive-news, and commercial-content gates when relevant.

Standing checks are research obligations, never publication quotas:

- Supreme Thursday drop check on Thursday;
- Stüssy release radar every day;
- active luxury runway calendars every day;
- exhibitions and cultural programmes every day;
- small breakout objects and observable cultural shifts every day.

The issue may publish none of these when evidence or editorial relevance is weak.

## Editorial and reference lock

- Select the smallest strong issue; do not fill a numerical quota.
- Separate fact, attributable source rationale, and Culture & Taste inference.
- Chinese carries the complete argument; English adds no unsupported fact or certainty.
- Run the canonical HarryTone audit before content lock.
- Compare up to seven previous valid issues before art direction.
- Lock today's editorial/design problem before visual browsing.
- Reopen and verify at least one detail-level project, live work, or case-study article; use at most two new deep cases by default.
- Complete the reference chain: original problem → transferable principle → today's problem → independent expression → do-not-copy surface.

## Images

- Every selected main story needs one visual treatment.
- Prefer a story-specific source image only when its usage-rights basis is separately verified.
- Credit never substitutes for permission.
- If rights are unknown, do not download or package the image. Use an owned original diagram, a clearly labeled non-documentary illustration, or a deliberate text-led treatment.
- Never fabricate documentary evidence, a person, product, show, campaign, or event.

## Public promotion and validation

Promote only reader-facing, publishable material into `src/issues/YYYY-MM-DD/`:

- `content.md`;
- `art-direction.json`;
- `issue-manifest.public.json`;
- scoped `issue.css` and optional progressive enhancement;
- local assets with a valid public rights basis.

Then run:

```text
npm ci
npm run daily:preflight
npm run verify
npm audit --audit-level=high
git diff --check
```

Confirm privacy scanning rejects private material and confirm the issue is fully readable on desktop, mobile, reduced motion, and without JavaScript. Re-run every dependent check after a material content, source, image, style, or interaction change.

## Result

On success:

- commit only the dated public issue and necessary public test updates;
- push the dated branch;
- open or update one pull request;
- report source/issue/artifact digests, QA result, unresolved rights, and the exact human decisions still required;
- stop before merge or deployment.

On any failure:

- report `BLOCKED` with the smallest actionable reason;
- do not push private or incomplete material;
- do not change Preview or production;
- preserve the previous good website exactly as it is.
