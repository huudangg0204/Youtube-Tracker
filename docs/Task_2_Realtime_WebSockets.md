# Task 2: Triển khai Giao thức Real-time WebSockets

## 1. Mục tiêu
Loại bỏ việc gọi REST API một lần (`POST /track`) thay bằng chuỗi kết nối duy trì liên tục (WebSockets) để hứng dữ liệu "Heartbeat" (nhịp tim) từ Extension khi User đang xem video trên Tab.

## 2. Tech Stack Cần Dùng
- **WebSocket Server**: `socket.io` (Dễ tích hợp, có sẵn room/namespace, tự động reconnect).
- **Security**: (Tùy chọn) `jsonwebtoken` (JWT) để xác thực các socket connect.
- **CORS config**: `cors` module.

## 3. Mô tả Công việc Chi tiết

### 3.1 Setup Socket.IO Server
- Cài đặt: `npm install socket.io`
- Bọc ứng dụng Express vào HTTP server và đưa cho Socket.io khởi tạo.
  ```javascript
  const http = require('http');
  const { Server } = require("socket.io");
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  ```

### 3.2 Định nghĩa các Event
Xây dựng file `server/src/sockets/trackingHandler.js` xử lý logic:
- Event **`connection`**: Khởi tạo session (nếu chưa có `user_id`, emit 1 event trả về Server-generated UUID cho client lưu lại).
- Event **`tracking_heartbeat`**: Client gửi qua mỗi 3-5s.
  * *Payload*: `{ video_id: 'abc', current_time: 120, playing: true, rate: 1 }`
  * *Logic*: Cầm `video_id` -> kiểm tra với Cache (Task 1) xem video có phải là loại âm nhạc không -> Nếu đúng, gửi thông tin này viết xuống DB (Influx).
- Event **`disconnect`**: Ghi nhận thời gian User thoát khỏi phiên nghe nhạc / đóng tab. Có thể viết 1 point rỗng với `playback_state="disconnected"`.

### 3.3 Tối ưu lưu lượng (Throttle / Debounce)
- Tránh việc 1 socket bị spam event liên tục làm nghẽn Event Loop. Sử dụng thư viện ngoài hoặc logic đếm frame để chỉ chấp nhận maximum 1 event mỗi giây / 1 Client_ID.

## 4. Bàn giao & Kiểm thử (Definition of Done)
- [ ] Connect từ script test client thành công.
- [ ] Cứ 5s gửi một heartbeat lên Server -> Logs ra InfluxDB v3 hiển thị đủ bản ghi.
- [ ] Ngắt kết nối thử -> Server chộp được event disconnect và không sụp lây diện rộng.
