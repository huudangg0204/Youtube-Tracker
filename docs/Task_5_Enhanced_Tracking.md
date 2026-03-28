# Task 5: Nâng cấp Tracking Data (Chuẩn bị cho AI Recommendation System)

## 1. Phân tích & Logic hệ thống hiện tại
Hệ thống hiện tại (InfluxDB v3 + Supabase Auth + Chrome Extension) đang thu thập dữ liệu Dòng Sự Kiện (Event Stream) cơ bản: nghe bài gì, vào lúc nào, trong bao lâu (`play`, `pause`, `ms_played`).
Tuy nhiên, đối với một hệ thống AI/Recommendation (Gợi ý), ngần đó dữ liệu là quá "mỏng" và nhiễu (thuần Implicit Feedback). AI Team không thể phân biệt được User nghe 30s vì thích hay vì ngủ quên, cũng không thể tìm ra điểm chung về Genre (thể loại) giữa các video.

Do đó, **nhiệm vụ cốt lõi của team Backend và Extension** trong Task này là: 
Nâng cấp từ mô hình Tracking thụ động (có view là tính) sang mô hình **Deep Tracking**. Thu thập các tín hiệu cực mạnh (Tương tác sâu, Context, Metadata) nhằm phục vụ trực tiếp cho thuật toán Content-Based Filtering và Collaborative Filtering của Recommendation System.

---

## 2. Mô tả chi tiết cho Team Extension (Frontend Data Collection)

### 2.1 Nhóm 1: Thu thập Lịch sử Tương tác (Behavior & Interaction)
Update `content.js` để gắn thêm các `MutationObserver` hoặc check DOM liên tục:
- **Tín hiệu tương tác rõ rệt (Explicit)**: 
  - Lắng nghe sự kiện OnClick trên cụm nút Action: `Like` / `Dislike` / `Save to Playlist`.
  - Phân tích HTTP Referrer hoặc biến số `?v=` trên Youtube để xác định `click_source`: Nhấp từ Trang chủ (Home), Cột gợi ý (Up Next / Recommendation), hay Gõ tìm kiếm (Search).
- **Tín hiệu ngầm định (Implicit)**:
  - Tính toán `watch_duration_ratio` = `thời gian thực xem` / `tổng thời lượng video`.
  - Khai báo biến `completed: true` nếu `watch_duration_ratio > 0.9` (Nghe chán chê gần hết bài).
  - Lắng nghe DOM của nút Replay hoặc phát hiện video tua lại từ đầu: tăng biến `replay_count`.
  - Nếu `ms_played < 10` giây mà User đã ấn Next / Chọn bài khác => Bắn event `skip_early` (Tín hiệu AI đánh giá cực thấp bài hát này).

### 2.2 Nhóm 2: Bọc Dữ liệu Ngữ Cảnh (Context)
- Khởi tạo một `session_id` (VD: mã UUID random) mỗi khi User mở tab mới hoặc F5. Gắn mã này vào XUYÊN SUỐT các payload gửi xuống để Backend biết "À, đây là 1 phiên nghe nhạc liền mạch".
- Lấy `Client Timezone` (múi giờ của Chrome) bọc vào payload để Backend chia `time_of_day` cho chính xác.

---

## 3. Mô tả chi tiết cho Team Backend (Data Processing & Storage)

### 3.1 Cập nhật Lõi Tracking (InfluxDB)
Sửa endpoint `POST /track` để tiếp nhận dải dữ liệu khủng lồ từ Extension.
- **Biến Tag (Dùng để nhóm/filter)**: Thêm `session_id`, `event_type` (có thể là: play, like, dislike, add_playlist, skip_early), `click_source`, `time_of_day` (morning/afternoon/night/latenight), `day_of_week`.
- **Biến Field**: `watch_duration_ratio`, `replay_count`.
- *Logic Xử lý Server*: Khi nhận `Client Timezone` và Timestamp, tự động convert sang `time_of_day` (ví dụ: 6h-12h là morning) và `day_of_week` (Monday, Tuesday...) trước khi WritePoint xuống InfluxDB.

### 3.2 Nhóm 3: Xây dựng Bảng Video Metadata (Relational DB) [CỰC KỲ QUAN TRỌNG]
AI không thể quét Data bằng InfluxDB. Chúng ta CẦN MỘT BẢNG SQL (Nằm trên Supabase Postgres có sẵn).
- **Table `videos`**:
  - `video_id` (Primary Key).
  - `title`, `artist`, `genre`, `duration`, `release_year`, `tags`.
- **Logic tự động hóa**:
  1. Mỗi khi `/track` được gọi, chạy 1 hàm check (có thêm Cache Redis) xem `video_id` này đã có trong bảng `videos` của Supabase chưa.
  2. Nếu **CHƯA CÓ**, Backend đứng ra gọi YouTube Data API (hoặc các thư viện scraping metadata Youtube).
  3. Trích xuất Thể loại (Genre/Category), Ca sĩ/Kênh (Channel/Artist), Tag list, v.v. và `INSERT` mới vào bảng `videos`.
  *Lưu ý: Không bắt Extension tự gọi YouTube Data API ở Client Side để tránh lộ API Key và bắt quả tang SPAM.*

### 3.3 Nhóm 4: Bảng User Profiles (Optional - Contextual Snapshot)
- **Table `user_profiles`** (Trên Supabase Postgres):
  - `user_id` (Primary Key, Link Auth).
  - `favorite_genres` (JSON / Text Array).
  - `top_artists` (JSON / Text Array).
- Team Backend có thể tạo 1 **Cronjob (Worker)** chạy mỗi đêm lúc 2h sáng: Query InfluxDB của 30 ngày qua $\rightarrow$ Tính toán ra 3 Thể loại và 5 Nghệ sĩ hay nghe nhất của User $\rightarrow$ Đắp vào bảng Postgres này.
*(Hoặc gác lại, Data Engineer / AI team sẽ viết Python Extract riêng sau này).*

---

## 4. Định nghĩa Hoàn thành (Definition of Done - Cho Dev Team)
- [ ] Database có bảng `videos` (Supabase Postgres) và tự động điền (populate) dữ liệu YouTube vào đó khi có người xem 1 video mới lạ.
- [ ] Mở tab InfluxDB v3, query thử 1 Event và thấy rành mạch các Tags quan trọng như `session_id = xxxxx`, `click_source = search`, `time_of_day = night`.
- [ ] Mở Network tab ở Chrome, test thử bấm "Like" hoặc "Thêm Playlist" $\rightarrow$ Thấy API `/track` nhảy event `event_type="like"` lên Server thành công.
