# Local build and evidence tooling

All tools are repository-relative and non-deploying.

- `npm run build` validates public source, contract/core identities, hashes, privacy boundaries, and V3 date semantics; then writes deterministic static output to ignored `dist/`.
- `npm run qa` independently checks the built artifact and writes technical evidence plus nine desktop, mobile, landscape, no-JavaScript, and reduced-motion renders under ignored `.stage4/evidence/<issue>/`.
- `npm run review:template` writes a digest-bound, `PENDING` named-human review form. It does not fill, approve, or infer human judgment.
- `npm run gate -- --previous-good <release-id>` evaluates exact evidence against the built digest. It writes a local simulation decision with `production_authority: false`.
- `npm test` runs deterministic and fail-closed regression scenarios using synthetic fixtures only.

These scripts have no GitHub API, hosting, Pages, workflow, branch, or deployment capability.
