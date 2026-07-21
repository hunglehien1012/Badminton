// ─── NEW / EDIT SESSION MODAL ──────────────────────────────────────
const COST_PRESETS = [
  { name: "Tiền sân", emoji: "🏟️", amount: 200 },
  { name: "Tiền nước", emoji: "💧", amount: 20 },
  { name: "Tiền cầu", emoji: "🏸", amount: 0 },
];

// Google Maps link starts collapsed behind a "+ Add Google Maps link" toggle
// (matches the redesigned modal) — expanded automatically when editing a
// session that already has one saved.
function setMapsLinkFieldVisible(visible) {
  document.getElementById("ms-maps-toggle").style.display = visible ? "none" : "flex";
  document.getElementById("ms-maps-group").style.display = visible ? "block" : "none";
}
function showMapsLinkField() {
  setMapsLinkFieldVisible(true);
  document.getElementById("ms-maps-link").focus();
}

function openNewSession() {
  editingSessionId = null;
  tempSessionPollLink = null;
  document.getElementById("modal-session-title").textContent = "New Session";
  document.getElementById("ms-save-btn").textContent = "Save Session";
  const today = new Date();
  document.getElementById("ms-date").value = today.toISOString().slice(0, 10);
  document.getElementById("ms-note").value = "Saturday";
  document.getElementById("ms-address").value = "";
  document.getElementById("ms-maps-link").value = "";
  setMapsLinkFieldVisible(false);
  // All members included; fixed always pre-checked in costs
  tempMembers = members.map((m) => ({ ...m, included: true, guestCount: 0, noShowCount: 0 }));
  tempCosts = COST_PRESETS.map((p) => ({
    id: uid(),
    name: p.name,
    emoji: p.emoji,
    amount: p.amount * 1000,
    qty: "",
    memberIds: [],
  }));
  // Default: fixed members auto-selected for all costs; casual NOT pre-selected
  const fixedIds = tempMembers
    .filter((m) => m.type !== "casual")
    .map((m) => m.id);
  tempCosts.forEach((c) => (c.memberIds = [...fixedIds]));
  renderCostLines();
  renderModalMembers();
  openModal("modal-session");
}

function openEditSession(sid) {
  const s = sessions.find((x) => x.id === sid);
  if (!s) return;
  editingSessionId = sid;
  tempSessionPollLink = null;
  document.getElementById("modal-session-title").textContent = "Edit Session";
  document.getElementById("ms-save-btn").textContent = "Update";
  document.getElementById("ms-date").value = s.date;
  document.getElementById("ms-note").value = s.note || "";
  document.getElementById("ms-address").value = s.address || "";
  document.getElementById("ms-maps-link").value = s.mapsUrl || "";
  setMapsLinkFieldVisible(!!s.mapsUrl);
  tempCosts = s.costs.map((c) => ({ ...c, memberIds: [...c.memberIds] }));
  // Merge saved members with global
  const savedIds = s.members.map((m) => m.id);
  const globalIds = members.map((m) => m.id);
  const allIds = new Set([...savedIds, ...globalIds]);
  tempMembers = [];
  allIds.forEach((id) => {
    const gm = members.find((m) => m.id === id);
    const sm = s.members.find((m) => m.id === id);
    const name = gm ? gm.name : sm ? sm.name : "";
    tempMembers.push({
      id,
      name,
      included: savedIds.includes(id),
      guestCount: sm && sm.guestCount ? sm.guestCount : 0,
      noShowCount: sm && sm.noShowCount ? sm.noShowCount : 0,
    });
  });
  renderCostLines();
  renderModalMembers();
  closeModal("modal-detail");
  openModal("modal-session");
}

function addCostLine() {
  tempCosts.push({
    id: uid(),
    name: "",
    emoji: "🗒️",
    amount: 0,
    qty: "",
    memberIds: [],
  });
  renderCostLines();
  // Focus last cost name input
  setTimeout(() => {
    const inputs = document.querySelectorAll(".cost-name-inp");
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function removeCostLine(cid) {
  tempCosts = tempCosts.filter((c) => c.id !== cid);
  renderCostLines();
}

function renderCostLines() {
  const wrap = document.getElementById("cost-lines");
  if (tempCosts.length === 0) {
    wrap.innerHTML =
      '<div style="font-size:12px;color:var(--hint);margin-bottom:8px">No cost items yet.</div>';
    return;
  }
  wrap.innerHTML = tempCosts
    .map((c) => {
      const includedMembers = tempMembers.filter((m) => m.included);
      const allOn =
        includedMembers.length > 0 &&
        includedMembers.every((m) => c.memberIds.includes(m.id));
      const allToggle = `<span class="share-member share-all ${allOn ? "on" : ""}" onclick="toggleAllCostMembers('${c.id}')">All</span>`;
      const toggles = includedMembers
        .map((m) => {
          const on = c.memberIds.includes(m.id);
          return `<span class="share-member ${on ? "on" : ""}" onclick="toggleCostMember('${c.id}','${m.id}')">${esc(m.name)}</span>`;
        })
        .join("");
      const dispVal = c.amount > 0 ? fmt(c.amount) : "";
      const shortVal = c.amount > 0 ? Math.round(c.amount / 1000) : "";
      return `<div class="cost-line" data-cid="${c.id}">
      <div class="cost-line-inputs">
        <input class="cost-name-inp" type="text" placeholder="Cost name…" value="${esc(c.name)}"
          oninput="tempCosts.find(x=>x.id==='${c.id}').name=this.value"
          maxlength="30">
        <input class="cost-qty-inp" type="text" placeholder="qty" title="Optional quantity, e.g. 2 courts, 5 shuttles — shown as (qty) in text export" value="${esc(c.qty || "")}"
          oninput="tempCosts.find(x=>x.id==='${c.id}').qty=this.value"
          maxlength="10">
        <div class="cost-input-wrap">
          <input type="number" class="cost-k" placeholder="0" value="${shortVal}" min="0" step="1"
            onblur="autoK(this);syncCostAmount('${c.id}',this)"
            onkeydown="if(event.key==='Enter'){autoK(this);syncCostAmount('${c.id}',this)}"
            oninput="syncCostAmount('${c.id}',this)">
          <span class="unit">k</span>
        </div>
        <button class="btn-icon cost-del" onclick="removeCostLine('${c.id}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="cost-display">${dispVal}</div>
      <div class="cost-apply-label">Apply to</div>
      <div class="share-toggle">${allToggle}${toggles}</div>
    </div>`;
    })
    .join("");
}

function syncCostAmount(cid, el) {
  const v = parseFloat(el.value) || 0;
  const cost = tempCosts.find((c) => c.id === cid);
  if (cost) {
    // If value looks like already in full VND (>=1000) keep it, else treat as k
    cost.amount = v >= 1000 ? Math.round(v) : Math.round(v * 1000);
    updateCostDisplay(el);
  }
}

function toggleCostMember(cid, mid) {
  const cost = tempCosts.find((c) => c.id === cid);
  if (!cost) return;
  const idx = cost.memberIds.indexOf(mid);
  if (idx === -1) cost.memberIds.push(mid);
  else cost.memberIds.splice(idx, 1);
  renderCostLines();
}

function toggleAllCostMembers(cid) {
  const cost = tempCosts.find((c) => c.id === cid);
  if (!cost) return;
  const includedIds = tempMembers.filter((m) => m.included).map((m) => m.id);
  const allOn =
    includedIds.length > 0 &&
    includedIds.every((id) => cost.memberIds.includes(id));
  cost.memberIds = allOn ? [] : [...includedIds];
  renderCostLines();
}

// Small "+N" stepper for a member's guestCount — lets a member bring N extra
// people (e.g. a guest they're paying for) WITHOUT that guest becoming a
// separate member entry. Cost splitting weighs this member up accordingly.
function guestStepperHtml(m) {
  const n = m.guestCount || 0;
  return `<span class="ms-stepper" title="Guests this member is bringing (folded into their own cost share)">
    <button type="button" class="ms-stepper-btn" onclick="changeGuestCount('${m.id}',-1)">−</button>
    <span class="ms-stepper-badge ms-stepper-badge-guest">+${n}</span>
    <button type="button" class="ms-stepper-btn" onclick="changeGuestCount('${m.id}',1)">+</button>
  </span>`;
}
function changeGuestCount(mid, delta) {
  const m = tempMembers.find((x) => x.id === mid);
  if (!m) return;
  m.guestCount = Math.max(0, (m.guestCount || 0) + delta);
  // A member's no-show count can never exceed their own weight (self + guests).
  const weight = 1 + m.guestCount;
  if ((m.noShowCount || 0) > weight) m.noShowCount = weight;
  renderModalMembers();
}
// Small stepper for how many of this member's own weight (self + guests)
// didn't actually show up — kept full weight for the court-fee line (they
// already reserved the spot) but excluded from every other cost line, same
// as the self-serve no-show handling on the public vote page. Bounded to
// [0, 1+guestCount] since it can't exceed this member's own weight.
function noShowStepperHtml(m) {
  const n = m.noShowCount || 0;
  const weight = 1 + (m.guestCount || 0);
  return `<span class="ms-stepper" title="How many of this member's own weight (self + guests) were no-shows">
    <button type="button" class="ms-stepper-btn" onclick="changeNoShowCount('${m.id}',-1)">−</button>
    <span class="ms-stepper-badge ${n > 0 ? "ms-stepper-badge-noshow" : ""}">${n}</span>
    <button type="button" class="ms-stepper-btn" onclick="changeNoShowCount('${m.id}',1)" ${n >= weight ? "disabled" : ""}>+</button>
  </span>`;
}
function changeNoShowCount(mid, delta) {
  const m = tempMembers.find((x) => x.id === mid);
  if (!m) return;
  const weight = 1 + (m.guestCount || 0);
  m.noShowCount = Math.max(0, Math.min(weight, (m.noShowCount || 0) + delta));
  renderModalMembers();
}
function renderModalMembers() {
  const wrap = document.getElementById("ms-members");
  if (tempMembers.length === 0) {
    wrap.innerHTML =
      '<div style="font-size:12px;color:var(--hint)">No members yet. Add from the "Members" tab or enter a name below.</div>';
    return;
  }
  const fixed = tempMembers.filter((m) => m.type !== "casual");
  const casual = tempMembers.filter((m) => m.type === "casual");
  let html = "";
  if (fixed.length > 0) {
    html += `<div class="ms-group-title ms-group-title-fixed">★ Fixed (always included)</div>`;
    html += fixed
      .map(
        (m) => `
      <div class="ms-member-row">
        <span class="ms-check checked disabled"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></span>
        <label class="ms-member-name">${esc(m.name)}</label>
        ${guestStepperHtml(m)}
        ${noShowStepperHtml(m)}
      </div>`,
      )
      .join("");
  }
  if (casual.length > 0) {
    html += `<div class="ms-group-title ms-group-title-casual">🏃 Casual</div>`;
    html += casual
      .map(
        (m) => `
      <div class="ms-member-row">
        <span class="ms-check ${m.included ? "checked" : ""}" onclick="toggleModalMember('${m.id}',${!m.included})"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></span>
        <label class="ms-member-name">${esc(m.name)}</label>
        ${guestStepperHtml(m)}
        ${noShowStepperHtml(m)}
      </div>`,
      )
      .join("");
  }
  wrap.innerHTML = html;
}

function toggleModalMember(mid, checked) {
  const m = tempMembers.find((x) => x.id === mid);
  if (m) {
    m.included = checked;
    // Update all cost memberIds
    if (!checked) {
      tempCosts.forEach((c) => {
        c.memberIds = c.memberIds.filter((id) => id !== mid);
      });
    }
    renderCostLines();
  }
}

function addInlineMember() {
  const inp = document.getElementById("ms-new-member-inline");
  const name = inp.value.trim();
  if (!name) return;
  // Inline-added members are casual by default
  const newMember = { id: uid(), name, type: "casual" };
  members.push(newMember);
  saveMembers();
  tempMembers.push({ ...newMember, included: true, guestCount: 0, noShowCount: 0 });
  inp.value = "";
  // Casual: NOT auto-added to cost lines (must be ticked manually)
  renderModalMembers();
  renderCostLines();
}
document
  .getElementById("ms-new-member-inline")
  .addEventListener("keydown", (e) => {
    if (e.key === "Enter") addInlineMember();
  });

function saveSession() {
  const date = document.getElementById("ms-date").value;
  if (!date) {
    showToast("Please select a date");
    return;
  }
  const note = document.getElementById("ms-note").value.trim();
  const address = document.getElementById("ms-address").value.trim();
  const mapsUrl = document.getElementById("ms-maps-link").value.trim();
  const includedMembers = tempMembers.filter((m) => m.included);
  if (includedMembers.length === 0) {
    showToast("Need at least 1 member");
    return;
  }

  // Build final costs — clamp amount input
  const finalCosts = tempCosts
    .filter((c) => c.name || c.amount > 0)
    .map((c) => {
      // Ensure memberIds only has included members
      const mids = c.memberIds.filter((id) =>
        includedMembers.some((m) => m.id === id),
      );
      return { ...c, memberIds: mids };
    });

  if (editingSessionId) {
    const idx = sessions.findIndex((s) => s.id === editingSessionId);
    if (idx !== -1) {
      // Preserve paid status
      const old = sessions[idx];
      const newMembers = includedMembers.map((m) => {
        const existing = old.members.find((om) => om.id === m.id);
        return {
          id: m.id,
          name: m.name,
          paid: existing ? existing.paid : false,
          guestCount: m.guestCount || 0,
          noShowCount: m.noShowCount || 0,
        };
      });
      sessions[idx] = {
        ...sessions[idx],
        date,
        note,
        address,
        mapsUrl,
        costs: finalCosts,
        members: newMembers,
      };
      syncSessionCostToPoll(sessions[idx]);
    }
  } else {
    const newSession = {
      id: uid(),
      date,
      note,
      address,
      mapsUrl,
      costs: finalCosts,
      members: includedMembers.map((m) => ({
        id: m.id,
        name: m.name,
        paid: false,
        guestCount: m.guestCount || 0,
        noShowCount: m.noShowCount || 0,
      })),
      ...(tempSessionPollLink ? { pollId: tempSessionPollLink } : {}),
    };
    sessions.push(newSession);
    if (newSession.pollId) syncSessionCostToPoll(newSession);
    tempSessionPollLink = null;
  }

  ss("hl_sessions", sessions);
  closeModal("modal-session");
  renderSessions();
  showToast(editingSessionId ? "Session updated" : "New session created");
}

