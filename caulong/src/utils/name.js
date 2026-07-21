// Chuẩn hóa tên thành key (bỏ dấu, chữ thường) — chỉ dùng để hiển thị / khớp tên, KHÔNG dùng làm key vote nữa
function nameKey(s) {
  return (
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "x"
  );
}

// Danh sách tên/chuỗi bị chặn khi vote — chuẩn hóa (bỏ dấu, chữ thường, bỏ
// khoảng trắng) trước khi so khớp, để bắt được cả biến thể cách chữ ra
// ("n u r u") lẫn có dấu ("Nauy"). Bất kỳ tên nào chứa số 7 (ở bất kỳ vị trí
// nào, kể cả xen giữa như "007") hoặc chữ "bảy" cũng bị chặn.
const BLOCKED_NAME_SUBSTRINGS = ["nuru", "brian", "nauy", "nu"];
function normalizeForNameBlockCheck(s) {
  return (
    (s || "")
      .normalize("NFD")
      // Strip only the 5 Vietnamese TONE marks (sắc/huyền/hỏi/ngã/nặng) —
      // deliberately NOT the full \u0300-\u036f range, because that range also
      // covers the horn/breve/circumflex marks that turn "u"/"o"/"a"/"e" into
      // entirely different letters ("ư"/"ơ"/"ă"/"â"/"ê"/"ô"). Stripping those
      // too would wrongly collapse e.g. "Nữ" down to "nu" and trip the "nu"
      // filter on a completely unrelated name.
      .replace(/[\u0300\u0301\u0303\u0309\u0323]/g, "")
      .normalize("NFC") // recompose the remaining accented letters back into single characters
      .replace(/đ/g, "d")
      .toLowerCase()
      .replace(/\s+/g, "")
  );
}
// Names may only use Vietnamese or English letters (plus space, apostrophe,
// period, hyphen) — this blocks emoji, other scripts (Chinese, Cyrillic…),
// and digits. Checked against the NFD-decomposed string so Vietnamese
// diacritics (which decompose into a base Latin letter + a combining mark)
// are recognized correctly instead of being rejected as "foreign" symbols.
const NAME_ALLOWED_CHARS_RE =
  /^[A-Za-zĐđ\u0300\u0301\u0302\u0303\u0306\u0309\u0323\u031B\s'’.\-]*$/;
function isNameBlocked(rawName) {
  if (!NAME_ALLOWED_CHARS_RE.test((rawName || "").normalize("NFD")))
    return true;
  const norm = normalizeForNameBlockCheck(rawName);
  if (!norm) return false;
  if (/7/.test(norm)) return true;
  return BLOCKED_NAME_SUBSTRINGS.some((sub) => norm.includes(sub));
}
