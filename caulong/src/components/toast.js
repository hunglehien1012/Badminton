// ─── TOAST ────────────────────────────────────────────────────────
let _tt;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove("show"), 2400);
}
function showAbsentTip(name, extra) {
  const msg = voterLang === "vi"
    ? `${name} vắng mặt nhưng vote dùm cho ${extra} bạn khác`
    : `${name} is absent but voted on behalf of ${extra} other friend${extra > 1 ? "s" : ""}`;
  showToast(msg);
}

