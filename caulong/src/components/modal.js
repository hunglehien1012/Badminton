// ─── MODAL HELPERS ────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.error(`openModal: no element with id "${id}"`);
    return;
  }
  el.classList.add("open");
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("open");
}
// Close on backdrop click
document.querySelectorAll(".modal-backdrop").forEach((b) => {
  b.addEventListener("click", (e) => {
    if (e.target === b) b.classList.remove("open");
  });
});

