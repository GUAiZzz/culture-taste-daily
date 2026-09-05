# Mandatory repository instructions

Read these files before changing this repository, in order:

1. `README.md`
2. `docs/NORTH_STAR.md`
3. `docs/PRODUCTION_STATUS.md`
4. `docs/PREVIEW_BUILD.md`
5. `docs/CONTRACT_STATUS.md`
6. `docs/PRODUCTION_CONTRACT_V3.md`
7. `docs/PRODUCTION_CONTRACT_V3_A1.md`
8. `docs/PRODUCTION_CONTRACT_V3_A2.md`
9. `docs/ARCHITECTURE.md`
10. `docs/DATA_BOUNDARIES.md`
11. `docs/HARRYTONE_DEPENDENCY.md`
12. `docs/REFERENCE_SYSTEM.md` and `docs/CULTURE_TASTE_SOURCE_MAP.md` for editorial work

For mobile, responsive, touch, or scroll-experience work, also read
`.agents/skills/culture-taste-mobile/SKILL.md` and
`docs/MOBILE_EDITORIAL_PROTOCOL.md` before changing implementation files.

For the authorized daily candidate dry run, also read `automation/DAILY_RUN.md` and `automation/daily-policy.json` before acting.

## Current hard stops

- Preview hosting is authorized only through `.github/workflows/preview.yml`; it must remain visibly non-production and `noindex`.
- Do not enable production cutover or unattended production automation.
- The repository owner authorized a continuing daily dry-run candidate task and a weekly read-only health audit. They are limited to `automation/DAILY_RUN.md` and `automation/WEEKLY_HEALTH.md`: dated candidate branch, QA, pull request, and read-only audit only. The owner-approved docs/PREVIEW_AUTONOMY.md amendment now grants only machine-gated daily Preview merge/dispatch authority. Weekly health stays read-only.
- Do not create a production or scheduled GitHub workflow. The authorized schedule lives outside GitHub Actions and has separately gated non-production Preview authority.
- Production Contract V3 is canonical, but implementation, preview, GitHub Pages, production deployment, historical migration, workflows, and daily automation remain separately gated and are not authorized by contract activation.
- The supplied 2026-08-20, 2026-08-21, and 2026-08-22 historical originals may be preserved in Preview with exact source hashes. Do not rewrite, normalize, or declare them production-ready.
- Do not read from or write to `GUAiZzz/GUAiZzz` as part of this repository's build.
- Do not copy canonical HarryTone private source into this repository.
- Do not commit private source-ledger instances, research notes, rejected-candidate notes, secrets, tokens, credentials, `.env` files, or local browser data.
- Do not treat public manifest status, generator scores, or visual self-review as deployment authority.

## Content and candidate rules

- `src/issues/<date>/content.md` is the public content source for an issue.
- Any generated candidate must be fully readable without JavaScript.
- Shared site behavior and issue-specific art direction must remain separate.
- The accepted `candidate/2026-08-25/` snapshot is review evidence, not a production release.
- Changes to locked content require a new content hash and a full QA rerun.
- Every selected story must verify a story-specific image from a first-party official source. An owned diagram, editorial illustration, media image, search result, or generated image cannot satisfy that gate.
- Official provenance and usage permission are separate. Unknown rights permit only the visibly linked, rights-blocked Preview treatment; they never authorize copying the asset into production.

## Preview operational amendment

Read docs/PREVIEW_AUTONOMY.md and automation/daily-policy.json before release work. The 2026-09-05 owner instruction supersedes prior daily candidate-only limits, effective 2026-09-06. Never apply that exception to Production, other repositories, history, default-branch migration or Pages settings.
