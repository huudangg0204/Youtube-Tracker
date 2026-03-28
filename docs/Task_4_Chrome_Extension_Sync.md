# Task 4: Upgrade Chrome Extension & Auth Sync

## 1. Mục tiêu
Biến Chrome Extension thành một Tracking Agent ẩn danh, thông minh. Có khả năng tự động xin JWT từ Cookie của Web App (hoặc nhận token) để định danh User, thu thập thông tin playback chi tiết.

## 2. Tech Stack Cần Dùng
- **Manifest V3** Chrome Extension.
- **Permissions**: `cookies`, `storage`, `activeTab`.
- **Framework**: (Tùy chọn) React / Vite / Vanilla JS cho Popup.

## 3. Mô tả Công việc Chi tiết

### 3.1 Popup Auth Flow (Xử lý Đăng Nhập)
- Khi bấm mở icon Extension (Popup.html). Trạng thái mặc định: đọc `chrome.storage.local.get('jwt')`.
- Nếu **CHƯA** có JWT:
  - Hiển thị UI: "Vui lòng đăng nhập qua Web App để bắt đầu track dữ liệu".
  - Có 1 nút bự "Đăng nhập ngay" -> Bấm vào sẽ mở tab mới trỏ tới `https://yourdomain.com/login`.
- Nếu **ĐÃ CÓ** JWT:
  - Hiển thị: "Đang track cho tài khoản: abc@gmail.com". Nút xem Dashboard, Nút Logout (clear storage).

### 3.2 Sync JWT Token bằng Cookie Reading
- Viết ở `background.js`: Dùng API `chrome.cookies.getAll({ domain: "yourdomain.com" }, (cookies) => {...})` để rình xem User đã có cookie Supabase `sb-access-token` chưa.
- Nếu có, chép cái Token đó vào `chrome.storage.local`.
- Luôn cấp quyền Host permission cho cái domain của bạn trong `manifest.json`.

### 3.3 Tracking Playback Realtime
- Bên trong `content.js` (nhúng vào trang YouTube):
  - Bắt các sự kiện `play`, `pause`, `timeupdate`, đếm `ms_played`. Bắt sự kiện click nút Mũi tên Next hoặc load bài mới -> Phát hiện "Skip".
  - Chạy `setInterval` (Heartbeat) khoảng 5-10s một lần (tùy thiết kế) HOẶC sử dụng kiến trúc Event-based.
  - Gửi Message sang `background.js` kèm payload `{ videoId: '...', ms_played: ... }`.
- `background.js` nhận message, móc JWT từ Storage ra, gói lại và `fetch('POST /track', { headers: { Authorization } })` gửi cho Backend.

## 4. Bàn giao & Kiểm thử
- [ ] Cài Extension -> Chạy ra thông báo "Chưa đăng nhập".
- [ ] Bấm nhảy sang Web, Login xong. Quay lại xem Extension thấy đã báo "Đang track". (Tự sync).
- [ ] Để video YouTube chạy 10 giây, mở Network Log của Background Script bóc tách được request `/track` mang theo JWT Auth.
