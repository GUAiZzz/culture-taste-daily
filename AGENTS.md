# Mandatory repository instructions

Read these files before changing this repository, in order:

1. `README.md`
2. `docs/NORTH_STAR.md`
3. `docs/PRODUCTION_STATUS.md`
4. `docs/CONTRACT_STATUS.md`
5. `docs/PRODUCTION_CONTRACT_V3.md`
6. `docs/ARCHITECTURE.md`
7. `docs/DATA_BOUNDARIES.md`
8. `docs/HARRYTONE_DEPENDENCY.md`
9. `docs/REFERENCE_SYSTEM.md` and `docs/CULTURE_TASTE_SOURCE_MAP.md` for editorial work

## Current hard stops

- Do not enable GitHub Pages, preview hosting, production deployment, or daily automation.
- Do not create a deployment or scheduled workflow without a later explicit authorization.
- Production Contract V3 is canonical, but implementation, preview, GitHub Pages, production deployment, historical migration, workflows, and daily automation remain separately gated and are not authorized by contract activation.
- Do not modify or import historical publication artifacts.
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
