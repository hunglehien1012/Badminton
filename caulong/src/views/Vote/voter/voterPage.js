// ─── VOTE: TRANG NGƯỜI CHƠI (?poll=...) ───────────────────────────
let voterPid = null,
  voterPoll = null;

async function initVoterView(pid) {
  voterPid = pid;
  vvActiveTab = "details";
  document.body.classList.add("voter-mode");
  const body = document.getElementById("vv-body");
  if (!fbReady()) {
    body.innerHTML =
      '<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">⚠️ The vote page isn\'t configured yet. Please contact the admin.</div>';
    return;
  }
  // Quan trọng: phải đợi đăng nhập ẩn danh xong rồi mới đọc Firebase, nếu
  // không Security Rules ("auth != null") sẽ từ chối vì auth vẫn còn null —
  // đây chính là nguyên nhân member thường bị mất khả năng vote sau khi bật
  // Firebase Auth.
  attachVoterPollListener(pid, 0);
}
// Gắn listener đọc dữ liệu vote, với cơ chế TỰ THỬ LẠI: lần đầu mở link trên
// một máy mới, việc tạo tài khoản ẩn danh có thể chậm/fail tạm thời (hay gặp
// trên iPhone mở link từ app chat) → đọc Firebase bị "permission denied" đúng
// 1 lần. Thay vì hiện lỗi chết như trước, giờ tự đợi auth xong rồi thử lại
// tối đa 3 lần (1.5s, 3s, 4.5s); hết 3 lần mới hiện lỗi kèm nút "Thử lại".
async function attachVoterPollListener(pid, attempt) {
  const body = document.getElementById("vv-body");
  await ensureFirebaseAuth();
  const ref = fdb.ref(POLLS_ROOT + "/" + pid);
  ref.on(
    "value",
    (snap) => {
      voterPoll = snap.val();
      migrateLegacyVote(pid, voterPoll);
      syncLockedNameFromServer(voterPoll);
      renderVoterView();
    },
    (err) => {
      console.error(err);
      ref.off();
      if (attempt < 3) {
        setTimeout(
          () => attachVoterPollListener(pid, attempt + 1),
          (attempt + 1) * 1500,
        );
        return;
      }
      body.innerHTML =
        '<div style="text-align:center;font-size:13px;color:var(--muted);padding:10px 0">Couldn\'t load vote data. Please try again later.<br><br><button class="vv-vote-btn" style="max-width:200px;margin:0 auto" onclick="attachVoterPollListener(\'' +
        pid +
        "', 0)\">🔄 Try again</button></div>";
    },
  );
}
