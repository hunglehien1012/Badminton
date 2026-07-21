// ─── LIÊN KẾT BUỔI ↔ VOTE: đồng bộ chi phí lên Firebase ────────────
// Sessions sống trong localStorage (riêng từng máy admin), nhưng trang vote
// công khai chỉ đọc được Firebase. Vì vậy khi 1 session được gắn với 1 poll
// (session.pollId), ta đẩy 1 bản snapshot chi phí lên polls/{pid}/sessionCost
// để BẤT KỲ ai có link vote cũng xem được (tab "Thanh toán"), dù họ không
// phải là admin và không có quyền truy cập localStorage của admin.
function syncSessionCostToPoll(session) {
  if (!session || !session.pollId || !fbReady()) return;
  const activeMembers = session.members.filter(
    (m) => calcMemberAmount(session, m.id) > 0,
  );
  const costs = session.costs.map((c) => {
    const names = c.memberIds.map((id) => {
      const m = session.members.find((mm) => mm.id === id);
      const nm = m ? m.name : id;
      const g = m && m.guestCount ? m.guestCount : 0;
      return g > 0 ? `${nm} +${g}` : nm;
    });
    // Divide by weighted headcount (each member's seat + their guests, minus
    // any no-show weight on non-court-fee lines) so the /person figure
    // matches what members actually owe — see memberWeightForCost.
    const lineWeight = c.memberIds.reduce(
      (sum, id) => sum + memberWeightForCost(session, id, c),
      0,
    );
    const perPerson = lineWeight > 0 ? c.amount / lineWeight : 0;
    return {
      name: c.name || "Cost",
      emoji: c.emoji || "🗒️",
      amount: c.amount,
      perPerson,
      names,
    };
  });
  const membersSnap = activeMembers.map((m) => ({
    name: m.name,
    avatar: defaultAvatarFor(m.name) || null,
    amount: calcMemberAmount(session, m.id),
    paid: !!m.paid,
    extra: m.guestCount || 0,
    noShow: !!(m.noShowCount && m.noShowCount > 0),
    noShowCount: m.noShowCount || 0,
  }));
  const total = session.costs.reduce((s, c) => s + (c.amount || 0), 0);
  const collected = membersSnap
    .filter((m) => m.paid)
    .reduce((s, m) => s + m.amount, 0);
  const splitCount = activeMembers.reduce(
    (sum, m) => sum + memberWeight(session, m.id),
    0,
  );
  fdb
    .ref(POLLS_ROOT + "/" + session.pollId + "/sessionCost")
    .set({
      sessionId: session.id,
      date: session.date,
      note: session.note || "",
      total,
      collected,
      pending: total - collected,
      costs,
      members: membersSnap,
      splitCount,
      updatedAt: Date.now(),
    })
    .catch((err) => console.error("Sync session cost to poll failed", err));
}

function clearPollSessionCost(pollId) {
  if (!pollId || !fbReady()) return;
  fdb
    .ref(POLLS_ROOT + "/" + pollId + "/sessionCost")
    .remove()
    .catch((err) => console.error("Clear poll session cost failed", err));
}

// Link/unlink an existing session to a poll from the admin's Vote list, so
// the "Thanh toán" tab on the public vote page can show its cost breakdown.
// Passing sid="" unlinks whichever session is currently attached to pid.
function linkPollToSession(pid, sid) {
  if (!sid) {
    const cur = sessions.find((x) => x.pollId === pid);
    if (cur) {
      delete cur.pollId;
      ss("hl_sessions", sessions);
    }
    clearPollSessionCost(pid);
    renderPollList();
    showToast("Session unlinked");
    return;
  }
  const s = sessions.find((x) => x.id === sid);
  if (!s) return;
  // A poll can only be linked to one session — clear any previous link
  sessions.forEach((x) => {
    if (x.pollId === pid && x.id !== sid) delete x.pollId;
  });
  s.pollId = pid;
  ss("hl_sessions", sessions);
  syncSessionCostToPoll(s);
  renderPollList();
  showToast("Session linked to vote");
}

