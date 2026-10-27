# Daily Preview operations

`daily-policy.json` is the machine authority for schedule and limits. `DAILY_RUN.md` is the research-to-release runbook. `docs/PREVIEW_AUTONOMY.md` records the owner's Preview-only authorization, evidence contract and recovery semantics. The production contract remains unchanged.

Run `npm run ops:state -- --online` to reconcile the current date, PR and release; `npm run ops:check` checks repository consistency. The optional `--automation-file` checks the real external scheduler without publishing its configuration.

`npm run daily:cycle -- --workspace-root <absolute-private-root> --online` is the resumable collection entrypoint. `npm run editorial:workspace -- plan --workspace <absolute-date-workspace>` returns saved article/source progress; `npm run sources:plan -- --summary` reports source-entrypoint coverage without claiming a completed scan. `npm run editorial:check -- --public-only` checks every new package and preserves the pinned already-live baseline. Full private evidence is still required at release. See `docs/EDITORIAL_OPERATIONS.md` for commands, recovery experiments and references.

Daily generation may change only its dated issue directory and exact dated cover. Technical/research evidence stays private. The release helper owns the guarded Preview merge/dispatch; Production, Pages settings and other repositories remain out of scope. Weekly health remains read-only.
