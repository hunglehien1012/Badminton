// ─── INIT ─────────────────────────────────────────────────────────
// Migration: điền "Saturday" vào các note đang trống
(function migrateNoteDates() {
  const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  let changed = false;
  sessions.forEach((s) => {
    if (!s.note || s.note.trim() === "" || datePattern.test(s.note.trim())) {
      s.note = "Saturday";
      changed = true;
    }
  });
  if (changed) ss("hl_sessions", sessions);
})();

// On load: auto-add all members to default cost memberIds in modal
renderSessions();
initMembersSync();

// Nếu mở qua link vote (?poll=...) → hiển thị trang vote cho người chơi
// Chế độ hiển thị:
// - Máy đã mở khóa admin (nhập đúng PIN 1 lần) → thấy đầy đủ các tab quản lý
// - Người khác mở link web → chỉ thấy trang Vote (cuộc vote đang mở mới nhất)
// - Có ?poll=<id> → luôn hiển thị đúng cuộc vote đó (kể cả admin, tiện xem trước)
// - Có ?admin=<PIN> → mở khóa admin cho máy này rồi tự xóa PIN khỏi URL
(async function () {
  const params = new URLSearchParams(location.search);
  const pin = params.get("admin");
  if (pin !== null) {
    history.replaceState(null, "", location.pathname);
    const result = await evaluateAdminAttempt(pin);
    if (result.ok) {
      ss("hl_admin", 1);
    }
    // Wrong/locked/banned attempts via URL are ignored silently (same as before) —
    // the lockout record is still updated by evaluateAdminAttempt() either way.
  }
  const managePid = params.get("manage");
  if (managePid) {
    initHostManageView(managePid);
    return;
  }
  const pid = new URLSearchParams(location.search).get("poll");
  const isAdmin = !!ls("hl_admin");
  if (pid) {
    initVoterView(pid);
    return;
  }
  if (!isAdmin) initVoterLatest();
})();

// ——— COPY COST SUMMARY (Detail tab: Tổng / Mỗi người / Vote ko đi) ———
// Snapshot of the most-recently-rendered cost summary row, refreshed each
// time renderPollInfoTab runs. Kept out of the onclick attribute itself
// since member names can contain quotes/unicode that are awkward to
// safely inline into HTML attribute strings.
let lastInfoCostSummary = null;
function fmtKShort(n) {
  return Math.round(n / 1000) + "k";
}
// One bullet line per no-show entry:
//  - solo no-show (no guests)      -> "* Tên"
//  - whole group no-show           -> "* Nhóm Tên ko đi"
//  - partial group no-show         -> "* Tên X/Y ko đi"
function noShowMemberLine(m) {
  if (!m.extra) return "* " + m.name;
  if (m.noShowCount >= m.extra) return "* Nhóm " + m.name + " ko đi";
  return "* " + m.name + " " + m.noShowCount + "/ " + m.extra + " ko đi";
}
function copyCostSummary(btn) {
  const data = lastInfoCostSummary;
  if (!data) return;
  const lines = [
    "Tổng: " + fmtKShort(data.total),
    "----------------",
    "Mỗi người: " + fmtKShort(data.perPerson),
  ];
  if (data.noShowAmt !== null && data.noShowAmt !== undefined) {
    lines.push("Vote ko đi: " + fmtKShort(data.noShowAmt));
  }
  if (data.noShowMembers && data.noShowMembers.length) {
    lines.push("");
    data.noShowMembers.forEach((m) => lines.push(noShowMemberLine(m)));
  }
  const text = lines.join("\n");
  const done = function () {
    btn.classList.add("copied");
    setTimeout(function () {
      btn.classList.remove("copied");
    }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(done)
      .catch(function () {
        prompt("Copy this text:", text);
      });
  } else {
    prompt("Copy this text:", text);
  }
}

// ——— COPY STK ———
function copySTK(btn) {
  var stk = "19032855202018";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(stk).then(function () {
      btn.classList.add("copied");
      setTimeout(function () {
        btn.classList.remove("copied");
      }, 1500);
    });
  } else {
    var ta = document.createElement("textarea");
    ta.value = stk;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    btn.classList.add("copied");
    setTimeout(function () {
      btn.classList.remove("copied");
    }, 1500);
  }
}

