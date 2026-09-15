# Daily Preview operations

`daily-policy.json` is the machine authority for schedule and limits. `DAILY_RUN.md` is the research-to-release runbook. `docs/PREVIEW_AUTONOMY.md` records the owner's Preview-only authorization, evidence contract and recovery semantics. The production contract remains unchanged.

Run `npm run ops:state -- --online` to reconcile the current date, PR and release; `npm run ops:check` checks repository consistency. The optional `--automation-file` checks the real external scheduler without publishing its configuration.

Daily generation may change only its dated issue directory and exact dated cover. Technical/research evidence stays private. The release helper owns the guarded Preview merge/dispatch; Production, Pages settings and other repositories remain out of scope. Weekly health remains read-only.
