# Task 6: Nâng cấp Web App thành Tracking Dashboard Thực thụ

## 1. Mục tiêu
Đội ngũ Frontend (Next.js / React) cần biến Web App từ một trang thống kê cơ bản thành một **Trung tâm Phân tích (Analytics Dashboard) nâng cao**. Dashboard này không chỉ show số liệu khô khan, mà phải phản ánh chi tiết được dữ liệu "Deep Tracking" đã thu thập từ Task 5 (Ngữ cảnh, Tương tác sâu, Metadata).

## 2. Tech Stack Cần Dùng
- **Frontend Framework**: Next.js (App Router) hoặc React (Vite).
- **UI & Styling**: Tailwind CSS, Shadcn UI / Radix primitives (Khuyến nghị dùng để dựng giao diện Dashboard chuyên nghiệp, có sẵn bảng, biểu đồ, thẻ card).
- **Charts**: `recharts` hoặc `chart.js` (Vẽ biểu đồ thời gian/tương tác).
- **Real-time Sync**: `socket.io-client` (Bắt tín hiệu "Now Playing" từ Backend).
- **Date/Time Formatting**: `date-fns` hoặc `dayjs`.

## 3. Mô tả Công việc Chi tiết (UI/UX Requirements)

### 3.1 Màn hình Tổng quan (Overview / Home)
- **Now Playing Card**:
  - Giao diện góc trên cùng nổi bật: Lắng nghe qua WebSocket (hoặc API). Khi extension đang phát nhạc, Dashboard phải hiển thị "Đang phát trên Tab khác" kèm Thumbnail, Title, Artist, và thanh tiến trình (progress bar) đếm giây mockup.
- **Key Metrics (Thống kê nhanh)**:
  - Tổng thời gian nghe (Ngữ cảnh: Tuần này vs Tuần trước).
  - Tỉ lệ Skip Early (Báo động nếu người dùng skip quá nhiều -> Content dở).
  - Thể loại (Genre) và Nghệ sĩ (Artist) nghe nhiều nhất.

### 3.2 Lịch sử nghe nhạc (Detailed History Feed)
Xây dựng một Data Table / List View chi tiết hóa các Events (bóc từ InfluxDB + Postgres Metadata).
- **Cột Timeline**: Giờ nghe (Ví dụ: 08:30 AM). Bổ sung nhãn ngữ cảnh (Morning, Night...) lấy từ Task 5.
- **Cột Thông tin**: Thumbnail (lấy từ YouTube `https://img.youtube.com/vi/{video_id}/hqdefault.jpg`), Tên bài hát, Tên Nghệ sĩ.
- **Cột Tương tác (Interaction)**: Cực kì quan trọng. Dùng icon để hiển thị:
  - 🟢 Nghe trọn vẹn (Completed > 90%).
  - 🔴 Bỏ qua sớm (Skip Early).
  - ❤️ Đã Like / 👎 Dislike.
  - 🔁 Replayed (Đã nghe lại `n` lần).
- Liên kết: Hover vào bài hát có thể nhấn Play để mở lại qua YouTube.

### 3.3 Analytics & Charts (Trang Thống Kê Phân Tích)
Phục vụ nhu cầu xem "Spotify Wrapped" thu nhỏ của người dùng:
- **Biểu đồ Cột (Bar Chart)**: Tổng số phút nghe theo Ngày trong Tuần (Thứ 2 đến CN).
- **Biểu đồ Tròn (Radar / Pie Chart)**: Tỉ lệ nghe nhạc theo "Context" (Buổi sáng làm việc vs Buổi tối thư giãn). UI cần giải thích: AI sẽ dùng thông tin ngày để gợi ý nhạc phù hợp từng khung giờ.
- **Bảng xếp hạng (Top Tier list)**: Danh sách 5 bài hát nghe đi nghe lại nhiều nhất (Dựa vào `watch_duration_ratio` và `replay_count`).

### 3.4 Trang Khám Phá / Gợi Ý (Dành cho AI sau này)
- Tạo một Tab UI `Recommendations` (Tạm thời là bản nháp - Mockup chờ team AI).
- **Section 1: "Gợi ý vì bạn đã nghe [Artist_Name]"** (Content-based filtering UI). Bắn API lấy danh sách bài hát cùng Genre.
- **Section 2: "Nhạc phù hợp cho buổi [Morning/Night]"** (Context-aware filtering UI).

## 4. Định nghĩa Hoàn thành (Definition of Done)
- [ ] Giao diện History View render dạng danh sách cuộn vô hạn (Infinite Scroll) hoặc Phân trang (Pagination) rành mạch. Trưng bày đầy đủ các dấu hiệu "Like", "Skip", "Completed".
- [ ] Mở tab YouTube trên máy đang Play bài A. Mở Dashboard thấy ô "Now Playing" hiện bài A thành công. Đổi bài B bên Youtube, ô Now Playing tự đổi (WebSockets Sync tốt).
- [ ] UI Chart (Recharts) tự động co giãn Responsive khi xem trên Mobile.
