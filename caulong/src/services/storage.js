// ─── STORAGE ──────────────────────────────────────────────────────
function ls(k) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function ss(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

