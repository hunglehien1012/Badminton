# Hướng dẫn cập nhật

## 1+2+3. Minify/Obfuscate + chặn DevTools + Watermark

Đã xong, không cần bạn làm gì thêm:

- **`script.js`** (file đính kèm) giờ là bản đã **obfuscate + minify** (đổi tên biến,
  mã hoá chuỗi, thêm dead code...) — dùng file này thay cho file cũ, index.html
  đã trỏ sẵn tới nó.
- **`script.source.js`** là bản gốc dễ đọc, **giữ lại để bạn sửa code sau này**.
  Mỗi khi sửa `script.source.js`, chạy lại lệnh sau để tạo bản obfuscate mới:
  ```
  node build.js
  ```
  (cần `npm install javascript-obfuscator` một lần trước đó)
- Đã thêm chặn **chuột phải** và phím tắt **F12 / Ctrl+Shift+I,J,C / Ctrl+U**.
  ⚠️ Lưu ý thật: đây chỉ là "gây khó", không chặn được người rành kỹ thuật
  (họ vẫn mở DevTools qua menu trình duyệt được). Đừng dựa vào đây để bảo vệ
  dữ liệu thật sự nhạy cảm.
- Đã thêm watermark (comment đầu file + dòng chữ nhỏ trong Console). Tìm và
  điền tên bạn vào chỗ `[ĐIỀN TÊN BẠN VÀO ĐÂY]` ở 3 vị trí trong
  `script.source.js` (đầu file, cuối file, và `index.html`) rồi build lại.

## 4. Firebase Authentication (phân biệt admin / member)

Cần bạn làm 4 bước thủ công trên Firebase Console (mình không có quyền truy
cập project Firebase của bạn):

### Bước 1 — Bật 2 phương thức đăng nhập
Firebase Console → project của bạn → **Authentication** → tab **Sign-in method**
→ bật:
- **Anonymous** (cho member bình thường — họ không cần biết gì cả, tự động)
- **Email/Password** (cho tài khoản admin)

### Bước 2 — Tạo 1 tài khoản admin
Vẫn trong **Authentication** → tab **Users** → **Add user**:
- Email: `admin@badminton.local` (phải khớp đúng với hằng số `ADMIN_EMAIL`
  trong `script.source.js` — đổi cả hai nếu muốn email khác)
- Password: mật khẩu thật, tối thiểu 6 ký tự — đây chính là "mã quản trị"
  bạn sẽ gõ khi bấm nút Admin (thay cho PIN `7777777` cũ)

### Bước 3 — Lấy UID và dán vào Security Rules
1. Mở app, bấm **Admin**, đăng nhập bằng mật khẩu vừa tạo ở Bước 2.
2. Mở DevTools → tab Console, sẽ thấy dòng log:
   `Admin UID (copy vào Security Rules): xxxxxxxxxxxx`
   (Hoặc lấy trực tiếp ở Authentication → Users → cột **User UID**.)
3. Mở file **`firebase-rules.json`** (đính kèm), thay **cả 3 chỗ**
   `ADMIN_UID_HERE` bằng UID vừa copy.

### Bước 4 — Áp dụng Rules
Firebase Console → **Realtime Database** → tab **Rules** → dán nội dung
`firebase-rules.json` đã sửa UID → **Publish**.

### Sau khi làm xong, phân quyền sẽ là:
| Hành động | Member thường | Admin |
|---|---|---|
| Xem vote / kết quả | ✅ | ✅ |
| Vote / đổi lựa chọn của mình | ✅ | ✅ |
| Thêm option mới cho vote | ✅ | ✅ |
| Tạo / sửa / đóng-mở / xoá cuộc vote | ❌ | ✅ |
| Sửa / xoá 1 dòng Activity log đã có | ❌ (append-only) | ❌ (append-only) |

Nếu có bước nào bạn làm mà không thấy dòng log UID hoặc gặp lỗi khi đăng
nhập admin, gửi lại lỗi cụ thể (thường sẽ hiện trong Console) để mình hỗ trợ
tiếp.
