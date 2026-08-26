document.documentElement.classList.add("has-js");

const visualThemes = ["field", "coral", "analog"];
const themeStorageKey = "ctd-theme";
const themeManualKey = "ctd-theme-manual";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function rememberTheme(theme) {
  try {
    window.sessionStorage.setItem(themeStorageKey, theme);
  } catch {
    // The selected theme still applies to the current page when storage is unavailable.
  }
}

function hasManualTheme() {
  try {
    return window.sessionStorage.getItem(themeManualKey) === "1";
  } catch {
    return false;
  }
}

function updateThemeLinks(theme) {
  for (const link of document.querySelectorAll("a[data-theme-link]")) {
    const url = new URL(link.href, window.location.href);
    url.searchParams.set("theme", theme);
    link.href = `${url.pathname}${url.search}${url.hash}`;
  }
  for (const link of document.querySelectorAll("a[data-theme-home]")) {
    const url = new URL(link.href, window.location.href);
    if (hasManualTheme()) url.searchParams.set("theme", theme);
    else url.searchParams.delete("theme");
    link.href = `${url.pathname}${url.search}${url.hash}`;
  }
}

function updateThemeControls(theme) {
  for (const button of document.querySelectorAll("[data-theme-choice]")) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
  }
  for (const status of document.querySelectorAll("[data-theme-status]")) {
    status.textContent = theme === "field" ? "FIELD GREEN" : theme === "coral" ? "CORAL SIGNAL" : "2000s TV";
  }
}

function applyTheme(theme, { manual = false } = {}) {
  const safeTheme = visualThemes.includes(theme) ? theme : "field";
  if (manual) {
    try {
      window.sessionStorage.setItem(themeManualKey, "1");
    } catch {
      // The click still applies to the current page when storage is unavailable.
    }
  }
  document.documentElement.dataset.visualTheme = safeTheme;
  rememberTheme(safeTheme);
  updateThemeControls(safeTheme);
  updateThemeLinks(safeTheme);
}

applyTheme(document.documentElement.dataset.visualTheme);

for (const button of document.querySelectorAll("[data-theme-choice]")) {
  button.addEventListener("click", () => applyTheme(button.dataset.themeChoice, { manual: true }));
}

for (const frame of document.querySelectorAll("[data-visual-frame]")) {
  const image = frame.querySelector("img.source-art");
  if (!image) continue;
  const originalSource = image.src;
  const retryDelays = [1200, 3000];
  let retryCount = 0;
  let retryTimer = null;
  let deadlineTimer = null;
  const markFailure = () => frame.classList.add("image-failed");
  const markSuccess = () => {
    window.clearTimeout(deadlineTimer);
    frame.classList.remove("image-failed");
  };
  const monitorAttempt = () => {
    window.clearTimeout(deadlineTimer);
    deadlineTimer = window.setTimeout(() => {
      if (image.complete && image.naturalWidth) markSuccess();
      else retryImage();
    }, 8000);
  };
  const retryImage = () => {
    window.clearTimeout(deadlineTimer);
    markFailure();
    if (retryCount >= retryDelays.length || retryTimer !== null) return;
    const delay = retryDelays[retryCount];
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      retryCount += 1;
      const retryUrl = new URL(originalSource, window.location.href);
      retryUrl.searchParams.set("ctd_retry", String(retryCount));
      image.src = retryUrl.href;
      monitorAttempt();
    }, delay);
  };
  image.addEventListener("load", markSuccess);
  image.addEventListener("error", retryImage);
  if (image.complete && image.naturalWidth) markSuccess();
  else if (image.complete) retryImage();
  else if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      monitorAttempt();
    }, { rootMargin: "800px" });
    observer.observe(image);
  } else {
    monitorAttempt();
  }
}

const storyFilters = [...document.querySelectorAll("[data-story-filter]")];
const storyCards = [...document.querySelectorAll("[data-story-card]")];
const radarGroups = [...document.querySelectorAll("[data-radar-group]")];

for (const button of storyFilters) {
  button.addEventListener("click", () => {
    const filter = button.dataset.storyFilter;
    for (const candidate of storyFilters) candidate.setAttribute("aria-pressed", String(candidate === button));
    for (const card of storyCards) card.hidden = filter !== "all" && card.dataset.storyCategory !== filter;
    for (const group of radarGroups) group.hidden = ![...group.querySelectorAll("[data-story-card]")].some((card) => !card.hidden);
  });
}

const filters = [...document.querySelectorAll("[data-filter]")];
const archiveItems = [...document.querySelectorAll(".archive-index li[data-kind]")];

for (const button of filters) {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    for (const candidate of filters) candidate.setAttribute("aria-pressed", String(candidate === button));
    for (const item of archiveItems) {
      item.classList.toggle("is-hidden", filter !== "all" && item.dataset.kind !== filter);
    }
  });
}

for (const frame of document.querySelectorAll("iframe[data-historical-frame]")) {
  const resize = () => {
    try {
      const documentHeight = frame.contentDocument?.documentElement?.scrollHeight;
      if (documentHeight) frame.style.height = `${Math.max(documentHeight, 720)}px`;
    } catch {
      // Cross-origin frames keep their CSS fallback height.
    }
  };
  frame.addEventListener("load", resize);
  window.addEventListener("resize", resize, { passive: true });
}

const issueBody = document.querySelector("body[data-issue]");
const issueStories = issueBody ? [...document.querySelectorAll(".issue-story")] : [];
const issueHeadings = issueBody ? [...document.querySelectorAll(".issue-story h2[id]")] : [];
const issueNavLinks = issueBody ? [...document.querySelectorAll(".issue-nav a[href^='#']")] : [];
const storyReader = document.querySelector("body[data-story-reader]");
const storyOpening = storyReader?.querySelector("[data-story-opening]");
const storyLedeStage = storyReader?.querySelector(".story-lede-stage");
const storyLede = storyReader?.querySelector("[data-word-reveal]");
const storyMediaStage = storyReader?.querySelector("[data-media-stage]");
let storyWords = [];
let motionFrame = 0;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

if (storyLede) {
  const source = storyLede.textContent.trim();
  const segments = "Segmenter" in Intl
    ? [...new Intl.Segmenter("zh-CN", { granularity: "word" }).segment(source)].map((part) => part.segment)
    : [...source];
  storyLede.replaceChildren(...segments.map((segment) => {
    const word = document.createElement("span");
    word.className = "story-word";
    word.textContent = segment;
    return word;
  }));
  storyWords = [...storyLede.querySelectorAll(".story-word")];
  storyReader.dataset.motionReady = "true";
}

function updateMotion() {
  motionFrame = 0;
  const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, window.scrollY / maximum));
  document.documentElement.style.setProperty("--reading-progress", String(progress));
  document.documentElement.style.setProperty("--shell-progress", String(Math.min(1, window.scrollY / 320)));

  if (storyReader && !reducedMotion.matches) {
    if (storyOpening) {
      const rect = storyOpening.getBoundingClientRect();
      const openingProgress = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight));
      document.documentElement.style.setProperty("--opening-progress", String(openingProgress));
    }
    if (storyLedeStage && storyWords.length) {
      const rect = storyLedeStage.getBoundingClientRect();
      const wordProgress = clamp((window.innerHeight * 0.8 - rect.top) / Math.max(1, rect.height * 0.68));
      const visible = wordProgress * (storyWords.length + 5);
      storyWords.forEach((word, index) => word.style.setProperty("--word-visible", String(clamp(visible - index))));
    }
    if (storyMediaStage) {
      const rect = storyMediaStage.getBoundingClientRect();
      const mediaProgress = clamp((window.innerHeight * 0.82 - rect.top) / Math.max(1, rect.height * 0.58));
      document.documentElement.style.setProperty("--media-progress", String(mediaProgress));
    }
  }

  if (!issueBody || reducedMotion.matches) return;
  const center = window.innerHeight * 0.58;
  for (const story of issueStories) {
    const rect = story.getBoundingClientRect();
    const rawShift = (rect.top - center) * 0.025;
    const shift = Math.max(-28, Math.min(28, rawShift));
    const distance = Math.min(1, Math.abs(rect.top - center) / window.innerHeight);
    story.style.setProperty("--story-shift", `${Math.round(shift)}px`);
    story.style.setProperty("--story-opacity", String(1 - distance * 0.22));
  }
}

if (storyReader && document.startViewTransition) {
  for (const link of storyReader.querySelectorAll("a.next-story, a.related-card, .story-sibling-nav a")) {
    link.addEventListener("click", (event) => {
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      document.startViewTransition(() => { window.location.href = destination.href; });
    });
  }
}

function scheduleMotion() {
  if (!motionFrame) motionFrame = window.requestAnimationFrame(updateMotion);
}

window.addEventListener("scroll", scheduleMotion, { passive: true });
window.addEventListener("resize", scheduleMotion, { passive: true });
updateMotion();

if (issueHeadings.length && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
    if (!visible) return;
    for (const link of issueNavLinks) {
      if (link.getAttribute("href") === `#${visible.target.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }, { rootMargin: "-18% 0px -66%", threshold: [0, 0.25, 0.75] });
  for (const heading of issueHeadings) observer.observe(heading);
}

const homeHero = document.querySelector(".home-hero");
if (homeHero && !reducedMotion.matches) {
  homeHero.addEventListener("pointermove", (event) => {
    const bounds = homeHero.getBoundingClientRect();
    homeHero.style.setProperty("--hero-x", String((event.clientX - bounds.left) / bounds.width - 0.5));
    homeHero.style.setProperty("--hero-y", String((event.clientY - bounds.top) / bounds.height - 0.5));
  }, { passive: true });
  homeHero.addEventListener("pointerleave", () => {
    homeHero.style.setProperty("--hero-x", "0");
    homeHero.style.setProperty("--hero-y", "0");
  }, { passive: true });
}
