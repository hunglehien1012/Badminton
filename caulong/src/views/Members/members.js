// ─── MEMBERS TAB ──────────────────────────────────────────────────
// Persists the local member list AND mirrors it to Firebase (best-effort —
// silently no-ops if Firebase isn't configured/reachable) so that voters on
// other devices can read the real Fixed/Casual roster to validate names
// against (see resolveNameForAction / MEMBERS_ROOT). Any failure (e.g.
// Firebase Rules rejecting the write) is now logged loudly instead of
// swallowed — a silent .catch(()=>{}) here was hiding exactly this kind of
// problem before.
async function saveMembers() {
  ss("hl_members", members);
  if (!fbReady()) return;
  await ensureFirebaseAuth(); // don't race the write against anonymous sign-in still in flight
  const obj = {};
  members.forEach((m) => (obj[m.id] = m));
  try {
    await fdb.ref(MEMBERS_ROOT).set(obj);
    console.log("[name-picker] saveMembers(): pushed", members.length, "member(s) to", MEMBERS_ROOT);
  } catch (err) {
    console.error("[name-picker] saveMembers(): FAILED to write to", MEMBERS_ROOT, "—", err);
    showToast("Couldn't sync members to Firebase — check Firebase Rules (see console)");
  }
}
let _membersSyncStarted = false;
let _adminInitialSyncDone = false; // ensures the admin-device auto-push (see initMembersSync) only runs once per page load
// Keeps `publicMembers` (read by any device, incl. voters with no local
// admin data) live-synced from Firebase, and folds in any member a voter
// requested-to-add from a DIFFERENT device (pending admin approval) into
// this device's local `members` list too, so the admin sees it in the
// Members tab without needing to refresh.
async function initMembersSync() {
  if (_membersSyncStarted || !fbReady()) return;
  _membersSyncStarted = true;
  await ensureFirebaseAuth(); // make sure "auth != null" is already true before we ever touch MEMBERS_ROOT
  fdb.ref(MEMBERS_ROOT).on(
    "value",
    (snap) => {
      const val = snap.val() || {};
      publicMembers = Object.values(val);
      console.log("[name-picker] initMembersSync(): loaded", publicMembers.length, "member(s) from", MEMBERS_ROOT);
      let changed = false;
      publicMembers.forEach((rm) => {
        if (!members.find((m) => m.id === rm.id)) {
          members.push(rm);
          changed = true;
        }
      });
      if (changed) {
        ss("hl_members", members); // local only — don't re-push, avoids a sync loop
        const tab = document.getElementById("tab-members");
        if (tab && tab.classList.contains("active")) renderMembers();
      }
      // One-time-per-load safety net: if this is the ADMIN's device and its
      // local list has members that never made it to Firebase (e.g. they were
      // added before this sync feature existed), push the full merged list up
      // now so voters on other devices can actually see them. Deliberately
      // gated to admin only — a random voter's mostly-empty local `members`
      // array must never overwrite the real list.
      if (ls("hl_admin") && !_adminInitialSyncDone) {
        _adminInitialSyncDone = true;
        saveMembers();
      }
      const picker = document.getElementById("modal-name-picker");
      if (picker && picker.classList.contains("open")) {
        const q = document.getElementById("np-search");
        renderNamePickerList(q ? q.value : "");
      }
    },
    (err) => {
      console.error("[name-picker] initMembersSync(): FAILED to read", MEMBERS_ROOT, "—", err);
    },
  );
}
function addMember() {
  const inp = document.getElementById("new-member-name");
  const type = document.getElementById("new-member-type").value;
  const name = inp.value.trim();
  if (!name) return;
  members.push({ id: uid(), name, type: type || "fixed" });
  saveMembers();
  inp.value = "";
  inp.focus();
  renderMembers();
  showToast("Added " + name);
}
document.getElementById("new-member-name").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addMember();
});

function toggleMemberType(id) {
  const m = members.find((m) => m.id === id);
  if (!m) return;
  const isFixed = m.type !== "casual"; // undefined hoặc 'fixed' đều là cố định
  m.type = isFixed ? "casual" : "fixed";
  saveMembers();
  renderMembers();
  showToast(m.name + " → " + (m.type === "fixed" ? "Fixed" : "Casual"));
}

async function deleteMember(id) {
  const m = members.find((m) => m.id === id);
  if (
    !(await showConfirm({
      title: "Delete member",
      message: `Delete member "${m.name}"? Data in sessions will be kept.`,
    }))
  )
    return;
  members = members.filter((m) => m.id !== id);
  saveMembers();
  renderMembers();
  showToast("Deleted");
}

function renderMembers() {
  const wrap = document.getElementById("member-list-wrap");
  const pending = members.filter((m) => m.pending);
  if (members.length === 0) {
    wrap.innerHTML =
      '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">No members yet.</div></div>';
    return;
  }
  const fixed = members.filter(
    (m) => !m.pending && (m.type === "fixed" || m.type === undefined),
  );
  const casual = members.filter((m) => !m.pending && m.type === "casual");
  let html = "";
  if (pending.length > 0) {
    html += `<div class="sec-label" style="margin-bottom:8px">⏳ Pending approval <span class="count-bubble">${pending.length}</span></div>`;
    html += pending.map((m) => pendingMemberRow(m)).join("");
  }
  if (fixed.length > 0) {
    html += `<div class="sec-label" style="margin-bottom:8px">⭐ Fixed <span class="count-bubble">${fixed.length}</span></div>`;
    html += fixed.map((m) => memberRow(m)).join("");
  }
  if (casual.length > 0) {
    html += `<div class="sec-label" style="margin:12px 0 8px">🚶 Casual <span class="count-bubble">${casual.length}</span></div>`;
    html += casual.map((m) => memberRow(m)).join("");
  }
  wrap.innerHTML = html;
}

function memberRow(m) {
  const isFixed = m.type !== "casual";
  const debt = memberDebt(m.id);
  return `<div class="player-item" style="margin-bottom:7px">
    <div class="avatar" style="${isFixed ? "background:var(--amber-l);color:var(--amber)" : ""}">${initials(m.name)}</div>
    <div style="flex:1">
      <div class="pi-name">${esc(m.name)}
        <span class="badge-pill ${isFixed ? "badge-amber" : "badge-blue"}" style="margin-left:6px;font-size:10px">${isFixed ? "⭐ Fixed" : "🚶 Casual"}</span>
      </div>
      <div class="pi-detail">${memberStats(m.id)}</div>
    </div>
    ${debt > 0 ? `<button class="btn btn-green btn-xs" onclick="markMemberPaidAll('${m.id}')" title="Mark Paid in every unpaid session" style="margin-right:4px;white-space:nowrap">✓ Mark All Paid</button>` : ""}
    <button class="btn btn-ghost btn-xs" onclick="toggleMemberType('${m.id}')" title="Change type" style="margin-right:4px">Change</button>
    <button class="btn-icon" onclick="deleteMember('${m.id}')" title="Delete">×</button>
  </div>`;
}

function pendingMemberRow(m) {
  return `<div class="pending-row">
    <div class="avatar" style="background:var(--amber-l);color:var(--amber)">${initials(m.name)}</div>
    <div style="flex:1">
      <div class="pi-name">${esc(m.name)}</div>
      <div class="pi-detail">Requested by a voter — not yet in Fixed/Casual list</div>
    </div>
    <button class="btn btn-green btn-xs" onclick="approveMember('${m.id}')">✓ Approve</button>
    <button class="btn btn-danger btn-xs" onclick="rejectMember('${m.id}')">✕ Reject</button>
  </div>`;
}
function approveMember(id) {
  const m = members.find((m) => m.id === id);
  if (!m) return;
  delete m.pending;
  if (!m.type) m.type = "casual";
  saveMembers();
  renderMembers();
  showToast(`Approved "${m.name}" as ${m.type === "fixed" ? "Fixed" : "Casual"} member`);
}
async function rejectMember(id) {
  const m = members.find((m) => m.id === id);
  if (!m) return;
  if (
    !(await showConfirm({
      title: "Reject request",
      message: `Reject "${m.name}"'s request to be added as a member? They'll need to pick an existing name (or request again) to vote.`,
    }))
  )
    return;
  members = members.filter((mm) => mm.id !== id);
  saveMembers();
  renderMembers();
  showToast("Rejected");
}

function memberDebt(mid) {
  let total_debt = 0;
  sessions.forEach((s) => {
    const p = s.members.find((m) => m.id === mid);
    if (!p || p.paid) return;
    total_debt += calcMemberAmount(s, mid);
  });
  return total_debt;
}

async function markMemberPaidAll(mid) {
  const m = members.find((x) => x.id === mid);
  if (!m) return;
  const debt = memberDebt(mid);
  if (debt <= 0) {
    showToast(m.name + " has no outstanding sessions");
    return;
  }
  if (
    !(await showConfirm({
      title: "Mark all as paid",
      tone: "info",
      message: `Mark "${m.name}" as Paid in every unpaid session (outstanding ${fmt(debt)})?`,
      yesText: "Yes!",
      noText: "Cancel",
    }))
  )
    return;
  let count = 0;
  sessions.forEach((s) => {
    const sm = s.members.find((x) => x.id === mid);
    if (sm && !sm.paid && calcMemberAmount(s, mid) > 0) {
      sm.paid = true;
      count++;
    }
  });
  ss("hl_sessions", sessions);
  renderMembers();
  renderSessions();
  showToast(
    "✓ " +
      m.name +
      " marked paid in " +
      count +
      " session" +
      (count > 1 ? "s" : ""),
  );
}

function memberStats(mid) {
  let sessions_played = 0,
    total_debt = 0,
    total_paid = 0;
  sessions.forEach((s) => {
    const p = s.members.find((m) => m.id === mid);
    if (!p) return;
    sessions_played++;
    const amt = calcMemberAmount(s, mid);
    if (p.paid) total_paid += amt;
    else total_debt += amt;
  });
  if (sessions_played === 0) return "No sessions played";
  return (
    sessions_played +
    " sessions · Owed: " +
    fmt(total_debt) +
    " · Paid: " +
    fmt(total_paid)
  );
}

