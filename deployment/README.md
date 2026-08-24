# Deployment boundary — Preview only

`.github/workflows/preview.yml` provides pull-request verification and a manually dispatched GitHub Pages Preview. It has no schedule and cannot be triggered by manifest status or generator scores.

The deployed artifact is visibly marked `NON-PRODUCTION PREVIEW`, carries `noindex,nofollow`, and is rebuilt and rechecked with the repository's pinned tools before upload. GitHub's technical Pages environment name does not grant Culture & Taste production authority.

Production deployment, custom domains, production redirects, old-site changes, and daily automation remain disabled. Any later production design requires separate authorization and exact artifact-bound technical evidence plus named human editorial/visual acceptance.
