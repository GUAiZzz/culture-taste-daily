// This checks the reader's fallback, not source availability or usage rights.
// Release still requires the separate dated provenance and health attestation.
export function declaredPreviewMedia(manifests = [], radars = [], corrections = {}) {
  const origins = new Map();
  const add = (url, origin) => {
    if (!/^https:\/\//.test(url ?? '') || !/^https:\/\//.test(origin ?? '')) return;
    if (!origins.has(url)) origins.set(url, new Set());
    origins.get(url).add(origin);
  };
  for (const manifest of manifests) for (const story of manifest.stories ?? []) {
    const media = story.media;
    if (media?.kind !== 'source_image' || media.origin_authority !== 'first_party_official'
      || media.rights_basis !== 'preview_user_authorized_external'
      || !story.sources?.some(source => source.relationship === 'first_party_official' && source.url === media.origin_url)) continue;
    add(media.external_image_url, media.origin_url);
    // The reading-room renderer has a small, separately reviewed correction
    // registry for old issues. Bind a correction only to the same declared
    // first-party origin and its own host; never accept an unrelated image.
    const correction = corrections[`${manifest.issue_id}/${story.id}`];
    try {
      if (correction?.origin_url === media.origin_url && typeof correction.reason === 'string' && correction.reason.trim()
        && new URL(correction.external_image_url).hostname === new URL(media.origin_url).hostname) {
        add(correction.external_image_url, correction.origin_url);
      }
    } catch { /* Invalid correction is not a verified origin. */ }
  }
  for (const radar of radars) for (const item of radar.items ?? []) {
    const media = item.media;
    if (media?.origin_authority !== 'first_party_official'
      || media.rights_basis !== 'preview_user_authorized_external') continue;
    add(media.kind === 'video' ? media.poster_url : media.url, item.official_url);
  }
  return origins;
}

export function verifiedPreviewFallback(image, origins) {
  const expected = origins.get(image?.url);
  return Boolean(expected?.size && image.external_preview === true && image.loaded === false
    && (image.settled === true || image.failure_state === true)
    && typeof image.alt === 'string' && image.alt.trim()
    && image.fallback?.visible === true && image.fallback.text?.trim()
    && image.fallback.links?.some(link => link.visible === true && expected.has(link.href)));
}

export function previewImagesReadable(facts, origins, { allowDeferred = false } = {}) {
  if (facts.broken_images?.length) return false;
  const images = facts.external_preview_images ?? [];
  if (!images.every(image => image.loaded === true || verifiedPreviewFallback(image, origins)
    || (allowDeferred && facts.deferred_external_previews?.includes(image.url)))) return false;
  // A generic failed frame or missing local artwork never borrows this exception.
  const frames = facts.failed_visual_frames ?? [];
  if ((facts.image_failed_frames ?? 0) !== frames.length) return false;
  return frames.every(frame => frame.external_image_urls.length > 0 && frame.external_image_urls.every(url =>
    images.some(image => image.url === url && verifiedPreviewFallback(image, origins))));
}

// Kept as a standalone serializable function so the real DOM behavior is tested.
export function collectPreviewImageFacts() {
  const visible = element => {
    if (!element || element.closest('[hidden]')) return false;
    if (element.checkVisibility) return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  };
  const facts = [...document.querySelectorAll('img[data-external-preview="true"]')].map(image => {
    const frame = image.closest('[data-photo], figure.story-figure, [data-visual-frame], .extra-thumb');
    const fallback = frame?.querySelector('.photo-fallback, .official-media-fallback, .image-failure-note, .source-image-fallback');
    const scope = frame?.closest('figure') ?? frame;
    const links = [...new Set([image.closest('a'), ...(scope?.querySelectorAll('a[href]') ?? []), frame?.closest('a')].filter(Boolean))];
    return {
      url: image.currentSrc || image.src,
      external_preview: true,
      alt: image.getAttribute('alt'),
      settled: image.complete,
      loaded: image.complete && image.naturalWidth > 0,
      failure_state: frame?.classList.contains('image-failed') || ['failed', 'slow'].includes(frame?.dataset.image),
      fallback: {
        visible: visible(fallback),
        text: fallback?.innerText ?? '',
        links: links.map(link => ({ href: link.href, visible: visible(link) })),
      },
    };
  });
  return {
    external_preview_images: facts,
    failed_visual_frames: [...document.querySelectorAll('[data-visual-frame].image-failed')].map(frame => ({
      external_image_urls: [...frame.querySelectorAll('img[data-external-preview="true"]')].map(image => image.currentSrc || image.src),
    })),
  };
}
