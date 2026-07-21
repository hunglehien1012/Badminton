// ─── AVATAR MẶC ĐỊNH THEO TÊN ────────────────────────────────────────
// Thêm cặp "Tên": "link ảnh" vào bảng dưới. Khi ai đó vote/nhập đúng tên
// (KHÔNG phân biệt hoa–thường & dấu, vd "Dương" = "duong" = "DƯƠNG") mà
// chưa tự đặt ảnh riêng, ảnh này sẽ tự hiển thị ở mọi nơi (Vote tab,
// no-show, người tổ chức…). Dán link ảnh thật của bạn vào để thay thế.
const NAME_AVATARS = {
  Dương: "public/avatars/Duong.jpg",
  Trung: "public/avatars/Trung.jpg",
  Hào: "public/avatars/Hao.jpg",
  Trí: "public/avatars/Tri.jpg",
  "Tú Anh": "public/avatars/Tuanh.jpg",
  Thạnh: "public/avatars/Thanh.jpg",
  Mai: "public/avatars/Mai.jpg",
  Hùng: "public/avatars/avat.jpeg",
  Mike: "public/avatars/Mike.jpg",
};
// Chuẩn hoá mỗi tên đã map thành các "từ" (token) để so khớp theo từ.
const _NAME_AVATAR_ENTRIES = Object.entries(NAME_AVATARS).map(([k, v]) => {
  const key = nameKey(k);
  return { key, tokens: key.split("_").filter(Boolean), url: v };
});
function defaultAvatarFor(name) {
  if (!name) return null;
  const key = nameKey(name);
  // 1) Khớp chính xác cả tên → ưu tiên nhất.
  const exact = _NAME_AVATAR_ENTRIES.find((e) => e.key === key);
  if (exact) return exact.url;
  // 2) Nếu không, khớp khi tên đã map xuất hiện dưới dạng TỪ trong tên nhập —
  //    vd "Dương" cũng khớp "Q. Dương" hay "Dương Anh". Nếu nhiều tên map cùng
  //    khớp, chọn tên map có nhiều từ nhất (cụ thể nhất).
  const nameTokens = new Set(key.split("_").filter(Boolean));
  let best = null;
  for (const e of _NAME_AVATAR_ENTRIES) {
    if (e.tokens.length && e.tokens.every((tk) => nameTokens.has(tk))) {
      if (!best || e.tokens.length > best.tokens.length) best = e;
    }
  }
  return best ? best.url : null;
}
