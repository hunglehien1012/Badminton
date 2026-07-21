// ID cố định cho thiết bị này, tạo 1 lần duy nhất và KHÔNG bị xóa khi đổi tên vote.
// Dùng làm key lưu vote trong Firebase → 1 thiết bị chỉ có đúng 1 slot vote / cuộc vote,
// dù người dùng bấm "Không phải bạn?" và đổi tên bao nhiêu lần cũng chỉ ghi đè lên slot đó
// thay vì tạo thêm phiếu mới (chặn việc 1 máy vote nhiều lần dưới nhiều tên khác nhau).
function getDeviceId() {
  let id = ls("hl_device_id");
  if (!id || typeof id !== "string") {
    id =
      window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : "d" + Date.now().toString(36) + Math.random().toString(36).slice(2);
    ss("hl_device_id", id);
  }
  return id;
}
// If this device has claimed someone else's existing vote entry as "me" for
// a given poll (see resolveVoterIdentity — used when two devices enter the
// same name), all reads/writes for that poll should target THAT entry
// instead of this device's own raw devId, so the two devices share one
// identity instead of appearing as two separate people with the same name.
function effectiveDevId(pid) {
  const adopted = ls("hl_adopted_id_" + pid);
  return adopted && typeof adopted === "string" ? adopted : getDeviceId();
}

