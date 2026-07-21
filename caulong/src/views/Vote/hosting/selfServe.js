// ─── SELF-SERVE HOSTING: anyone can create + manage their own vote ────
// Creating happens in a lightweight MODAL (no page navigation) — reached by
// tapping "+ Create your own vote" on the public vote page. Managing an
// existing vote later still uses a dedicated page (?manage=<pollId>), since
// that's a link the host bookmarks/saves for repeat visits.
// Ownership is the creator's own Firebase Auth uid (anonymous is fine),
// stamped as `creatorUid` on the poll at creation and checked both by
// Firebase Rules (server-side) and here (so a stranger with the manage link
// just sees a polite "no permission" instead of a form).
function hcSetView(title) {
  document.body.classList.add("host-mode");
  const t = document.getElementById("host-view-title");
  if (t) t.textContent = title;
}
// Recovery net for "I lost my manage link": every poll this device created
// (see submitHostCreatePollModal) has its id remembered in hl_my_hosted_polls,
// so this device can always find its way back — but ONLY from the same
// browser/device. If someone clears site data, switches devices, or never
// opens it again after creating, there's no login to fall back on, so
// there's genuinely no way to recover it; they'd need a fresh vote made for
// them (by another host, or by the admin).
async function openMyHostedVotesModal() {
  document.getElementById("hc-modal-title").textContent = "My hosted votes";
  document.getElementById("hc-modal-copy-icon").innerHTML = "";
  document.getElementById("hc-modal-footer").innerHTML = "";
  openModal("modal-host-create");
  const body = document.getElementById("hc-modal-body");
  if (!fbReady()) {
    body.innerHTML =
      '<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">⚠️ The vote system isn\'t configured yet.</div>';
    return;
  }
  // Matching your name against the vote's Organizer field is what grants
  // access now — this works from any device, not just the one that created
  // the vote (see loadMyHostedVotes / unlockHostManage).
  body.innerHTML = `
    <div style="margin-bottom:10px">
      <label class="field-label">Your name</label>
      <input type="text" id="mhv-name" maxlength="30" value="${esc((ls("hl_voter_locked_name") || "").trim())}" onkeydown="if(event.key==='Enter'){loadMyHostedVotes();}">
    </div>
    <button class="vv-vote-btn" onclick="loadMyHostedVotes()">Show my votes</button>
  `;
}
function loadMyHostedVotes() {
  const name = (document.getElementById("mhv-name").value || "").trim();
  if (!name) {
    showToast("Please enter your name");
    return;
  }
  const key = nameKey(name);
  const body = document.getElementById("hc-modal-body");
  body.innerHTML =
    '<div style="text-align:center;color:var(--muted);font-size:13px;padding:10px 0">Loading…</div>';
  ensureFirebaseAuth()
    .then(() => fdb.ref(POLLS_ROOT).once("value"))
    .then((snap) => {
      const all = snap.val() || {};
      ss("hl_voter_locked_name", name); // remember so the manage page can unlock straight away
      const rows = Object.entries(all)
        .filter(([, p]) => p && nameKey(p.organizer) === key)
        .sort(([, a], [, b]) => (b.createdAt || 0) - (a.createdAt || 0))
        .map(
          ([pid, p]) => `
        <div class="player-item" style="margin-bottom:8px;cursor:pointer" onclick="closeModal('modal-host-create');location.href='?manage=${pid}'">
          <div style="flex:1">
            <div class="pi-name">${esc(p.note || "Untitled vote")}</div>
            <div class="pi-detail">${esc(fmtDate(p.date))} · ${p.status === "open" ? "Open" : "Closed"}</div>
          </div>
        </div>`,
        )
        .join("");
      body.innerHTML =
        rows ||
        `<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">No votes with "${esc(name)}" were found.</div>`;
    })
    .catch((err) => {
      console.error(err);
      body.innerHTML =
        '<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">Couldn\'t load votes. Please try again later.</div>';
    });
}
async function openHostCreateModal() {
  document.getElementById("hc-modal-title").textContent =
    "Create your own vote";
  document.getElementById("hc-modal-copy-icon").innerHTML = "";
  openModal("modal-host-create");
  const body = document.getElementById("hc-modal-body");
  body.innerHTML =
    '<div style="text-align:center;color:var(--muted);font-size:13px;padding:10px 0">Loading…</div>';
  document.getElementById("hc-modal-footer").innerHTML = "";
  if (!fbReady()) {
    body.innerHTML =
      '<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">⚠️ The vote system isn\'t configured yet.</div>';
    return;
  }
  await ensureFirebaseAuth();
  renderHostCreateModalForm();
}
function renderHostCreateModalForm() {
  tempPollOptions = DEFAULT_POLL_OPTIONS.map((o) => ({ ...o }));
  pollOptionsWrapId = "hc-vp-options";
  pollNewOptionInputId = "hc-vp-new-option-label";
  pollAddOptionEditing = false;
  pollOptionsSelectable = true;
  pollSelectedOptionIds = new Set();
  const body = document.getElementById("hc-modal-body");
  body.innerHTML = `
    <div class="hm-form">
    <div style="margin-bottom:14px">
      <label class="field-label">Vote title</label>
      <input type="text" id="hc-title" maxlength="60">
    </div>
    <div style="display:flex;gap:12px;margin-bottom:14px">
      <div style="flex:1">
        <label class="field-label">Your name</label>
        <input type="text" id="hc-name" maxlength="30" value="${esc((ls("hl_voter_locked_name") || "").trim())}">
      </div>
      <div style="flex:1">
        <label class="field-label">Date</label>
        <input type="date" id="hc-date" value="${new Date().toISOString().slice(0, 10)}">
      </div>
    </div>
    <div>
      <label class="field-label">Vote options</label>
      <div id="hc-vp-options"></div>
    </div>
    </div>
  `;
  renderPollOptionsEditor();
  document.getElementById("hc-modal-footer").innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('modal-host-create')">Cancel</button>
    <button class="btn btn-primary" onclick="submitHostCreatePollModal()">Create</button>
  `;
}
async function submitHostCreatePollModal() {
  const name = (document.getElementById("hc-name").value || "").trim();
  const title = (document.getElementById("hc-title").value || "").trim();
  const date = document.getElementById("hc-date").value;
  if (!name) {
    showToast("Please enter your name");
    return;
  }
  if (isNameBlocked(name)) {
    showToast("Invalid name");
    return;
  }
  if (!title) {
    showToast("Please enter a vote title");
    return;
  }
  if (!date) {
    showToast("Please pick a date");
    return;
  }
  const options = tempPollOptions
    .map((o) => ({ id: o.id, label: o.label.trim() }))
    .filter((o) => o.label);
  if (options.length === 0) {
    showToast("Add at least 1 vote option");
    return;
  }
  // Only keep selections that still point at a real (non-empty-label) option.
  const myChoices = Array.from(pollSelectedOptionIds).filter((oid) =>
    options.some((o) => o.id === oid),
  );
  const uidVal = await getMyAuthUid();
  if (!uidVal) {
    showToast("Couldn't connect — please try again");
    return;
  }
  ss("hl_voter_locked_name", name);
  const ref = fdb.ref(POLLS_ROOT).push();
  ref
    .set({
      date,
      note: title,
      organizer: name,
      options,
      status: "open",
      createdAt: Date.now(),
      creatorUid: uidVal,
    })
    .then(() => {
      const mine = ls("hl_my_hosted_polls") || [];
      if (!mine.includes(ref.key)) {
        mine.push(ref.key);
        ss("hl_my_hosted_polls", mine);
      }
      // Vote for myself right away, so I don't have to reopen the vote and
      // select an option again after creating it.
      if (myChoices.length > 0) {
        const devId = effectiveDevId(ref.key);
        fdb
          .ref(POLLS_ROOT + "/" + ref.key + "/votes/" + devId)
          .set({
            name,
            choices: myChoices,
            at: Date.now(),
            nameKey: nameKey(name),
            avatar: ls("hl_voter_avatar") || null,
          })
          .catch((err) =>
            console.error("Couldn't save creator's own vote", err),
          );
      }
      renderHostCreateModalSuccess(ref.key);
    })
    .catch((err) => {
      console.error(err);
      showToast(
        "Error: " + (err && err.message ? err.message : "couldn't connect"),
      );
    });
}
function renderHostCreateModalSuccess(pid) {
  document.getElementById("hc-modal-title").textContent = t("voteCreatedTitle");
  document.getElementById("hc-modal-copy-icon").innerHTML = "";
  const body = document.getElementById("hc-modal-body");
  body.innerHTML = `
    <div style="text-align:center;font-size:13px;color:var(--muted);margin-bottom:16px">${t("voteCreatedDesc")}</div>
    <div style="margin-bottom:14px">
      <label class="field-label">${t("votingLinkLabel")}</label>
      <div style="display:flex;gap:6px">
        <input type="text" readonly value="${esc(pollLink(pid))}" style="flex:1;font-size:12px" onclick="this.select()">
        <button class="btn btn-ghost btn-sm" onclick="copyPollLink('${pid}')">${t("copyBtn")}</button>
      </div>
    </div>
    <div>
      <label class="field-label">${t("manageLinkLabel")}</label>
      <div style="display:flex;gap:6px">
        <input type="text" readonly value="${esc(manageLink(pid))}" style="flex:1;font-size:12px" onclick="this.select()">
        <button class="btn btn-ghost btn-sm" onclick="copyManageLink('${pid}',true)">${t("copyBtn")}</button>
      </div>
    </div>
  `;
  document.getElementById("hc-modal-footer").innerHTML =
    `<button class="btn btn-primary" onclick="closeModal('modal-host-create');location.href='?poll=${pid}'">${t("viewVotePage")}</button>`;
}
async function initHostManageView(pid) {
  hcSetView("Manage your vote");
  const body = document.getElementById("host-body");
  if (!fbReady()) {
    body.innerHTML =
      '<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">⚠️ The vote system isn\'t configured yet.</div>';
    return;
  }
  await ensureFirebaseAuth();
  const myUid = await getMyAuthUid();
  // Guards the one-time "claim" write below (see isOrganizerMatch branch) so
  // we don't retry it on every single snapshot re-fire (e.g. someone else
  // voting), only once per page load unless it actually failed.
  let claimAttempted = false;
  fdb.ref(POLLS_ROOT + "/" + pid).on(
    "value",
    (snap) => {
      const p = snap.val();
      if (!p) {
        body.innerHTML =
          '<div style="text-align:center;font-size:13px;color:var(--muted);padding:16px 10px">This vote no longer exists.</div>';
        return;
      }
      pollsCache[pid] = p; // so togglePollStatus/deletePoll/clearPollLog/etc. (read pollsCache) work unmodified
      const isCreator = !!myUid && p.creatorUid === myUid;
      const isClaimedEditor =
        !!myUid && !!(p.editorUids && p.editorUids[myUid]);
      const lockedName = (ls("hl_voter_locked_name") || "").trim();
      const isOrganizerMatch =
        !!(p.organizer || "").trim() &&
        !!lockedName &&
        nameKey(lockedName) === nameKey(p.organizer);
      if (isCreator || isClaimedEditor) {
        renderHostManageForm(pid, p);
        return;
      }
      if (isOrganizerMatch) {
        // Name matches, but THIS device/browser has never been granted write
        // access before (new device, cleared cache, incognito…). The client
        // already trusts the name match to *show* the form, but Firebase
        // Rules only trust creatorUid/editorUids — never a client-typed
        // name — so without this, Update/Close/Delete would still get
        // rejected with PERMISSION_DENIED. Claim it once so this device is
        // now a real, rules-recognized editor of this poll going forward.
        if (myUid && !isClaimedEditor && !claimAttempted) {
          claimAttempted = true;
          // On a brand-new device/anonymous session, the very first write can
          // take a long time (WebSocket handshake + auth token still
          // settling) — sometimes long enough to look "stuck". Rather than
          // block on it forever, show the form optimistically after a short
          // timeout; the claim write keeps running in the background and
          // will still land (or the next Update attempt will retry/report
          // the real error if it genuinely failed).
          let claimSettled = false;
          const proceedOptimistically = () => {
            if (claimSettled) return;
            claimSettled = true;
            renderHostManageForm(pid, p);
          };
          const claimTimeout = setTimeout(proceedOptimistically, 4000);
          fdb
            .ref(POLLS_ROOT + "/" + pid + "/editorUids/" + myUid)
            .set(true)
            .then(() => {
              clearTimeout(claimTimeout);
              proceedOptimistically();
            })
            .catch((err) => {
              clearTimeout(claimTimeout);
              console.error("Couldn't claim editor access", err);
              claimAttempted = false; // allow retry on the next snapshot
              if (!claimSettled) {
                claimSettled = true;
                body.innerHTML =
                  '<div style="text-align:center;font-size:13px;color:var(--muted);padding:16px 10px;line-height:1.6">⚠️ Your name matches this vote\'s organizer, but this device couldn\'t get edit access (Firebase Rules rejected it). Ask whoever set up Firebase to add the <code>editorUids</code> rule.</div>';
              }
            });
          // "value" will also re-fire once the write above actually lands,
          // with editorUids now containing myUid → isClaimedEditor becomes
          // true above and the real form renders normally from then on.
          body.innerHTML =
            '<div style="text-align:center;font-size:13px;color:var(--muted);padding:16px 10px">Unlocking manage access…</div>';
          return;
        }
        renderHostManageForm(pid, p);
        return;
      }
      renderHostManageNameGate(pid, p);
    },
    (err) => {
      console.error(err);
      body.innerHTML =
        '<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">Couldn\'t load this vote. Please try again later.</div>';
    },
  );
}
// Shown instead of the manage form when neither this device nor the saved
// name is recognized. Anyone whose name matches the vote's Organizer field
// can type it in here to unlock editing — access isn't tied to a device or
// the original manage link anymore.
function renderHostManageNameGate(pid, p) {
  const body = document.getElementById("host-body");
  if (!(p.organizer || "").trim()) {
    body.innerHTML =
      '<div style="text-align:center;font-size:13px;color:var(--muted);padding:16px 10px;line-height:1.6">🔒 This vote has no Organizer set, so it can only be managed from the device that created it.</div>';
    return;
  }
  body.innerHTML = `
    <div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0 16px;line-height:1.6">🔒 Only this vote's organizer can manage it.<br>Enter the organizer's name to unlock.</div>
    <div style="margin-bottom:10px">
      <label class="field-label">Your name</label>
      <input type="text" id="hmg-name" placeholder="Enter organizer's name…" maxlength="30" value="${esc((ls("hl_voter_locked_name") || "").trim())}" onkeydown="if(event.key==='Enter'){unlockHostManage('${pid}')}">
    </div>
    <button class="vv-vote-btn" onclick="unlockHostManage('${pid}')">Unlock</button>
  `;
}
async function unlockHostManage(pid) {
  const nameInput = document.getElementById("hmg-name");
  const name = (nameInput.value || "").trim();
  if (!name) {
    showToast("Please enter a name");
    return;
  }
  const p = pollsCache[pid];
  if (!p || nameKey(name) !== nameKey(p.organizer)) {
    showToast("That name doesn't match this vote's Organizer");
    return;
  }
  ss("hl_voter_locked_name", name);
  // Also claim real (Rules-recognized) edit access for this device — typing
  // the matching name only unlocks the UI locally; without this write,
  // Update/Close/Delete would still fail with PERMISSION_DENIED afterwards.
  const myUid = await getMyAuthUid();
  if (myUid) {
    try {
      // Don't block the Unlock button forever if this is a brand-new
      // device/session and the first write is slow to land — let it keep
      // running in the background past the timeout; Update will retry/report
      // the real error later if it truly never went through.
      await Promise.race([
        fdb.ref(POLLS_ROOT + "/" + pid + "/editorUids/" + myUid).set(true),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    } catch (err) {
      console.error("Couldn't claim editor access", err);
      showToast(
        "Unlocked, but this device couldn't get save access (check Firebase Rules) — Update may still fail.",
      );
    }
  }
  renderHostManageForm(pid, p);
}
// Self-serve cost lines for a hosted vote — same shape/idea as the admin
// session cost lines (name/emoji/amount), but WITHOUT a per-line "apply to"
// picker: for a self-serve vote there's no admin-managed member list, so
// every cost line is simply split across everyone counted as attending (see
// selfServeAttendees / computeSelfServeCost below), weighted by any "+N"
// guest options they picked.
let tempHostCosts = [];
// Pending edits for the Manage-your-vote form — mirrors tempHostCosts:
// nothing here touches Firebase until "Update" is pressed, so "Cancel"
// can just discard it by re-rendering from the last known server poll.
let tempNoShows = {};
let tempCostBasisOptionId = null;
// Snapshot of the form right after loading from the server — compared
// against the live temp state to decide whether "Update" should be enabled.
let hostManageBaselineSnapshot = null;
function computeHostFormSnapshot() {
  const title = (document.getElementById("hm-title")?.value || "").trim();
  const date = document.getElementById("hm-date")?.value || "";
  const costs = tempHostCosts
    .filter((c) => c.name || c.amount > 0)
    .map((c) => `${c.name || ""}|${c.amount || 0}`)
    .join(";");
  const noShows = Object.keys(tempNoShows)
    .sort()
    .map((k) => `${k}:${tempNoShows[k]}`)
    .join(",");
  return JSON.stringify({
    title,
    date,
    costs,
    noShows,
    costBasis: tempCostBasisOptionId || "",
  });
}
function updateHostSaveButtonState() {
  const btn = document.getElementById("hm-update-btn");
  if (!btn) return;
  btn.disabled = computeHostFormSnapshot() === hostManageBaselineSnapshot;
}

function renderHostManageForm(pid, p) {
  const body = document.getElementById("host-body");
  tempHostCosts =
    p.costs && p.costs.length > 0
      ? p.costs.map((c) => ({ ...c }))
      : COST_PRESETS.map((pr) => ({
          id: uid(),
          name: pr.name,
          emoji: pr.emoji,
          amount: 0,
          qty: "",
        }));
  tempNoShows = { ...(p.noShows || {}) };
  tempCostBasisOptionId = p.costBasisOptionId || null;
  const attendanceOptions = computeOptionAttendance(p).filter(
    (o) => o.total > 0,
  );
  const maxTotal = attendanceOptions.length
    ? Math.max(...attendanceOptions.map((o) => o.total))
    : 0;
  const tiedOptions = attendanceOptions.filter((o) => o.total === maxTotal);
  const tieBreakHtml =
    tiedOptions.length > 1
      ? `<div style="margin-bottom:16px">
      <label class="field-label">Cost basis (tie)</label>
      <div style="font-size:11px;color:var(--hint);margin-bottom:6px">${tiedOptions.length} options are tied with ${maxTotal} people each. Pick which one the Payment split should be based on:</div>
      <select id="hm-cost-basis" onchange="tempCostBasisOptionId=this.value||null;updateHostSaveButtonState()">
        <option value="">— Choose —</option>
        ${tiedOptions
          .map(
            (o) =>
              `<option value="${o.id}" ${tempCostBasisOptionId === o.id ? "selected" : ""}>${esc(o.label)} (${o.total})</option>`,
          )
          .join("")}
      </select>
    </div>`
      : "";
  // Union of everyone across the attending options — no-show is picked from
  // this full pool, independent of which option ends up as the cost basis.
  const allAttendeesMap = new Map();
  attendanceOptions.forEach((o) =>
    o.attendees.forEach((a) => {
      if (!allAttendeesMap.has(a.nameKey)) allAttendeesMap.set(a.nameKey, a);
    }),
  );
  const allAttendees = Array.from(allAttendeesMap.values());
  const noShowAttendees = allAttendees.filter((a) => tempNoShows[a.nameKey]);
  const noShowChipsHtml = noShowAttendees
    .map((a) => noShowChipHtml(pid, a))
    .join("");
  const noShowRowsHtml = allAttendees.length
    ? allAttendees
        .map((a) => noShowRowHtml(pid, a, !!tempNoShows[a.nameKey]))
        .join("")
    : `<div class="ns-empty">No voters yet.</div>`;
  body.innerHTML = `
    <div class="hm-form">
    <div style="margin-bottom:14px">
      <label class="field-label">Vote title</label>
      <input type="text" id="hm-title" maxlength="60" placeholder="(max 60 characters)" value="${esc(p.note || "")}" oninput="updateHostSaveButtonState()">
    </div>
    <div style="margin-bottom:16px">
      <label class="field-label">Date</label>
      <input type="date" id="hm-date" value="${esc(p.date || "")}" oninput="updateHostSaveButtonState()">
    </div>
    ${tieBreakHtml}
    <div style="margin-bottom:16px">
      <label class="field-label">Costs</label>
      <div id="hm-cost-lines"></div>
      <button class="btn btn-ghost btn-sm" onclick="addHostCostLine()" style="margin-top:6px">+ Add cost</button>
    </div>
    <div style="margin-bottom:16px;position:relative">
      <label class="field-label">No-show</label>
      <div class="ns-trigger" id="hm-noshow-trigger" onclick="toggleNoShowPanel()">
        <div class="ns-chips" id="hm-noshow-chips">${noShowChipsHtml || '<span class="ns-trigger-placeholder">Select no-show members</span>'}</div>
        <span class="ns-trigger-chev">▾</span>
      </div>
      <div class="ns-panel" id="hm-noshow-panel">
        <div class="ns-search-wrap">
          <input type="text" id="hm-noshow-search" placeholder="Search member" oninput="filterNoShowRows(this.value)" autocomplete="off">
          <a class="ns-clear-all" onclick="clearAllNoShow('${pid}')">Clear all</a>
        </div>
        <div class="ns-list" id="hm-noshow-list">${noShowRowsHtml}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding-top:14px;border-top:1px solid var(--border)">
      <button class="btn btn-ghost" onclick="togglePollStatus('${pid}')">${p.status === "open" ? "Close vote" : "Reopen vote"}</button>
      <div style="display:flex;gap:14px">
        <button class="btn btn-ghost" onclick="cancelHostManageEdits('${pid}')">Cancel</button>
        <button class="btn btn-primary" id="hm-update-btn" disabled style="background:var(--blue);border-color:var(--blue)" onclick="saveHostPollEdits('${pid}')">Update</button>
      </div>
    </div>
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
      <label class="field-label">Voting link</label>
      <div style="display:flex;gap:6px">
        <input type="text" readonly value="${esc(pollLink(pid))}" style="flex:1;font-size:12px" onclick="this.select()">
        <button class="btn btn-ghost btn-sm" onclick="copyPollLink('${pid}')">Copy</button>
      </div>
    </div>
    </div>
  `;
  renderHostCostLines();
  // The Firebase listener re-renders this whole form whenever the poll
  // changes on the server (e.g. someone votes) — that would otherwise
  // visibly close the panel and clear the search box mid-edit, so restore
  // that state here.
  if (noShowPanelWasOpen) {
    const trigger = document.getElementById("hm-noshow-trigger");
    const panel = document.getElementById("hm-noshow-panel");
    const search = document.getElementById("hm-noshow-search");
    if (trigger && panel) {
      trigger.classList.add("open");
      panel.classList.add("open");
    }
    if (search && noShowSearchQuery) {
      search.value = noShowSearchQuery;
      filterNoShowRows(noShowSearchQuery);
    }
  }
  ensureNoShowOutsideClickHandler();
  // Baseline = the state right after loading from the server — "Update"
  // stays disabled until something actually differs from this.
  hostManageBaselineSnapshot = computeHostFormSnapshot();
  updateHostSaveButtonState();
}
// Discards every pending edit (title/date fields, cost lines, no-show
// selections, cost-basis pick) by simply re-rendering straight from the
// last known server state — nothing was written to Firebase yet, so
// there's nothing to undo server-side, just the in-progress form state.
function cancelHostManageEdits(pid) {
  const p = pollsCache[pid];
  if (!p) return;
  renderHostManageForm(pid, p);
}
let noShowOutsideClickAttached = false;
let noShowPanelWasOpen = false;
let noShowSearchQuery = "";
function ensureNoShowOutsideClickHandler() {
  if (noShowOutsideClickAttached) return;
  noShowOutsideClickAttached = true;
  document.addEventListener("click", closeNoShowPanelOnOutsideClick);
}
function noShowRowHtml(pid, a, checked) {
  const tone = avatarToneFor(a);
  const avatarHtml = a.avatar
    ? `<img src="${a.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : esc(initials(a.name));
  return `<label class="ns-row" data-name="${esc(a.name.toLowerCase())}" data-namekey="${a.nameKey}">
    <input type="checkbox" ${checked ? "checked" : ""} onchange="onNoShowCheckboxChange('${pid}','${a.nameKey}',this)">
    <span class="ns-row-avatar" style="background:${a.avatar ? "transparent" : tone.solid};overflow:hidden">${avatarHtml}</span>
    <span class="ns-row-name">${esc(a.name)}</span>
    ${a.extra > 0 ? `<span class="ns-row-extra">+${a.extra}</span>` : ""}
  </label>`;
}
// Pill/tag rendering for a selected no-show member, shown inside the
// trigger box itself (avatar + name + remove ×) instead of plain text.
function noShowChipHtml(pid, a) {
  const tone = avatarToneFor(a);
  const avatarHtml = a.avatar
    ? `<img src="${a.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : esc(initials(a.name));
  const nsCount = tempNoShows[a.nameKey] || 0;
  const countLabel = nsCount > 0 ? ` <span style="font-size:10px;color:var(--hint)">(${nsCount} no-show)</span>` : "";
  return `<span class="ns-chip">
    <span class="ns-chip-avatar" style="background:${a.avatar ? "transparent" : tone.solid};overflow:hidden">${avatarHtml}</span>
    <span class="ns-chip-name">${esc(a.name)}${countLabel}</span>
    <span class="ns-chip-remove" onclick="event.stopPropagation();removeNoShowChip('${pid}','${a.nameKey}')">×</span>
  </span>`;
}
function toggleNoShowPanel() {
  const trigger = document.getElementById("hm-noshow-trigger");
  const panel = document.getElementById("hm-noshow-panel");
  if (!trigger || !panel) return;
  const opening = !panel.classList.contains("open");
  panel.classList.toggle("open", opening);
  trigger.classList.toggle("open", opening);
  noShowPanelWasOpen = opening;
  if (opening) {
    const search = document.getElementById("hm-noshow-search");
    if (search) setTimeout(() => search.focus(), 0);
  } else {
    noShowSearchQuery = "";
  }
}
function closeNoShowPanelOnOutsideClick(e) {
  const trigger = document.getElementById("hm-noshow-trigger");
  const panel = document.getElementById("hm-noshow-panel");
  if (!trigger || !panel) {
    document.removeEventListener("click", closeNoShowPanelOnOutsideClick);
    noShowOutsideClickAttached = false;
    return;
  }
  if (trigger.contains(e.target) || panel.contains(e.target)) return;
  panel.classList.remove("open");
  trigger.classList.remove("open");
  noShowPanelWasOpen = false;
  noShowSearchQuery = "";
}
function filterNoShowRows(query) {
  noShowSearchQuery = query;
  const q = query.trim().toLowerCase();
  const rows = document.querySelectorAll("#hm-noshow-list .ns-row");
  let visible = 0;
  rows.forEach((row) => {
    const match = !q || (row.dataset.name || "").includes(q);
    row.style.display = match ? "" : "none";
    if (match) visible++;
  });
  const list = document.getElementById("hm-noshow-list");
  let empty = list.querySelector(".ns-empty-filtered");
  if (visible === 0) {
    if (!empty) {
      empty = document.createElement("div");
      empty.className = "ns-empty ns-empty-filtered";
      empty.textContent = "No members found.";
      list.appendChild(empty);
    }
  } else if (empty) {
    empty.remove();
  }
}
function refreshNoShowChips(pid) {
  const p = pollsCache[pid];
  const chipsWrap = document.getElementById("hm-noshow-chips");
  if (!chipsWrap) return;
  const attendanceOptions = p
    ? computeOptionAttendance(p).filter((o) => o.total > 0)
    : [];
  const byKey = new Map();
  attendanceOptions.forEach((o) =>
    o.attendees.forEach((a) => {
      if (!byKey.has(a.nameKey)) byKey.set(a.nameKey, a);
    }),
  );
  const checkedKeys = [];
  document.querySelectorAll("#hm-noshow-list .ns-row").forEach((row) => {
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb && cb.checked && row.dataset.namekey)
      checkedKeys.push(row.dataset.namekey);
  });
  const chipsHtml = checkedKeys
    .map((k) => byKey.get(k))
    .filter(Boolean)
    .map((a) => noShowChipHtml(pid, a))
    .join("");
  chipsWrap.innerHTML =
    chipsHtml ||
    '<span class="ns-trigger-placeholder">Select no-show members</span>';
}
// Removing a member via their chip's × — uncheck the matching row (if the
// panel happens to be open) and drop them from the pending edit; nothing
// hits Firebase until "Update" is pressed.
// "Clear all" — wipes every pending no-show selection at once (still just
// the staged tempNoShows, not written to Firebase until "Update").
function clearAllNoShow(pid) {
  tempNoShows = {};
  document
    .querySelectorAll('#hm-noshow-list .ns-row input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = false;
    });
  refreshNoShowChips(pid);
  updateHostSaveButtonState();
}
function removeNoShowChip(pid, nameKey) {
  delete tempNoShows[nameKey];
  const row = document.querySelector(
    `#hm-noshow-list .ns-row[data-namekey="${nameKey}"]`,
  );
  if (row) {
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = false;
  }
  refreshNoShowChips(pid);
  updateHostSaveButtonState();
}
// Checking a name in the No-show list. If that person picked a "+N" guest
// option, we don't know whether they alone are missing or their guests too —
// so we confirm the exact headcount (bounded to [1, N]) before saving. This
// only updates the pending tempNoShows object — like the cost lines, it's
// not written to Firebase until "Update" is pressed (and is discarded by
// "Cancel").
async function onNoShowCheckboxChange(pid, nameKey, checkboxEl) {
  const p = pollsCache[pid];
  if (!p) return;
  if (!checkboxEl.checked) {
    delete tempNoShows[nameKey];
    refreshNoShowChips(pid);
    updateHostSaveButtonState();
    return;
  }
  const attendanceOptions = computeOptionAttendance(p).filter(
    (o) => o.total > 0,
  );
  let attendee = null;
  for (const o of attendanceOptions) {
    attendee = o.attendees.find((a) => a.nameKey === nameKey);
    if (attendee) break;
  }
  if (!attendee) return;
  let count = 1;
  if (attendee.weight > 1) {
    count = await showNoShowCountConfirm(attendee.name, attendee.weight);
    if (count == null) {
      checkboxEl.checked = false; // cancelled — revert the check
      return;
    }
  }
  tempNoShows[attendee.nameKey] = count;
  refreshNoShowChips(pid);
  updateHostSaveButtonState();
}
// Small stepper confirm dialog — "N thành viên không đi hả", bounded to
// [1, maxCount] and never negative. Resolves to the confirmed count, or
// null if the host cancels.
function showNoShowCountConfirm(name, maxCount) {
  return new Promise((resolve) => {
    let count = maxCount;
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-backdrop";
    backdrop.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-hd">
          <div class="confirm-icon-wrap info"><div class="diamond"></div><div class="mark">?</div></div>
          <div class="confirm-title">${esc(name)}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin:6px 0 14px">
          <button type="button" class="ns-dec" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:var(--bg);font-size:18px;line-height:1;cursor:pointer">−</button>
          <div id="ns-count-num" style="font-size:32px;font-weight:800;min-width:44px;text-align:center">${count}</div>
          <button type="button" class="ns-inc" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:var(--bg);font-size:18px;line-height:1;cursor:pointer">+</button>
        </div>
        <div class="confirm-msg" id="ns-caption" style="text-align:center">${count} thành viên không đi hả</div>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-btn-no" type="button">Cancel</button>
          <button class="confirm-btn confirm-btn-yes" type="button" style="background:var(--blue)">Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    const numEl = backdrop.querySelector("#ns-count-num");
    const capEl = backdrop.querySelector("#ns-caption");
    const update = () => {
      numEl.textContent = count;
      capEl.textContent = `${count} thành viên không đi hả`;
    };
    backdrop.querySelector(".ns-dec").addEventListener("click", () => {
      if (count > 1) {
        count--;
        update();
      }
    });
    backdrop.querySelector(".ns-inc").addEventListener("click", () => {
      if (count < maxCount) {
        count++;
        update();
      }
    });
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(val);
    };
    backdrop
      .querySelector(".confirm-btn-no")
      .addEventListener("click", () => finish(null));
    backdrop
      .querySelector(".confirm-btn-yes")
      .addEventListener("click", () => finish(count));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finish(null);
    });
  });
}

function renderHostCostLines() {
  const wrap = document.getElementById("hm-cost-lines");
  if (!wrap) return;
  if (tempHostCosts.length === 0) {
    wrap.innerHTML =
      '<div style="font-size:12px;color:var(--hint);margin-bottom:8px">No cost items yet.</div>';
    return;
  }
  wrap.innerHTML = tempHostCosts
    .map((c) => {
      const shortVal =
        c.amount > 0 ? Math.round(c.amount).toLocaleString("en-US") : "";
      const isCourt = isCourtFeeCost(c.name);
      return `<div class="cost-line" data-cid="${c.id}">
      <input class="cost-name-inp" type="text" placeholder="Cost name…" value="${esc(c.name)}"
        style="flex:1;min-width:0${isCourt ? ";background:var(--surface-2, #f3f4f6);color:var(--muted);cursor:not-allowed" : ""}"
        ${isCourt ? "disabled" : `oninput="updateHostCostField('${c.id}','name',this.value)"`} maxlength="30">
      <div style="text-align:right;flex-shrink:0;margin-left:10px">
        <div class="cost-input-wrap">
          <input type="text" inputmode="numeric" class="cost-k" placeholder="0" value="${shortVal}"
            style="text-align:right;width:110px"
            onblur="syncHostCostAmount('${c.id}',this)"
            onkeydown="if(event.key==='Enter'){syncHostCostAmount('${c.id}',this)}"
            oninput="syncHostCostAmount('${c.id}',this)">
        </div>
      </div>
      <button class="hm-cost-remove" type="button" onclick="removeHostCostLine('${c.id}')" title="Remove" aria-label="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
      </button>
    </div>`;
    })
    .join("");
}
function updateHostCostField(cid, field, value) {
  const c = tempHostCosts.find((x) => x.id === cid);
  if (c) c[field] = value;
  updateHostSaveButtonState();
}
function syncHostCostAmount(cid, el) {
  const digits = el.value.replace(/[^\d]/g, "");
  const v = digits ? parseInt(digits, 10) : 0;
  // Reformat with thousand separators as you type, keeping the cursor at
  // the end (money is typed left-to-right, so this doesn't fight the user).
  el.value = v > 0 ? v.toLocaleString("en-US") : "";
  const c = tempHostCosts.find((x) => x.id === cid);
  if (c) c.amount = v;
  updateHostSaveButtonState();
}
function addHostCostLine() {
  tempHostCosts.push({ id: uid(), name: "", emoji: "🗒️", amount: 0, qty: "" });
  renderHostCostLines();
  updateHostSaveButtonState();
  setTimeout(() => {
    const inputs = document.querySelectorAll("#hm-cost-lines .cost-name-inp");
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}
function removeHostCostLine(cid) {
  tempHostCosts = tempHostCosts.filter((c) => c.id !== cid);
  renderHostCostLines();
  updateHostSaveButtonState();
}
function saveHostPollEdits(pid) {
  const title = (document.getElementById("hm-title").value || "").trim();
  const date = document.getElementById("hm-date").value;
  if (!date) {
    showToast("Please pick a date");
    return;
  }
  const btn = document.getElementById("hm-update-btn");
  if (btn) btn.disabled = true; // instant feedback; the listener re-render confirms it
  const costs = tempHostCosts.filter((c) => c.name || c.amount > 0);
  fdb
    .ref(POLLS_ROOT + "/" + pid)
    .update({
      note: title,
      date,
      costs,
      noShows: Object.keys(tempNoShows).length ? tempNoShows : null,
      costBasisOptionId: tempCostBasisOptionId || null,
    })
    .then(() => showToast("Updated"))
    .catch((err) => {
      console.error(err);
      if (btn) btn.disabled = false; // save failed — let them retry
      showToast(
        "Error: " + (err && err.message ? err.message : "couldn't connect"),
      );
    });
}
// overwrite the admin's rename right back on the voter's next Submit tap.
function syncLockedNameFromServer(poll) {
  if (!poll || !poll.votes) return;
  const serverEntry = poll.votes[effectiveDevId(voterPid)];
  if (!serverEntry || !serverEntry.name) return;
  const local = (ls("hl_voter_locked_name") || "").trim();
  if (serverEntry.name !== local) {
    ss("hl_voter_locked_name", serverEntry.name);
  }
}

let vvExpanded = new Set();
let vvLogExpanded = false;
let vvLogSearch = "";
let vvLogVisibleCount = 5; // how many activity entries are currently shown — grows by 5 as the user scrolls

