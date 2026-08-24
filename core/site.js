document.documentElement.classList.add("has-js");

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
