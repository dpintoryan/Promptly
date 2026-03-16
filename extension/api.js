// ============================================================
//  api.js
//  A thin fetch() wrapper that automatically attaches the
//  stored JWT to every request header.
//  All extension files import their API calls from here.
// ============================================================

// Replace with your actual Railway URL after deploying
const BACKEND_URL = "https://YOUR-RAILWAY-URL.up.railway.app";

// ── Get the stored JWT from chrome.storage ───────────────────
async function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get("pp_token", (result) => {
      resolve(result.pp_token || null);
    });
  });
}

// ── Core fetch wrapper ────────────────────────────────────────
// Automatically adds Authorization header if a token exists.
// Returns { ok, status, data } — never throws.
async function apiFetch(path, options = {}) {
  const token = await getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };

  } catch (err) {
    // Network error (offline, Railway down, etc.)
    console.error("[API] Network error:", err.message);
    return {
      ok:     false,
      status: 0,
      data:   { error: "Network error. Check your connection." },
    };
  }
}

// ── Named API methods ─────────────────────────────────────────

// POST /auth/google — exchange Google ID token for a JWT
async function authWithGoogle(idToken) {
  return apiFetch("/auth/google", {
    method: "POST",
    body:   JSON.stringify({ idToken }),
  });
}

// GET /auth/me — get current user data using stored JWT
async function getMe() {
  return apiFetch("/auth/me");
}

// POST /auth/signout — notify backend (optional)
async function signOut() {
  return apiFetch("/auth/signout", { method: "POST" });
}

// POST /optimize — optimize a prompt
async function optimizePrompt(rawPrompt, framework, systemPrompt) {
  return apiFetch("/optimize", {
    method: "POST",
    body:   JSON.stringify({ rawPrompt, framework, systemPrompt }),
  });
}

// ── History API methods ───────────────────────────────────────

// GET /history — fetch user's prompt history
async function getHistory() {
  return apiFetch("/history");
}

// DELETE /history/:id — delete a single history entry
async function deleteHistoryEntry(id) {
  return apiFetch(`/history/${id}`, { method: "DELETE" });
}

// PATCH /history/:id/favourite — toggle favourite on an entry
async function toggleFavourite(id) {
  return apiFetch(`/history/${id}/favourite`, { method: "PATCH" });
}
