// ─── "SELECT YOUR OPTIONS" MODAL ──────────────────────────────────
// Voting now happens here instead of directly on the summary page: tap
// "Change vote" to open this, pick options (checkmarks toggle a LOCAL
// pending selection only), then tap Submit to actually save it.
// ─── RESTRICTED VOTER NAME (must match a Fixed/Casual member) ──────
// Guarantees at least one real fetch of the public member list has
// completed before we ever decide a typed name "doesn't match" — otherwise
// a slow connection could wrongly bounce a legit member into the
// request-to-add flow just because the realtime listener hadn't caught up yet.
let _membersLoadPromise = null;
function ensureMembersLoaded() {
  if (_membersLoadPromise) return _membersLoadPromise;
  _membersLoadPromise = new Promise((resolve) => {
    if (!fbReady()) {
      console.warn(
        "[name-picker] Firebase not configured/reachable — proceeding with an empty member list.",
      );
      return resolve();
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    // Safety net: Firebase rules not yet updated for MEMBERS_ROOT (or a slow
    // connection) must NOT hang the whole name flow forever — give up after
    // 5s and just proceed with whatever's in publicMembers so far.
    const timeout = setTimeout(() => {
      console.warn(
        "[name-picker] Timed out loading " +
          MEMBERS_ROOT +
          " from Firebase after 5s — check that your Firebase Realtime Database rules allow read access to this path.",
      );
      finish();
    }, 5000);
    fdb
      .ref(MEMBERS_ROOT)
      .once("value")
      .then((snap) => {
        clearTimeout(timeout);
        if (publicMembers.length === 0) {
          const val = snap.val() || {};
          publicMembers = Object.values(val);
        }
        finish();
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error(
          "[name-picker] Error reading " + MEMBERS_ROOT + " from Firebase:",
          err,
        );
        finish();
      });
  });
  return _membersLoadPromise;
}
// Looks up a typed name against the public (Firebase-synced) member list,
// accent/case-insensitive via the existing nameKey() helper.
function findMemberByTypedName(name) {
  const key = nameKey(name);
  return publicMembers.find((m) => !m.pending && nameKey(m.name) === key) || null;
}
let namePickerCallback = null; // called with (pickedName|null) when the picker resolves
// Resolves the name to use for a voting action (toggleVote/confirmVote/
// addVoterOption): returns the already-locked name if there is one, else
// validates whatever is typed in #vv-name against the member list. An exact
// (accent/case-insensitive) match resolves immediately; anything else opens
// the single-select picker modal instead of accepting the free-typed name.
// Resolves to `null` if the user cancels/hasn't typed anything valid yet.
async function resolveNameForAction() {
  console.log("[name-picker] resolveNameForAction() called");
  try {
    const lockedName = (ls("hl_voter_locked_name") || "").trim();
    if (lockedName) {
      console.log("[name-picker] already locked as:", lockedName);
      return lockedName;
    }
    const inp = document.getElementById("vv-name");
    const typed = inp ? inp.value.trim() : "";
    console.log("[name-picker] typed name:", JSON.stringify(typed));
    if (!typed) {
      showToast("Please enter your name before voting");
      if (inp) inp.focus();
      return null;
    }
    if (isNameBlocked(typed)) {
      console.log("[name-picker] blocked by isNameBlocked()");
      showToast("Invalid name");
      return null;
    }
    console.log("[name-picker] loading member list…");
    await ensureMembersLoaded();
    console.log("[name-picker] publicMembers:", publicMembers);
    const match = findMemberByTypedName(typed);
    console.log("[name-picker] match found:", match);
    if (match) {
      if (!(await resolveVoterIdentity(match.name))) return null;
      ss("hl_voter_locked_name", match.name);
      return match.name;
    }
    console.log("[name-picker] no match — opening picker modal");
    return new Promise((resolve) => {
      openNamePickerModal(typed, async (picked) => {
        try {
          if (!picked) {
            resolve(null);
            return;
          }
          if (!(await resolveVoterIdentity(picked))) {
            resolve(null);
            return;
          }
          ss("hl_voter_locked_name", picked);
          resolve(picked);
        } catch (err) {
          console.error("[name-picker] Error resolving picked name:", err);
          showToast("Something went wrong — please try again");
          resolve(null);
        }
      });
    });
  } catch (err) {
    console.error("[name-picker] resolveNameForAction failed:", err);
    showToast("Something went wrong — please try again");
    return null;
  }
}
function openNamePickerModal(typedQuery, callback) {
  const modalEl = document.getElementById("modal-name-picker");
  if (!modalEl) {
    console.error(
      "[name-picker] #modal-name-picker not found — index.html needs to be re-uploaded alongside script.js.",
    );
    showToast("App files out of date — please reload / contact admin");
    callback(null);
    return;
  }
  namePickerCallback = callback;
  const search = document.getElementById("np-search");
  const hint = document.getElementById("np-hint");
  if (search) search.value = typedQuery || "";
  if (hint)
    hint.textContent = typedQuery
      ? `"${typedQuery}" isn't in the member list yet — search and pick your name, or request to add it.`
      : "Search and pick your name from the member list.";
  renderNamePickerList(typedQuery || "");
  openModal("modal-name-picker");
  setTimeout(() => {
    if (search) search.focus();
  }, 0);
}
function closeNamePickerModal() {
  closeModal("modal-name-picker");
  if (namePickerCallback) {
    const cb = namePickerCallback;
    namePickerCallback = null;
    cb(null);
  }
}
// The generic ".modal-backdrop" click handler (wired up at script load) only
// removes the "open" class — it doesn't know this modal has a pending
// Promise waiting on a name. Without this, clicking outside the modal would
// leave resolveNameForAction() hanging forever instead of resolving to null.
// Guarded with a null-check: if index.html hasn't been updated to include
// the #modal-name-picker markup yet, this must NOT throw — a throw here
// would be a top-level (not inside a function) statement and would silently
// abort every bit of script.js below it on the page, breaking the whole app.
(function attachNamePickerBackdropListener() {
  const el = document.getElementById("modal-name-picker");
  if (!el) {
    console.error(
      "[name-picker] #modal-name-picker not found in the page — index.html is out of date (needs to be re-uploaded alongside script.js).",
    );
    return;
  }
  el.addEventListener("click", (e) => {
    if (e.target.id === "modal-name-picker") closeNamePickerModal();
  });
})();
function npRowHtml(m) {
  const tone = avatarToneFor(m);
  const av = defaultAvatarFor(m.name);
  const avatarHtml = av
    ? `<img src="${av}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : esc(initials(m.name));
  return `<div class="np-row" onclick="pickName('${m.id}')">
    <span class="np-row-avatar" style="background:${av ? "transparent" : tone.solid};overflow:hidden">${avatarHtml}</span>
    <span class="np-row-name">${esc(m.name)}</span>
  </div>`;
}
function renderNamePickerList(query) {
  const list = document.getElementById("np-list");
  if (!list) return;
  const q = (query || "").trim().toLowerCase();
  const pool = publicMembers.filter((m) => !m.pending);
  const filtered = q
    ? pool.filter((m) => m.name.toLowerCase().includes(q))
    : pool;
  const fixed = filtered.filter((m) => m.type === "fixed" || m.type === undefined);
  const casual = filtered.filter((m) => m.type === "casual");
  let html = "";
  if (fixed.length) html += fixed.map(npRowHtml).join("");
  if (casual.length) html += casual.map(npRowHtml).join("");
  if (!filtered.length)
    html += `<div class="ns-empty">No members found.</div>`;
  const trimmedQuery = (query || "").trim();
  html += `<div class="np-add-row" onclick="requestAddNewMember()">
    <span class="np-add-circle">+</span>
    <span class="np-add-label">${trimmedQuery ? `Can't find "${esc(trimmedQuery)}"? Request to add` : "Can't find your name? Request to add"}</span>
  </div>`;
  list.innerHTML = html;
}
function pickName(id) {
  const m = publicMembers.find((mm) => mm.id === id) || members.find((mm) => mm.id === id);
  if (!m) return;
  closeModal("modal-name-picker");
  const cb = namePickerCallback;
  namePickerCallback = null;
  if (cb) cb(m.name);
}
// A voter whose name genuinely isn't in the Fixed/Casual list yet can ask to
// be added — this does NOT create a confirmed member immediately; it's
// pushed to Firebase flagged `pending: true` so the admin sees it under
// "⏳ Pending approval" in the Members tab and can approve/reject it. The
// voter can keep voting under that name right away; nothing changes for them
// once approved (they were already using the requested name).
async function requestAddNewMember() {
  const searchEl = document.getElementById("np-search");
  const prefill = searchEl ? searchEl.value.trim() : "";
  const typed = await showPrompt({
    title: "Request to add your name",
    label: prefill
      ? `Confirm the name to request (found: "${prefill}")`
      : "Your full name",
    placeholder: "Enter your full name…",
    confirmText: "Send request",
  });
  if (typed === null) return;
  const trimmed = typed.trim();
  if (!trimmed) {
    showToast("Please enter your name");
    return;
  }
  if (isNameBlocked(trimmed)) {
    showToast("Invalid name");
    return;
  }
  // If it actually matches an existing member after all, just use that
  // instead of creating a duplicate pending request.
  const existing = findMemberByTypedName(trimmed);
  if (existing) {
    closeModal("modal-name-picker");
    const cb = namePickerCallback;
    namePickerCallback = null;
    if (cb) cb(existing.name);
    return;
  }
  const entry = { id: uid(), name: trimmed, type: "casual", pending: true };
  publicMembers.push(entry);
  if (fbReady()) {
    fdb
      .ref(MEMBERS_ROOT + "/" + entry.id)
      .set(entry)
      .catch((err) => console.error(err));
  }
  closeModal("modal-name-picker");
  showToast(`Sent — waiting for admin approval to add "${trimmed}"`);
  const cb = namePickerCallback;
  namePickerCallback = null;
  if (cb) cb(trimmed);
}

function openVoterSelectModal() {
  if (!voterPoll) return;
  if (voterPoll.status !== "open") {
    showToast("This vote is closed");
    return;
  }
  vvShowAddOptionInput = false;
  ensurePendingChoices(voterPid, voteChoices(getMyVoteEntry()));
  renderVoterSelectModal();
  openModal("modal-voter-select");
}
function closeVoterSelectModal() {
  if (voteDelayActive) {
    showToast("Please wait — your submission is still being applied…");
    return;
  }
  // Discard any un-submitted taps made inside the modal
  vvPendingChoices = new Set(voteChoices(getMyVoteEntry()));
  vvShowAddOptionInput = false;
  closeModal("modal-voter-select");
}
function renderVoterSelectModal() {
  if (!voterPoll) return;
  const p = voterPoll;
  const open = p.status === "open";
  const lockedName = (ls("hl_voter_locked_name") || "").trim();
  const curInput = document.getElementById("vv-name");
  const nameVal = lockedName ? lockedName : curInput ? curInput.value : "";
  const myVoteEntry = getMyVoteEntry();
  const myAvatar =
    (myVoteEntry && myVoteEntry.avatar) ||
    ls("hl_voter_avatar") ||
    defaultAvatarFor(nameVal) ||
    null;
  ensurePendingChoices(voterPid, voteChoices(myVoteEntry));
  const myChoices = Array.from(vvPendingChoices);
  const groups = pollVotesByOption(p);
  const avatarPreview = myAvatar
    ? `<img src="${myAvatar}" alt="" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0">`
    : `<div style="width:34px;height:34px;border-radius:50%;background:var(--bg);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--muted);flex-shrink:0">${esc(initials(lockedName || "?"))}</div>`;
  const nameBox = lockedName
    ? `<div class="vv-name-box">
        <label class="field-label">Voting as</label>
        <div style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:12px 14px">
          <div onclick="pickVoterAvatar()" style="position:relative;cursor:pointer;flex-shrink:0" title="Add/change your photo (optional)">
            ${avatarPreview}
            <span style="position:absolute;bottom:-2px;right:-2px;background:var(--surface);border:1px solid var(--border);border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1">📷</span>
          </div>
          <span style="font-size:15px;font-weight:600;flex:1">${esc(lockedName)}</span>
        </div>
        <div style="font-size:11px;color:var(--hint);margin-top:4px">Wrong name? Ask the club admin to fix it for you.</div>
        ${myAvatar ? `<div style="text-align:right;margin-top:4px"><span onclick="removeVoterAvatar()" style="font-size:11px;color:var(--hint);cursor:pointer;text-decoration:underline">Remove photo</span></div>` : ""}
      </div>`
    : `<div class="vv-name-box">
        <label class="field-label">Your name <span style="color:var(--coral-m)">*</span></label>
        <div style="display:flex;align-items:center;gap:10px">
          <div onclick="pickVoterAvatar()" style="position:relative;cursor:pointer;flex-shrink:0" title="Add/change your photo (optional)">
            ${avatarPreview}
            <span style="position:absolute;bottom:-2px;right:-2px;background:var(--surface);border:1px solid var(--border);border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1">📷</span>
          </div>
          <input type="text" id="vv-name" placeholder="Type your name (must match a club member)…" maxlength="30" autocomplete="off" value="${esc(nameVal)}" oninput="renderVoterNameHint()" style="flex:1">
        </div>
        ${myAvatar ? `<div style="text-align:right;margin-top:4px"><span onclick="removeVoterAvatar()" style="font-size:11px;color:var(--hint);cursor:pointer;text-decoration:underline">Remove photo</span></div>` : ""}
      </div>`;
  const addOptionBox = open
    ? vvShowAddOptionInput
      ? `<div class="fb-opt fb-opt-editing">
          <span class="fb-check"></span>
          <input type="text" id="vv-new-option" maxlength="30" autocomplete="off"
            style="flex:1;border:none;background:transparent;padding:0;font-size:15px;font-weight:500;color:var(--text)"
            onkeydown="if(event.key==='Enter'){this.blur();} if(event.key==='Escape'){this.dataset.cancel='1';this.blur();}"
            onblur="handleAddOptionBlur(this)">
        </div>`
      : `<div class="fb-add-option" onclick="showAddOptionField()">
          <span class="fb-add-circle">+</span>
          <span class="fb-add-label">Add option…</span>
        </div>`
    : "";
  const modalBody = document.getElementById("vv-modal-body");
  if (modalBody) {
    modalBody.innerHTML = `
      ${nameBox}
      ${groups.map((g) => fbOptRow(g, myChoices, open)).join("")}
      ${addOptionBox}
      <div style="text-align:center;font-size:12px;color:var(--muted);margin-top:8px">${open ? "" : "This vote is closed"}</div>
    `;
  }
  const remainingDelay =
    voteDelayActive && voteDelayEndsAt
      ? Math.max(0, Math.ceil((voteDelayEndsAt - Date.now()) / 1000))
      : 0;
  const submitBtn = document.getElementById("vv-modal-submit-btn");
  const cancelBtn = document.getElementById("vv-modal-cancel-btn");
  if (submitBtn) {
    submitBtn.disabled = voteDelayActive || !open;
    submitBtn.textContent = voteDelayActive
      ? `⏳ Applying in ${remainingDelay}s…`
      : "Submit";
  }
  if (cancelBtn) cancelBtn.disabled = voteDelayActive;
}

// Expands the "+ Add option" row into an inline text field styled exactly
// like the other checkbox rows (focused automatically, no placeholder).
function showAddOptionField() {
  vvShowAddOptionInput = true;
  renderVoterSelectModal();
  setTimeout(() => {
    const inp = document.getElementById("vv-new-option");
    if (inp) inp.focus();
  }, 0);
}
// Collapses the inline text field back into the "+ Add option" row.
function cancelAddOptionField() {
  vvShowAddOptionInput = false;
  renderVoterSelectModal();
}
// No explicit confirm/cancel buttons: leaving the field (blur) is what commits
// it. Typed something → save it as a new option. Left empty (or Escape was
// pressed) → just collapse back to the "+ Add option" row.
function handleAddOptionBlur(inputEl) {
  const cancelled = inputEl && inputEl.dataset.cancel === "1";
  const val = inputEl ? inputEl.value.trim() : "";
  setTimeout(() => {
    if (!vvShowAddOptionInput) return; // already handled elsewhere
    if (cancelled || !val) {
      cancelAddOptionField();
    } else {
      addVoterOption();
    }
  }, 100);
}

// Members can suggest a new vote option from the public vote page itself,
// but can't rename or delete any option (only the admin can, from the
// Create/Edit Vote card). Pushed as its own Firebase child so two people
// adding an option at the same time never overwrite each other.
async function addVoterOption() {
  if (!voterPoll || voterPoll.status !== "open") {
    showToast("This vote is closed");
    return;
  }
  const inp = document.getElementById("vv-new-option");
  const label = inp ? inp.value.trim() : "";
  if (!label) {
    showToast("Enter an option label first");
    return;
  }
  const existing = pollOptions(voterPoll);
  if (existing.some((o) => nameKey(o.label) === nameKey(label))) {
    showToast("That option already exists");
    return;
  }
  // Resolves to the locked name if there is one, otherwise validates whatever
  // is typed in "Your name" against the member list (opening the picker if it
  // doesn't match) — see resolveNameForAction().
  const voterName = await resolveNameForAction();
  if (!voterName) return;
  const ref = fdb.ref(POLLS_ROOT + "/" + voterPid + "/options").push();
  ref
    .set({ id: ref.key, label, addedBy: voterName, at: Date.now() })
    .then(() => {
      if (inp) inp.value = "";
      // Auto-select the option this device just created, so the user doesn't
      // have to tap it again before hitting Submit.
      ensurePendingChoices(voterPid, voteChoices(getMyVoteEntry()));
      vvPendingChoices.add(ref.key);
      vvShowAddOptionInput = false;
      renderVoterSelectModal();
      showToast("Option added");
      logVoteEvent(voterPid, voterName, `added new option "${label}"`);
    })
    .catch((err) => {
      console.error(err);
      showToast(
        "Error: " + (err && err.message ? err.message : "couldn't connect"),
      );
    });
}

function renderVoterNameHint() {
  // Don't re-render everything (avoid losing focus while typing) — light update only if needed later
}


// Tapping an option only changes the LOCAL pending selection — nothing is
// written to Firebase until the member taps "Confirm selection". This avoids
// a network write (and a throttle "attempt") per tap, and lets people freely
// change their mind before locking it in.
//
// Anti-spam throttle: each device gets 4 free CONFIRM taps per poll. From the
// 5th confirm onward, it's queued and applied after a growing delay — 10s on
// the 5th, 20s on the 6th, 30s on the 7th, and so on — instead of firing
// immediately. This is a best-effort client-side limit (not server-enforced).
let voteDelayActive = false;
let voteDelayEndsAt = null; // timestamp the current delay finishes, else null
let voteDelayTimer = null; // interval id driving the live countdown in the UI
let vvPendingChoices = null; // Set of optionIds selected locally but not yet confirmed
let vvPendingBasePid = null; // which poll vvPendingChoices belongs to
let vvShowAddOptionInput = false; // whether the "+ Add option" row has expanded into a text field
function voteAttemptKey(pid) {
  return "hl_vote_attempts_" + pid;
}
// Returns this device's own vote entry from the (realtime) poll data.
function getMyVoteEntry() {
  if (!voterPoll) return null;
  const lockedName = (ls("hl_voter_locked_name") || "").trim();
  const curInput = document.getElementById("vv-name");
  const nameVal = lockedName ? lockedName : curInput ? curInput.value : "";
  const myDevId = effectiveDevId(voterPid);
  const legacyKey = nameVal.trim() ? nameKey(nameVal) : null;
  return (
    (voterPoll.votes && voterPoll.votes[myDevId]) ||
    (legacyKey && voterPoll.votes && voterPoll.votes[legacyKey]) ||
    null
  );
}
// Called right before a name is locked in for the first time on this device.
// If that name already belongs to a DIFFERENT device on this poll, ask
// whether that's actually the same person — if confirmed, this device
// "becomes" that existing entry (same choices, same everything) instead of
// creating a second, duplicate-named voter. Returns true to proceed with the
// name as-is, false to abort (caller should not lock the name yet).
async function resolveVoterIdentity(name) {
  const myDevId = getDeviceId();
  const votes = (voterPoll && voterPoll.votes) || {};
  const key = nameKey(name);
  const dup = Object.entries(votes).find(
    ([devId, v]) => devId !== myDevId && nameKey(v.name) === key,
  );
  if (!dup) return true;
  const takeOver = await showConfirm({
    title: "Name already used",
    tone: "info",
    message: `"${name}" is already used by another voter on this poll. If that's you, we'll use their existing selections instead of creating a duplicate "${name}". Continue as the same person?`,
    yesText: "Yes, that's me",
    noText: "Pick another name",
  });
  if (!takeOver) return false;
  ss("hl_adopted_id_" + voterPid, dup[0]);
  return true;
}
// (Re)seeds the pending-selection state from the committed server vote —
// only when we don't have one yet, or we've switched to a different poll.
// This is what lets vvPendingChoices survive realtime re-renders while the
// member is still deciding, without ever clobbering an in-progress edit.
function ensurePendingChoices(pid, committed) {
  if (vvPendingBasePid !== pid || vvPendingChoices === null) {
    vvPendingChoices = new Set(committed);
    vvPendingBasePid = pid;
  }
}
async function toggleVote(optionId) {
  if (!voterPoll || voterPoll.status !== "open") {
    showToast("This vote is closed");
    return;
  }
  const name = await resolveNameForAction();
  if (!name) return;
  ensurePendingChoices(voterPid, voteChoices(getMyVoteEntry()));
  if (vvPendingChoices.has(optionId)) vvPendingChoices.delete(optionId);
  else vvPendingChoices.add(optionId);
  renderVoterSelectModal();
}
// Locks in the pending selection — this is the actual "vote attempt" that
// counts toward the 4-free / growing-delay throttle.
async function confirmVote() {
  console.log("[name-picker] confirmVote() called, poll status:", voterPoll && voterPoll.status);
  if (!voterPoll || voterPoll.status !== "open") {
    showToast("This vote is closed");
    return;
  }
  if (voteDelayActive) {
    showToast(
      "Please wait — your previous confirmation is still being applied…",
    );
    return;
  }
  if (!vvPendingChoices) return;
  const name = await resolveNameForAction();
  if (!name) return;
  const choices = Array.from(vvPendingChoices);
  const key = voteAttemptKey(voterPid);
  const attempt = (ls(key) || 0) + 1;
  ss(key, attempt);
  const delaySec = attempt > 4 ? (attempt - 4) * 10 : 0;
  if (delaySec > 0) {
    voteDelayActive = true;
    voteDelayEndsAt = Date.now() + delaySec * 1000;
    showToast(`Vote limit reached — applying your selection in ${delaySec}s…`);
    if (voteDelayTimer) clearInterval(voteDelayTimer);
    voteDelayTimer = setInterval(() => {
      if (!voteDelayActive) {
        clearInterval(voteDelayTimer);
        voteDelayTimer = null;
        return;
      }
      renderVoterSelectModal();
    }, 1000);
    renderVoterSelectModal();
    setTimeout(() => {
      voteDelayActive = false;
      voteDelayEndsAt = null;
      if (voteDelayTimer) {
        clearInterval(voteDelayTimer);
        voteDelayTimer = null;
      }
      submitVote(choices, name);
    }, delaySec * 1000);
  } else {
    submitVote(choices, name);
  }
}
function submitVote(choices, name) {
  const devId = effectiveDevId(voterPid);
  const existing = (voterPoll.votes && voterPoll.votes[devId]) || null;
  const previous = voteChoices(existing);
  // Keep whatever avatar is already on this vote entry; if none yet, fall back to
  // whatever photo this device last uploaded on any poll (avoids re-uploading every time).
  const avatar = (existing && existing.avatar) || ls("hl_voter_avatar") || null;
  // Votes are keyed by deviceId (fixed, doesn't change when the name is changed) →
  // each device only ever has 1 vote record per poll, no matter how many times "Not you?" is used.
  fdb
    .ref(POLLS_ROOT + "/" + voterPid + "/votes/" + devId)
    .set({ name, choices, at: Date.now(), nameKey: nameKey(name), avatar })
    .then(() => {
      const optsAll = pollOptions(voterPoll);
      const added = choices.filter((c) => !previous.includes(c));
      const removed = previous.filter((c) => !choices.includes(c));
      showToast(
        added.length || removed.length
          ? "Vote confirmed"
          : "No changes to confirm",
      );
      if (existing && existing.name && existing.name !== name) {
        logVoteEvent(
          voterPid,
          name,
          `changed their name from "${existing.name}"`,
        );
      }
      const addedLabels = added
        .map((oid) => {
          const opt = optsAll.find((o) => o.id === oid);
          return opt ? opt.label : null;
        })
        .filter(Boolean);
      const removedLabels = removed
        .map((oid) => {
          const opt = optsAll.find((o) => o.id === oid);
          return opt ? opt.label : null;
        })
        .filter(Boolean);
      logVoteChangeEvent(voterPid, name, addedLabels, removedLabels);
      closeModal("modal-voter-select");
      renderVoterView();
    })
    .catch((err) => {
      console.error(err);
      showToast(
        "Error: " + (err && err.message ? err.message : "couldn't connect"),
      );
    });
}

