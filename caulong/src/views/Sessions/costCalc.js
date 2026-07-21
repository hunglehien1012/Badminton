// ─── COST AMOUNT CALC ─────────────────────────────────────────────
// A member can carry "guests" (bringing +N extra people) WITHOUT being split
// into separate member entries — instead their guestCount just increases
// their own weight in the cost split (a member with 1 guest pays for ~2
// people's worth of court/water/shuttle, while still showing as a single
// avatar with a "+1" badge — see renderGuestBadge / renderModalMembers).
function memberWeight(session, memberId) {
  const sm = session.members.find((m) => m.id === memberId);
  return 1 + (sm && sm.guestCount ? sm.guestCount : 0);
}
// Weight for a specific cost line: no-show members keep their FULL weight for
// the court fee (they already reserved the spot) but lose the no-show portion
// of their weight on every other cost line — same rule as the public vote
// page's self-serve calculation (see computeSelfServeCost's otherWeight).
function memberWeightForCost(session, memberId, cost) {
  const full = memberWeight(session, memberId);
  if (cost && isCourtFeeCost(cost.name)) return full;
  const sm = session.members.find((m) => m.id === memberId);
  const noShowCount = sm && sm.noShowCount ? sm.noShowCount : 0;
  return Math.max(0, full - noShowCount);
}
function calcMemberAmount(session, memberId) {
  let total = 0;
  session.costs.forEach((c) => {
    if (!c.memberIds.includes(memberId)) return;
    const myWeight = memberWeightForCost(session, memberId, c);
    if (myWeight <= 0) return;
    const totalWeight = c.memberIds.reduce(
      (sum, id) => sum + memberWeightForCost(session, id, c),
      0,
    );
    if (totalWeight > 0) total += (c.amount * myWeight) / totalWeight;
  });
  return Math.ceil(total / 1000) * 1000;
}

