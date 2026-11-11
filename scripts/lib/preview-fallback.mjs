// This checks the reader's fallback, not source availability or usage rights.
// Release still requires the separate dated provenance and health attestation.
export function declaredPreviewMedia(manifests = [], radars = [], corrections = {}, readingMedia = {}, provisionalFeatures = []) {
  const origins = new Map();
  // Navigation thumbnails open a complete, statically served story that retains
  // its exact official source. Derive destinations from verified manifest data.
  origins.navigationTargets = new Map();
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(manifest.issue_id || '') && /^[a-z0-9-]+$/.test(story.id || '')) {
      if (!origins.navigationTargets.has(media.external_image_url)) origins.navigationTargets.set(media.external_image_url, new Set());
      origins.navigationTargets.get(media.external_image_url).add(`/issues/${manifest.issue_id}/#story-${story.id}`);
    }
    // The reading-room renderer has a small, separately reviewed correction
    // registry for old issues. Bind a correction only to the same declared
    // first-party origin and its own host; never accept an unrelated image.
    const correction = corrections[`${manifest.issue_id}/${story.id}`];
    try {
      if (correction?.origin_url === media.origin_url && typeof correction.reason === 'string' && correction.reason.trim()
        && new URL(correction.external_image_url).hostname === new URL(media.origin_url).hostname) {
        add(correction.external_image_url, correction.origin_url);
        const targets=origins.navigationTargets.get(media.external_image_url);
        if(targets)origins.navigationTargets.set(correction.external_image_url,new Set(targets));
      }
    } catch { /* Invalid correction is not a verified origin. */ }
    // Supplemental reading images are approved public metadata, never a claim
    // inferred from an arbitrary DOM attribute. Bind each image to this exact
    // story and one of its declared first-party sources before allowing fallback.
    for (const image of readingMedia[`${manifest.issue_id}/${story.id}`] ?? []) {
      try {
        const source = story.sources?.find(source => source.relationship === 'first_party_official' && source.url === image.origin_url);
        if (source && image.origin_authority === 'first_party_official'
          && image.rights_basis === 'preview_user_authorized_external'
          && typeof image.alt === 'string' && image.alt.trim()
          && typeof image.credit === 'string' && image.credit.trim()
          && new URL(image.external_image_url).hostname === new URL(image.origin_url).hostname) {
          add(image.external_image_url, image.origin_url);
        }
      } catch { /* Unbound or malformed media never borrows the exception. */ }
    }
  }
  for (const radar of radars) for (const item of radar.items ?? []) {
    const media = item.media;
    if (media?.origin_authority !== 'first_party_official'
      || media.rights_basis !== 'preview_user_authorized_external') continue;
    add(media.kind === 'video' ? media.poster_url : media.url, item.official_url);
  }
  // These declarations are separately labeled user-requested Preview data.
  // They only bind fallback behavior to the exact source and story route;
  // they do not claim research admission, provenance verification or rights.
  for(const feature of provisionalFeatures){
    if(feature?.schemaVersion!==1||feature.status!=='preview'||!/^\d{4}-\d{2}-\d{2}$/.test(feature.date||'')||!Array.isArray(feature.stories))throw Error('Invalid provisional media declaration');
    for(const story of feature.stories){
      if(!/^[a-z0-9-]+$/.test(story.id||'')||!Array.isArray(story.images))throw Error('Invalid provisional story declaration');
      for(const image of story.images){
        if(!['unknown','public_domain'].includes(image.rights)||!image.alt?.trim()||!image.caption?.trim()||!image.credit?.trim())throw Error('Incomplete provisional image declaration');
        add(image.url,image.origin);
        if(!origins.navigationTargets.has(image.url))origins.navigationTargets.set(image.url,new Set());
        origins.navigationTargets.get(image.url).add(`/issues/${feature.date}/#story-${story.id}`);
      }
    }
  }
  return origins;
}

function verifiedStoryNavigation(image, origins) {
  if (image?.navigation?.kind !== 'edition-story' || !image.navigation.href) return false;
  try {
    const target = new URL(image.navigation.href), base = new URL(image.navigation.pageUrl);
    if (target.origin !== base.origin || target.search || !image.navigation.storyId) return false;
    const endings = origins.navigationTargets?.get(image.url);
    const site = new URL('./', base);
    const exact = [...(endings || [])].some(route => target.pathname === site.pathname + route.slice(1).split('#')[0]
      && target.hash === '#story-' + image.navigation.storyId && target.hash === '#' + route.split('#')[1]);
    return exact && image.navigation.homepage === true && (image.navigation.visible === true || image.navigation.inactive === true && image.navigation.current !== true);
  } catch { return false; }
}

export function verifiedPreviewFallback(image, origins) {
  const expected = origins.get(image?.url);
  const navigation = verifiedStoryNavigation(image, origins);
  return Boolean(expected?.size && image.external_preview === true && image.loaded === false
    && (image.settled === true || image.failure_state === true)
    && typeof image.alt === 'string' && image.alt.trim()
    && (image.fallback?.visible === true || navigation && image.navigation.inactive === true)
    && image.fallback.text?.trim()
    && (navigation || image.fallback.links?.some(link => link.visible === true && expected.has(link.href))));
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
    const navigationLink = frame?.closest('a[data-living-entry="story"]');
    const links = [...new Set([image.closest('a'), ...(scope?.querySelectorAll('a[href]') ?? []), frame?.closest('a')].filter(Boolean))];
    return {
      url: image.currentSrc || image.src,
      external_preview: true,
      navigation: frame?.dataset.previewNavigation === 'edition-story' ? {kind: 'edition-story', href: navigationLink?.href, pageUrl: location.href, storyId: navigationLink?.dataset.storyId, visible: visible(navigationLink), homepage: document.body.classList.contains('page-home'), current: navigationLink?.getAttribute('aria-current') === 'true', inactive: Boolean(navigationLink?.matches('.living-art[aria-hidden="true"]'))} : null,
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
