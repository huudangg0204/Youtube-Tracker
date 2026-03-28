-- Script tạo bảng videos trong Supabase để Cập nhật siêu dữ liệu Music Video Tracking

CREATE TABLE IF NOT EXISTS public.videos (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT,
    category_id TEXT,
    category_name TEXT,
    duration_iso TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Kích hoạt Row-level security nhưng cho phép quyền Thêm/Sửa tự do để Server NodeJS (vốn đang chạy Auth client ẩn danh) có thể đẩy dữ liệu lên được.
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert to videos"
ON public.videos
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public select videos"
ON public.videos
FOR SELECT
TO public
USING (true);
