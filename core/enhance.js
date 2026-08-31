(() => {
  const themes = ["field", "coral", "analog"];
  const storageKey = "ctd-theme";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function storedTheme() {
    try {
      return window.sessionStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function rememberTheme(theme) {
    try {
      window.sessionStorage.setItem(storageKey, theme);
    } catch {
      // Theme selection still works for this page when storage is unavailable.
    }
  }

  function requestedTheme() {
    const queryTheme = new URLSearchParams(window.location.search).get("theme");
    return themes.includes(queryTheme) ? queryTheme : null;
  }

  function initialTheme() {
    const requested = requestedTheme();
    const remembered = storedTheme();
    if (requested) return requested;
    if (themes.includes(remembered)) return remembered;
    return themes[Math.floor(Math.random() * themes.length)];
  }

  function updateThemeLinks(theme) {
    document.querySelectorAll("a[data-theme-link]").forEach((link) => {
      const url = new URL(link.href, window.location.href);
      url.searchParams.set("theme", theme);
      link.href = `${url.pathname}${url.search}${url.hash}`;
    });
  }

  function updateThemeControls(theme) {
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      const selected = button.dataset.themeChoice === theme;
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-label", `${button.textContent.trim()}${selected ? "，当前主题" : ""}`);
    });
    const status = document.querySelector("[data-theme-status]");
    if (status) status.textContent = theme === "field" ? "FIELD GREEN" : theme === "coral" ? "CORAL SIGNAL" : "2000s TV";
  }

  function applyTheme(theme, remember = true) {
    document.documentElement.dataset.visualTheme = theme;
    if (remember) rememberTheme(theme);
    updateThemeControls(theme);
    updateThemeLinks(theme);
  }

  const theme = initialTheme();
  applyTheme(theme);
  document.documentElement.classList.add("has-js");

  document.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-theme-choice]");
    if (choice && themes.includes(choice.dataset.themeChoice)) applyTheme(choice.dataset.themeChoice);

    const filter = event.target.closest("[data-index-filter]");
    if (!filter) return;
    const category = filter.dataset.indexFilter;
    document.querySelectorAll("[data-index-filter]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button === filter));
    });
    document.querySelectorAll("[data-index-card]").forEach((card) => {
      card.hidden = category !== "all" && card.dataset.indexCategory !== category;
    });
    filter.scrollIntoView({ block: "nearest", inline: "center", behavior: reducedMotion.matches ? "auto" : "smooth" });
  });

  document.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const control = event.target.closest("[data-theme-choice], [data-index-filter]");
    if (!control) return;
    const selector = control.matches("[data-theme-choice]") ? "[data-theme-choice]" : "[data-index-filter]";
    const controls = [...control.parentElement.querySelectorAll(selector)];
    const current = controls.indexOf(control);
    if (current < 0) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? controls.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + controls.length) % controls.length;
    const next = controls[nextIndex];
    next.focus({ preventScroll: true });
    next.click();
    next.scrollIntoView({ block: "nearest", inline: "center", behavior: reducedMotion.matches ? "auto" : "smooth" });
  });

  const issueBody = document.querySelector("body[data-issue]");
  const headings = issueBody ? [...document.querySelectorAll("article > h2[id]")] : [];
  const navLinks = issueBody ? [...document.querySelectorAll(".issue-nav a[href^='#']")] : [];
  let frame = 0;
  let motionActive = true;
  let listenersAttached = false;
  let sectionObserver = null;

  function updateMotion() {
    frame = 0;
    if (!motionActive || document.hidden) return;
    const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / maximum));
    document.documentElement.style.setProperty("--reading-progress", String(progress));
    document.documentElement.style.setProperty("--shell-progress", String(Math.min(1, window.scrollY / 360)));

    if (!issueBody || reducedMotion.matches) return;
    const viewportCenter = window.innerHeight * 0.56;
    const shiftLimit = window.innerWidth <= 800 ? 12 : 24;
    headings.forEach((heading) => {
      const rect = heading.getBoundingClientRect();
      const distance = Math.min(1, Math.abs(rect.top - viewportCenter) / window.innerHeight);
      const rawShift = Math.round((rect.top - viewportCenter) * 0.025);
      const boundedShift = Math.max(-shiftLimit, Math.min(shiftLimit, rawShift));
      heading.style.setProperty("--section-shift", `${boundedShift}px`);
      heading.style.setProperty("--section-opacity", String(1 - distance * 0.35));
    });
  }

  function scheduleMotion() {
    if (motionActive && !document.hidden && !frame) frame = window.requestAnimationFrame(updateMotion);
  }

  function observeSections() {
    if (!headings.length || !("IntersectionObserver" in window) || sectionObserver) return;
    sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        if (link.getAttribute("href") === `#${visible.target.id}`) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-18% 0px -65%", threshold: [0, 0.2, 0.75] });
    headings.forEach((heading) => sectionObserver.observe(heading));
  }

  function attachMotion() {
    if (!listenersAttached) {
      window.addEventListener("scroll", scheduleMotion, { passive: true });
      window.addEventListener("resize", scheduleMotion, { passive: true });
      listenersAttached = true;
    }
    motionActive = true;
    delete document.documentElement.dataset.motionPaused;
    observeSections();
    scheduleMotion();
  }

  function detachMotion() {
    motionActive = false;
    document.documentElement.dataset.motionPaused = "true";
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (listenersAttached) {
      window.removeEventListener("scroll", scheduleMotion);
      window.removeEventListener("resize", scheduleMotion);
      listenersAttached = false;
    }
    sectionObserver?.disconnect();
    sectionObserver = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) detachMotion();
    else attachMotion();
  });
  window.addEventListener("pagehide", detachMotion);
  window.addEventListener("pageshow", attachMotion);
  reducedMotion.addEventListener?.("change", scheduleMotion);
  attachMotion();
})();
