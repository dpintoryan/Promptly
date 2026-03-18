// ============================================================
//  storage.js
//  chrome.storage.local helpers for Promptly standalone.
//  Stores: API keys per provider, selected provider,
//          selected model, and prompt history.
// ============================================================

const STORAGE_KEYS = {
  API_KEYS:  "promptly_api_keys",   // { openai: "sk-...", anthropic: "...", ... }
  PROVIDER:  "promptly_provider",   // "openai" | "anthropic" | "gemini" | "deepseek" | "grok"
  MODEL:     "promptly_model",      // model string
  HISTORY:   "promptly_history",    // array of history entries
};

// ── Provider + Model ──────────────────────────────────────────

async function getSelectedProvider() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.PROVIDER, (r) => {
      resolve(r[STORAGE_KEYS.PROVIDER] || "openai");
    });
  });
}

async function saveSelectedProvider(providerId) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.PROVIDER]: providerId }, resolve);
  });
}

async function getSelectedModel() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.MODEL, (r) => {
      resolve(r[STORAGE_KEYS.MODEL] || null);
    });
  });
}

async function saveSelectedModel(model) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.MODEL]: model }, resolve);
  });
}

// ── API Keys ──────────────────────────────────────────────────
// Keys are stored as an object so users can save keys for
// multiple providers and switch between them freely.

async function getAllApiKeys() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.API_KEYS, (r) => {
      resolve(r[STORAGE_KEYS.API_KEYS] || {});
    });
  });
}

async function getApiKeyForProvider(providerId) {
  const keys = await getAllApiKeys();
  return keys[providerId] || null;
}

async function saveApiKeyForProvider(providerId, key) {
  const keys = await getAllApiKeys();
  keys[providerId] = key;
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.API_KEYS]: keys }, resolve);
  });
}

async function clearApiKeyForProvider(providerId) {
  const keys = await getAllApiKeys();
  delete keys[providerId];
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.API_KEYS]: keys }, resolve);
  });
}

// ── History ───────────────────────────────────────────────────

async function getHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.HISTORY, (r) => {
      resolve(r[STORAGE_KEYS.HISTORY] || []);
    });
  });
}

async function saveHistory(entries) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: entries }, resolve);
  });
}

async function addHistoryEntry(entry) {
  const history = await getHistory();
  const updated = [
    { ...entry, id: Date.now().toString(), createdAt: new Date().toISOString() },
    ...history,
  ];
  // Keep last 10, drop oldest non-favourites first
  if (updated.length > 10) {
    const idx = [...updated].reverse().findIndex((e, i) => !e.favourite && i > 0);
    if (idx !== -1) updated.splice(updated.length - 1 - idx, 1);
    else updated.pop();
  }
  await saveHistory(updated);
  return updated;
}

async function deleteHistoryEntry(id) {
  const history = await getHistory();
  const updated  = history.filter((e) => e.id !== id);
  await saveHistory(updated);
  return updated;
}

async function toggleHistoryFavourite(id) {
  const history = await getHistory();
  const updated  = history.map((e) => e.id === id ? { ...e, favourite: !e.favourite } : e);
  await saveHistory(updated);
  return updated;
}
