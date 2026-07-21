// ─── TABS ─────────────────────────────────────────────────────────
function switchTab(t) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-tab")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("tab-" + t).classList.add("active");
  const idx = { sessions: 0, members: 1, export: 2, vote: 3 }[t];
  document.querySelectorAll(".nav-tab")[idx].classList.add("active");
  const bar = document.getElementById("export-fixed-bar");
  const sticky = document.getElementById("export-sticky");
  const isExport = t === "export";
  if (bar) bar.style.display = isExport ? "block" : "none";
  if (sticky) sticky.style.display = isExport ? "block" : "none";
  if (t === "sessions") renderSessions();
  if (t === "members") renderMembers();
  if (t === "export") renderExportPage();
  if (t === "vote") renderVotePage();
}

