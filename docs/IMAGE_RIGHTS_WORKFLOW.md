# Source images: preferred, never presumed

Culture & Taste should prefer a real image supplied by the information source when that image can be published safely. A page being public, an image being visible in a browser, a photographer credit, a press mention, or an embeddable URL is not permission to copy, package, transform, or hotlink that image.

## The publication rule

1. Select the story and the exact image together. The image must be relevant to the claim and its role must be explicit: `source_image`, `original_illustration`, `data_diagram`, or `historical_artifact`.
2. Record the image-origin page or direct asset URL as `media.origin_url`. This is provenance only; it is not a rights grant. A publisher-hosted `external_image_url` is permitted only for the visibly non-production Preview treatment described below; it must never enter a production artifact.
3. Record a specific public rights label in `media.rights_basis`: `open_license`, `documented_permission`, `public_domain`, `owned_original`, or `historical_artifact_review`.
4. Copy the image into the issue package only after the rights basis is verified for this repository, territory, format, and duration. The production build accepts only local display-critical assets. A Preview-only linked figure may temporarily show a publisher-hosted URL, but it is marked `PREVIEW ONLY`, keeps the rights summary `blocked`, and cannot pass the production gate.
5. Keep permission emails, contracts, restrictions, and full evidence in the private source-ledger. The public manifest contains only the minimum provenance and rights label needed for reader trust.
6. Caption the image accurately. A source image may document the event; an original diagram or contextual image must be labeled as such and cannot be presented as documentary evidence.

## What is blocked

The following are never valid production rights bases by themselves: `found online`, `credit`, `press access`, `fair use` guessed by the editor, an official website URL, an `og:image` tag, or a remote embed. Unknown, contradictory, expired, or out-of-scope rights block that image. The Preview-only `preview_user_authorized_external` label is a display exception, not a permission claim; it is always blocked from production. If no source image clears the check, use a clearly labeled original diagram, a verified text/data composition, or a deliberate text-only passage.

## Manifest contract

Every issue visual declares:

- `asset`: a local file under the issue's `assets/` directory;
- `kind`: the visual's documentary or editorial role;
- `origin_url`: source provenance when applicable, otherwise `null` for owned original work;
- `rights_basis`: the separately reviewed usage-rights basis;
- `alt`, `caption`, and `credit`: reader-facing accessibility and attribution.

`source_image` additionally requires an origin URL and one of `open_license`, `documented_permission`, or `public_domain`. `original_illustration` and `data_diagram` require `owned_original`. The JSON schema and build fail closed before an asset can enter the generated site if this contract is missing or contradictory.

## Current Preview

The 2026-08-24 Preview now surfaces five publisher-hosted source-image URLs (Supreme/Hypebeast, Stüssy, BAPE, SFMOMA, and Taipei Music Center) inside linked figures; clicking the figure opens the cited source. These are explicitly `PREVIEW ONLY`, use `preview_user_authorized_external`, and set the public rights summary to `blocked`, so they cannot pass the production gate. The Southbank, Seoul Fashion Week, and empty luxury-runway slots remain original data diagrams because no source image was safely surfaced for them. A production cutover still requires the source owner’s press asset, written permission, or a clearly applicable open-license record.
