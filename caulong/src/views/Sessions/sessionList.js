// ─── SESSIONS TAB ─────────────────────────────────────────────────
function renderSessions() {
  // Global stats
  let collected = 0,
    totalCosts = 0;
  sessions.forEach((s) => {
    totalCosts += s.costs.reduce((sum, c) => sum + (c.amount || 0), 0);
    s.members.forEach((m) => {
      if (m.paid) collected += calcMemberAmount(s, m.id);
    });
  });
  const pending = totalCosts - collected;
  document.getElementById("s-total-sessions").textContent = sessions.length;
  document.getElementById("s-collected").textContent = fmtK(collected);
  document.getElementById("s-pending").textContent = fmtK(pending);

  const list = document.getElementById("session-list");
  if (sessions.length === 0) {
    list.innerHTML =
      '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">No sessions yet.<br>Click "+ New Session" to get started.</div></div>';
    return;
  }
  // Sort newest first
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  // Group by month key "YYYY-MM"
  const groups = {};
  sorted.forEach((s) => {
    const key = s.date.slice(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  let html = "";
  const monthKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  const now = new Date();
  const thisMonthKey =
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");

  monthKeys.forEach((key) => {
    const [yr, mo] = key.split("-");
    const monthLabel = "Month " + parseInt(mo) + " / " + yr;
    const isCurrentMonth = key === thisMonthKey;
    const groupSessions = groups[key];

    // Month-level stats (only members with amt > 0)
    let mTotal = 0,
      mPaid = 0,
      mBuoi = groupSessions.length;
    groupSessions.forEach((s) => {
      mTotal += s.costs.reduce((sum, c) => sum + (c.amount || 0), 0);
      s.members.forEach((m) => {
        const amt = calcMemberAmount(s, m.id);
        if (amt <= 0) return;
        if (m.paid) mPaid += amt;
      });
    });
    const mPending = mTotal - mPaid;
    const allDone = mPending === 0 && mTotal > 0;

    // Collapsed by default except current month — but respect the user's own expand/collapse choice if they already set one
    if (!(key in monthCollapseState)) monthCollapseState[key] = !isCurrentMonth;
    const collapsed = monthCollapseState[key];

    html += `<div class="month-group" id="mg-${key}">
      <div class="month-header" onclick="toggleMonth('${key}')">
        <div class="month-header-left">
          <span class="month-chevron ${collapsed ? "" : "open"}" id="mc-${key}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></span>
          <div>
            <div class="month-title">${monthLabel} ${isCurrentMonth ? '<span class="badge-pill badge-amber" style="font-size:10px;vertical-align:middle">This Month</span>' : ""}</div>
            <div class="month-sub">${mBuoi} sessions · ${allDone ? '<span style="color:var(--green)">Fully Collected</span>' : "Outstanding <strong>" + fmt(mPending) + "</strong>"}</div>
          </div>
        </div>
        <div class="month-stat">
          <div style="font-size:14px;font-weight:700">${fmt(mTotal)}</div>
          <div style="font-size:10px;color:var(--muted)">Collected: ${fmt(mPaid)}</div>
        </div>
      </div>
      <div class="month-body ${collapsed ? "collapsed" : ""}" id="mb-${key}">`;

    groupSessions.forEach((s) => {
      const activeM = s.members.filter((m) => calcMemberAmount(s, m.id) > 0);
      const paidCount = activeM.filter((m) => m.paid).length;
      const total = activeM.length;
      const totalAmt = s.costs.reduce((sum, c) => sum + (c.amount || 0), 0);
      const paidAmt = activeM
        .filter((m) => m.paid)
        .reduce((sum, m) => sum + calcMemberAmount(s, m.id), 0);
      const d = new Date(s.date + "T00:00:00");
      const mon = d.toLocaleDateString("en-GB", { month: "short" });
      let badge = "";
      if (paidCount === total && total > 0)
        badge = '<span class="badge-pill badge-green">Done</span>';
      else if (paidCount === 0)
        badge = '<span class="badge-pill badge-coral">Unpaid</span>';
      else
        badge =
          '<span class="badge-pill badge-amber">' +
          paidCount +
          "/" +
          total +
          " paid</span>";
      const costs_summary = s.costs.map((c) => esc(c.name)).join(" · ");
      html += `<div class="session-item" onclick="openDetail('${s.id}')">
        <div class="session-date-badge">
          <div class="day">${d.getDate()}</div>
          <div class="mon">${mon}</div>
        </div>
        <div class="session-meta">
          <div class="session-name">${s.note ? esc(s.note) : fmtDate(s.date)}</div>
          <div class="session-info">${total} people · ${costs_summary || "No costs"}</div>
          <div style="margin-top:4px">${badge}</div>
        </div>
        <div class="session-total">${fmt(totalAmt)}<small>Collected: ${fmt(paidAmt)}</small></div>
      </div>`;
    });

    html += `</div></div>`;
  });

  list.innerHTML = html;
}

function toggleMonth(key) {
  const body = document.getElementById("mb-" + key);
  const chev = document.getElementById("mc-" + key);
  body.classList.toggle("collapsed");
  chev.classList.toggle("open");
  monthCollapseState[key] = body.classList.contains("collapsed");
  ss("hl_month_collapse", monthCollapseState);
}

