# 🏸 Badminton Club Manager

Ứng dụng quản lý CLB cầu lông: buổi chơi, thành viên, chia tiền, vote lịch chơi (Firebase Realtime Database).

## Cấu trúc thư mục (Feature-based + Separation of Concerns)

```
caulong_stg/
├── public/                  # File tĩnh không thay đổi
│   ├── avatars/             # Ảnh đại diện thành viên
│   └── qr.jpg               # QR chuyển khoản
├── src/
│   ├── assets/
│   │   └── styles.css       # CSS toàn dự án
│   ├── constants/           # Biến cố định
│   │   ├── config.js        # Cấu hình Firebase, POLLS_ROOT, ADMIN_EMAIL/UID
│   │   └── avatars.js       # Bảng map Tên → ảnh mặc định
│   ├── context/
│   │   └── state.js         # Trạng thái toàn cục (members, sessions, temp*)
│   ├── services/            # Tầng giao tiếp dữ liệu (API/storage)
│   │   ├── storage.js       # localStorage (ls/ss)
│   │   ├── firebase.js      # Khởi tạo + auth Firebase
│   │   ├── device.js        # Device ID (chống vote trùng)
│   │   └── backup.js        # Backup / Restore JSON
│   ├── utils/               # Hàm bổ trợ thuần túy
│   │   ├── helpers.js       # uid, fmt, esc, fmtDate, autoK…
│   │   ├── name.js          # Chuẩn hóa tên, chặn tên cấm
│   │   └── protection.js    # Bản quyền, chặn chuột phải/DevTools
│   ├── components/          # UI nhỏ, tái sử dụng
│   │   ├── modal.js
│   │   ├── toast.js
│   │   └── confirmDialog.js
│   ├── layout/
│   │   └── tabs.js          # Điều hướng tab (Sessions/Members/Export/Vote)
│   ├── views/               # Gom theo TÍNH NĂNG (Feature-based)
│   │   ├── Sessions/        # Buổi chơi
│   │   │   ├── sessionList.js      # Danh sách + thống kê
│   │   │   ├── sessionModal.js     # Modal tạo / sửa buổi
│   │   │   ├── sessionDetail.js    # Modal chi tiết
│   │   │   ├── costCalc.js         # Tính tiền theo trọng số (guest/no-show)
│   │   │   ├── sessionPollSync.js  # Đồng bộ chi phí Buổi ↔ Vote lên Firebase
│   │   │   └── sessionText.js      # Xuất text dán Messenger/Zalo
│   │   ├── Members/
│   │   │   └── members.js          # Thêm/sửa/xóa + sync roster lên Firebase
│   │   ├── Export/
│   │   │   ├── exportPage.js       # Trang tổng hợp công nợ
│   │   │   └── exportImage.js      # Xuất ảnh (html2canvas)
│   │   └── Vote/
│   │       ├── i18n.js             # Chuyển ngữ EN/VI trang vote
│   │       ├── activityLog.js      # Nhật ký hoạt động
│   │       ├── admin/              # Tính năng dành cho admin
│   │       │   ├── voteAdminTab.js
│   │       │   ├── pollEditor.js
│   │       │   ├── adminActions.js
│   │       │   └── adminRateLimit.js
│   │       ├── voter/              # Trang người chơi (?poll=...)
│   │       │   ├── voterPage.js
│   │       │   ├── detailTab.js
│   │       │   ├── participantsTab.js
│   │       │   ├── paymentTab.js
│   │       │   ├── voterIdentity.js
│   │       │   └── voterAvatar.js
│   │       └── hosting/
│   │           └── selfServe.js    # Ai cũng tự tạo & quản lý vote riêng
│   └── main.js              # KHỞI TẠO: migrate dữ liệu, render, routing URL
├── index.html               # Nạp script theo thứ tự phụ thuộc
├── firebase-rules.json      # Security Rules mẫu
├── .env.example             # Mẫu cấu hình môi trường (không chứa key thật)
├── .gitignore
├── HUONG_DAN.md
└── README.md
```

## Nguyên tắc tổ chức

1. **Separation of Concerns** — mỗi tầng một trách nhiệm:
   - `constants` chỉ chứa giá trị cố định; `services` chỉ giao tiếp dữ liệu (localStorage / Firebase); `utils` là hàm thuần không phụ thuộc DOM/state; `components` là UI dùng chung; `views` là logic màn hình.
2. **Feature-based** — mọi thứ thuộc một tính năng nằm chung một thư mục (`views/Sessions`, `views/Vote/voter`…), khi sửa tính năng nào chỉ cần mở đúng thư mục đó.
3. **Thứ tự nạp script** trong `index.html` đi từ tầng thấp → cao: constants → services → utils → context → components → layout → views → `main.js`. **`main.js` luôn cuối cùng** vì nó là file duy nhất thực thi khởi tạo.

## Chạy dự án

Đây là static site, không cần build:

```bash
# Cách 1: mở trực tiếp index.html (chế độ local sẽ ghi vào test_polls, an toàn)
# Cách 2: chạy server tĩnh
npx serve .
```

## Cấu hình

- Firebase: sửa `src/constants/config.js` (API key, databaseURL, ADMIN_EMAIL, ADMIN_UID).
- Avatar mặc định theo tên: thêm cặp `"Tên": "public/avatars/xxx.jpg"` vào `src/constants/avatars.js`.
- Security Rules: dán nội dung `firebase-rules.json` vào Firebase Console.

## Lộ trình nâng cấp (gợi ý)

Khi dự án lớn hơn, chuyển sang Vite + ES Modules: đổi mỗi file thành `export`/`import` thay vì biến toàn cục, đưa cấu hình vào `.env` (đã có sẵn `.env.example`), và các hàm gọi từ `onclick` trong HTML chuyển sang `addEventListener`.
