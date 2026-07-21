// ─── STATE ────────────────────────────────────────────────────────
let members = ls("hl_members") || []; // [{id,name}]
// Public mirror of `members`, kept in sync from Firebase (MEMBERS_ROOT) so
// voters on other devices can validate/pick a name from it. See saveMembers()
// (admin → Firebase) and initMembersSync() (Firebase → this device).
let publicMembers = [];
let sessions = ls("hl_sessions") || []; // [{id,date,note,address,costs:[{id,name,emoji,amount,memberIds[]}],members:[{id,name,paid,guestCount}]}]
// guestCount: number of extra people this member is bringing/paying for,
// folded into their own row instead of being split into separate members
// (see memberWeight/calcMemberAmount and guestStepperHtml/guestSuffix).
let monthCollapseState = ls("hl_month_collapse") || {}; // { 'YYYY-MM': true/false } — remembers user's expand/collapse choice
let editingSessionId = null;
let tempCosts = []; // cost lines in modal
let tempMembers = []; // members in modal [{id,name,included,guestCount}]
let tempSessionPollLink = null; // pollId to attach to the NEXT newly-created session (set by createSessionFromPoll)

