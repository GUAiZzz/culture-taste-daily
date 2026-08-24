# Mandatory repository instructions

Read these files before changing this repository, in order:

1. `README.md`
2. `docs/NORTH_STAR.md`
3. `docs/PRODUCTION_STATUS.md`
4. `docs/PREVIEW_BUILD.md`
5. `docs/CONTRACT_STATUS.md`
6. `docs/PRODUCTION_CONTRACT_V3.md`
7. `docs/ARCHITECTURE.md`
8. `docs/DATA_BOUNDARIES.md`
9. `docs/HARRYTONE_DEPENDENCY.md`
10. `docs/REFERENCE_SYSTEM.md` and `docs/CULTURE_TASTE_SOURCE_MAP.md` for editorial work

## Current hard stops

- Preview hosting is authorized only through `.github/workflows/preview.yml`; it must remain visibly non-production and `noindex`.
- Do not enable production cutover or daily automation.
- Do not create a production or scheduled workflow without a later explicit authorization.
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
