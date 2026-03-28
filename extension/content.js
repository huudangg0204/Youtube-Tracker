/**
 * YouTube Video Tracker - Content Script (Deep Tracking V2)
 */

let lastVideoId = null;
let currentEvent = null;
let playStartTime = 0;
let accumulatedMs = 0;
let hasEnded = false;
let lastKnownDuration = 0;
let hasTriggeredCompleted = false;
let lastTime = 0;

// Contextual session scopes
const SESSION_ID = crypto.randomUUID();
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function getVideoId() {
    return new URLSearchParams(window.location.search).get('v');
}

function getClickSource() {
    const ref = document.referrer || '';
    if (!ref) return 'direct';
    if (ref.includes('youtube.com/results')) return 'search';
    if (ref.includes('youtube.com/watch')) return 'recommendation';
    if (ref.includes('youtube.com')) return 'home';
    return 'external';
}

function sendTrackPayload(event, ms_played, playback_rate = 1, extra = {}) {
    const videoId = extra.videoId || getVideoId();
    if (!videoId) return;

    const payload = {
        event,
        ms_played: Math.round(ms_played),
        timestamp: Date.now(),
        playback_rate,
        session_id: SESSION_ID,
        timezone: TIMEZONE,
        click_source: getClickSource(),
        ...extra,
        videoId // Override videoId explicitly to ensure priority
    };

    chrome.runtime.sendMessage({
        action: "trackPlayback",
        payload
    });
    console.log(`[YT Tracker] Evaluated & Sent: ${event}`, payload);
}

function computeWatchRatio(videoElement, ms_played) {
    if (!lastKnownDuration) return 0;
    return Math.min(1, ms_played / lastKnownDuration);
}

function setupVideoListeners() {
    const videoElement = document.querySelector('video.html5-main-video');
    if (!videoElement) return;

    if (videoElement.dataset.ytTrackerAttached) return;
    videoElement.dataset.ytTrackerAttached = 'true';

    console.log(`🎥 YT Tracker Deep Hook Attached to Video Element [Session: ${SESSION_ID}]`);

    lastTime = 0;
    videoElement.addEventListener('timeupdate', () => {
        if (videoElement.duration && !isNaN(videoElement.duration)) {
            lastKnownDuration = videoElement.duration * 1000;
            
            // Replay detection: From >90% to <3s trên CÙNG 1 VIDEO (Tránh nhầm với việc chuyển bài mới)
            if (lastVideoId === getVideoId() && lastTime > (videoElement.duration * 0.9) && videoElement.currentTime < 3) {
                console.log("[YT Tracker] Replay detected via time jump!");
                sendTrackPayload('replay', 0, videoElement.playbackRate);
                
                // Nếu người dùng tua lại từ cuối để nghe lại, cần phải chốt hạ thời gian xem trước đó thành 1 event pause/ended cục bộ
                if (currentEvent === 'play') {
                    const played = Date.now() - playStartTime;
                    accumulatedMs += played;
                    sendTrackPayload('play', played, videoElement.playbackRate, {
                        watch_duration_ratio: computeWatchRatio(videoElement, accumulatedMs)
                    });
                }

                // Cài đặt lại các biến đếm cho lần nghé mới
                hasTriggeredCompleted = false; 
                accumulatedMs = 0;
                playStartTime = Date.now();
                currentEvent = 'play'; // Tạm thời set thành pause để chờ event play chính thức sau đó, tránh nhầm lẫn giữa replay với việc tua lại bình thường
            }
            lastTime = videoElement.currentTime;

            // Real-time track_completed detection (>= 90%)
            const currentSessionPlayed = currentEvent === 'play' ? (Date.now() - playStartTime) : 0;
            const totalAcc = accumulatedMs + currentSessionPlayed;
            const ratio = lastKnownDuration ? (totalAcc / lastKnownDuration) : 0;
            
            if (ratio >= 0.9 && !hasTriggeredCompleted) {
                console.log("[YT Tracker] Track Completed Threshold Reached!");
                sendTrackPayload('track_completed', 0, videoElement.playbackRate, { watch_duration_ratio: ratio });
                hasTriggeredCompleted = true;
            }
        }
    });

    if (!videoElement.paused && !videoElement.ended) {
        lastVideoId = getVideoId();
        currentEvent = 'play';
        playStartTime = Date.now();
        sendTrackPayload('play', 0, videoElement.playbackRate);
    }

    videoElement.addEventListener('play', () => {
        if (hasEnded) {
            sendTrackPayload('replay', 0, videoElement.playbackRate);
            hasEnded = false;
        }

        if (currentEvent === 'play') return; // Đang play rồi thì bỏ qua Fake start
        lastVideoId = getVideoId();
        currentEvent = 'play';
        playStartTime = Date.now();

        sendTrackPayload('play', 0, videoElement.playbackRate);
    });

    videoElement.addEventListener('pause', () => {
        // Debounce 1.5s: Giải quyết triệt để lỗi Chrome tự động ép Pause khi đổi thẻ Tab (kéo background stream)
        setTimeout(() => {
            // Nếu sau 1.5s mà video đã chạy lại (paused = false), chứng tỏ đây là Phantom Pause do Browser chứ ko phải User bấm dừng.
            if (!videoElement.paused) {
                console.log("[YT Tracker] Ignored Phantom Pause from Tab Switch");
                return;
            }

            if (currentEvent === 'play' && lastVideoId === getVideoId()) {
                const played = Date.now() - playStartTime;
                accumulatedMs += played;
                sendTrackPayload('pause', played, videoElement.playbackRate, {
                    watch_duration_ratio: computeWatchRatio(videoElement, accumulatedMs)
                });
            }
            currentEvent = 'pause';
            playStartTime = 0;
        }, 1500);
    });

    videoElement.addEventListener('ended', () => {
        hasEnded = true;
        if (currentEvent === 'play') {
            const played = Date.now() - playStartTime;
            accumulatedMs += played;
            sendTrackPayload('pause', played, videoElement.playbackRate, {
                watch_duration_ratio: computeWatchRatio(videoElement, accumulatedMs)
            });
        }
        currentEvent = null;
    });
}

// Global UI Explicit Context (Like/Dislike/Save)
document.body.addEventListener('click', (e) => {
    const likeBtn = e.target.closest('like-button-view-model');
    if (likeBtn) {
        const isSelected = likeBtn.querySelector('button')?.getAttribute('aria-pressed') === 'true';
        if (!isSelected) sendTrackPayload('like', 0, 1, { watch_duration_ratio: 0 });
        return;
    }
    const dislikeBtn = e.target.closest('dislike-button-view-model');
    if (dislikeBtn) {
        const isSelected = dislikeBtn.querySelector('button')?.getAttribute('aria-pressed') === 'true';
        if (!isSelected) sendTrackPayload('dislike', 0, 1, { watch_duration_ratio: 0 });
        return;
    }
    const saveBtn = e.target.closest('ytd-button-renderer');
    if (saveBtn && saveBtn.innerText?.toLowerCase().includes('save')) {
        sendTrackPayload('add_playlist', 0, 1, { watch_duration_ratio: 0 });
    }
}, true);

let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        if (lastVideoId && currentEvent !== null) {
            let played = 0;
            if (currentEvent === 'play') {
                played = Date.now() - playStartTime;
                accumulatedMs += played;
            }
            
            const videoElem = document.querySelector('video.html5-main-video');
            const ratio = computeWatchRatio(videoElem, accumulatedMs);
            
            if (ratio < 0.9) {
                let eventName = ratio < 0.1 ? 'skip_early' : 'skip';
                sendTrackPayload(eventName, played, 1, { watch_duration_ratio: ratio, videoId: lastVideoId });
            } else if (currentEvent === 'play') {
                sendTrackPayload('pause', played, 1, { watch_duration_ratio: ratio, videoId: lastVideoId });
            }
        }

        lastUrl = location.href;
        currentEvent = null;
        accumulatedMs = 0;
        lastKnownDuration = 0;
        hasEnded = false;
        hasTriggeredCompleted = false;
        lastTime = 0; // Đặt lại lastTime để tránh lỗi nhận diện sai Replay giữa 2 video
        lastVideoId = getVideoId();

        setTimeout(setupVideoListeners, 1500);
    }
}).observe(document, { subtree: true, childList: true });

setTimeout(setupVideoListeners, 2000);
