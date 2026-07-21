// ─── SESSION → PLAIN TEXT (for pasting into Messenger/Zalo groups) ──
const VN_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]; // Date.getDay(): 0=Sunday

function buildSessionText(s) {
  const d = new Date(s.date + "T00:00:00");
  const dateBlock = `${VN_WEEKDAYS[d.getDay()]}--- ${d.getDate()}/${d.getMonth() + 1}`;

  const costBlock = s.costs
    .filter((c) => c.name || c.amount > 0)
    .map((c) => {
      const amtK = Math.round(c.amount / 1000);
      return c.qty ? `${c.name}: ${amtK} (${c.qty})` : `${c.name}: ${amtK}`;
    })
    .join("\n");

  // Build per-member display entries
  const activeMembers = s.members.filter((m) => calcMemberAmount(s, m.id) > 0);
  const entries = activeMembers.map((m) => {
    const amt = calcMemberAmount(s, m.id);
    const weight = memberWeight(s, m.id);
    const noShow = m.noShowCount || 0;
    // Name with weight: "Tester(4)" if weight > 1, else just "Tester"
    let namePart = m.name;
    if (weight > 1) namePart += `(${weight})`;
    // No-show annotation: "(ko đi)" if all absent, "(N ko đi)" if partial
    let suffix = "";
    if (noShow > 0) {
      suffix = noShow >= weight ? " (ko đi)" : ` (${noShow} ko đi)`;
    }
    return { namePart, amt, suffix, hasNoShow: noShow > 0 };
  });

  // Group members by amount, preserving first-appearance order.
  // Members with no-show annotations get their own line (not grouped with
  // clean members) so the annotation stays clear.
  const amtOrder = []; // ordered unique amounts (first-seen)
  const byAmt = {};    // amt -> { clean: [], annotated: [] }
  entries.forEach((e) => {
    if (!byAmt[e.amt]) {
      byAmt[e.amt] = { clean: [], annotated: [] };
      amtOrder.push(e.amt);
    }
    (e.hasNoShow ? byAmt[e.amt].annotated : byAmt[e.amt].clean).push(e);
  });

  const lines = [];
  amtOrder.forEach((amt) => {
    const amtK = Math.round(amt / 1000);
    const { clean, annotated } = byAmt[amt];
    if (clean.length > 0) {
      lines.push(clean.map((e) => e.namePart).join(", ") + `: ${amtK}k`);
    }
    annotated.forEach((e) => {
      lines.push(`${e.namePart}: ${amtK}k${e.suffix}`);
    });
  });

  const memberBlock = lines.join("\n");
  return dateBlock + "\n\n\n" + costBlock + "\n\n" + memberBlock;
}

function copySessionText(sid) {
  const s = sessions.find((x) => x.id === sid);
  if (!s) return;
  const text = buildSessionText(s);
  const done = () => showToast("Copied! Paste it into Messenger");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(done)
      .catch(() => prompt("Copy this text:", text));
  } else {
    prompt("Copy this text:", text);
  }
}

