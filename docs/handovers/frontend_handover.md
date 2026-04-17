# 📋 Bàn Giao Kỹ Thuật — Phần Frontend Developer

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

# TASK 5: MoodChart UI Component 📈

| | |
|---|---|
| **Mục tiêu** | Vẽ biểu đồ cột xếp chồng (Stacked Bar) hiển thị mood 7 ngày trên Dashboard |
| **Assignee** | Frontend Dev |
| **Ước tính** | 2-3 giờ |
| **Files tạo/sửa** | `MoodChart.tsx` (NEW), `page.tsx` (MODIFY), `api.ts` (MODIFY) |
| **Tiền điều kiện** | TASK 4 (Backend API ready) |

### Bước 5.1: Thêm `fetchMoodWeekly()` vào `api.ts`

**File**: `dashboard/lib/api.ts`

```typescript
export const fetchMoodWeekly = async () => {
  const res = await api.get('/stats/mood-weekly')
  return res.data
}
```

### Bước 5.2: Tạo `MoodChart.tsx`

**File**: `dashboard/components/charts/MoodChart.tsx`

#### Thiết Kế Visual

```
┌──────────────────────────────────────────────┐
│  🎭 Biểu Đồ Cảm Xúc (7 Ngày Gần Nhất)     │
│                                              │
│  12 ┤                                         │
│  10 ┤         ██                              │
│   8 ┤    ██   ██         ██                   │
│   6 ┤    ██   ██    ██   ██              ██   │
│   4 ┤    ██   ██    ██   ██    ██   ██   ██   │
│   2 ┤    ██   ██    ██   ██    ██   ██   ██   │
│   0 ┴────T2───T3────T4───T5────T6───T7───CN── │
│                                              │
│  🟡 Happy  🟣 Sad  🔴 Energetic  🟢 Chill   │
│  🟠 Angry  🩷 Romantic  ⬛ Dramatic  💚 Party│
└──────────────────────────────────────────────┘
```

#### Color Palette (CỐ ĐỊNH)

```typescript
const MOOD_COLORS: Record<string, string> = {
  'Happy/Upbeat':    '#FFD93D',
  'Sad/Melancholic': '#6C5CE7',
  'Energetic':       '#FF6B6B',
  'Chill/Relaxed':   '#4ECDC4',
  'Angry/Intense':   '#E17055',
  'Romantic/Dreamy': '#FD79A8',
  'Dramatic/Epic':   '#2D3436',
  'Party/Dance':     '#00B894',
  'Unknown':         '#B2BEC3',
}
```

#### Thư Viện

Dùng **Recharts** (đã có sẵn trong project). Components cần:
- `<BarChart>`, `<Bar>` (stacked), `<XAxis>`, `<YAxis>`, `<Tooltip>`, `<Legend>`

#### Empty State

Khi chưa có data Spotify (tuần đầu sử dụng), hiển thị:
- Icon 🎵 + text "Chưa có dữ liệu cảm xúc. Nghe thêm nhạc để xem mood chart!"

### Bước 5.3: Tích hợp vào Dashboard `page.tsx`

**File**: `dashboard/app/dashboard/page.tsx`

Thêm vào grid, vị trí **ngay sau SkipRateChart + ContextPieChart** (trước HistoryTable):

```tsx
// Trong phần state
const [moodData, setMoodData] = useState<any[]>([]);

// Trong loadData()
const [histRes, statsRes, moodRes] = await Promise.all([
  fetchHistory(), fetchStats(), fetchMoodWeekly()
]);
setMoodData(moodRes.data || []);

// Trong JSX, trước HistoryTable
<div className="grid grid-cols-1 gap-6">
  <MoodChart data={moodData} />
</div>
```

### Tiêu Chí Hoàn Thành ✅
- [ ] Biểu đồ hiển thị 7 cột (T2→CN) với màu sắc đúng palette
- [ ] Hover tooltip hiển thị breakdown mood + số lượng
- [ ] Legend hiển thị tất cả 8 moods
- [ ] Empty state khi không có data
- [ ] Responsive: stack thành 1 cột trên mobile

---

# TASK 7: Weekly Insights Banner UI 🖥️

| | |
|---|---|
| **Mục tiêu** | Component banner đầu trang Dashboard hiển thị Weekly Wrapped text + Skeleton loading |
| **Assignee** | Frontend Dev |
| **Ước tính** | 2-3 giờ |
| **Files tạo/sửa** | `WeeklyInsightsBanner.tsx` (NEW), `page.tsx` (MODIFY), `api.ts` (MODIFY) |
| **Tiền điều kiện** | TASK 6 (Backend API ready) |

### Bước 7.1: Thêm `fetchWeeklyInsights()` vào `api.ts`

```typescript
export const fetchWeeklyInsights = async () => {
  const res = await api.get('/insights/weekly')
  return res.data
}
```

### Bước 7.2: Tạo `WeeklyInsightsBanner.tsx`

**File**: `dashboard/components/dashboard/WeeklyInsightsBanner.tsx`

#### Thiết Kế Visual

**State 1 — Loading (Skeleton):**
```
┌─────────────────────────────────────────────────────────┐
│  ✨ Your Weekly Insights                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ████████████████████████████░░░░░░░░░░░░░░░░░░  │   │
│  │  ██████████████████████░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│  │  █████████████████████████████░░░░░░░░░░░░░░░░░  │   │
│  └──────────────────────────────────────────────────┘   │
│  🔄 Đang phân tích thói quen nghe nhạc tuần qua...     │
└─────────────────────────────────────────────────────────┘
```

**State 2 — Loaded (Content):**
```
┌─────────────────────────────────────────────────────────┐
│  ✨ Your Weekly Insights                    [Thu gọn ▲] │
│                                                         │
│  🎵 Tuần này bạn đã "cháy" 25 giờ với âm nhạc! The     │
│  Weeknd chiếm spotlight với 32 lần play — có vẻ bạn     │
│  đang sống trong album After Hours rồi đó 😄 Đặc biệt  │
│  bạn hay nghe nhạc từ 22h-2h sáng — đúng chất "cú       │
│  đêm" thứ thiệt 🦉 ...                                  │
│                                                         │
│  📊 Top Artist: The Weeknd • Taylor Swift • Hans Zimmer │
└─────────────────────────────────────────────────────────┘
```

**State 3 — Empty (No data):**
```
┌─────────────────────────────────────────────────────────┐
│  ✨ Your Weekly Insights                                │
│  🎧 Tuần trước bạn chưa nghe bài nào. Hãy mở YouTube  │
│  và bắt đầu hành trình âm nhạc nào!                     │
└─────────────────────────────────────────────────────────┘
```

#### Props Interface

```typescript
interface WeeklyInsightsBannerProps {
  // Không cần props — component tự fetch data
}

// Internal state:
// - status: 'loading' | 'loaded' | 'empty' | 'error'
// - insightText: string
// - summaryStats: object (top artists, hours, etc.)
// - isExpanded: boolean (collapse/expand)
```

#### Skeleton Loading Implementation

```
3 dòng animated gradient bar:
- width: 90%, 75%, 85% (khác nhau để trông tự nhiên)
- animation: shimmer (background linear-gradient moving left→right)
- duration: 1.5s infinite
```

#### Styling
- Background: gradient `from-amber-500/10 to-orange-500/10` (warm tone, khác với NowPlayingCard)
- Border-left: 4px solid amber-500
- Border-radius: 16px
- Collapse animation: `max-height` transition

### Bước 7.3: Tích hợp vào Dashboard `page.tsx`

**Vị trí**: ĐẦU TIÊN, TRƯỚC NowPlayingCard

```tsx
import WeeklyInsightsBanner from '@/components/dashboard/WeeklyInsightsBanner';

// Trong JSX, dòng đầu tiên sau heading:
<WeeklyInsightsBanner />

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <NowPlayingCard liveEvent={liveEvent} />
</div>
// ... rest of dashboard
```

> [!NOTE]
> `WeeklyInsightsBanner` tự fetch data riêng (useEffect nội bộ), không phụ thuộc vào `loadData()` của page — vì insight lần đầu mất 5-15s, không nên block toàn bộ dashboard.

### Tiêu Chí Hoàn Thành ✅
- [ ] Skeleton loading hiển thị ngay khi vào dashboard
- [ ] Sau 5-15s (lần đầu) hoặc <1s (lần sau) → nội dung wrapped text hiển thị
- [ ] Button thu gọn/mở rộng hoạt động smooth
- [ ] Empty state khi không có data tuần trước
- [ ] Responsive: text wrap đúng trên mobile
- [ ] Không block phần còn lại của dashboard trong khi loading
