// ─── ACTIVITY LOG (visible to every member, not just admin) ──────
// Every vote toggle / name change / new-option suggestion gets pushed here so
// anyone with the vote link can see who changed what and when, searchable by name.
function pollLogs(p) {
  const logs = p && p.logs ? Object.values(p.logs) : [];
  return logs.sort((a, b) => (b.at || 0) - (a.at || 0));
}
function logVoteEvent(pid, name, action) {
  if (!fbReady() || !pid) return;
  fdb
    .ref(POLLS_ROOT + "/" + pid + "/logs")
    .push()
    .set({ name: name || "Someone", action, at: Date.now() })
    .catch((err) => console.error("Log write failed", err));
}
// One Submit tap = one log entry, even if several options were toggled at
// once — e.g. "Brian selected: Option A, Option C" instead of two separate
// lines. `added`/`removed` are arrays of option LABELS (already resolved at
// submit time so the log stays accurate even if an option is later renamed).
function logVoteChangeEvent(pid, name, added, removed) {
  if (!fbReady() || !pid) return;
  if ((!added || !added.length) && (!removed || !removed.length)) return;
  fdb
    .ref(POLLS_ROOT + "/" + pid + "/logs")
    .push()
    .set({
      name: name || "Someone",
      selected: added && added.length ? added : null,
      unselected: removed && removed.length ? removed : null,
      at: Date.now(),
    })
    .catch((err) => console.error("Log write failed", err));
}
function formatLogTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
// Renders the body of one activity entry (everything after the bold name).
// New-style entries (one per Submit tap) carry `selected`/`unselected` label
// arrays, rendered as a numbered list with each option bolded. Older entries
// (name changes, suggested options, and logs written before this feature)
// only have a plain `action` string, rendered as before.
function renderLogEntryBody(l) {
  if (l.selected || l.unselected) {
    let out = "";
    if (l.selected && l.selected.length) {
      out += `selected:<ol style="margin:4px 0 4px 18px;padding:0">${l.selected.map((label) => `<li><b>${esc(label)}</b></li>`).join("")}</ol>`;
    }
    if (l.unselected && l.unselected.length) {
      out += `unselected:<ol style="margin:4px 0 4px 18px;padding:0">${l.unselected.map((label) => `<li><b>${esc(label)}</b></li>`).join("")}</ol>`;
    }
    return out;
  }
  return esc(l.action || "");
}
function renderLogListHtml(logs, search) {
  const q = (search || "").trim().toLowerCase();
  const filtered = q
    ? logs.filter((l) => (l.name || "").toLowerCase().includes(q))
    : logs;
  if (filtered.length === 0) {
    return '<div style="font-size:12px;color:var(--hint);text-align:center;padding:8px 0">No activity yet.</div>';
  }
  const visible = filtered.slice(0, vvLogVisibleCount);
  let html = visible
    .map(
      (l) => `
    <div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="font-weight:600">${esc(l.name || "Someone")}</span> ${renderLogEntryBody(l)}
      <div style="color:var(--hint);font-size:10px;margin-top:1px">${formatLogTime(l.at)}</div>
    </div>`,
    )
    .join("");
  if (visible.length < filtered.length) {
    html += `<div style="text-align:center;padding:6px 0"><span onclick="event.stopPropagation();loadMoreActivity()" style="font-size:11px;color:var(--hint);text-decoration:underline;cursor:pointer">Load more</span></div>`;
  }
  return html;
}
function toggleVoteLog() {
  vvLogExpanded = !vvLogExpanded;
  if (vvLogExpanded) vvLogVisibleCount = 5;
  renderVoterView();
}
function filterVoteLog(value) {
  vvLogSearch = value;
  vvLogVisibleCount = 5;
  const listEl = document.getElementById("vv-log-list");
  if (listEl)
    listEl.innerHTML = renderLogListHtml(pollLogs(voterPoll), vvLogSearch);
}
// Explicit "Load more" trigger — the reliable way to reveal 5 more entries.
// (Scroll-to-bottom alone isn't enough here: with only 5 entries the box
// often isn't tall enough to actually produce a scrollbar, so a scroll event
// never fires and nothing loads. The button always works regardless.)
function loadMoreActivity() {
  const q = (vvLogSearch || "").trim().toLowerCase();
  const logs = pollLogs(voterPoll);
  const filtered = q
    ? logs.filter((l) => (l.name || "").toLowerCase().includes(q))
    : logs;
  if (vvLogVisibleCount >= filtered.length) return;
  vvLogVisibleCount += 5;
  const listEl = document.getElementById("vv-log-list");
  if (listEl) listEl.innerHTML = renderLogListHtml(logs, vvLogSearch);
}
// Infinite-scroll: also reveals 5 more entries once the user scrolls near the
// bottom of the activity list, for the case where there are enough entries to
// actually make the box scrollable. Preserves scroll position on re-render.
function handleActivityScroll(el) {
  if (el.scrollTop + el.clientHeight < el.scrollHeight - 20) return;
  const q = (vvLogSearch || "").trim().toLowerCase();
  const logs = pollLogs(voterPoll);
  const filtered = q
    ? logs.filter((l) => (l.name || "").toLowerCase().includes(q))
    : logs;
  if (vvLogVisibleCount >= filtered.length) return;
  vvLogVisibleCount += 5;
  const scrollPos = el.scrollTop;
  el.innerHTML = renderLogListHtml(logs, vvLogSearch);
  el.scrollTop = scrollPos;
}

const migratedLegacyVotePolls = new Set();

// Legacy data migration (before switching to deviceId-based vote keys): if this
// device previously locked a name and the poll has an old vote stored under
// nameKey matching it but no deviceId-keyed vote yet, move it over (and remove
// the old key) so the device isn't asked to vote again / doesn't get double counted.
function migrateLegacyVote(pid, p) {
  if (!pid || !p || migratedLegacyVotePolls.has(pid)) return;
  const lockedName = (ls("hl_voter_locked_name") || "").trim();
  if (!lockedName) return;
  const devId = getDeviceId();
  if (p.votes && p.votes[devId]) {
    migratedLegacyVotePolls.add(pid);
    return;
  }
  const oldKey = nameKey(lockedName);
  if (oldKey === devId) return;
  const legacy = p.votes && p.votes[oldKey];
  if (!legacy) return;
  migratedLegacyVotePolls.add(pid);
  fdb
    .ref(POLLS_ROOT + "/" + pid + "/votes/" + devId)
    .set({ ...legacy, nameKey: oldKey })
    .then(() => fdb.ref(POLLS_ROOT + "/" + pid + "/votes/" + oldKey).remove())
    .catch((err) => console.error("Migrate legacy vote failed", err));
}

// No ?poll= param → automatically find the latest open vote
async function initVoterLatest() {
  vvActiveTab = "details";
  document.body.classList.add("voter-mode");
  const body = document.getElementById("vv-body");
  if (!fbReady()) {
    body.innerHTML =
      '<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">⚠️ The vote page isn\'t configured yet. Please contact the admin.</div>';
    return;
  }
  attachVoterLatestListener(0);
}
// Giống attachVoterPollListener: tự thử lại tối đa 3 lần trước khi hiện lỗi,
// để tránh màn hình lỗi chết trong lần mở đầu tiên khi auth ẩn danh chưa kịp xong.
async function attachVoterLatestListener(attempt) {
  const body = document.getElementById("vv-body");
  await ensureFirebaseAuth();
  const ref = fdb.ref(POLLS_ROOT).orderByChild("createdAt").limitToLast(10);
  ref.on(
    "value",
    (snap) => {
      const all = snap.val() || {};
      let best = null,
        bestId = null,
        any = null,
        anyId = null;
      Object.keys(all).forEach((id) => {
        const p = all[id];
        if (!any || (p.createdAt || 0) > (any.createdAt || 0)) {
          any = p;
          anyId = id;
        }
        if (
          p.status === "open" &&
          (!best || (p.createdAt || 0) > (best.createdAt || 0))
        ) {
          best = p;
          bestId = id;
        }
      });
      voterPid = bestId || anyId;
      voterPoll = best || any;
      // Link gốc (không có ?poll=) = trang tạo vote, KHÔNG tự mở cuộc vote.
      document.getElementById("vv-body").innerHTML = `
        <div style="text-align:center;padding:14px 6px">
          <div style="font-size:15px;font-weight:700;margin-bottom:16px">Tạo cuộc vote của bạn</div>
          <button class="btn btn-primary" onclick="openHostCreateModal()" style="width:100%;max-width:280px;justify-content:center;background:var(--blue);border-color:var(--blue);color:#fff">Create vote</button>
        </div>`;
      return;
    },
    (err) => {
      console.error(err);
      ref.off();
      if (attempt < 3) {
        setTimeout(
          () => attachVoterLatestListener(attempt + 1),
          (attempt + 1) * 1500,
        );
        return;
      }
      body.innerHTML =
        '<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">Couldn\'t load vote data. Please try again later.<br><br><button class="vv-vote-btn" style="max-width:200px;margin:0 auto" onclick="attachVoterLatestListener(0)">🔄 Try again</button></div>';
    },
  );
}

