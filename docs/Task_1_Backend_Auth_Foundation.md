# Task 1: Setup Backend Foundation & Authentication Layer

## 1. Mục tiêu
Thiết lập nền tảng Backend vững chắc (FastAPI hoặc Node.js/NestJS) kết nối với hệ cơ sở dữ liệu InfluxDB v3 Core. Quan trọng nhất là tích hợp giải pháp xác thực (Supabase Auth) để đồng bộ User ID giữa Extension và Web App.

## 2. Tech Stack Cần Dùng
- **Backend Framework**: Node.js (Express/NestJS) HOẶC Python (FastAPI).
- **Database**: InfluxDB v3 Core (Lưu trữ Time-series cho History, Track).
- **Authentication**: Supabase Auth (Quản lý User, cấp JWT).
- **SDK**: `@influxdata/influxdb-client-v3`, `@supabase/supabase-js`.

## 3. Mô tả Công việc Chi tiết

### 3.1 Setup InfluxDB v3 Core
- Tạo bucket `youtube_tracking_data`.
- Cấu hình client kết nối bằng Host và Token.
- Thiết kế Schema InfluxDB:
  - *Measurement*: `playback_events`
  - *Tags* (Indexed): `user_id` (Lấy từ JWT Supabase), `video_id`, `event_type` (play, skip, pause).
  - *Fields*: `ms_played` (thời lượng đã nghe), `timestamp`, `playback_rate`.

### 3.2 Tích hợp Supabase Auth Authentication
- Tạo project trên Supabase, lấy `URL` và `ANON_KEY`.
- Viết Middleware Auth trên Backend:
  - Mọi request API `/track`, `/history`, `/stats` đều phải có Header `Authorization: Bearer <JWT>`.
  - Middleware sẽ gọi hàm verify JWT của Supabase. Nếu hợp lệ, trích xuất `user_id` và gán vào request context.
- (Tùy chọn) Lưu thông tin user profile cơ bản (tên, avatar) vào bảng Users của Supabase PostgreSQL (phần Auth đã tự động làm việc này).

## 4. Bàn giao & Kiểm thử
- [ ] API chạy thành công ở `localhost`.
- [ ] Truyền một JWT giả/hết hạn vào request bị báo lỗi 401 Unauthorized.
- [ ] Truyền JWT hợp lệ từ Supabase -> Middleware bóc tách được `user_id` thành công.
