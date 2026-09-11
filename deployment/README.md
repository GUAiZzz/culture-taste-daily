# Deployment boundary — Preview only

`.github/workflows/preview.yml` provides pull-request verification and a manually dispatched GitHub Pages Preview. It has no schedule and cannot be triggered by manifest status or generator scores.

The deployed artifact is visibly marked `NON-PRODUCTION PREVIEW`, carries `noindex,nofollow`, and is rebuilt and rechecked with the repository's pinned tools before upload. GitHub's technical Pages environment name does not grant Culture & Taste production authority.

Production deployment, custom domains, production redirects, old-site changes, and unattended Production automation remain disabled. Any later production design requires separate authorization and exact artifact-bound technical evidence plus named human editorial/visual acceptance.

Daily non-production dispatch is permitted only through the owner-authorized machine gate in docs/PREVIEW_AUTONOMY.md. The workflow checks the exact Preview SHA and the live verifier checks deployed route hashes.
