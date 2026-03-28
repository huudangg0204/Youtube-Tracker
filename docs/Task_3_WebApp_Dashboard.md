# Task 3: Develop Web App Dashboard (Next.js)

## 1. Mục tiêu
Xây dựng một Web App hiện đại làm "Trung tâm chỉ huy" (Dashboard) cho người dùng. Nơi người dùng Đăng nhập, quản lý Auth và xem các thống kê (Spotify Wrapped style) dữ liệu âm nhạc cá nhân từ InfluxDB.

## 2. Tech Stack Cần Dùng
- **Frontend**: Next.js (App Router) hoặc Vite React.
- **Styling**: Tailwind CSS, Shadcn UI (Khuyến nghị).
- **Auth**: `@supabase/supabase-js`, `@supabase/ssr` (nếu dùng Next.js).
- **Charts**: `recharts` / `chart.js`.

## 3. Mô tả Công việc Chi tiết

### 3.1 Trang Đăng nhập & Đăng ký
- Xây dựng giao diện Login (Google OAuth & Email/Password) sử dụng Supabase Auth.
- Sau khi Login thành công, Supabase sẽ lưu Session (chứa JWT) vào Cookies/LocalStorage. Gán domain rõ ràng cho Cookie để Extension có thể đọc được (VD: `.trackingapp.com` nếu deploy thật, hoặc `localhost`).

### 3.2 Dashboard & Charts
- Lấy JWT từ Session, fetch API Backend (Task 2): `/history`, `/stats`.
- Dựng UI/UX:
  - **Lịch sử nghe nhạc**: Dạng danh sách (List) các video vừa xem.
  - **Thống kê Thời gian**: Biểu đồ Cột (Bar chart) thể hiện thời gian nghe mỗi ngày trong tuần.
  - **Skip Rate & Top Genres**: Biểu đồ quạt (Pie chart).

### 3.3 Đồng bộ Real-time (Live Updates)
- Khi user mở tab Dashboard, kết nối WebSocket tới Backend.
- Bắt sự kiện `new_track_event` (được Backend bắn xuống ở Task 2). Khi có nhạc mới phát từ Extension, UI hiển thị Notification nhỏ: *"Bạn đang nghe bài ABC ở tab khác..."* và update lại biểu đồ lịch sử realtime.

### 3.4 Web-to-Extension Communication (Tùy chọn Auth Sync)
- *Nếu dùng cách gửi Message:* Khi Web App login xong, có thể gửi một lệnh `chrome.runtime.sendMessage(EXTENSION_ID, { jwt: token })` để chủ động nạp token vào Extension (yêu cầu Web App phải khai báo đúng Extension ID).

## 4. Bàn giao & Kiểm thử
- [ ] Bấm Login Google thành công, Cookie xuất hiện.
- [ ] Test Dashboard ra được biểu đồ giả lập.
- [ ] Mở 2 tab (1 tab YouTube Extension chạy ngầm, 1 tab Dashboard), khi tab YouTube nhảy giây, Dashboard có nhảy Notification live.
