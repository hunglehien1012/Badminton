// ─── HELPERS ──────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function fmt(n) {
  return Math.round(n).toLocaleString("en-US") + "₫";
}
function fmtK(n) {
  const v = Math.round(n);
  return v >= 1000 ? v.toLocaleString("en-US") + "₫" : v + "₫";
}
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}
// Auto-add 3 zeros when input loses focus or Enter pressed (for number inputs with class cost-k)
function autoK(el) {
  const v = el.value.trim();
  if (!v) return;
  const n = parseFloat(v);
  if (!isNaN(n) && n < 1000 && n > 0) {
    el.value = Math.round(n * 1000);
    updateCostDisplay(el);
  }
}
function updateCostDisplay(el) {
  const v = parseFloat(el.value) || 0;
  const line = el.closest(".cost-line");
  const d = line && line.querySelector(".cost-display");
  if (d) d.textContent = v > 0 ? fmt(v) : "";
}

