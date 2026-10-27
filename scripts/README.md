# Local build and evidence tooling

Tools are repository-relative. Build/editorial/source/QA commands do not deploy; the explicitly guarded `preview:release` and `preview:resume` commands are the only authorized daily Preview mutation path.

- `npm run build` validates public source, contract/core identities, hashes, privacy boundaries, and V3 date semantics; then writes deterministic static output to ignored `dist/`.
- `npm run daily:preflight` checks today's Shanghai date and refresh window, canonical public dependency identities, standing scan beats, and the no-merge/no-deploy dry-run boundary. A blocked preflight exits non-zero.
- `npm run daily:cycle -- --workspace-root <absolute-private-root> --online` resumes actual saved article/source work and reports the next incomplete action. It does not claim publication.
- `npm run editorial:workspace -- init|plan|apply|checkpoint|carry|export ...` saves drafts, source notes and actual timestamps in an external private, locked, atomically written workspace. Repeated operation IDs do not duplicate work; stale revisions are rejected.
- `npm run editorial:check -- --public-only` validates public package counts/structure before CI/build. `--date YYYY-MM-DD --private-evidence <external-export>` additionally validates per-article read sources. Public CI cannot certify private research.
- `npm run sources:plan -- --summary` reports official route coverage; `--subject <id>` gives actual verified discovery entrypoints and unresolved identity. A plan never counts as read research.
- `npm run qa` independently checks the built artifact and writes technical evidence plus issue, shell, and historical renders under ignored `.stage4/evidence/<issue>/`.
- `npm run review:template` writes a digest-bound, `PENDING` named-human review form. It does not fill, approve, or infer human judgment.
- `npm run gate -- --previous-good <release-id>` evaluates exact evidence against the built digest. It writes a local simulation decision with `production_authority: false`.
- `npm test` runs deterministic and fail-closed regression scenarios using synthetic fixtures only.

`ops:state --online` reads scoped GitHub state. Editorial/source tools make no GitHub or Pages writes. See `docs/EDITORIAL_OPERATIONS.md` for the complete private-to-public handoff.
