const CLEARED_SOURCE_IMAGE_RIGHTS = new Set(["open_license", "documented_permission", "public_domain"]);

export function assertOfficialStoryImages(manifest, gate) {
  if (!gate?.required || manifest.publication_date < gate.effective_from) return;

  for (const story of manifest.stories) {
    const media = story.media;
    if (!media || media.kind !== "source_image") {
      throw new Error(`${manifest.issue_id} story ${story.id} requires a first-party official source image; editorial visuals cannot satisfy the gate`);
    }
    if (media.origin_authority !== gate.required_origin_authority) {
      throw new Error(`${manifest.issue_id} story ${story.id} image origin is not marked first-party official`);
    }

    const matchingOfficialSource = story.sources.some(
      (source) => source.relationship === gate.required_source_relationship && source.url === media.origin_url,
    );
    if (!matchingOfficialSource) {
      throw new Error(`${manifest.issue_id} story ${story.id} image origin must match a first-party official story source`);
    }

    const isPreviewExternal = Boolean(media.external_image_url) && media.rights_basis === "preview_user_authorized_external";
    const isClearedLocalSourceImage = !media.external_image_url && CLEARED_SOURCE_IMAGE_RIGHTS.has(media.rights_basis);
    if (!isPreviewExternal && !isClearedLocalSourceImage) {
      throw new Error(`${manifest.issue_id} story ${story.id} official image has no allowed display treatment`);
    }
  }
}
