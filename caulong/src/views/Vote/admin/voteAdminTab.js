// ─── VOTE: ADMIN TAB ──────────────────────────────────────────────
let pollsCache = {},
  pollsListenerOn = false,
  pollExpanded = {},
  editingPollId = null;

// Default vote options for a new poll. Admin can add/rename/delete options
// per-poll from the "Create/Edit Vote" card; members can also add options
// from the public vote page itself (but can't edit or delete any option).
const DEFAULT_POLL_OPTIONS = [
  { id: "in", label: "Go" },
  { id: "out", label: "Bận" },
];
// Color palette cycled by option position, used for chips/avatars/rows.
const OPTION_PALETTE = [
  {
    bg: "var(--green-l)",
    border: "var(--green-m)",
    text: "var(--green-d)",
    solid: "var(--green)",
  },
  {
    bg: "var(--coral-l)",
    border: "var(--coral-m)",
    text: "#712B13",
    solid: "var(--coral)",
  },
  {
    bg: "var(--amber-l)",
    border: "var(--amber)",
    text: "#633806",
    solid: "var(--amber)",
  },
  {
    bg: "var(--blue-l)",
    border: "var(--blue)",
    text: "var(--blue)",
    solid: "var(--blue)",
  },
  {
    bg: "var(--purple-l)",
    border: "var(--purple)",
    text: "var(--purple)",
    solid: "var(--purple)",
  },
];
function optColor(i) {
  return OPTION_PALETTE[i % OPTION_PALETTE.length];
}
// Every member gets ONE fixed color derived from their name (hashed into
// OPTION_PALETTE), so the same person always looks the same everywhere —
// avatar stacks, name chips, Participants tab — instead of picking up
// whichever option/group's color they happen to be listed under.
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function avatarToneFor(v) {
  const key = String((v && (v.nameKey || v.name)) || "");
  return OPTION_PALETTE[hashStr(key) % OPTION_PALETTE.length];
}
// Options for a given poll, falling back to the defaults for old polls
// created before this feature (which have no `options` field saved).
// `options` may be a plain array (admin create/edit) or a keyed object
// (options members pushed in from the vote page) — both work here.
function pollOptions(p) {
  if (p && p.options && typeof p.options === "object") {
    const arr = Object.values(p.options).filter((o) => o && o.label);
    if (arr.length > 0) return arr;
  }
  return DEFAULT_POLL_OPTIONS;
}

