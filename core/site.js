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
