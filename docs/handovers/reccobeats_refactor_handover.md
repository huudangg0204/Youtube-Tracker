# Bản Mô Tả Chi Tiết Refactor Logic Phân Tích Mood & Thể Loại Nhạc

## Tổng Quan

Tài liệu này hướng dẫn dev team thực hiện refactor (thay thế) toàn bộ logic tính toán `mood` và dự đoán nhạc cụ / thể loại nhạc (genres) hiện tại (đang sử dụng API từ Last.fm thông qua tag community, có mặt trong `server/src/services/lastfmService.js`) sang một luồng pipeline hoàn toàn mới, chính xác và chuyên sâu hơn bằng cách thu thập *Audio Features trực tiếp* thông qua API của Deezer và ReccoBeats. Việc thực hiện hoàn toàn sử dụng APIs free (không tốn keys).

## Workflow Pipeline Mới

Cách tiếp cận mới sẽ tính the mood based on các đặc trưng âm thanh thực của bài hát (`valence`, `energy`, `danceability`, `acousticness`...). Pipeline diễn ra theo các bước sau, tương tự như mã logic đã được xác minh độc lập tại file `test-reccobeats.js`:

### Bước 1: Làm Sạch YouTube Title
Giữ lại và sử dụng thuật toán `cleanYouTubeTitle(title)` trong file hiện tại. Input từ Youtube tracker sẽ là `title` (Tên video) và `channelTitle` (thường là artist name). 

### Bước 2: Tìm Kiếm Trên Deezer → ISRC (ID của Track)
- Endpoint: `GET https://api.deezer.com/search?q=title+artist&limit=3`
- Hành động: Lọc ra bài hát khớp nhất so với từ khoá.
- Trả về: `id` của bài bên Deezer.
- Secondary request: Gọi `GET https://api.deezer.com/track/{deezerId}` để lấy trường `isrc` (hoặc có trên obj search tuỳ config) rất quan trọng để mapping track qua các music source khác.

### Bước 3: Ánh Xạ ISRC → Reccobeats Internal UUID
- Endpoint: `GET https://api.api.reccobeats.com/v1/track?ids={isrc}`
- Hành động: Mapping global track information.
- Trả về: Lấy `track.id` (internal ReccoBeats UUID), và thông tin mô tả chi tiết của track (trackName, artistName).

### Bước 4: Get Audio Features
- Endpoint: `GET https://api.reccobeats.com/v1/track/{uuid}/audio-features`
- Trả về một object chứa chi tiết thông số: `{ valence, energy, danceability, acousticness, instrumentalness, tempo, speechiness, liveness, loudness }`.

### Bước 5: Tính Toán Mood & Genre Hint
Dùng trực tiếp các map handlers đã định sẵn trong file `test-reccobeats.js`:
- `mapAudioFeaturesToMood(features)` -> Returns chuỗi đại diện (vd: "Happy/Upbeat", "Dramatic/Epic").
- `mapAudioFeaturesToGenreHint(features)` -> Returns chuỗi thể loại phỏng đoán.

---

## Chi Tiết Triển Khai Trong Mã Nguồn

### 1. Refactor File / Service
- Đổi tên file `server/src/services/lastfmService.js` thành `server/src/services/musicMetadataService.js` (hoặc tạo file mới và deprecate service cũ).
- Cập nhật lại đường dẫn import và function mapping ở mọi nơi đang gọi logic enrichment cũ (ví dụ: `trackingHandler.js`, `insightsService.js`).

### 2. Cấu Trúc Khối Code Mới (Reference file `test-reccobeats.js`)
Trong `musicMetadataService.js`, bạn cần mang lại các module logic đã pass-test thành method hoặc exported util func:

* `searchDeezerTrack(title, artist)`
* `getReccoBeatsUUID(ids)`
* `getReccoBeatsAudioFeatures(uuid)`
* `mapAudioFeaturesToMood(features)`
* `mapAudioFeaturesToGenreHint(features)`

### 3. Sửa Đổi Orchestrator (Main Enrichment Function)
Function `enrichVideoWithLastfm` hiện tại → Đổi thành `enrichVideoAudioFeatures` (hoặc chức năng tương tự):

```javascript
async function enrichVideoAudioFeatures(videoId, title, channelTitle) {
    // 1. Kiểm tra tồn tại trong DB 'track_metadata'
    // ...

    // 2. Build Pipeline
    const cleanTitle = cleanYouTubeTitle(title);
    
    // Step 2.1 Deezer search
    const deezerResult = await searchDeezerTrack(cleanTitle, channelTitle);
    if (!deezerResult || !deezerResult.isrc) return; // fail safe

    // Step 2.2 RB UUID Auth Request
    const rbTrack = await getReccoBeatsUUID(deezerResult.isrc);
    if (!rbTrack) return; 
    
    // Step 2.3 Audio feature request
    const features = await getReccoBeatsAudioFeatures(rbTrack.uuid);
    
    // Step 2.4 Map mood + Genre
    const mood = mapAudioFeaturesToMood(features);
    const genre = mapAudioFeaturesToGenreHint(features);
    const language = await detectLanguage(cleanTitle);

    // 3. Upsert into Supabase `track_metadata`
    //  - Insert values: mood = mood, genres = [genre], artist_name = rbTrack.artist_name || channelTitle...
}
```

## Các Yêu Cầu và Lưu Ý (Best Practices)

1. **Khả Năng Xử Lý Lỗi (Fault Tolerance)**: Các endpoint như `api.reccobeats.com` có thể trả về lỗi 404 (nếu ko tìm thấy ISRC) hoặc rate limits. Đảm bảo sử dụng `try/catch` ở mỗi network call và fallback êm rới; return null và kết thúc cycle thay vì crash server socket hoặc async loop.
2. **Caching**: Sử dụng cơ chế Redis cache sẵn có (giống hàm `getTrackInfo` cũ) cho cặp ID ISRC -> Features. Đặc tính âm thanh của 1 ISRC không bao giờ đổi. Nếu cache UUID và / hoặc Audio Features trên Redis trong 7, 30 ngày để giảm time call api lặp lại.
3. **Timeout Constraint**: Axios calls nên cung cấp option `timeout: 8000` (8s) để tranh treo process worker quá thời gian nếu network chập chờn.
4. **Remove / Cleanup biến môi trường Cũ**: Khi last.fm đã refactor xong thì xoá/bỏ key `LASTFM_API_KEY` khỏi `.env` do không cần dùng tới nữa.
