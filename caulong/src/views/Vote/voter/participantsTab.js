// ─── TAB: NGƯỜI THAM GIA ────────────────────────────────────────────
// Shows the organizer, a total-vote summary, then every voter grouped by
// the option they picked, as an avatar grid (name + photo/initials).
function renderParticipantsTab(p, groups) {
  // Distinct voters, derived from the SAME (already name-merged) vote objects
  // used to build `groups` — reusing those references (not re-reading
  // p.votes) matters below, where we check `directSet.has(v)` by identity.
  const allVotes = Array.from(new Set(groups.flatMap((g) => g.votes)));

  // Organizer is optional per-vote; falls back to Brian (the app's admin,
  // see the "Brian" login link on the voter page) when left blank.
  const organizerName = (p && p.organizer && p.organizer.trim()) || "Brian";
  const organizerAvatar = defaultAvatarFor(organizerName);
  const organizerRow = `
    <div style="font-size:12px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">${t("organizer")}</div>
    <div style="display:flex;align-items:center;gap:14px;background:var(--bg);border-radius:16px;padding:14px 18px;margin-bottom:26px">
      <div style="width:44px;height:44px;border-radius:50%;background:#c98a3e;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:17px;flex-shrink:0;overflow:hidden">${organizerAvatar ? `<img src="${esc(organizerAvatar)}" alt="" style="width:100%;height:100%;object-fit:cover">` : esc(initials(organizerName))}</div>
      <span style="font-weight:800;font-size:18px;color:var(--text)">${esc(organizerName)}</span>
    </div>`;

  // Total number of distinct people who voted (already deduped by name — see
  // mergedPollVotes), so someone who picked multiple options, or who voted
  // from two devices under the same name, is only counted once.
  const totalVoters = allVotes.length;
  const totalRow = `
    <div style="display:flex;align-items:center;gap:14px;background:var(--green-l);border:1px solid var(--green-m);border-radius:16px;padding:16px 18px;margin-bottom:30px">
      <div style="width:40px;height:40px;border-radius:12px;background:var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 11a4 4 0 1 0-3.2-6.4M17 11a4 4 0 0 1 4 4v2M17 11c1.5 0 4 .8 4 4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="9" cy="8" r="4" stroke="#fff" stroke-width="1.8"></circle><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>
      </div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:800;letter-spacing:.06em;color:var(--green)">${t("totalVoters").toUpperCase()}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:2px">${t("totalVotersSub")}</div>
      </div>
      <div style="font-size:30px;font-weight:800;color:var(--green)">${totalVoters}</div>
    </div>`;

  // "+N" options are guest-count modifiers, not real attendance choices.
  // "+2 T2" adds 2 guests to whichever main option's label contains "T2"
  // (case-insensitive substring match); a bare "+2" with no suffix defaults
  // to the FIRST main option in the poll, so people don't have to pick a day
  // twice just to say how many guests they're bringing.
  const GUEST_RE = /^\+(\d+)(?:\s+(.+))?$/;
  const isGuestOption = (label) => GUEST_RE.test((label || "").trim());

  const mainGroups = groups.filter((g) => !isGuestOption(g.label));
  const guestGroups = groups.filter((g) => isGuestOption(g.label));

  // Resolve each guest option to { amount, mainId } once up front.
  const guestMeta = {};
  guestGroups.forEach((g) => {
    const m = GUEST_RE.exec(g.label.trim());
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
  // Total guests a voter is bringing that are attributed to a given main
  // option id (0 if none of their guest picks resolve to that main option).
  const guestExtraForMain = (v, mainId) => {
    const chosen = voteChoices(v);
    let extra = 0;
    chosen.forEach((oid) => {
      const meta = guestMeta[oid];
      if (meta && meta.mainId === mainId) extra += meta.amount;
    });
    return extra;
  };

  // (hashStr / avatarToneFor are defined globally now, shared with the Vote
  // tab's avatarStack/name chips — see near OPTION_PALETTE.)

  const renderAvatarCell = (v, extra, absent) => {
    const tone = avatarToneFor(v);
    const nameLabel = extra > 0 ? `${esc(v.name)} +${extra}` : esc(v.name);
    return `
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:64px;text-align:center">
            <div style="position:relative;width:56px;height:56px">
              ${
                v.avatar
                  ? `<img src="${v.avatar}" alt="" style="box-sizing:border-box;width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--text)">`
                  : `<div style="box-sizing:border-box;width:56px;height:56px;border-radius:50%;background:${tone.solid};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;border:2px solid var(--text)">${esc(initials(v.name))}</div>`
              }
              ${
                extra > 0
                  ? `<div style="position:absolute;bottom:-2px;right:-4px;background:var(--green);color:#fff;font-size:11px;font-weight:800;border-radius:999px;padding:2px 6px;border:2px solid var(--surface)">+${extra}</div>`
                  : ""
              }
            </div>
            <span style="font-size:13px;font-weight:600;color:var(--text);text-align:center">${nameLabel}</span>
            ${absent ? `<span class="badge-pill badge-coral">${t("absent")}</span>` : ""}
          </div>`;
  };

  const shown = new Set(); // vote entries already rendered inside a main group

  const mainHtml = mainGroups
    .map((g) => {
      // Everyone who directly picked this main option, plus anyone who only
      // tagged a guest option pointing at it (e.g. picked "+3 T6" but never
      // explicitly picked T6 themselves — they're sending guests but are
      // personally absent, so they don't take up a seat of their own).
      const directSet = new Set(g.votes);
      const implicit = allVotes.filter(
        (v) => !directSet.has(v) && guestExtraForMain(v, g.id) > 0,
      );
      const voters = g.votes.concat(implicit);
      if (voters.length === 0) return "";

      // Merge vote entries that share the same name (case/accent-insensitive)
      // into ONE avatar cell. This happens e.g. when the same person votes
      // from two devices — once picking the day themselves, once only
      // tagging "+1" — which would otherwise render as two different people
      // ("Hùng" attending, plus a separate "Hùng +1 · Absent"). Merged, they
      // become a single "Hùng +1" cell: attending, with the guest folded in.
      const byName = new Map(); // nameKey -> merged entry
      voters.forEach((v) => {
        shown.add(v);
        const isDirect = directSet.has(v);
        const extra = guestExtraForMain(v, g.id);
        const key = nameKey(v.name);
        const entry = byName.get(key);
        if (!entry) {
          byName.set(key, { name: v.name, avatar: v.avatar, isDirect, extra });
        } else {
          entry.isDirect = entry.isDirect || isDirect;
          entry.extra += extra;
          if (!entry.avatar && v.avatar) entry.avatar = v.avatar;
          if (isDirect) entry.name = v.name; // prefer the attending record's exact name/casing
        }
      });

      let total = 0;
      const cells = Array.from(byName.values())
        .map((entry) => {
          total += (entry.isDirect ? 1 : 0) + entry.extra;
          return renderAvatarCell(entry, entry.extra, !entry.isDirect);
        })
        .join("");
      return `
    <div style="margin-bottom:30px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="font-size:15px;font-weight:800;color:${g.tone.solid}">${esc(g.label)}</span>
        <span style="background:${g.tone.solid};color:#fff;font-size:12px;font-weight:800;border-radius:999px;padding:2px 10px">${total}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:22px">${cells}</div>
    </div>`;
    })
    .join("");

  // Safety net: only reachable if the poll has no main options at all (so
  // guest picks had nothing to default to) — still show them, plainly, so
  // no vote silently disappears.
  const leftoverHtml = guestGroups
    .map((g) => {
      const leftover = g.votes.filter((v) => !shown.has(v));
      if (leftover.length === 0) return "";
      const cells = leftover.map((v) => renderAvatarCell(v, 0)).join("");
      return `
    <div style="margin-bottom:30px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="font-size:15px;font-weight:800;color:${g.tone.solid}">${esc(g.label)}</span>
        <span style="background:${g.tone.solid};color:#fff;font-size:12px;font-weight:800;border-radius:999px;padding:2px 10px">${leftover.length}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:22px">${cells}</div>
    </div>`;
    })
    .join("");

  const optionsHtml =
    mainHtml || leftoverHtml
      ? mainHtml + leftoverHtml
      : `<div style="text-align:center;color:var(--muted);font-size:13px;padding:30px 10px">${t("noVotesYet")}</div>`;

  return organizerRow + totalRow + optionsHtml;
}

