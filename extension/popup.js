document.addEventListener('DOMContentLoaded', () => {
    const loadingView = document.getElementById('loading');
    const authView = document.getElementById('auth-view');
    const unauthView = document.getElementById('unauth-view');
    const userInfo = document.getElementById('user-info');
    const forceSyncBtn = document.getElementById('forceSync');

    function updateUI(jwt) {
        loadingView.style.display = 'none';
        if (jwt) {
            authView.style.display = 'block';
            unauthView.style.display = 'none';
            try {
                // Decode simple payload
                const payload = JSON.parse(atob(jwt.split('.')[1]));
                userInfo.textContent = payload.email || "Authenticated User";
            } catch (e) {
                userInfo.textContent = "Authenticated User";
            }
        } else {
            authView.style.display = 'none';
            unauthView.style.display = 'block';
        }
    }

    // Initial state check
    chrome.storage.local.get(['supabaseToken'], (result) => {
        updateUI(result.supabaseToken);
    });

    // Force sync triggers background check
    forceSyncBtn.addEventListener('click', () => {
        forceSyncBtn.textContent = 'Syncing...';
        chrome.runtime.sendMessage({ action: "syncAuth" }, (response) => {
            setTimeout(() => { forceSyncBtn.textContent = 'Force Auth Sync'; }, 1000);
            if (response && response.token) {
                updateUI(response.token);
            } else {
                updateUI(null);
            }
        });
    });
});