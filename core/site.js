document.documentElement.classList.add("has-js");

const visualThemes = ["field", "coral", "analog"];
const themeStorageKey = "ctd-theme";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function rememberTheme(theme) {
  try {
    window.sessionStorage.setItem(themeStorageKey, theme);
  } catch {
    // The selected theme still applies to the current page when storage is unavailable.
  }
}

function updateThemeLinks(theme) {
  for (const link of document.querySelectorAll("a[data-theme-link]")) {
    const url = new URL(link.href, window.location.href);
    url.searchParams.set("theme", theme);
    link.href = `${url.pathname}${url.search}${url.hash}`;
  }
}

function updateThemeControls(theme) {
  for (const button of document.querySelectorAll("[data-theme-choice]")) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
  }
  const status = document.querySelector("[data-theme-status]");
  if (status) status.textContent = theme === "field" ? "FIELD GREEN" : theme === "coral" ? "CORAL SIGNAL" : "2000s TV";
}

function applyTheme(theme) {
  const safeTheme = visualThemes.includes(theme) ? theme : "field";
  document.documentElement.dataset.visualTheme = safeTheme;
  rememberTheme(safeTheme);
  updateThemeControls(safeTheme);
  updateThemeLinks(safeTheme);
}

applyTheme(document.documentElement.dataset.visualTheme);

for (const button of document.querySelectorAll("[data-theme-choice]")) {
  button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
}

const storyFilters = [...document.querySelectorAll("[data-story-filter]")];
const storyCards = [...document.querySelectorAll("[data-story-card]")];

for (const button of storyFilters) {
  button.addEventListener("click", () => {
    const filter = button.dataset.storyFilter;
    for (const candidate of storyFilters) candidate.setAttribute("aria-pressed", String(candidate === button));
    for (const card of storyCards) card.hidden = filter !== "all" && card.dataset.storyCategory !== filter;
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
let motionFrame = 0;

function updateMotion() {
  motionFrame = 0;
  const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, window.scrollY / maximum));
  document.documentElement.style.setProperty("--reading-progress", String(progress));
  document.documentElement.style.setProperty("--shell-progress", String(Math.min(1, window.scrollY / 320)));

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
