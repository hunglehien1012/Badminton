// ─── TAB: CHI TIẾT (date / address / maps) ─────────────────────────
function renderPollInfoTab(p) {
  const d = new Date(p.date + "T00:00:00");
  const weekdayDate = `${weekdayName(d.getDay())}, ${fmtDate(p.date)}`;

  let html = `<div class="info-row">
      <div class="info-ico">${ICON_CALENDAR}</div>
      <div class="info-main">
        <div class="info-title">${esc(weekdayDate)}</div>
        ${p.note ? `<div class="info-sub">${esc(p.note)}</div>` : ""}
      </div>
    </div>`;

  if (p.address || p.mapsUrl) {
    const url = resolveMapsUrl(p);
    html += `<div class="info-row">
      <div class="info-ico">${ICON_PIN}</div>
      <div class="info-main">
        <div class="info-title">${esc(p.address || t("viewLocation"))}</div>
        ${url ? `<a class="info-link" href="${url}" target="_blank" rel="noopener">${t("showMap")}</a>` : ""}
      </div>
    </div>`;
  } else {
    html += `<div class="info-row">
      <div class="info-ico">${ICON_PIN}</div>
      <div class="info-main">
        <div class="info-sub">${t("noAddress")}</div>
      </div>
    </div>`;
  }

  // Cost summary: total + per-person, with a link that jumps to the Payment tab.
  const sc = p.sessionCost || computeSelfServeCost(p);
  if (sc && !sc.needsTieBreak) {
    // If there's at least one no-show, "per player" shows the LOWEST amount
    // among members who aren't no-show (they carry the reduced share of
    // non-court costs) instead of a flat average — closer to what most
    // paying members will actually owe. No no-shows → unchanged average
    // divided by the weighted headcount (includes "+N" guests folded into a
    // voter's own weight), same denominator the Payment tab's Costs section
    // uses — not the number of distinctly-named attendees, which undercounts
    // when guests are involved.
    const nonNoShowAmounts = (sc.members || [])
      .filter((m) => !m.noShow)
      .map((m) => m.amount);
    let perPersonAmt;
    if (
      nonNoShowAmounts.length < (sc.members || []).length &&
      nonNoShowAmounts.length > 0
    ) {
      perPersonAmt = Math.min(...nonNoShowAmounts);
    } else {
      const memberCount =
        typeof sc.splitCount === "number" && sc.splitCount > 0
          ? sc.splitCount
          : (sc.members || []).length;
      perPersonAmt = memberCount > 0 ? sc.total / memberCount : 0;
    }
    // No-show members only ever pay the court-fee share of their own
    // weight — so "per no-show" should be a single (weight=1) person's
    // share of just the court fee. It must NOT be derived from whichever
    // no-show member's own total happens to be lowest: someone who
    // brought several guests (all marked no-show) still carries their
    // full group weight in the court-fee split, so their own total can
    // look larger than "per player" even though they're paying for
    // court only, same as everyone else who's no-show. Using the
    // constant per-weight-unit court rate instead keeps this figure
    // always ≤ per player, as it should be.
    const hasNoShow = (sc.members || []).some((m) => m.noShow);
    let noShowAmt = null;
    if (hasNoShow) {
      const courtFeeTotal = (sc.costs || [])
        .filter((c) => isCourtFeeCost(c.name))
        .reduce((s, c) => s + (c.amount || 0), 0);
      const totalWeight = sc.splitCount || 0;
      noShowAmt =
        totalWeight > 0
          ? Math.ceil(courtFeeTotal / totalWeight / 1000) * 1000
          : 0;
    }
    // Snapshot the data the copy button needs (avoids threading long,
    // unicode-heavy name strings through an inline onclick attribute).
    lastInfoCostSummary = {
      total: sc.total,
      perPerson: perPersonAmt,
      noShowAmt,
      noShowMembers: (sc.members || [])
        .filter((m) => m.noShow)
        .map((m) => ({
          name: m.name,
          extra: m.extra || 0,
          noShowCount: m.noShowCount || 0,
        })),
    };
    html += `<div class="info-row">
      <div class="info-ico">${ICON_TAG}</div>
      <div class="info-main">
        <div class="info-title">${fmt(sc.total)} ${t("totalCostLabel")}</div>
        <div class="info-title">${fmt(perPersonAmt)} ${t("perPersonCostLabel")}</div>
        ${noShowAmt !== null ? `<div class="info-title">${fmt(noShowAmt)} ${t("perNoShowCostLabel")}</div>` : ""}
        <a class="info-link" onclick="switchVvTab('payment')">${t("goToPayment")}</a>
      </div>
      <button class="info-copy-btn" onclick="copyCostSummary(this)" title="Copy"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
    </div>`;
  }

  return html;
}

function renderVoterView() {
  const body = document.getElementById("vv-body");
  if (!voterPoll) {
    body.innerHTML =
      '<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">This vote doesn\'t exist or has been deleted.</div>';
    return;
  }
  const p = voterPoll;
  const open = p.status === "open";
  const myVoteEntry = getMyVoteEntry();
  const committedChoices = voteChoices(myVoteEntry);
  ensurePendingChoices(voterPid, committedChoices);
  const groups = pollVotesByOption(p);
  const title = p.note || "Badminton Session";
  // Scale each option's progress bar against the club's member count at the time
  // the poll was created (falls back to the highest vote count for old polls
  // that predate that snapshot, so the bar chart still makes sense).
  const totalMembers =
    Array.isArray(p.memberNames) && p.memberNames.length
      ? p.memberNames.length
      : Math.max(1, ...groups.map((g) => g.votes.length), 1);
  const summaryRows = groups
    .map((g) => fbOptSummaryRow(g, totalMembers))
    .join("");
  const changeBtnLabel = committedChoices.length ? "Change vote" : "Vote";
  const changeBtn = open
    ? `<button class="vv-vote-btn" onclick="openVoterSelectModal()">${changeBtnLabel}</button>`
    : "";
  const logs = pollLogs(p);
  const logSection = `
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
      <div onclick="toggleVoteLog()" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
        <span style="font-size:13px;font-weight:600">Activity <span style="color:var(--muted);font-weight:400">(${logs.length})</span></span>
        <span style="font-size:11px;color:var(--hint)">${vvLogExpanded ? "Hide ▲" : "Show ▼"}</span>
      </div>
      ${
        vvLogExpanded
          ? `<div style="margin-top:8px">
              <input type="text" placeholder="Search by name…" value="${esc(vvLogSearch)}" oninput="filterVoteLog(this.value)" style="margin-bottom:8px">
              <div id="vv-log-list" onscroll="handleActivityScroll(this)" style="max-height:260px;overflow-y:auto">${renderLogListHtml(logs, vvLogSearch)}</div>
            </div>`
          : ""
      }
    </div>`;

  const tabBar = `
    <div class="vv-tabs">
      <button class="vv-tab ${vvActiveTab === "info" ? "active" : ""}" onclick="switchVvTab('info')">${t("tabInfo")}</button>
      <button class="vv-tab ${vvActiveTab === "details" ? "active" : ""}" onclick="switchVvTab('details')">${t("tabVote")}</button>
      <button class="vv-tab ${vvActiveTab === "participants" ? "active" : ""}" onclick="switchVvTab('participants')">${t("tabParticipants")}</button>
      <button class="vv-tab ${vvActiveTab === "payment" ? "active" : ""}" onclick="switchVvTab('payment')">${t("tabPayment")}</button>
    </div>`;

  let tabContent;
  if (vvActiveTab === "info") {
    tabContent = renderPollInfoTab(p);
  } else if (vvActiveTab === "participants") {
    tabContent = renderParticipantsTab(p, groups);
  } else if (vvActiveTab === "payment") {
    tabContent = renderPaymentTab(p);
  } else {
    tabContent = `${summaryRows}${changeBtn}${logSection}`;
  }

  const langToggle = `
    <div style="display:inline-flex;background:var(--bg);border-radius:20px;padding:2px;gap:2px">
      <button onclick="setVoterLang('en')" style="border:none;font-size:11px;font-weight:${voterLang === "en" ? "700" : "500"};padding:4px 10px;border-radius:16px;cursor:pointer;background:${voterLang === "en" ? "var(--surface)" : "transparent"};color:${voterLang === "en" ? "var(--text)" : "var(--muted)"};box-shadow:${voterLang === "en" ? "var(--shadow)" : "none"}">EN</button>
      <button onclick="setVoterLang('vi')" style="border:none;font-size:11px;font-weight:${voterLang === "vi" ? "700" : "500"};padding:4px 10px;border-radius:16px;cursor:pointer;background:${voterLang === "vi" ? "var(--surface)" : "transparent"};color:${voterLang === "vi" ? "var(--text)" : "var(--muted)"};box-shadow:${voterLang === "vi" ? "var(--shadow)" : "none"}">VI</button>
    </div>`;

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      ${langToggle}
      <span class="badge-pill vv-status-pill ${open ? "badge-green" : "badge-coral"}"><span class="vv-status-dot"></span>${open ? "Open" : "Closed"}</span>
    </div>
    <div style="text-align:center;margin-bottom:26px">
      <div style="font-size:26px;font-weight:800;letter-spacing:-.01em;color:var(--text)">${esc(title)}</div>
      <div style="font-size:18px;color:var(--hint);font-weight:600;margin-top:6px">${esc(fmtDate(p.date))}</div>
    </div>
    ${tabBar}
    ${tabContent}`;
  // Keep the select-options modal in sync too, if it happens to be open
  // (e.g. a realtime update comes in while the member is still picking).
  const modalEl = document.getElementById("modal-voter-select");
  if (modalEl && modalEl.classList.contains("open")) renderVoterSelectModal();
}

