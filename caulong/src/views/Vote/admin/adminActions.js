// ─── ADMIN: CLEAR ACTIVITY LOG / REMOVE A VOTER (per poll) ────────
// Handy for wiping test data (or removing a specific person's vote) without
// needing DevTools — everything goes through the same custom confirm/prompt
// dialogs already used elsewhere in the admin panel.
function clearPollLog(pid) {
  showConfirm({
    title: "Clear activity log",
    message:
      "This deletes every Activity entry for this vote (who selected what, name changes, added options…). This can't be undone.",
    yesText: "Clear log",
    noText: "Cancel",
  }).then((ok) => {
    if (!ok) return;
    fdb
      .ref(POLLS_ROOT + "/" + pid + "/logs")
      .remove()
      .then(() => showToast("Activity log cleared"))
      .catch((err) => {
        console.error(err);
        showToast(
          "Error: " + (err && err.message ? err.message : "couldn't connect"),
        );
      });
  });
}
async function removePollVoterByName(pid) {
  const p = pollsCache[pid];
  if (!p || !p.votes) {
    showToast("No votes yet on this poll");
    return;
  }
  const name = await showPrompt({
    title: "Remove voter",
    label: "Exact name to remove",
    placeholder: "E.g.: HHH",
    confirmText: "Find",
    cancelText: "Cancel",
  });
  if (!name || !name.trim()) return;
  const target = name.trim().toLowerCase();
  const matches = Object.entries(p.votes).filter(
    ([, v]) => (v.name || "").trim().toLowerCase() === target,
  );
  if (matches.length === 0) {
    showToast(`No voter found named "${name.trim()}"`);
    return;
  }
  const ok = await showConfirm({
    title: "Remove voter",
    message: `Remove ${matches.length} vote entr${matches.length > 1 ? "ies" : "y"} named "${name.trim()}"? This can't be undone.`,
    yesText: "Remove",
    noText: "Cancel",
  });
  if (!ok) return;
  Promise.all(
    matches.map(([devId]) =>
      fdb.ref(POLLS_ROOT + "/" + pid + "/votes/" + devId).remove(),
    ),
  )
    .then(() => showToast("Voter removed"))
    .catch((err) => {
      console.error(err);
      showToast(
        "Error: " + (err && err.message ? err.message : "couldn't connect"),
      );
    });
}
// Lets the admin fix a voter's display name directly (typo, wrong device
// name, etc.) without needing that person to reopen the vote link themselves.
async function renamePollVoter(pid) {
  const p = pollsCache[pid];
  if (!p || !p.votes) {
    showToast("No votes yet on this poll");
    return;
  }
  const oldName = await showPrompt({
    title: "Rename voter",
    label: "Current name (exact)",
    placeholder: "E.g.: HHH",
    confirmText: "Find",
    cancelText: "Cancel",
  });
  if (!oldName || !oldName.trim()) return;
  const target = oldName.trim().toLowerCase();
  const matches = Object.entries(p.votes).filter(
    ([, v]) => (v.name || "").trim().toLowerCase() === target,
  );
  if (matches.length === 0) {
    showToast(`No voter found named "${oldName.trim()}"`);
    return;
  }
  const newName = await showPrompt({
    title: "Rename voter",
    label: `New name for "${oldName.trim()}"`,
    placeholder: "E.g.: Hùng",
    confirmText: "Rename",
    cancelText: "Cancel",
  });
  if (!newName || !newName.trim()) return;
  const cleanNew = newName.trim();
  if (isNameBlocked(cleanNew)) {
    showToast("That name isn't allowed");
    return;
  }
  const ok = await showConfirm({
    title: "Rename voter",
    message: `Rename ${matches.length} vote entr${matches.length > 1 ? "ies" : "y"} from "${oldName.trim()}" to "${cleanNew}"?`,
    yesText: "Rename",
    noText: "Cancel",
    tone: "info",
  });
  if (!ok) return;
  Promise.all(
    matches.map(([devId]) =>
      fdb
        .ref(POLLS_ROOT + "/" + pid + "/votes/" + devId)
        .update({ name: cleanNew, nameKey: nameKey(cleanNew) }),
    ),
  )
    .then(() => {
      logVoteEvent(
        pid,
        cleanNew,
        `was renamed by admin (was "${oldName.trim()}")`,
      );
      showToast("Voter renamed");
    })
    .catch((err) => {
      console.error(err);
      showToast(
        "Error: " + (err && err.message ? err.message : "couldn't connect"),
      );
    });
}

function renderPollList() {
  const wrap = document.getElementById("poll-list");
  const ids = Object.keys(pollsCache);
  if (ids.length === 0) {
    wrap.innerHTML =
      '<div class="empty-state"><div class="empty-icon">🗳️</div><div class="empty-text">No votes yet.</div></div>';
    return;
  }
  ids.sort(
    (a, b) => (pollsCache[b].createdAt || 0) - (pollsCache[a].createdAt || 0),
  );
  wrap.innerHTML = ids
    .map((pid) => {
      const p = pollsCache[pid];
      const groups = pollVotesByOption(p);
      const open = p.status === "open";
      const exp = pollExpanded[pid];
      const summary = groups
        .map((g) => `${g.label}: ${g.votes.length}`)
        .join(" &nbsp;·&nbsp; ");
      let detail = "";
      if (exp) {
        detail = `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        ${groups
          .map(
            (g) => `
          <div style="font-size:11px;font-weight:600;color:${g.tone.text};margin:8px 0 4px">${esc(g.label)} (${g.votes.length})</div>
          <div>${g.votes.length ? g.votes.map((v) => `<span class="vote-chip" style="background:${avatarToneFor(v).bg};border-color:${avatarToneFor(v).border};color:${avatarToneFor(v).text}">${chipAvatarImg(v)}${esc(v.name)}</span>`).join("") : '<span style="font-size:12px;color:var(--hint)">No one yet</span>'}</div>`,
          )
          .join("")}
      </div>`;
      }
      const linkedSession = sessions.find((s) => s.pollId === pid);
      const linkSelect = `<select onchange="linkPollToSession('${pid}', this.value)" style="font-size:11px;padding:3px 6px;width:auto;border-radius:20px" title="Link to a session so the Thanh toán tab on the public vote page can show its cost breakdown">
          <option value="">🔗 Link session…</option>
          ${sessions
            .map(
              (s) =>
                `<option value="${s.id}" ${linkedSession && linkedSession.id === s.id ? "selected" : ""}>${esc(fmtDate(s.date))}${s.note ? " · " + esc(s.note) : ""}</option>`,
            )
            .join("")}
        </select>`;
      return `<div class="poll-item ${open ? "" : "closed"}">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div style="flex:1;min-width:150px;cursor:pointer" onclick="togglePollExpand('${pid}')">
          <div class="vp-card-title">${esc(fmtDate(p.date))}${p.note ? " · " + esc(p.note) : ""}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
            <span class="badge-pill vp-status-pill ${open ? "badge-green" : "badge-coral"}"><span class="vp-status-dot"></span>${open ? "Open" : "Closed"}</span>
            <span class="vp-join-count">${summary}</span>
            ${linkedSession ? '<span class="badge-pill badge-blue">💰 ' + esc(fmtDate(linkedSession.date)) + "</span>" : ""}
          </div>
        </div>
        <button class="btn btn-green btn-sm" onclick="createSessionFromPoll('${pid}')">${ICON_CHECK}<span>Create Session</span></button>
      </div>
      <div class="vp-divider"></div>
      <div class="vp-action-group">
        <div class="vp-group-title">Edit &amp; share</div>
        <div class="vp-group-buttons">
          <button class="btn btn-ghost btn-sm" onclick="copyPollLink('${pid}')">${ICON_LINK}<span>Link</span></button>
          <button class="btn btn-ghost btn-sm" onclick="editPoll('${pid}')">${ICON_EDIT}<span>Edit</span></button>
          <button class="btn btn-ghost btn-sm" onclick="togglePollStatus('${pid}')">${ICON_LOCK}<span>${open ? "Close" : "Reopen"}</span></button>
          ${linkSelect}
        </div>
      </div>
      <div class="vp-action-group">
        <div class="vp-group-title">Voters</div>
        <div class="vp-group-buttons">
          <button class="btn btn-ghost btn-sm" onclick="renamePollVoter('${pid}')" title="Rename a specific voter's entry">${ICON_EDIT}<span>Rename Voter</span></button>
          <button class="btn btn-ghost btn-sm" onclick="removePollVoterByName('${pid}')" title="Remove a specific voter's entry by name">${ICON_REMOVE}<span>Remove Voter</span></button>
          <button class="btn btn-ghost btn-sm" onclick="clearPollLog('${pid}')" title="Delete all Activity log entries for this vote">${ICON_CLEAR}<span>Clear Log</span></button>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn btn-danger btn-sm" onclick="deletePoll('${pid}')">${ICON_TRASH}<span>Delete Vote</span></button>
      </div>
      ${detail}
    </div>`;
    })
    .join("");
}

// Create a new session from vote results: everyone who voted for the "Join"
// option (✅) is added and pre-ticked in the cost split.

function createSessionFromPoll(pid) {
  const p = pollsCache[pid];
  if (!p) return;
  // Use the SAME attendance logic as the Payment tab (computeOptionAttendance /
  // pickCostBasisOption) instead of hard-coding option id "in" — that only
  // matches the default "Go"/"Bận" poll, and silently finds 0 votes on polls
  // that use custom options (e.g. "T2 14/07", "T3 15/07"...), even though
  // people clearly voted. Here we pick whichever option has the most voters
  // (matching what Payment already bases the cost split on), with the same
  // tie-break rule (host's saved costBasisOptionId) if two options are tied.
  const attendance = computeOptionAttendance(p).filter((o) => o.total > 0);
  if (attendance.length === 0) {
    showToast("No one has voted to join yet");
    return;
  }
  const maxTotal = Math.max(...attendance.map((o) => o.total));
  const tied = attendance.filter((o) => o.total === maxTotal);
  let basis = tied.length === 1 ? tied[0] : null;
  if (!basis && tied.length > 1) {
    basis = tied.find((o) => o.id === p.costBasisOptionId) || null;
  }
  if (!basis) {
    showToast(
      "⚖️ " +
        tied.map((o) => o.label).join(" and ") +
        " are tied — resolve which one to use from the Manage page first",
    );
    return;
  }
  const ins = basis.attendees;
  // Match voter names to members (case/accent-insensitive); unknown names → new Casual
  // member. basis.attendees already folds in "+N" guest-option votes — including from
  // people who only voted the guest option, not the main day option itself — via
  // computeOptionAttendance's GUEST_OPTION_RE parsing, which (unlike extraGuestCount
  // below) correctly handles suffixed labels like "+2 t3" used to tie a guest option to
  // a specific day option. So we reuse its v.extra directly instead of re-deriving guest
  // counts from scratch.
  const votedIds = new Set();
  const guestCounts = {}; // memberId -> total extra guests for this session
  ins.forEach((v) => {
    let m = members.find((mm) => nameKey(mm.name) === nameKey(v.name));
    if (!m) {
      m = { id: uid(), name: v.name.trim(), type: "casual" };
      members.push(m);
    }
    votedIds.add(m.id);
    guestCounts[m.id] = (guestCounts[m.id] || 0) + Math.max(0, (v.weight || 1) - 1);
  });
  saveMembers();
  editingSessionId = null;
  tempSessionPollLink = pid;
  document.getElementById("modal-session-title").textContent =
    "New Session (from vote)";
  document.getElementById("ms-save-btn").textContent = "Save Session";
  document.getElementById("ms-date").value =
    p.date || new Date().toISOString().slice(0, 10);
  document.getElementById("ms-note").value = p.note || "Saturday";
  // Carry over the host's own no-show marks from "Manage your vote"
  // (poll.noShows, keyed by nameKey → how many of that voter's own weight
  // didn't show up) so the new Session starts already reflecting them,
  // instead of silently losing that info the moment a real Session takes
  // over the Payment tab from the self-serve calculation.
  const pollNoShows = p.noShows || {};
  // Only pre-tick members who actually voted ✅ Join (including Fixed) plus their +N guests — no one else added automatically
  tempMembers = members.map((m) => {
    const guestCount = guestCounts[m.id] || 0;
    const rawNoShow = pollNoShows[nameKey(m.name)] || 0;
    return {
      ...m,
      included: votedIds.has(m.id),
      guestCount,
      // Clamped to this member's own weight (self + guests) in case it no
      // longer matches what the poll originally recorded.
      noShowCount: Math.min(rawNoShow, 1 + guestCount),
    };
  });
  // Reuse the host's own cost amounts from "Manage your vote" (poll.costs) if
  // they entered any, instead of always resetting to the blank template
  // amounts — otherwise creating a Session silently discarded whatever the
  // host had already filled in over there.
  const pollCosts = (p.costs || []).filter((c) => c.name || c.amount > 0);
  tempCosts = (pollCosts.length > 0 ? pollCosts : COST_PRESETS).map((pr) => ({
    id: uid(),
    name: pr.name,
    emoji: pr.emoji || "🗒️",
    // poll.costs amounts are already full VND; COST_PRESETS are in "k" (thousands).
    amount: pollCosts.length > 0 ? pr.amount || 0 : pr.amount * 1000,
    qty: pr.qty || "",
    memberIds: [],
  }));
  const incIds = tempMembers.filter((m) => m.included).map((m) => m.id);
  tempCosts.forEach((c) => (c.memberIds = [...incIds]));
  renderCostLines();
  renderModalMembers();
  openModal("modal-session");
}

