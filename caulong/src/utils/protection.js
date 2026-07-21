// ─── BẢN QUYỀN ─────────────────────────────────────────────────────
// Badminton Club Manager
// Tác giả: [ĐIỀN TÊN BẠN VÀO ĐÂY]
// Ngày tạo: 2026
// Mọi hình thức sao chép lại toàn bộ mã nguồn cho mục đích thương mại
// khi chưa được sự đồng ý của tác giả đều không được phép.
console.log(
  "%cBadminton Club Manager %c— built by [ĐIỀN TÊN BẠN VÀO ĐÂY], 2026",
  "font-weight:bold;font-size:13px",
  "font-size:12px;color:#888",
);

// ─── CHẶN CHUỘT PHẢI / PHÍM TẮT MỞ DEVTOOLS ───────────────────────
// Lưu ý: đây chỉ là biện pháp GÂY KHÓ, không thể chặn tuyệt đối — ai rành kỹ
// thuật vẫn mở được DevTools bằng menu trình duyệt (⋮ → More tools) hoặc
// bằng cách mở trước rồi mới vào trang. Không nên dựa vào đây để bảo vệ dữ
// liệu thật sự nhạy cảm.
document.addEventListener("contextmenu", function (e) {
  e.preventDefault();
});
document.addEventListener("keydown", function (e) {
  const k = e.key;
  const blocked =
    k === "F12" ||
    (e.ctrlKey && e.shiftKey && ["I", "J", "C", "i", "j", "c"].includes(k)) ||
    (e.ctrlKey && ["U", "u"].includes(k));
  if (blocked) {
    e.preventDefault();
  }
});
