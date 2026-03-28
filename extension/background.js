// Central Background Worker for YouTube Tracker

const API_URL = "http://localhost:5000/track";

function checkCookiesAndSync() {
    chrome.cookies.get({ url: "http://localhost", name: "yt_tracker_jwt" }, (cookie) => {
        if (cookie && cookie.value) {
            chrome.storage.local.set({ supabaseToken: cookie.value });
            console.log("Auth synced successfully from yt_tracker_jwt.", cookie.value.substring(0, 15) + "...");
        } else {
            chrome.storage.local.remove(['supabaseToken']);
            console.log("No valid auth session found in cookies.");
        }
    });
}

// Initial Sync
checkCookiesAndSync();

// Listen for cookie changes on localhost
chrome.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.cookie.domain.includes("localhost") && changeInfo.cookie.name === "yt_tracker_jwt") {
        console.log("Cookie changed, re-syncing...", changeInfo);
        if (changeInfo.removed) {
            chrome.storage.local.remove(['supabaseToken']);
        } else {
            checkCookiesAndSync();
        }
    }
});

// Listener for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "syncAuth") {
        checkCookiesAndSync();
        // Give it a tiny bit of time to read storage asynchronously before returning
        setTimeout(() => {
            chrome.storage.local.get(['supabaseToken'], (res) => sendResponse({ token: res.supabaseToken }));
        }, 100);
        return true; 
    }
    
    if (message.action === "trackPlayback") {
        chrome.storage.local.get(['supabaseToken'], (res) => {
            const token = res.supabaseToken;
            if (!token) {
                console.log("Ignored tracking API call: No JWT token found in storage. Please login first.");
                sendResponse({ success: false, error: "No JWT token" });
                return;
            }

            const payload = message.payload;
            console.log("Dispatching authorized request to backend...", payload);

            fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })
            .then(async r => {
                const text = await r.text();
                // Successful is 200/201
                if (r.ok) {
                    console.log("✅ Track Response:", r.status, text);
                    sendResponse({ success: true, status: r.status });
                } else {
                    console.warn("⚠️ Track Response Failed:", r.status, text);
                    sendResponse({ success: false, error: "Track request failed" });
                }
            })
            .catch(err => {
                console.error("Track POST Error:", err);
                sendResponse({ success: false, error: err.message });
            });
        });
        return true; 
    }
});