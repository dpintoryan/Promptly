// ============================================================
//  background.js  (Service Worker)
//  Handles the Google OAuth flow using chrome.identity.
// ============================================================

const BACKEND_URL = "https://YOUR-RAILWAY-URL.up.railway.app";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SIGN_IN") {
    handleSignIn().then(sendResponse).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  if (message.type === "SIGN_OUT") {
    handleSignOut().then(sendResponse).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});

// ── Helper: get a fresh access token, clearing any cached one first ──
async function getFreshToken() {
  // Step 1: get whatever token Chrome has cached (non-interactive)
  const cachedToken = await new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      resolve(token || null);
    });
  });

  // Step 2: if there's a cached token, remove it so we get a truly fresh one
  if (cachedToken) {
    await new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token: cachedToken }, resolve);
    });
  }

  // Step 3: now get a fresh token interactively (shows account picker if needed)
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

// ── Sign In ───────────────────────────────────────────────────
async function handleSignIn() {
  try {
    // Get a guaranteed fresh access token
    const accessToken = await getFreshToken();

    // Send to backend — backend verifies with Google's userinfo endpoint
    const backendResponse = await fetch(`${BACKEND_URL}/auth/google`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ idToken: accessToken }),
    });

    const backendData = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok || !backendData.success) {
      // If the token was rejected, remove it from cache so next attempt is fresh
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: accessToken }, resolve);
      });
      throw new Error(backendData.error || "Backend authentication failed.");
    }

    // Store JWT and user data
    await chrome.storage.local.set({
      pp_token: backendData.token,
      pp_user:  backendData.user,
    });

    return { success: true, user: backendData.user };

  } catch (err) {
    console.error("[background] Sign in error:", err.message);
    return { success: false, error: err.message };
  }
}

// ── Sign Out ──────────────────────────────────────────────────
async function handleSignOut() {
  try {
    // Get and remove the cached token from Chrome
    const cachedToken = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        resolve(token || null);
      });
    });

    if (cachedToken) {
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: cachedToken }, resolve);
      });
    }

    await chrome.storage.local.remove(["pp_token", "pp_user"]);
    return { success: true };

  } catch (err) {
    console.error("[background] Sign out error:", err.message);
    return { success: false, error: err.message };
  }
}
