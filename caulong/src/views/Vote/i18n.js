// ─── VOTER PAGE: EN/VI LANGUAGE TOGGLE (default English) ──────────
// Only the public voter-facing page (?poll=...) is translated — the admin
// panel (Sessions/Members/Export/Vote tabs) stays as-is since it's only
// ever seen by the club admin.
let voterLang = ls("hl_voter_lang") || "en";
function setVoterLang(lang) {
  voterLang = lang === "vi" ? "vi" : "en";
  ss("hl_voter_lang", voterLang);
  renderVoterView();
}
function toggleVoterLang() {
  setVoterLang(voterLang === "en" ? "vi" : "en");
}
function weekdayName(dayIndex) {
  return (voterLang === "vi" ? VN_WEEKDAYS_FULL : EN_WEEKDAYS_FULL)[dayIndex];
}
const VOTER_STRINGS = {
  voteCreatedTitle: { en: "Vote created 🎉", vi: "Đã tạo vote 🎉" },
  voteCreatedDesc: {
    en: "Go to Manage vote to add costs. You can also open Manage vote later from My hosted votes.",
    vi: "Vào phần manage vote để thêm chi phí. Bạn cũng có thể vào phần My hosted vote để xem manage vote.",
  },
  votingLinkLabel: { en: "🔗 Voting link", vi: "🔗 Link vote" },
  manageLinkLabel: { en: "🔑 Manage link", vi: "🔑 Link quản lý" },
  copyBtn: { en: "Copy", vi: "Sao chép" },
  copied: { en: "Copied", vi: "Đã sao chép" },
  manageLinkCopied: {
    en: "Manage link copied",
    vi: "Đã sao chép link quản lý",
  },
  viewVotePage: { en: "View vote page", vi: "Xem trang vote" },
  tabInfo: { en: "Details", vi: "Chi tiết" },
  tabVote: { en: "Vote", vi: "Vote" },
  tabParticipants: { en: "Participants", vi: "Người tham gia" },
  tabPayment: { en: "Payment", vi: "Thanh toán" },
  viewLocation: { en: "View location", vi: "Xem vị trí" },
  showMap: { en: "Show map", vi: "Hiển thị bản đồ" },
  noAddress: { en: "No address yet.", vi: "Chưa có địa chỉ." },
  organizer: { en: "Organizer", vi: "Người tổ chức" },
  totalVoters: { en: "Total voters", vi: "Tổng số người vote" },
  totalVotersSub: {
    en: "People who voted at least once",
    vi: "Người đã bình chọn ít nhất một lần",
  },
  noVotesYet: {
    en: "No one has voted yet.",
    vi: "Chưa có ai tham gia bình chọn.",
  },
  paymentPending: {
    en: "{name} will update payment info once the session is created.",
    vi: "{name} sẽ cập nhật thông tin thanh toán khi buổi được tạo.",
  },
  collected: { en: "Collected", vi: "Đã thu" },
  progress: { en: "Progress", vi: "Tiến độ" },
  costs: { en: "Costs", vi: "Chi phí" },
  noCosts: { en: "No costs yet.", vi: "Chưa có khoản chi." },
  members: { en: "Members", vi: "Thành viên" },
  noMembers: { en: "No members yet.", vi: "Chưa có thành viên." },
  costItem: { en: "Cost item", vi: "Khoản chi" },
  perPerson: { en: "/person", vi: "/người" },
  unassigned: { en: "Unassigned", vi: "Chưa gán" },
  absent: { en: "Absent", vi: "Vắng mặt" },
  paidStatus: { en: "Paid", vi: "Đã thanh toán" },
  owes: { en: "Owes", vi: "Còn nợ" },
  paidBadge: { en: "✓ Paid", vi: "✓ Đã trả" },
  notPaidBadge: { en: "Not paid", vi: "Chưa trả" },
  totalCostLabel: { en: "total", vi: "tổng cộng" },
  perPersonCostLabel: { en: "per player", vi: "cho mỗi người chơi" },
  perNoShowCostLabel: { en: "per no-show", vi: "cho mỗi người vắng mặt" },
  goToPayment: { en: "Payment", vi: "Thanh toán" },
};
function t(key) {
  const entry = VOTER_STRINGS[key];
  if (!entry) return key;
  return entry[voterLang] || entry.en;
}

function mapsLink(address) {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(address)
  );
}

// Line-style icons (used in the "Chi tiết" info rows) matching the reference design.
const ICON_CALENDAR = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="8" y1="3" x2="8" y2="7"></line><line x1="16" y1="3" x2="16" y2="7"></line><polyline points="8 13 11 16 16 10"></polyline></svg>`;
const ICON_PIN = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
const ICON_TAG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41L11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82z"></path><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"></circle></svg>`;

// Prefer an explicitly-pasted Google Maps link; fall back to an
// auto-generated search link built from the address text.
function resolveMapsUrl(entity) {
  if (entity.mapsUrl) return entity.mapsUrl;
  if (entity.address) return mapsLink(entity.address);
  return null;
}

function switchDetailTab(tab) {
  document
    .querySelectorAll("#md-tabs .md-tab")
    .forEach((b) => b.classList.toggle("active", b.dataset.mdtab === tab));
  document
    .querySelectorAll(".md-panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById("md-panel-" + tab).classList.add("active");
}

function renderDetailInfoTab(s) {
  const d = new Date(s.date + "T00:00:00");
  const weekdayDate = `${VN_WEEKDAYS_FULL[d.getDay()]}, ${fmtDate(s.date)}`;

  let html = `<div class="info-row">
      <div class="info-ico">${ICON_CALENDAR}</div>
      <div class="info-main">
        <div class="info-title">${weekdayDate}</div>
        ${s.note ? `<div class="info-sub">${esc(s.note)}</div>` : ""}
      </div>
    </div>`;

  if (s.address || s.mapsUrl) {
    const url = resolveMapsUrl(s);
    html += `<div class="info-row">
      <div class="info-ico">${ICON_PIN}</div>
      <div class="info-main">
        <div class="info-title">${esc(s.address || "Xem vị trí")}</div>
        ${url ? `<a class="info-link" href="${url}" target="_blank" rel="noopener">Hiển thị bản đồ</a>` : ""}
      </div>
    </div>`;
  } else {
    html += `<div class="info-row">
      <div class="info-ico">${ICON_PIN}</div>
      <div class="info-main">
        <div class="info-sub">Chưa có địa chỉ. Bấm "Edit" để thêm.</div>
      </div>
    </div>`;
  }

  // Cost summary: total + per-person, with a link into the Payment tab.
  const activeMembers = s.members.filter((m) => calcMemberAmount(s, m.id) > 0);
  const totalAmt = activeMembers.reduce(
    (sum, m) => sum + calcMemberAmount(s, m.id),
    0,
  );
  // Divide by the weighted headcount (includes "+N" guests folded into a
  // member's own weight) — the same denominator calcMemberAmount uses to
  // split each cost line, so this stays consistent with the Payment tab.
  const perPersonCount = activeMembers.reduce(
    (sum, m) => sum + memberWeight(s, m.id),
    0,
  );
  const perPersonAmt = perPersonCount > 0 ? totalAmt / perPersonCount : 0;

  html += `<div class="info-row">
      <div class="info-ico">${ICON_TAG}</div>
      <div class="info-main">
        <div class="info-title">${fmt(totalAmt)} tổng cộng</div>
        <div class="info-title">${fmt(perPersonAmt)} cho mỗi người chơi</div>
        <a class="info-link" onclick="switchDetailTab('vote')">Thanh toán</a>
      </div>
    </div>`;

  return html;
}

function renderDetailVoteTab(s, sid) {
  // Only count members who have amt > 0 (i.e. are in at least one cost item)
  const activeMembers = s.members.filter((m) => calcMemberAmount(s, m.id) > 0);
  const totalAmt = s.costs.reduce((sum, c) => sum + (c.amount || 0), 0);
  const paidAmt = activeMembers
    .filter((m) => m.paid)
    .reduce((sum, m) => sum + calcMemberAmount(s, m.id), 0);
  const pct =
    activeMembers.length > 0
      ? Math.round(
          (activeMembers.filter((m) => m.paid).length / activeMembers.length) *
            100,
        )
      : 0;

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-size:11px;color:var(--muted)">📅 ${fmtDate(s.date)}</div>
        <div style="font-size:20px;font-weight:700;letter-spacing:-.02em;margin-top:2px">${fmt(totalAmt)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--muted)">Collected</div>
        <div style="font-size:16px;font-weight:600;color:var(--green)">${fmt(paidAmt)}</div>
      </div>
    </div>
    <div class="prog-label"><span>Progress</span><span>${pct}%</span></div>
    <div class="prog-wrap"><div class="prog-bar" style="width:${pct}%"></div></div>
    <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Costs</div>`;

  s.costs.forEach((c) => {
    const names = c.memberIds.map((id) => {
      const m = s.members.find((m) => m.id === id) || { name: id };
      return m.name;
    });
    const perPerson =
      c.memberIds.length > 0 ? c.amount / c.memberIds.length : 0;
    html += `<div class="cost-line">
      <span class="cost-line-emoji">${c.emoji || "🗒️"}</span>
      <div style="flex:1"><div class="cost-line-name">${esc(c.name || "Khoản chi")}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${names.length > 0 ? names.map(esc).join(", ") : "Unassigned"} · ${fmt(perPerson)}/person</div>
      </div>
      <div class="cost-amount">${fmt(c.amount)}</div>
    </div>`;
  });

  html += `<div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">Members</div>`;
  const unpaid = activeMembers.filter((m) => !m.paid);
  const paid = activeMembers.filter((m) => m.paid);
  if (unpaid.length > 0) {
    html += `<div class="sec-label" style="justify-content:space-between">
      <span>⏳ Unpaid <span class="count-bubble">${unpaid.length}</span></span>
      <button class="btn btn-green btn-xs" onclick="markAllPaid('${sid}')">✓ Mark All Paid</button>
    </div>`;
    unpaid.forEach((m) => {
      const amt = calcMemberAmount(s, m.id);
      html += `<div class="player-item" style="margin-bottom:6px">
        <div class="avatar">${initials(m.name)}</div>
        <div style="flex:1"><div class="pi-name">${esc(m.name)}${guestSuffix(m)}</div><div class="pi-detail">Owes ${fmt(amt)}</div></div>
        <div class="pi-actions">
          <button class="btn-pay-toggle" onclick="togglePaid('${sid}','${m.id}')">✓ Paid</button>
        </div>
      </div>`;
    });
  }
  if (paid.length > 0) {
    html += `<div class="sec-label" style="margin-top:10px">✅ Paid <span class="count-bubble cb-green">${paid.length}</span></div>`;
    paid.forEach((m) => {
      const amt = calcMemberAmount(s, m.id);
      html += `<div class="player-item paid-item" style="margin-bottom:6px">
        <div class="avatar av-paid">${initials(m.name)}</div>
        <div style="flex:1"><div class="pi-name">${esc(m.name)}${guestSuffix(m)}</div><div class="pi-detail paid-detail">Paid ${fmt(amt)}</div></div>
        <div class="pi-actions">
          <span class="badge-paid-sm">Paid</span>
          <button class="btn-undo-pay" onclick="togglePaid('${sid}','${m.id}')">Undo</button>
        </div>
      </div>`;
    });
  }

  return html;
}

// Small "+N" label shown right next to a member's name wherever a guest they
// brought is folded into their own cost share instead of a separate member.
function guestSuffix(m) {
  const n = m && m.guestCount ? m.guestCount : 0;
  if (!n) return "";
  return ` <span class="badge-pill badge-blue" style="font-size:9px;margin-left:4px;vertical-align:middle">+${n}</span>`;
}

function openDetail(sid) {
  const s = sessions.find((x) => x.id === sid);
  if (!s) return;
  document.getElementById("md-title").textContent = s.note || fmtDate(s.date);
  document.getElementById("md-edit-btn").onclick = () => openEditSession(sid);
  document.getElementById("md-del-btn").onclick = () => deleteSession(sid);
  document.getElementById("md-copy-text-btn").onclick = () =>
    copySessionText(sid);

  document.getElementById("md-panel-vote").innerHTML = renderDetailVoteTab(
    s,
    sid,
  );

  openModal("modal-detail");
}

function togglePaid(sid, mid) {
  const s = sessions.find((x) => x.id === sid);
  if (!s) return;
  const m = s.members.find((x) => x.id === mid);
  if (!m) return;
  m.paid = !m.paid;
  ss("hl_sessions", sessions);
  syncSessionCostToPoll(s);
  openDetail(sid);
  renderSessions();
  showToast(m.paid ? m.name + " paid" : m.name + " payment undone");
}

function markAllPaid(sid) {
  const s = sessions.find((x) => x.id === sid);
  if (!s) return;
  const activeIds = s.members
    .filter((m) => calcMemberAmount(s, m.id) > 0)
    .map((m) => m.id);
  s.members.forEach((m) => {
    if (activeIds.includes(m.id)) m.paid = true;
  });
  ss("hl_sessions", sessions);
  syncSessionCostToPoll(s);
  openDetail(sid);
  renderSessions();
  showToast("All marked as paid");
}

async function deleteSession(sid) {
  const s = sessions.find((x) => x.id === sid);
  if (
    !(await showConfirm({
      title: "Delete session",
      message: `Delete session "${s.note || fmtDate(s.date)}"?`,
    }))
  )
    return;
  if (s.pollId) clearPollSessionCost(s.pollId);
  sessions = sessions.filter((x) => x.id !== sid);
  ss("hl_sessions", sessions);
  closeModal("modal-detail");
  renderSessions();
  showToast("Session deleted");
}

