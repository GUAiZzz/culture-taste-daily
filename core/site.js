document.documentElement.classList.add("has-js");

const visualThemes = ["field", "coral", "analog"];
const themeStorageKey = "ctd-theme";
const themeManualKey = "ctd-theme-manual";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileViewport = window.matchMedia("(max-width: 50rem)");
const lifecycle = new AbortController();
const observers = new Set();
const cleanupTasks = new Set();

function revealControl(control) {
  control.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "nearest", inline: "center" });
}

function enableRailKeyboard(container, selector) {
  const controls = [...container.querySelectorAll(selector)];
  if (!controls.length) return;
  const syncTabStops = () => {
    const selected = controls.find((control) => control.getAttribute("aria-pressed") === "true") ?? controls[0];
    for (const control of controls) control.tabIndex = control === selected ? 0 : -1;
  };
  syncTabStops();
  container.addEventListener("keydown", (event) => {
    const current = controls.indexOf(document.activeElement);
    if (current < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? controls.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + controls.length) % controls.length;
    const next = controls[nextIndex];
    next.focus();
    next.click();
    syncTabStops();
    revealControl(next);
  }, { signal: lifecycle.signal });
  container.addEventListener("click", (event) => {
    const control = event.target.closest(selector);
    if (!control || !container.contains(control)) return;
    syncTabStops();
    revealControl(control);
  }, { signal: lifecycle.signal });
}

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
  button.addEventListener("click", () => applyTheme(button.dataset.themeChoice, { manual: true }), { signal: lifecycle.signal });
}

for (const group of document.querySelectorAll(".theme-dots")) enableRailKeyboard(group, "[data-theme-choice]");

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
  image.addEventListener("load", markSuccess, { signal: lifecycle.signal });
  image.addEventListener("error", retryImage, { signal: lifecycle.signal });
  if (image.complete && image.naturalWidth) markSuccess();
  else if (image.complete) retryImage();
  else if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      observers.delete(observer);
      monitorAttempt();
    }, { rootMargin: "800px" });
    observers.add(observer);
    observer.observe(image);
  } else {
    monitorAttempt();
  }
  cleanupTasks.add(() => {
    window.clearTimeout(deadlineTimer);
    window.clearTimeout(retryTimer);
  });
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
  }, { signal: lifecycle.signal });
}

for (const group of new Set(storyFilters.map((button) => button.parentElement).filter(Boolean))) {
  enableRailKeyboard(group, "[data-story-filter]");
}

const weekDossiers = [...document.querySelectorAll("[data-week-dossier]")];

function setWeekExpanded(dossier, expanded) {
  const button = dossier.querySelector("[data-week-toggle]");
  const panel = dossier.querySelector("[data-week-panel]");
  if (!button || !panel) return;
  button.setAttribute("aria-expanded", String(expanded));
  panel.hidden = !expanded;
  const mark = button.querySelector(".week-toggle-mark");
  if (mark) mark.textContent = expanded ? "−" : "＋";
}

function openWeekFromHash({ scroll = false } = {}) {
  const target = weekDossiers.find((dossier) => `#${dossier.id}` === window.location.hash);
  for (const dossier of weekDossiers) setWeekExpanded(dossier, dossier === target);
  if (target && scroll) {
    window.requestAnimationFrame(() => target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" }));
  }
}

if (weekDossiers.length) {
  openWeekFromHash();
  for (const dossier of weekDossiers) {
    const button = dossier.querySelector("[data-week-toggle]");
    button?.addEventListener("click", () => {
      const wasExpanded = button.getAttribute("aria-expanded") === "true";
      for (const candidate of weekDossiers) setWeekExpanded(candidate, false);
      if (!wasExpanded) {
        setWeekExpanded(dossier, true);
        window.history.replaceState(null, "", `#${dossier.id}`);
      } else if (window.location.hash === `#${dossier.id}`) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
    }, { signal: lifecycle.signal });
  }
  window.addEventListener("hashchange", () => openWeekFromHash({ scroll: true }), { signal: lifecycle.signal });
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
  frame.addEventListener("load", resize, { signal: lifecycle.signal });
  window.addEventListener("resize", resize, { passive: true, signal: lifecycle.signal });
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
  if (document.hidden) return;
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
  const shiftLimit = mobileViewport.matches ? 12 : 24;
  for (const story of issueStories) {
    const rect = story.getBoundingClientRect();
    const rawShift = (rect.top - center) * 0.025;
    const shift = Math.max(-shiftLimit, Math.min(shiftLimit, rawShift));
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
    }, { signal: lifecycle.signal });
  }
}

function scheduleMotion() {
  if (!motionFrame) motionFrame = window.requestAnimationFrame(updateMotion);
}

window.addEventListener("scroll", scheduleMotion, { passive: true, signal: lifecycle.signal });
window.addEventListener("resize", scheduleMotion, { passive: true, signal: lifecycle.signal });
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
  observers.add(observer);
  for (const heading of issueHeadings) observer.observe(heading);
}

const homeHero = document.querySelector(".home-hero");
if (homeHero && !reducedMotion.matches) {
  homeHero.addEventListener("pointermove", (event) => {
    const bounds = homeHero.getBoundingClientRect();
    homeHero.style.setProperty("--hero-x", String((event.clientX - bounds.left) / bounds.width - 0.5));
    homeHero.style.setProperty("--hero-y", String((event.clientY - bounds.top) / bounds.height - 0.5));
  }, { passive: true, signal: lifecycle.signal });
  homeHero.addEventListener("pointerleave", () => {
    homeHero.style.setProperty("--hero-x", "0");
    homeHero.style.setProperty("--hero-y", "0");
  }, { passive: true, signal: lifecycle.signal });
}

function syncDocumentVisibility() {
  document.documentElement.dataset.motionPaused = String(document.hidden);
  if (document.hidden && motionFrame) {
    window.cancelAnimationFrame(motionFrame);
    motionFrame = 0;
  } else if (!document.hidden) {
    scheduleMotion();
  }
}

function cleanupLifecycle() {
  lifecycle.abort();
  if (motionFrame) window.cancelAnimationFrame(motionFrame);
  for (const observer of observers) observer.disconnect();
  for (const cleanup of cleanupTasks) cleanup();
  observers.clear();
  cleanupTasks.clear();
}

document.addEventListener("visibilitychange", syncDocumentVisibility, { signal: lifecycle.signal });
window.addEventListener("pagehide", cleanupLifecycle, { once: true });
syncDocumentVisibility();
