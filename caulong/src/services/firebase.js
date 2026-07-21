// ─── FIREBASE (VOTE) ──────────────────────────────────────────────
let fdb = null;
let fauth = null;
let _authReadyPromise = null;
// Đăng nhập ẩn danh cho MỌI người dùng (member bình thường) ngay khi trang
// tải xong, để Firebase Rules có thể yêu cầu "auth != null" mà không chặn
// người vote bình thường. Không cần chờ hàm này xong mới cho phép tương tác —
// nó chạy song song, và trong thực tế người dùng luôn mất vài trăm ms để bấm
// nút đầu tiên nên auth thường đã sẵn sàng.
function ensureFirebaseAuth() {
  if (_authReadyPromise) return _authReadyPromise;
  _authReadyPromise = new Promise((resolve) => {
    if (!fauth) return resolve(null);
    // Lần ĐẦU TIÊN mở trang trên một thiết bị, Firebase phải gọi mạng để tạo
    // tài khoản ẩn danh — trên mạng di động chậm hoặc trình duyệt trong app
    // (Zalo/Messenger) request này hay bị chậm/fail tạm thời. Vì vậy:
    // - Thử signInAnonymously tối đa 3 lần, giãn cách 1s → 2s (backoff).
    // - Tổng thời gian chờ tối đa 20s thay vì 8s.
    // - Nếu vẫn fail thì resolve(null) NHƯNG xóa cache promise, để lần gọi
    //   ensureFirebaseAuth() tiếp theo (ví dụ khi người dùng bấm "Thử lại")
    //   được phép thử đăng nhập lại từ đầu thay vì dính kết quả fail mãi mãi.
    let settled = false;
    const finish = (user) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!user) _authReadyPromise = null; // đừng cache thất bại
      resolve(user);
    };
    const timeout = setTimeout(() => {
      console.error(
        "Firebase Auth timeout — mạng chậm hoặc chưa bật 'Anonymous' sign-in trong Firebase Console.",
      );
      finish(null);
    }, 20000);
    let signingIn = false;
    fauth.onAuthStateChanged((user) => {
      if (user) return finish(user);
      if (signingIn) return; // đã có vòng retry đang chạy
      signingIn = true;
      const trySignIn = (attempt) => {
        if (settled) return;
        fauth.signInAnonymously().catch((e) => {
          console.error(
            "Anonymous sign-in failed (attempt " + attempt + ")",
            e,
          );
          if (attempt >= 3 || settled) {
            finish(null);
            return;
          }
          setTimeout(() => trySignIn(attempt + 1), attempt * 1000);
        });
        // thành công → onAuthStateChanged sẽ fire với user → finish(user)
      };
      trySignIn(1);
    });
  });
  return _authReadyPromise;
}
// Resolves this device's Firebase Auth uid (anonymous is fine) — used to
// stamp/verify ownership of self-serve hosted polls (creatorUid).
async function getMyAuthUid() {
  const user = await ensureFirebaseAuth();
  return user ? user.uid : null;
}

function fbReady() {
  if (fdb) return true;
  if (
    !window.firebase ||
    !FIREBASE_CONFIG.apiKey ||
    FIREBASE_CONFIG.apiKey.indexOf("DÁN") === 0
  )
    return false;
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    fdb = firebase.database();
    fauth = firebase.auth();
    ensureFirebaseAuth();
    return true;
  } catch (e) {
    console.error("Firebase init failed", e);
    return false;
  }
}
