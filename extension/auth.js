// ============================================================
//  auth.js
//  Helper functions for managing auth state in the extension.
//  Handles token storage and retrieval from chrome.storage.local.
// ============================================================

// ── Save JWT to storage ───────────────────────────────────────
async function saveToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pp_token: token }, resolve);
  });
}

// ── Save user data to storage ────────────────────────────────
async function saveUser(user) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pp_user: user }, resolve);
  });
}

// ── Get stored token ─────────────────────────────────────────
async function getStoredToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get("pp_token", (result) => {
      resolve(result.pp_token || null);
    });
  });
}

// ── Get stored user ──────────────────────────────────────────
async function getStoredUser() {
  return new Promise((resolve) => {
    chrome.storage.local.get("pp_user", (result) => {
      resolve(result.pp_user || null);
    });
  });
}

// ── Clear all auth data from storage ────────────────────────
async function clearAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["pp_token", "pp_user"], resolve);
  });
}

// ── Check if the stored JWT is expired ──────────────────────
// Decodes the payload without verifying (server does that).
// Used to avoid sending obviously expired tokens.
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // exp is in seconds; Date.now() is in milliseconds
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}
