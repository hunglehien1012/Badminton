// ─── ADMIN CODE RATE-LIMITING / LOCKOUT (per IP, shared via Firebase) ─────
// - Every wrong attempt: short escalating delay before the next try — 1s, 2s, 4s, 8s, doubling.
// - Every 3 wrong attempts: a bigger lockout kicks in — 10 min (1st time), 30 min (2nd time), 24h (3rd+ time).
// - If an IP reaches the 24h tier on 2 different calendar days, that IP is permanently blocked.
// Note: this is enforced client-side against a shared Firebase record keyed by public IP
// (looked up via api.ipify.org). It stops casual guessing well, but — like any client-side
// check — someone technical enough to edit the page's JS or call Firebase directly, or who
// switches to a different IP/VPN, can get around it. If Firebase isn't reachable or the IP
// lookup fails, it falls back to a per-device (localStorage) check instead of per-IP.
const ADMIN_LOCK_TIERS_MS = [
  10 * 60 * 1000,
  30 * 60 * 1000,
  24 * 60 * 60 * 1000,
]; // 10min, 30min, 24h
const ADMIN_ATTEMPTS_BEFORE_LOCK = 3;

let _cachedClientIp = null;
async function getClientIp() {
  if (_cachedClientIp) return _cachedClientIp;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = await res.json();
    if (data && data.ip) {
      _cachedClientIp = data.ip;
      return _cachedClientIp;
    }
  } catch (e) {
    console.error("IP lookup failed", e);
  }
  return null;
}
function lockKeyFor(ip) {
  // Firebase keys can't contain '.', ':', '#', '$', '[', ']', '/'
  return ip ? "ip_" + ip.replace(/[^a-zA-Z0-9]/g, "_") : "dev_" + getDeviceId();
}
function defaultLockRecord() {
  return {
    wrongCount: 0,
    delayStep: 0,
    lockTier: 0,
    lockUntil: 0,
    nextAttemptAt: 0,
    tier3Dates: {},
    permaBanned: false,
  };
}
async function lockStoreGet(key) {
  if (fbReady()) {
    try {
      const snap = await fdb.ref("adminLockouts/" + key).once("value");
      return snap.val();
    } catch (e) {
      console.error("Lock store read failed", e);
    }
  }
  return ls("hl_lock_" + key);
}
async function lockStoreSet(key, rec) {
  if (fbReady()) {
    try {
      await fdb.ref("adminLockouts/" + key).set(rec);
      return;
    } catch (e) {
      console.error("Lock store write failed", e);
    }
  }
  ss("hl_lock_" + key, rec);
}
function formatDuration(ms) {
  if (ms <= 0) return "0s";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h) parts.push(h + "h");
  if (m) parts.push(m + "m");
  if (!h && s) parts.push(s + "s");
  return parts.join(" ") || "0s";
}

// Call with no `code` to just check whether this IP is currently gated (locked/banned)
// without recording an attempt. Call with a `code` to actually submit an admin-code attempt.
async function evaluateAdminAttempt(code) {
  const ip = await getClientIp();
  const key = lockKeyFor(ip);
  const rec = { ...defaultLockRecord(), ...((await lockStoreGet(key)) || {}) };
  const now = Date.now();

  if (rec.permaBanned) {
    return {
      ok: false,
      gated: true,
      message:
        "🚫 This IP has been permanently blocked for repeated failed admin login attempts.",
    };
  }
  if (rec.lockUntil && rec.lockUntil > now) {
    return {
      ok: false,
      gated: true,
      message: `🔒 Too many failed attempts. Try again in ${formatDuration(rec.lockUntil - now)}.`,
    };
  }
  if (rec.nextAttemptAt && rec.nextAttemptAt > now) {
    return {
      ok: false,
      gated: true,
      message: `⏳ Please wait ${formatDuration(rec.nextAttemptAt - now)} before trying again.`,
    };
  }

  if (code === undefined) return { ok: true, gated: false };

  // Mật khẩu thật được kiểm tra bởi Firebase Auth (server-side), không phải
  // so sánh chuỗi ở client — người mở DevTools không thể tự cấp quyền admin
  // cho mình được nữa vì Firebase sẽ từ chối nếu sai mật khẩu thật.
  let authOk = false;
  if (fbReady()) {
    try {
      await ensureFirebaseAuth();
      await fauth.signInWithEmailAndPassword(ADMIN_EMAIL, code);
      authOk = true;
    } catch (e) {
      authOk = false;
    }
  } else {
    // Không có Firebase → không thể xác thực an toàn, coi như sai.
    authOk = false;
  }

  if (authOk) {
    rec.wrongCount = 0;
    rec.delayStep = 0;
    rec.nextAttemptAt = 0;
    await lockStoreSet(key, rec);
    return { ok: true };
  }

  // Wrong code
  rec.wrongCount += 1;
  if (rec.wrongCount >= ADMIN_ATTEMPTS_BEFORE_LOCK) {
    const tierIdx = Math.min(rec.lockTier, ADMIN_LOCK_TIERS_MS.length - 1);
    const durationMs = ADMIN_LOCK_TIERS_MS[tierIdx];
    rec.lockTier = Math.min(rec.lockTier + 1, ADMIN_LOCK_TIERS_MS.length);
    rec.lockUntil = now + durationMs;
    rec.wrongCount = 0;
    rec.delayStep = 0;
    rec.nextAttemptAt = 0;
    // Hitting the 24h tier on 2 different calendar days → permanent block
    if (tierIdx === ADMIN_LOCK_TIERS_MS.length - 1) {
      const todayKey = new Date().toISOString().slice(0, 10);
      rec.tier3Dates = rec.tier3Dates || {};
      rec.tier3Dates[todayKey] = true;
      if (Object.keys(rec.tier3Dates).length >= 2) {
        rec.permaBanned = true;
      }
    }
    await lockStoreSet(key, rec);
    if (rec.permaBanned) {
      return {
        ok: false,
        message:
          "🚫 Too many violations across multiple days. This IP is now permanently blocked.",
      };
    }
    return {
      ok: false,
      message: `🔒 Wrong code ${ADMIN_ATTEMPTS_BEFORE_LOCK} times. Locked for ${formatDuration(durationMs)}.`,
    };
  }

  const delaySec = Math.pow(2, rec.delayStep);
  rec.delayStep += 1;
  rec.nextAttemptAt = now + delaySec * 1000;
  await lockStoreSet(key, rec);
  return {
    ok: false,
    message: `Wrong code. Please wait ${delaySec}s before trying again.`,
  };
}

async function adminLogin() {
  const gate = await evaluateAdminAttempt();
  if (!gate.ok) {
    showToast(gate.message);
    return;
  }
  const p = await showPrompt({
    title: "Brian Access",
    label: "Brian code",
    placeholder: "Enter Brian code",
    confirmText: "Log in",
    cancelText: "Cancel",
  });
  if (p === null) return;
  const result = await evaluateAdminAttempt(p);
  if (result.ok) {
    ss("hl_admin", 1);
    if (fauth && fauth.currentUser) {
      // In UID ra console một lần để bạn copy dán vào Firebase Security Rules
      // (thay cho "DÁN_ADMIN_UID_VÀO_ĐÂY"). Không hiển thị trên giao diện vì
      // đây chỉ là bước cấu hình 1 lần, không cần thiết với người dùng thường.
      console.log(
        "Admin UID (copy vào Security Rules):",
        fauth.currentUser.uid,
      );
    }
    location.href = location.pathname;
  } else {
    showToast(result.message);
  }
}

function avatarStack(arr) {
  const shown = arr.slice(0, 3);
  const more = arr.length - shown.length;
  return `<span class="av-stack">${shown
    .map((v) =>
      v.avatar
        ? `<span class="av" style="padding:0;overflow:hidden"><img src="${v.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></span>`
        : `<span class="av" style="background:${avatarToneFor(v).solid}">${esc(initials(v.name))}</span>`,
    )
    .join(
      "",
    )}${more > 0 ? `<span class="av more">+${more}</span>` : ""}</span>`;
}

// Small 16px avatar image shown before a name in vote-chip pills, when the voter has one set
function chipAvatarImg(v) {
  return v.avatar
    ? `<img src="${v.avatar}" alt="" style="width:16px;height:16px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:4px">`
    : "";
}

function toggleVvList(oid) {
  if (vvExpanded.has(oid)) vvExpanded.delete(oid);
  else vvExpanded.add(oid);
  renderVoterView();
}

function fbOptRow(group, myChoices, open) {
  const { id, label, votes, tone } = group;
  const sel = myChoices.includes(id);
  const expanded = vvExpanded.has(id);
  return `<div class="fb-opt ${sel ? "sel" : ""} ${open ? "" : "disabled"}" onclick="${open ? `toggleVote('${id}')` : ""}">
      <span class="fb-check">${sel ? "✓" : ""}</span>
      <div style="flex:1;font-size:15px;font-weight:500">${esc(label)}</div>
      <div onclick="event.stopPropagation();toggleVvList('${id}')" style="display:flex;align-items:center;gap:7px;padding:2px 4px">
        ${votes.length ? avatarStack(votes) : ""}
        <span style="font-size:13px;color:var(--muted);font-weight:600">${votes.length}</span>
      </div>
    </div>
    ${expanded && votes.length ? `<div class="fb-opt-names">${votes.map((v) => `<span class="vote-chip" style="background:${avatarToneFor(v).bg};border-color:${avatarToneFor(v).border};color:${avatarToneFor(v).text}">${chipAvatarImg(v)}${esc(v.name)}</span>`).join("")}</div>` : ""}`;
}

let vvActiveTab = "details"; // 'info' | 'details' (=Vote) | 'participants' | 'payment'
function switchVvTab(tab) {
  vvActiveTab = tab;
  renderVoterView();
}

