// ============================================================
//  Promptly Standalone – popup.js  (v3 — Multi-Provider, No Token Tracking)
// ============================================================

// ── Security ──────────────────────────────────────────────────
const MAX_PROMPT_LENGTH = 1000;
const INJECTION_PATTERNS = [/<script[\s\S]*?>/i, /javascript\s*:/i, /on\w+\s*=\s*["'][^"']*["']/i, /data\s*:\s*text\/html/i, /vbscript\s*:/i];
function sanitizeInput(str) { return str.replace(/<[^>]*>/g, "").replace(/[\x00-\x08\x0B\x0E-\x1F\x7F]/g, "").trim(); }
function looksLikeInjection(str) { return INJECTION_PATTERNS.some((p) => p.test(str)); }

// ── Frameworks ────────────────────────────────────────────────
const FRAMEWORKS = {
  TCRTE: { systemPrompt: `You are an expert prompt engineer. Rewrite the user's raw prompt using the TCRTE framework.\nTCRTE sections: ROLE (who the AI should be), CONTEXT (background), TASK (what to do), CONSTRAINTS (rules/limits), OUTPUT FORMAT (structure).\nRules: Preserve intent completely. Use exact headers. Return ONLY the improved prompt, no preamble.` },
  CoT:   { systemPrompt: `You are an expert prompt engineer. Rewrite the user's raw prompt using Chain-of-Thought (CoT).\nInclude: clear task, step-by-step reasoning instructions, sequential stages for complex tasks.\nRules: Preserve intent. Add "think step by step" instructions. Return ONLY the improved prompt, no preamble.` },
  FewShot: { systemPrompt: `You are an expert prompt engineer. Rewrite the user's raw prompt using the Few-Shot framework.\nInclude: clear task, 2-3 labeled examples (Example 1, Example 2) showing input→output, then the actual request.\nRules: Preserve intent. Create realistic examples. Return ONLY the improved prompt, no preamble.` },
};

// ── State ─────────────────────────────────────────────────────
let selectedFramework  = "TCRTE";
let selectedProviderId = "openai";
let selectedModel      = "gpt-4o";
let currentFilter      = "all";
let historyCache       = [];

// ── DOM refs ──────────────────────────────────────────────────
const tabNav          = document.getElementById("tabNav");
const tabBtns         = document.querySelectorAll(".tab-btn");
const headerRight     = document.getElementById("headerRight");
const providerChip    = document.getElementById("providerChip");
const chipDot         = document.getElementById("chipDot");
const chipLabel       = document.getElementById("chipLabel");
const modelSelect     = document.getElementById("modelSelect");
const apiKeyInput     = document.getElementById("apiKeyInput");
const toggleKeyBtn    = document.getElementById("toggleKeyBtn");
const saveBtn         = document.getElementById("saveBtn");
const setupStatus     = document.getElementById("setupStatus");
const rawPromptEl     = document.getElementById("rawPrompt");
const perfectPromptEl = document.getElementById("perfectPrompt");
const perfectBtn      = document.getElementById("perfectBtn");
const statusBar       = document.getElementById("statusBar");
const outputSection   = document.getElementById("outputSection");
const copyBtn         = document.getElementById("copyBtn");
const clearBtn        = document.getElementById("clearBtn");
const historyList     = document.getElementById("historyList");
const filterBtns      = document.querySelectorAll(".filter-btn");
const footerProvider  = document.getElementById("footerProvider");
const docsLink        = document.getElementById("docsLink");

// ── Helpers ───────────────────────────────────────────────────
function showView(name) { document.querySelectorAll(".view").forEach((v) => v.classList.remove("active")); document.getElementById(`view-${name}`)?.classList.add("active"); }
function showStatus(el, msg, type = "error") { el.textContent = msg; el.className = `status-bar ${type}`; }
function hideStatus(el) { el.className = "status-bar"; el.textContent = ""; }
function setLoading(on) { perfectBtn.disabled = on; perfectBtn.textContent = on ? "⏳ Optimizing…" : "✦ PERFECT THIS PROMPT"; }
function formatDate(iso) { const d = new Date(iso); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); }

function updateProviderChip(providerId) {
  const p = PROVIDERS[providerId];
  if (!p) return;
  chipLabel.textContent      = p.name;
  chipDot.style.background   = p.color;
  footerProvider.textContent = p.name;
  footerProvider.style.color = p.color;
}

function populateModels(providerId, savedModel) {
  const p = PROVIDERS[providerId];
  modelSelect.innerHTML = p.models.map((m) =>
    `<option value="${m}" ${m === (savedModel || p.defaultModel) ? "selected" : ""}>${m}</option>`
  ).join("");
}

function updateDocsLink(providerId) {
  const p = PROVIDERS[providerId];
  docsLink.innerHTML = `Get your key at <a href="${p.docsUrl}" target="_blank">${p.docsUrl.replace("https://", "")}</a>`;
}

// ── Provider card selection ───────────────────────────────────
document.querySelectorAll(".provider-card").forEach((card) => {
  card.addEventListener("click", async () => {
    document.querySelectorAll(".provider-card").forEach((c) => c.classList.remove("active"));
    card.classList.add("active");
    selectedProviderId = card.dataset.provider;
    const existingKey = await getApiKeyForProvider(selectedProviderId);
    apiKeyInput.value = existingKey || "";
    apiKeyInput.className = `key-input${existingKey ? " has-key" : ""}`;
    apiKeyInput.placeholder = PROVIDERS[selectedProviderId].placeholder;
    populateModels(selectedProviderId, null);
    updateDocsLink(selectedProviderId);
  });
});

toggleKeyBtn.addEventListener("click", () => {
  apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
});

// ── Save key ──────────────────────────────────────────────────
saveBtn.addEventListener("click", async () => {
  const key   = apiKeyInput.value.trim();
  const model = modelSelect.value;
  if (!key) { showStatus(setupStatus, "⚠ Please enter your API key.", "error"); return; }

  saveBtn.disabled = true;
  saveBtn.textContent = "Verifying…";
  hideStatus(setupStatus);

  try {
    await callProvider(selectedProviderId, key, model, "You are a helpful assistant.", "Say OK", 5);
    await saveApiKeyForProvider(selectedProviderId, key);
    await saveSelectedProvider(selectedProviderId);
    await saveSelectedModel(model);
    selectedModel = model;
    saveBtn.disabled = false;
    saveBtn.textContent = "✦ SAVE & START";
    updateProviderChip(selectedProviderId);
    headerRight.style.display = "flex";
    tabNav.classList.add("visible");
    showView("main");
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = "✦ SAVE & START";
    showStatus(setupStatus, `✗ ${err.message}`, "error");
  }
});

apiKeyInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveBtn.click(); });

providerChip.addEventListener("click", async () => {
  document.querySelectorAll(".provider-card").forEach((c) => {
    c.classList.toggle("active", c.dataset.provider === selectedProviderId);
  });
  const existingKey = await getApiKeyForProvider(selectedProviderId);
  apiKeyInput.value = existingKey || "";
  apiKeyInput.className = `key-input${existingKey ? " has-key" : ""}`;
  apiKeyInput.placeholder = PROVIDERS[selectedProviderId].placeholder;
  populateModels(selectedProviderId, selectedModel);
  updateDocsLink(selectedProviderId);
  tabNav.classList.remove("visible");
  showView("setup");
});

// ── Framework cards ───────────────────────────────────────────
document.querySelectorAll(".fw-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".fw-card").forEach((c) => c.classList.remove("active"));
    card.classList.add("active");
    selectedFramework = card.dataset.framework;
  });
});

// ── Tabs ──────────────────────────────────────────────────────
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.tab === "history") { showView("history"); renderHistoryView(); }
    else showView("main");
  });
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderHistory(historyCache);
  });
});

// ── History ───────────────────────────────────────────────────
function renderHistory(entries) {
  const filtered = currentFilter === "favourites" ? entries.filter((e) => e.favourite) : entries;
  if (filtered.length === 0) {
    historyList.innerHTML = `<div class="history-empty"><span>${currentFilter === "favourites" ? "★" : "📭"}</span>${currentFilter === "favourites" ? "No favourites yet." : "No history yet. Optimize a prompt to get started."}</div>`;
    return;
  }

  historyList.innerHTML = filtered.map((entry) => {
    const providerName = PROVIDERS[entry.provider]?.name || entry.provider || "";
    return `
      <div class="history-card ${entry.favourite ? "is-favourite" : ""}" data-id="${entry.id}">
        <div class="hcard-top">
          <div class="hcard-meta">
            <span class="hcard-framework">${entry.framework}</span>
            ${providerName ? `<span class="hcard-provider">${providerName}</span>` : ""}
            <span class="hcard-date">${formatDate(entry.createdAt)}</span>
          </div>
          <div class="hcard-actions">
            <button class="hcard-btn copy-btn" data-id="${entry.id}">Copy</button>
            <button class="hcard-btn fav-btn ${entry.favourite ? "active" : ""}" data-id="${entry.id}">★</button>
            <button class="hcard-btn del-btn" data-id="${entry.id}">✕</button>
          </div>
        </div>
        <div class="hcard-prompt"><strong>Raw:</strong> ${entry.rawPrompt}</div>
      </div>`;
  }).join("");

  historyList.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entry = historyCache.find((e) => e.id === btn.dataset.id);
      if (!entry) return;
      navigator.clipboard.writeText(entry.optimizedPrompt).then(() => {
        btn.textContent = "✓"; setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      });
    });
  });

  historyList.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      historyCache = await toggleHistoryFavourite(btn.dataset.id);
      renderHistory(historyCache);
    });
  });

  historyList.querySelectorAll(".del-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      historyCache = await deleteHistoryEntry(btn.dataset.id);
      renderHistory(historyCache);
    });
  });
}

async function renderHistoryView() {
  historyCache = await getHistory();
  renderHistory(historyCache);
}

// ── Optimize ──────────────────────────────────────────────────
async function perfectPrompt() {
  let rawText = rawPromptEl.value.trim();
  if (!rawText) { showStatus(statusBar, "⚠ Please enter a prompt."); return; }
  if (looksLikeInjection(rawText)) { showStatus(statusBar, "⚠ Input contains invalid characters."); return; }  
  rawText = sanitizeInput(rawText);
  if (!rawText) { showStatus(statusBar, "⚠ Prompt is empty after sanitization."); return; }

  const apiKey = await getApiKeyForProvider(selectedProviderId);
  if (!apiKey) { showView("setup"); return; }

  hideStatus(statusBar);
  setLoading(true);
  perfectPromptEl.value = "";

  try {
    const result = await callProvider(
      selectedProviderId, apiKey, selectedModel,
      FRAMEWORKS[selectedFramework].systemPrompt,
      `Rewrite this prompt using the ${selectedFramework} framework:\n\n"${rawText}"`,
      1024
    );

    setLoading(false);
    if (!result.text) { showStatus(statusBar, "✗ Provider returned an empty response."); return; }

    perfectPromptEl.value = result.text;

    historyCache = await addHistoryEntry({
      provider:        selectedProviderId,
      model:           selectedModel,
      framework:       selectedFramework,
      rawPrompt:       rawText,
      optimizedPrompt: result.text,
      favourite:       false,
    });

    outputSection.classList.remove("reveal");
    void outputSection.offsetWidth;
    outputSection.classList.add("reveal");
    showStatus(statusBar, "✓ Prompt optimized successfully!", "success");

  } catch (err) {
    setLoading(false);
    showStatus(statusBar, `✗ ${err.message}`);
    if (err.message.toLowerCase().includes("invalid") && err.message.toLowerCase().includes("key")) {
      setTimeout(() => { showView("setup"); }, 1500);
    }
  }
}

perfectBtn.addEventListener("click", perfectPrompt);
rawPromptEl.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); perfectPrompt(); } });

copyBtn.addEventListener("click", () => {
  const text = perfectPromptEl.value.trim(); if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = "Copied!"; copyBtn.classList.add("copied");
    setTimeout(() => { copyBtn.textContent = "Copy"; copyBtn.classList.remove("copied"); }, 2000);
  });
});

clearBtn.addEventListener("click", () => { perfectPromptEl.value = ""; hideStatus(statusBar); });

rawPromptEl.addEventListener("input", () => {
  const len = rawPromptEl.value.length;
  const el  = document.getElementById("charCounter");
  if (!el) return;
  el.textContent = `${len} chars`;
});

// ── Init ──────────────────────────────────────────────────────
async function init() {
  selectedProviderId = await getSelectedProvider();
  selectedModel      = await getSelectedModel() || PROVIDERS[selectedProviderId].defaultModel;
  const apiKey       = await getApiKeyForProvider(selectedProviderId);
  historyCache       = await getHistory();

  document.querySelectorAll(".provider-card").forEach((c) => {
    c.classList.toggle("active", c.dataset.provider === selectedProviderId);
  });
  populateModels(selectedProviderId, selectedModel);
  updateDocsLink(selectedProviderId);
  if (apiKey) { apiKeyInput.value = apiKey; apiKeyInput.className = "key-input has-key"; }
  apiKeyInput.placeholder = PROVIDERS[selectedProviderId].placeholder;

  if (apiKey) {
    updateProviderChip(selectedProviderId);
    headerRight.style.display = "flex";
    tabNav.classList.add("visible");
    showView("main");
  } else {
    showView("setup");
  }
}

init();
