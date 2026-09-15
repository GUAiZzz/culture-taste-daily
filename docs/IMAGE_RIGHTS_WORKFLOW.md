# Official source images: required; permission never presumed

Every selected story must first verify a story-specific image supplied by a first-party official source. That provenance gate and the usage-rights gate are separate. A page being public, an image being visible in a browser, a photographer credit, a press mention, or an embeddable URL is not permission to copy, package, transform, or hotlink that image.

## The publication rule

1. Select the story and an exact first-party official image together. The origin must be the directly responsible subject, brand, designer, artist, institution, venue, organizer, or canonical official channel. Third-party media, search, gallery, repost, social mirror, stock, and generated imagery do not satisfy this gate.
2. Record the official image-origin page as `media.origin_url`, the direct asset URL separately when needed for Preview, and mark both the story source and media origin as `first_party_official`. This is provenance only; it is not a rights grant. A source-hosted `external_image_url` is permitted only for the visibly non-production Preview treatment described below; it must never enter a production artifact.
3. Record a specific public rights label in `media.rights_basis`: `open_license`, `documented_permission`, `public_domain`, `owned_original`, or `historical_artifact_review`.
4. Copy the image into the issue package only after the rights basis is verified for this repository, territory, format, and duration. The production build accepts only local display-critical assets. A Preview-only linked figure may temporarily show a publisher-hosted URL, but it is marked `PREVIEW ONLY`, keeps the rights summary `blocked`, and cannot pass the production gate.
5. Keep permission emails, contracts, restrictions, and full evidence in the private source-ledger. The public manifest contains only the minimum provenance and rights label needed for reader trust.
6. Caption the image accurately. A current official source image may document the event. A contextual official image, original diagram, or illustration must be labeled as such and cannot be presented as current documentary evidence.
7. Original diagrams, illustrations, and text-led compositions may supplement the official image but cannot satisfy the official-image gate. If no accurate official image is verifiable, hold or omit the story.

## What is blocked

The following are never valid production rights bases by themselves: `found online`, `credit`, `press access`, `fair use` guessed by the editor, an official website URL, an `og:image` tag, or a remote embed. Unknown, contradictory, expired, or out-of-scope rights block that image. The Preview-only `preview_user_authorized_external` label is a display exception, not a permission claim; it is always blocked from production. If rights do not clear, the official image may remain a linked Preview figure, but production stays blocked until a valid rights basis exists or the story is omitted.

## Manifest contract

Every issue visual declares:

- `asset`: a local file under the issue's `assets/` directory;
- `kind`: the visual's documentary or editorial role;
- `origin_url`: source provenance when applicable, otherwise `null` for owned original work;
- `rights_basis`: the separately reviewed usage-rights basis;
- `alt`, `caption`, and `credit`: reader-facing accessibility and attribution.

`source_image` additionally requires an origin URL and one of `open_license`, `documented_permission`, `public_domain`, or the production-blocking `preview_user_authorized_external`. From the A2 effective date, the build also requires `origin_authority: first_party_official` and a matching story source with `relationship: first_party_official`. `original_illustration` and `data_diagram` require `owned_original`, but neither satisfies the story-level official-image gate. The JSON schema and build fail closed before an asset can enter the generated site if this contract is missing or contradictory.

## Current Preview

The 2026-08-24 Preview now surfaces five publisher-hosted source-image URLs (Supreme/Hypebeast, Stüssy, BAPE, SFMOMA, and Taipei Music Center) inside linked figures; clicking the figure opens the cited source. These are explicitly `PREVIEW ONLY`, use `preview_user_authorized_external`, and set the public rights summary to `blocked`, so they cannot pass the production gate. The Southbank, Seoul Fashion Week, and empty luxury-runway slots remain original data diagrams because no source image was safely surfaced for them. A production cutover still requires the source owner’s press asset, written permission, or a clearly applicable open-license record.

The repaired 2026-08-25 Preview applies A2 to every story: eight figures resolve to first-party official origins and click through to the responsible official page. They remain externally hosted, explicitly `PREVIEW ONLY`, and rights-blocked. One SFMOMA image is explicitly contextual evidence of an earlier Hashimoto installation rather than documentary imagery of the current `Giant Arc`; that distinction is preserved in its alt text and caption.
