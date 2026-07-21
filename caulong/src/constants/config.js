// 👉 DÁN cấu hình Firebase của bạn vào đây (Project settings → Your apps → SDK setup and configuration)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyApWkFa71IuWWveIYOlvAwaUd82UUtWBwc",
  authDomain: "badminton-7db14.firebaseapp.com",
  databaseURL:
    "https://badminton-7db14-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "badminton-7db14",
};
// Local testing safety net: when this file is opened locally (localhost or a
// plain file:// double-click) instead of the real deployed site, all vote
// data is written under a separate "test_polls" node in the SAME Firebase
// project/database — so anything you create while testing locally never
// touches, and can never get overwritten by, the real "polls" data your
// members actually vote on. No extra setup needed — the real deployed site
// (any other domain) still reads/writes "polls" exactly as before.
const IS_LOCAL_ENV =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.protocol === "file:";
const POLLS_ROOT = IS_LOCAL_ENV ? "test_polls" : "polls";
// Public, read-by-everyone mirror of the admin's local Fixed/Casual member
// list. Needed so a voter opening the vote link on their OWN device/phone
// (which has none of the admin's localStorage data) can still validate their
// typed name against the real member list — see saveMembers()/initMembersSync().
const MEMBERS_ROOT = IS_LOCAL_ENV ? "test_members" : "members";
// 👉 Mã quản trị: mật khẩu của tài khoản admin bạn tạo trong Firebase Console
// (Authentication → Users → Add user). Email cố định bên dưới, mật khẩu chính
// là "mã quản trị" mà bạn sẽ gõ khi bấm nút Admin. Đổi cả hai theo ý bạn,
// miễn khớp với tài khoản đã tạo trên Firebase.
const ADMIN_EMAIL = "admin@badminton.local";
// 👉 UID của tài khoản admin ở trên (Authentication → Users → cột User UID,
// copy sau khi đăng nhập admin thành công ít nhất 1 lần). Dùng để viết
// Firebase Security Rules chỉ cho phép UID này thực hiện các thao tác quản trị.
const ADMIN_UID = "DÁN_ADMIN_UID_VÀO_ĐÂY";

