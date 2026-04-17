# 📋 Bàn Giao Kỹ Thuật — Phần DBA (Database)

> **Mục tiêu tổng quan**: Tích hợp Spotify API để enrich metadata (genre, mood, artist chính xác), xây biểu đồ cảm xúc tuần, và tạo "Weekly Wrapped Insights" bằng LLM Gemini.

## Chuẩn Bị Chung (Cho Tất Cả Dev)

### Biến Môi Trường Cần Thêm Vào `.env`

```env
# Spotify (https://developer.spotify.com/dashboard → Create App)
SPOTIFY_CLIENT_ID=<your_spotify_client_id>
SPOTIFY_CLIENT_SECRET=<your_spotify_client_secret>

# Gemini (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=<your_gemini_api_key>
```

### Dependencies Cần Cài

```bash
# Trong thư mục server/
npm install franc-min levenshtein node-cron @google/generative-ai
```

---

# TASK 1: Database Schema Setup 🗄️

| | |
|---|---|
| **Mục tiêu** | Khởi tạo schema hợp nhất (`videos`, `track_metadata`, `weekly_insights`) trên Supabase |
| **Assignee** | Backend / DBA |
| **Ước tính** | 10 phút |
| **File thực thi** | `init.sql` (có sẵn ở thư mục gốc) |

### Bước 1.1: Chạy SQL trên Supabase

1. Mở Supabase Dashboard → SQL Editor
2. Mở file `init.sql`
3. Paste toàn bộ nội dung file này vào SQL Editor và chạy (Run)
4. Verify: vào Table Editor, kiểm tra 3 bảng `videos`, `track_metadata` và `weekly_insights` xuất hiện

### Tiêu Chí Hoàn Thành ✅
- [ ] 3 bảng tồn tại trên Supabase
- [ ] RLS policies active
- [ ] `track_metadata.video_id` có FK constraint đến `videos.video_id`
