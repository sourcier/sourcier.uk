document.addEventListener("DOMContentLoaded", () => {
  const menuToggles = document.querySelectorAll(".site-nav-toggle");

  menuToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const target = document.getElementById(toggle.dataset.target);
      target.toggleAttribute("data-open");
      toggle.setAttribute(
        "aria-expanded",
        target.hasAttribute("data-open") ? "true" : "false",
      );
    });
  });
});
