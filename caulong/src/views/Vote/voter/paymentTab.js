// ─── TAB: THANH TOÁN ────────────────────────────────────────────────
// Read-only view of the cost breakdown for whichever session the admin
// linked to this poll (see linkPollToSession / createSessionFromPoll).
// Voters can see totals and who's paid, but can't toggle anything here —
// that stays an admin-only action inside the session detail modal.
// ─── SELF-SERVE PAYMENT CALCULATION ────────────────────────────────
// Admin-created sessions get their cost breakdown pushed to
// polls/{pid}/sessionCost by syncSessionCostToPoll() (see above). Self-serve
// votes have no admin session behind them, so instead we compute an
// equivalent breakdown live, straight from the poll's own `costs` (set by
// the host on the Manage page) and its live votes — no separate snapshot
// needed since everyone already reads the same poll node from Firebase.
//
// How many people the cost gets split among: the poll may have several
// "main" (non-"+N") options — e.g. different candidate days, "T2 14/07" vs
// "T3 15/07" — each with its own attendee count (direct picks + attributed
// "+N" guests, exactly like the Participants tab's "· 5" totals). We split
// the cost across whichever main option has the MOST people, on the
// assumption that's the day the session actually happens. The default
// "Can't make it" option (id "out") is never a candidate, since it counts
// declines, not attendance.
// If two (or more) main options are tied for the highest count, we can't
// guess which day is real — the host must pick one explicitly from the
// Manage page (stored as poll.costBasisOptionId); until they do, the
// Payment tab shows a "waiting on host" message instead of a number.
const GUEST_OPTION_RE = /^\+(\d+)(?:\s+(.+))?$/;
function isGuestOptionLabel(label) {
  return GUEST_OPTION_RE.test((label || "").trim());
}
// For every "main" (non-"+N", non-"Can't make it") option, work out its
// attendee list and total headcount — same math renderParticipantsTab uses
// to show "T2 14/07 · 5", just returned as data instead of markup.
function computeOptionAttendance(poll) {
  const groups = pollVotesByOption(poll);
  const allVotes = Array.from(new Set(groups.flatMap((g) => g.votes)));
  const mainGroups = groups.filter(
    (g) => g.id !== "out" && !isGuestOptionLabel(g.label),
  );
  const guestGroups = groups.filter((g) => isGuestOptionLabel(g.label));

  const guestMeta = {};
  guestGroups.forEach((g) => {
    const m = GUEST_OPTION_RE.exec(g.label.trim());
    const amount = parseInt(m[1], 10) || 0;
    const suffix = (m[2] || "").trim().toLowerCase();
    let mainId = null;
    if (suffix) {
      const match = mainGroups.find((mg) =>
        mg.label.toLowerCase().includes(suffix),
      );
      if (match) mainId = match.id;
    }
    if (!mainId && mainGroups.length) mainId = mainGroups[0].id;
    guestMeta[g.id] = { amount, mainId };
  });
  const guestExtraForMain = (v, mainId) => {
    let extra = 0;
    voteChoices(v).forEach((oid) => {
      const meta = guestMeta[oid];
      if (meta && meta.mainId === mainId) extra += meta.amount;
    });
    return extra;
  };

  return mainGroups.map((g) => {
    const directSet = new Set(g.votes);
    const implicit = allVotes.filter(
      (v) => !directSet.has(v) && guestExtraForMain(v, g.id) > 0,
    );
    const byName = new Map();
    g.votes.concat(implicit).forEach((v) => {
      const isDirect = directSet.has(v);
      const extra = guestExtraForMain(v, g.id);
      const key = nameKey(v.name);
      const entry = byName.get(key);
      if (!entry)
        byName.set(key, { name: v.name, avatar: v.avatar, isDirect, extra });
      else {
        entry.isDirect = entry.isDirect || isDirect;
        entry.extra += extra;
        if (!entry.avatar && v.avatar) entry.avatar = v.avatar;
        if (isDirect) entry.name = v.name;
      }
    });
    const attendees = Array.from(byName.values())
      .map((e) => ({
        name: e.name,
        nameKey: nameKey(e.name),
        avatar: e.avatar || null,
        weight: (e.isDirect ? 1 : 0) + e.extra,
        extra: e.extra,
      }))
      .filter((a) => a.weight > 0);
    return {
      id: g.id,
      label: g.label,
      total: attendees.reduce((s, a) => s + a.weight, 0),
      attendees,
    };
  });
}
// Picks which main option the cost should be split against: the one with
// the highest attendee count, or the host's explicit tie-break choice when
// several options are tied for the top spot. Returns null if there's
// nothing to split yet, or a tie the host hasn't resolved.
function pickCostBasisOption(poll) {
  const options = computeOptionAttendance(poll);
  const withVoters = options.filter((o) => o.total > 0);
  if (withVoters.length === 0) return null;
  const maxTotal = Math.max(...withVoters.map((o) => o.total));
  const tied = withVoters.filter((o) => o.total === maxTotal);
  if (tied.length === 1) return tied[0];
  return tied.find((o) => o.id === poll.costBasisOptionId) || null;
}
// Identifies which cost line is "the court fee" (tiền sân) — the only cost
// a no-show member still owes. Matched by name since hosts can freely rename
// or add cost lines; "Court Fee" is just the default preset label.
// Strips Vietnamese tone/diacritic marks so cost-name matching below doesn't
// have to enumerate every accented variant (e.g. "sân" vs "sằn", "nước" vs
// "nứơc") — normalize to plain ASCII-ish letters first, then match.
function stripDiacritics(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, (m) => (m === "đ" ? "d" : "D"));
}
function isCourtFeeCost(name) {
  return /court|san/i.test(stripDiacritics(name).trim());
}
function isShuttleCost(name) {
  return /shuttle|cau/i.test(stripDiacritics(name).trim());
}
function isWaterCost(name) {
  return /water|nuoc/i.test(stripDiacritics(name).trim());
}
// Small inline icon set matching the redesigned cost cards — falls back to
// a plain dot for any custom cost line the host adds (e.g. "Sân tập thêm").
function costIcon(name) {
  if (isCourtFeeCost(name)) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"></rect><line x1="3" y1="12" x2="21" y2="12"></line><line x1="12" y1="3" x2="12" y2="21"></line></svg>`;
  }
  if (isShuttleCost(name)) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l3 6-9 9-3-6z"></path><circle cx="12" cy="3" r="1.4" fill="var(--muted)" stroke="none"></circle></svg>`;
  }
  if (isWaterCost(name)) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z"></path></svg>`;
  }
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle></svg>`;
}
function computeSelfServeCost(poll) {
  const costs = (poll.costs || []).filter((c) => c.name || c.amount > 0);
  if (costs.length === 0) return null;
  const basis = pickCostBasisOption(poll);
  if (!basis) {
    const options = computeOptionAttendance(poll).filter((o) => o.total > 0);
    const maxTotal = options.length
      ? Math.max(...options.map((o) => o.total))
      : 0;
    const tied = options.filter((o) => o.total === maxTotal);
    return {
      selfServe: true,
      needsTieBreak: tied.length > 1,
      tiedOptions: tied,
    };
  }
  const attendees = basis.attendees;
  const totalWeight = basis.total;
  const noShows = poll.noShows || {};
  // No-show members keep their full weight for the court fee, but are
  // excluded (fully or partially, per the confirmed no-show count) from
  // every other cost line.
  const otherWeight = (a) => Math.max(0, a.weight - (noShows[a.nameKey] || 0));
  const otherTotalWeight = attendees.reduce((s, a) => s + otherWeight(a), 0);
  const total = costs.reduce((s, c) => s + (c.amount || 0), 0);
  // Court fee: everyone keeps full weight (self + all guests), so "+N" reflects
  // every extra person they brought.
  const names = attendees.map((a) => {
    const isAbsent = a.weight === a.extra && a.extra > 0;
    let n = a.extra > 0 ? `${a.name} +${a.extra}` : a.name;
    return { text: n, absent: isAbsent, name: a.name, extra: a.extra };
  });
  // Other costs: no-shows drop out, so a member's remaining guests are their
  // weight minus their own seat (otherWeight - 1) after subtracting no-shows.
  const otherNames = attendees
    .filter((a) => otherWeight(a) > 0)
    .map((a) => {
      const isAbsent = a.weight === a.extra && a.extra > 0;
      const g = otherWeight(a) - (isAbsent ? 0 : 1);
      let n = g > 0 ? `${a.name} +${g}` : a.name;
      return { text: n, absent: isAbsent, name: a.name, extra: a.extra };
    });
  const costLines = costs.map((c) => {
    const isCourt = isCourtFeeCost(c.name);
    const lineNames = isCourt ? names : otherNames;
    // Split by weighted headcount (guests included) so /person matches what
    // each member actually owes, instead of dividing by voter count.
    const denom = isCourt ? totalWeight : otherTotalWeight;
    return {
      name: c.name || "Cost",
      emoji: c.emoji || "🗒️",
      amount: c.amount || 0,
      perPerson: denom > 0 ? (c.amount || 0) / denom : 0,
      names: lineNames,
    };
  });
  const paidMap = poll.costsPaid || {};
  const members = attendees.map((a) => {
    let amount = 0;
    costs.forEach((c) => {
      if (isCourtFeeCost(c.name)) {
        amount +=
          totalWeight > 0 ? ((c.amount || 0) * a.weight) / totalWeight : 0;
      } else {
        const w = otherWeight(a);
        if (w > 0 && otherTotalWeight > 0) {
          amount += ((c.amount || 0) * w) / otherTotalWeight;
        }
      }
    });
    return {
      name: a.name,
      nameKey: a.nameKey,
      avatar: a.avatar || defaultAvatarFor(a.name) || null,
      amount: Math.ceil(amount / 1000) * 1000,
      paid: !!paidMap[a.nameKey],
      noShow: !!noShows[a.nameKey],
      extra: a.extra || 0,
      weight: a.weight || 1,
      noShowCount: noShows[a.nameKey] || 0,
      absent: a.weight === a.extra && a.extra > 0,
    };
  });
  const collected = members
    .filter((m) => m.paid)
    .reduce((s, m) => s + m.amount, 0);
  return {
    selfServe: true,
    basisLabel: basis.label,
    splitCount: totalWeight,
    date: poll.date,
    note: poll.note,
    total,
    collected,
    pending: total - collected,
    costs: costLines,
    members,
  };
}

// Toggle a self-serve attendee's paid status (anyone with the vote link can
// mark themselves — or a teammate — as paid, since there's no admin behind
// a self-serve vote to do it for them). Stored on the poll itself, keyed by
// nameKey so it survives across devices/renames the same way votes do.
function toggleSelfServePaid(pid, memberNameKey) {
  if (!fbReady()) return;
  const ref = fdb.ref(POLLS_ROOT + "/" + pid + "/costsPaid/" + memberNameKey);
  ref.once("value").then((snap) => {
    ref.set(!snap.val());
  });
}

function renderPaymentTab(p) {
  const sc = p.sessionCost || computeSelfServeCost(p);

  if (!sc) {
    const organizerName = (p && p.organizer && p.organizer.trim()) || "Brian";
    return `<div style="text-align:center;color:var(--muted);font-size:13px;padding:30px 10px;line-height:1.6">
      <br>
      ${t("paymentPending").replace("{name}", esc(organizerName))}
    </div>`;
  }
  if (sc.needsTieBreak) {
    return `<div style="text-align:center;color:var(--muted);font-size:13px;padding:30px 10px;line-height:1.6">
      <br>
      ⚖️ ${sc.tiedOptions.map((o) => esc(o.label)).join(" and ")} are tied with the same number of people.<br>The host needs to pick which one to base the cost split on (from the Manage page) before this can be calculated.
    </div>`;
  }
  const costLines = (sc.costs || [])
    .map(
      (c) => {
        // c.names can be [{text, absent}] (self-serve) or ["string"] (session-linked)
        const namesParts = (c.names || []).map((n) => {
          if (typeof n === "object" && n.text) {
            if (n.absent && n.extra > 0) {
              return `<span style="color:var(--coral);cursor:pointer" onclick="event.stopPropagation();showAbsentTip('${esc(n.name).replace(/'/g, "\\'")}',${n.extra})">${esc(n.text)}</span>`;
            }
            return esc(n.text);
          }
          return esc(n);
        });
        return `
    <div class="cost-card">
      <div class="cost-card-top">
        <div class="cost-card-left">
          <div class="cost-icon">${costIcon(c.name)}</div>
          <div class="cost-card-name">${esc(c.name || t("costItem"))}</div>
        </div>
        <div class="cost-card-amount">${fmt(c.amount)}</div>
      </div>
      <div class="cost-card-detail"><span class="cost-card-names">${namesParts.length ? namesParts.join(", ") : t("unassigned")}</span><span class="cost-card-per-person">${fmt(c.perPerson)}${t("perPerson")}</span></div>
    </div>`;
      },
    )
    .join("");
  const memberLines = (sc.members || [])
    .map((m) => {
      let countLabel = "";
      let noShowLabel = "";
      if (m.extra > 0) {
        countLabel = `<span class="pi-count">(${m.extra})</span>`;
        if (m.noShowCount > 0) {
          noShowLabel = `<span class="pi-noshow">· ${m.noShowCount} no show</span>`;
        }
      } else if (m.noShow) {
        noShowLabel = `<span class="pi-noshow">· no-show</span>`;
      }
      // Absent = implicit voter who didn't vote for the main option directly,
      // only voted a "+N" guest option (voting on behalf of their friends).
      const isAbsent = !!m.absent;
      const nameStyle = isAbsent ? "color:var(--coral);cursor:pointer" : "";
      const absentClick = isAbsent && m.extra > 0
        ? `onclick="event.stopPropagation();showAbsentTip('${esc(m.name).replace(/'/g, "\\'")}',${m.extra})"`
        : "";
      const badgeClick = sc.selfServe
        ? `onclick="event.stopPropagation();toggleSelfServePaid('${voterPid}','${m.nameKey}')" style="cursor:pointer"`
        : "";
      const tone = avatarToneFor(m);
      const avatarStyle = m.avatar
        ? "overflow:hidden"
        : `background:${tone.bg};color:${tone.text}`;
      return `
    <div class="player-item ${m.paid ? "paid-item" : ""}" style="margin-bottom:6px">
      <div class="avatar" style="${avatarStyle}">${m.avatar ? `<img src="${esc(m.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : initials(m.name)}</div>
      <div style="flex:1;min-width:0">
        <div class="pi-name-row">
          <span class="pi-name" style="${nameStyle}" ${absentClick}>${esc(m.name)}</span>${countLabel}${noShowLabel}
        </div>
        <div class="pi-detail ${m.paid ? "paid-detail" : ""}">${m.paid ? t("paidStatus") : t("owes") + ` <span class="pi-debt-amount">${fmt(m.amount)}</span>`}</div>
      </div>
      <span class="badge-pill ${m.paid ? "badge-green" : "badge-coral"}" ${badgeClick}>${m.paid ? t("paidBadge") : t("notPaidBadge")}</span>
    </div>`;
    })
    .join("");
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-size:11px;color:var(--muted)">${esc(fmtDate(sc.date))}${sc.note ? " · " + esc(sc.note) : ""}</div>
        <div style="font-size:20px;font-weight:700;letter-spacing:-.02em;margin-top:2px">${fmt(sc.total)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--muted)">${t("collected")}</div>
        <div style="font-size:16px;font-weight:600;color:var(--green)">${fmt(sc.collected)}</div>
      </div>
    </div>
    <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px;display:flex;align-items:center;gap:6px">${t("costs")} <span style="font-size:15px;font-weight:700;color:var(--text)">${sc.splitCount != null ? sc.splitCount : (sc.members || []).length}</span>${(() => {
      const ns = (sc.members || []).reduce(
        (s, m) => s + (m.noShowCount || (m.noShow ? 1 : 0)),
        0,
      );
      return ns > 0
        ? ` <span style="font-size:11px;font-weight:400;color:var(--hint);text-transform:none;letter-spacing:0">(${ns} no-show)</span>`
        : "";
    })()}</div>
    ${costLines || `<div style="font-size:12px;color:var(--hint)">${t("noCosts")}</div>`}
    <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">${t("members")}</div>
    ${memberLines || `<div style="font-size:12px;color:var(--hint)">${t("noMembers")}</div>`}
  `;
}

// Read-only summary row shown on the main vote page: label, who-voted avatars,
// and a progress bar sized against the club's member count. Tapping it expands
// the full list of names (same as before) — but no longer casts a vote itself;
// voting now happens inside the "Select your options" modal via Change vote.
function fbOptSummaryRow(group, totalMembers) {
  const { id, label, votes, tone } = group;
  const expanded = vvExpanded.has(id);
  const pct =
    totalMembers > 0
      ? Math.min(100, Math.round((votes.length / totalMembers) * 100))
      : 0;
  return `<div style="margin-bottom:16px;cursor:pointer" onclick="toggleVvList('${id}')">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:16px;font-weight:600">${esc(label)}</div>
        <div style="display:flex;align-items:center;gap:7px">
          ${votes.length ? avatarStack(votes) : ""}
        </div>
      </div>
      <div style="height:8px;border-radius:5px;background:var(--border);overflow:hidden">
        <div style="height:100%;border-radius:5px;width:${pct}%;background:var(--blue)"></div>
      </div>
      ${expanded && votes.length ? `<div class="fb-opt-names" style="margin-top:8px">${votes.map((v) => `<span class="vote-chip" style="background:${avatarToneFor(v).bg};border-color:${avatarToneFor(v).border};color:${avatarToneFor(v).text}">${chipAvatarImg(v)}${esc(v.name)}</span>`).join("")}</div>` : ""}
    </div>`;
}

