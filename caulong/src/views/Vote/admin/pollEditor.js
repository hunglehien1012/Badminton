// ─── Poll options editor (used inside the Create/Edit Vote card) ──
let tempPollOptions = DEFAULT_POLL_OPTIONS.map((o) => ({ ...o }));
// Which container/input the shared options-editor functions below should
// target. There are THREE separate places that show an options editor (admin
// Vote tab, the public "Create your own vote" modal, and the self-serve
// "Manage vote" page) — each must use its OWN element ids, otherwise
// document.getElementById() always resolves to whichever one appears first
// in the page, silently rendering into the wrong (often hidden) container.
// Whoever opens an options editor should set these two ids first.
let pollOptionsWrapId = "vp-options";
let pollNewOptionInputId = "vp-new-option-label";
// Whether the "+ Add option" row is currently expanded into an inline text
// field — mirrors vvShowAddOptionInput on the voter "Select your options"
// modal, so both places look and behave identically.
let pollAddOptionEditing = false;
// Whether the options above can be tapped to select/deselect them (used by
// the "Create your own vote" modal so the host can already vote for
// themself while creating, without needing to reopen the vote afterwards).
let pollOptionsSelectable = false;
let pollSelectedOptionIds = new Set();
function togglePollOptionSelection(oid) {
  if (!pollOptionsSelectable) return;
  if (pollSelectedOptionIds.has(oid)) pollSelectedOptionIds.delete(oid);
  else pollSelectedOptionIds.add(oid);
  renderPollOptionsEditor();
}

// Inline line-icon set matching the "Create Vote" admin redesign mock —
// replaces emoji glyphs so the vote-tab buttons render identically across
// platforms/fonts instead of relying on each OS's emoji artwork.
const ICON_X = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B5BAAF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const ICON_LINK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7368" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"></path><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"></path></svg>`;
const ICON_EDIT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7368" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path></svg>`;
const ICON_LOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7368" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 018 0v4"></path></svg>`;
const ICON_REMOVE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7368" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="5.5" y1="18.5" x2="18.5" y2="5.5"></line></svg>`;
const ICON_CLEAR = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7368" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"></path><path d="M8.5 20L18 10.5a2.1 2.1 0 000-3l-1.5-1.5a2.1 2.1 0 00-3 0L4 15.5V20h4.5z"></path><path d="M13.5 7L17 10.5"></path></svg>`;
const ICON_TRASH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"></path></svg>`;
const ICON_CHECK = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>`;
const ICON_PLUS = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

function renderPollOptionsEditor() {
  const wrap = document.getElementById(pollOptionsWrapId);
  if (!wrap) return;
  const rows = tempPollOptions
    .map((o) => {
      const sel = pollOptionsSelectable && pollSelectedOptionIds.has(o.id);
      return `
    <div class="fb-opt vp-opt-edit ${pollOptionsSelectable ? "selectable" : ""} ${sel ? "sel" : ""}"
      ${pollOptionsSelectable ? `onclick="togglePollOptionSelection('${o.id}')"` : ""}>
      <span class="fb-check">${sel ? "✓" : ""}</span>
      <input type="text" value="${esc(o.label)}" maxlength="30" placeholder="Option label…"
        style="flex:1;border:none;background:transparent;padding:0;font-size:15px;font-weight:500;color:var(--text)"
        onclick="event.stopPropagation()"
        oninput="updatePollOptionField('${o.id}','label',this.value)">
      <button class="btn-icon vp-option-del" onclick="event.stopPropagation();removePollOption('${o.id}')" title="Delete option"
        ${tempPollOptions.length <= 1 ? 'disabled style="opacity:.3;cursor:not-allowed"' : ""}>${ICON_X}</button>
    </div>`;
    })
    .join("");
  const addRow = pollAddOptionEditing
    ? `<div class="fb-opt fb-opt-editing">
        <span class="fb-check"></span>
        <input type="text" id="${pollNewOptionInputId}" maxlength="30" autocomplete="off"
          style="flex:1;border:none;background:transparent;padding:0;font-size:15px;font-weight:500;color:var(--text)"
          onkeydown="if(event.key==='Enter'){this.blur();} if(event.key==='Escape'){this.dataset.cancel='1';this.blur();}"
          onblur="handlePollAddOptionBlur(this)">
      </div>`
    : `<div class="fb-add-option" onclick="showPollAddOptionField()">
        <span class="fb-add-circle">+</span>
        <span class="fb-add-label">Add option…</span>
      </div>`;
  wrap.innerHTML = rows + addRow;
}

function updatePollOptionField(oid, field, value) {
  const o = tempPollOptions.find((x) => x.id === oid);
  if (o) o[field] = value;
}

// Members can now select MULTIPLE options per poll (e.g. "Join" + "+2").
// Votes are stored as `choices: [optionId, ...]`. Older votes saved before this
// feature used a single `choice: optionId` string — this reads both formats.
function voteChoices(v) {
  if (!v) return [];
  if (Array.isArray(v.choices)) return v.choices;
  if (v.choice) return [v.choice];
  return [];
}

async function removePollOption(oid) {
  if (tempPollOptions.length <= 1) return;
  // Warn if people already voted for this option on the poll being edited
  if (editingPollId) {
    const p = pollsCache[editingPollId];
    const voteCount =
      p && p.votes
        ? mergedPollVotes(p).filter((v) => voteChoices(v).includes(oid)).length
        : 0;
    if (voteCount > 0) {
      const ok = await showConfirm({
        title: "Delete option",
        message: `${voteCount} member(s) already voted for this option. Delete it anyway? Their votes will stay recorded but won't match a visible option anymore.`,
        yesText: "Delete anyway",
        noText: "Cancel",
      });
      if (!ok) return;
    }
  }
  tempPollOptions = tempPollOptions.filter((o) => o.id !== oid);
  pollSelectedOptionIds.delete(oid);
  renderPollOptionsEditor();
}

// Expands the "+ Add option" row into an inline text field, styled exactly
// like the existing option rows above it (same component used on the voter
// "Select your options" modal — see showAddOptionField()).
function showPollAddOptionField() {
  pollAddOptionEditing = true;
  renderPollOptionsEditor();
  setTimeout(() => {
    const inp = document.getElementById(pollNewOptionInputId);
    if (inp) inp.focus();
  }, 0);
}
function cancelPollAddOptionField() {
  pollAddOptionEditing = false;
  renderPollOptionsEditor();
}
// No explicit confirm/cancel buttons: leaving the field (blur) is what
// commits it. Typed something → add it as a new option. Left empty (or
// Escape was pressed) → just collapse back to the "+ Add option" row.
function handlePollAddOptionBlur(inputEl) {
  const cancelled = inputEl && inputEl.dataset.cancel === "1";
  const val = inputEl ? inputEl.value.trim() : "";
  setTimeout(() => {
    if (!pollAddOptionEditing) return; // already handled elsewhere
    if (cancelled || !val) {
      cancelPollAddOptionField();
    } else {
      tempPollOptions.push({ id: uid(), label: val });
      pollAddOptionEditing = false;
      renderPollOptionsEditor();
    }
  }, 100);
}

function renderVotePage() {
  const warn = document.getElementById("vote-setup-warn");
  const create = document.getElementById("vote-create-card");
  if (!fbReady()) {
    warn.style.display = "block";
    create.style.display = "none";
    document.getElementById("poll-list").innerHTML = "";
    return;
  }
  warn.style.display = "none";
  create.style.display = "block";
  if (!document.getElementById("vp-date").value) {
    document.getElementById("vp-date").value = new Date()
      .toISOString()
      .slice(0, 10);
  }
  pollOptionsWrapId = "vp-options";
  pollNewOptionInputId = "vp-new-option-label";
  pollAddOptionEditing = false;
  pollOptionsSelectable = false;
  pollSelectedOptionIds = new Set();
  listenPolls();
  renderPollOptionsEditor();
  renderPollList();
}

async function listenPolls() {
  if (pollsListenerOn || !fbReady()) return;
  pollsListenerOn = true;
  await ensureFirebaseAuth();
  fdb.ref(POLLS_ROOT).on(
    "value",
    (snap) => {
      pollsCache = snap.val() || {};
      if (document.getElementById("tab-vote").classList.contains("active"))
        renderPollList();
    },
    (err) => {
      console.error(err);
      showToast("Couldn't load vote data (check Firebase Rules)");
    },
  );
}

function createPoll() {
  if (!fbReady()) {
    showToast("Firebase isn't configured");
    return;
  }
  const date = document.getElementById("vp-date").value;
  if (!date) {
    showToast("Pick a date first");
    return;
  }
  const note = document.getElementById("vp-note").value.trim();
  const address = document.getElementById("vp-address").value.trim();
  const mapsUrl = document.getElementById("vp-maps-link").value.trim();
  const organizer = document.getElementById("vp-organizer").value.trim();
  const options = tempPollOptions
    .map((o) => ({
      id: o.id,
      label: o.label.trim(),
    }))
    .filter((o) => o.label);
  if (options.length === 0) {
    showToast("Add at least 1 vote option");
    return;
  }

  if (editingPollId) {
    // Editing an existing poll: update date/note/options, keep all votes as-is
    fdb
      .ref(POLLS_ROOT + "/" + editingPollId)
      .update({ date, note, address, mapsUrl, organizer, options })
      .then(() => {
        showToast("Vote updated");
        cancelEditPoll();
      })
      .catch((err) => {
        console.error(err);
        showToast(
          "Error: " + (err && err.message ? err.message : "couldn't connect"),
        );
      });
    return;
  }

  const ref = fdb.ref(POLLS_ROOT).push();
  ref
    .set({
      date,
      note,
      address,
      mapsUrl,
      organizer,
      createdAt: Date.now(),
      status: "open",
      memberNames: members.map((m) => m.name),
      options,
    })
    .then(() => {
      document.getElementById("vp-note").value = "";
      document.getElementById("vp-address").value = "";
      document.getElementById("vp-maps-link").value = "";
      document.getElementById("vp-organizer").value = "";
      showToast("Vote created");
      copyPollLink(ref.key, true);
    })
    .catch((err) => {
      console.error(err);
      showToast(
        "Error: " +
          (err && err.message ? err.message : "couldn't connect to Firebase"),
      );
    });
}

function editPoll(pid) {
  const p = pollsCache[pid];
  if (!p) return;
  editingPollId = pid;
  document.getElementById("vp-date").value = p.date || "";
  document.getElementById("vp-note").value = p.note || "";
  document.getElementById("vp-address").value = p.address || "";
  document.getElementById("vp-maps-link").value = p.mapsUrl || "";
  document.getElementById("vp-organizer").value = p.organizer || "";
  tempPollOptions = pollOptions(p).map((o) => ({ ...o }));
  renderPollOptionsEditor();
  document.getElementById("vote-create-title").textContent = "✏️ Edit Vote";
  document.getElementById("vote-create-btn").textContent = "Save Changes";
  document.getElementById("vote-create-cancel").style.display = "inline-flex";
  document
    .getElementById("vote-create-card")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEditPoll() {
  editingPollId = null;
  document.getElementById("vp-date").value = new Date()
    .toISOString()
    .slice(0, 10);
  document.getElementById("vp-note").value = "";
  document.getElementById("vp-address").value = "";
  document.getElementById("vp-maps-link").value = "";
  document.getElementById("vp-organizer").value = "";
  tempPollOptions = DEFAULT_POLL_OPTIONS.map((o) => ({ ...o }));
  renderPollOptionsEditor();
  document.getElementById("vote-create-title").textContent = "Create Vote";
  document.getElementById("vote-create-btn").innerHTML = `${ICON_PLUS}<span>Create Vote</span>`;
  document.getElementById("vote-create-cancel").style.display = "none";
}

function pollLink(pid) {
  return location.origin + location.pathname + "?poll=" + pid;
}
function copyPollLink(pid, silent) {
  const url = pollLink(pid);
  const done = () =>
    showToast(silent ? "Vote link copied — share it with the group" : "Copied");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(url)
      .then(done)
      .catch(() => prompt("Copy vote link:", url));
  } else {
    prompt("Copy vote link:", url);
  }
}
// Self-serve hosting: link a creator uses to edit/close/delete their OWN
// vote later (see initHostManageView). Different from pollLink, which is
// the link members use to actually vote.
function manageLink(pid) {
  return location.origin + location.pathname + "?manage=" + pid;
}
function copyManageLink(pid, silent) {
  const url = manageLink(pid);
  const done = () => showToast(silent ? t("manageLinkCopied") : t("copied"));
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(url)
      .then(done)
      .catch(() => prompt("Copy manage link:", url));
  } else {
    prompt("Copy manage link:", url);
  }
}

function togglePollStatus(pid) {
  const p = pollsCache[pid];
  if (!p || !fbReady()) return;
  fdb
    .ref(POLLS_ROOT + "/" + pid + "/status")
    .set(p.status === "open" ? "closed" : "open");
}
async function deletePoll(pid) {
  if (
    !(await showConfirm({
      title: "Delete vote",
      message: "Delete this vote? All vote data will be lost.",
      yesText: "Yes!",
      noText: "No, keep it",
    }))
  )
    return;
  fdb
    .ref(POLLS_ROOT + "/" + pid)
    .remove()
    .then(() => showToast("Vote deleted"));
}
function togglePollExpand(pid) {
  pollExpanded[pid] = !pollExpanded[pid];
  renderPollList();
}

// Same real person can end up with two different vote entries when they use
// two devices — e.g. one device picked their day, another only tagged a
// "+1" guest option, or they simply voted twice by mistake. Rather than
// showing up as two different people everywhere (Vote tab chips, avatar
// stacks, Participants tab, session creation…), we fold same-name entries
// into ONE before anything reads p.votes. Choices are unioned; whichever
// record was created FIRST (earlier `at` timestamp) is kept as the
// canonical one (its name casing wins), but an avatar from either record is
// kept if the earlier one didn't set one.
function mergedPollVotes(p) {
  const raw = p && p.votes ? Object.values(p.votes) : [];
  const byName = new Map(); // nameKey -> merged entry
  raw.forEach((v) => {
    const key = nameKey(v.name);
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, { ...v, choices: voteChoices(v) });
      return;
    }
    const earlier = (prev.at || 0) <= (v.at || 0) ? prev : v;
    const later = earlier === prev ? v : prev;
    const choices = Array.from(
      new Set([...voteChoices(prev), ...voteChoices(v)]),
    );
    byName.set(key, {
      ...earlier,
      choices,
      avatar: earlier.avatar || later.avatar,
    });
  });
  return Array.from(byName.values()).map((v) => ({
    ...v,
    avatar: v.avatar || defaultAvatarFor(v.name),
  }));
}
// Returns votes grouped by each option defined on the poll (or the defaults for old polls)
function pollVotesByOption(p) {
  const votes = mergedPollVotes(p);
  return pollOptions(p).map((o, i) => ({
    ...o,
    tone: optColor(i),
    votes: votes
      .filter((v) => voteChoices(v).includes(o.id))
      .sort((a, b) => (a.at || 0) - (b.at || 0)),
  }));
}
// Votes for one specific option id (e.g. the default "in" / Join option)
function pollVotesFor(p, optionId) {
  const votes = mergedPollVotes(p);
  return votes
    .filter((v) => voteChoices(v).includes(optionId))
    .sort((a, b) => (a.at || 0) - (b.at || 0));
}

