// ============================================================
//  Promptly – popup.js  (v3 — History + Token Stats)
//  Controls all UI state and interacts with auth.js / api.js
// ============================================================

// ── Client-side Security Constants ──────────────────────────
const MAX_PROMPT_LENGTH = 1000;

const INJECTION_PATTERNS = [
  /<script[\s\S]*?>/i,
  /javascript\s*:/i,
  /on\w+\s*=\s*["'][^"']*["']/i,
  /data\s*:\s*text\/html/i,
  /vbscript\s*:/i,
];

function sanitizeInput(str) {
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x08\x0B\x0E-\x1F\x7F]/g, "")
    .trim();
}

function looksLikeInjection(str) {
  return INJECTION_PATTERNS.some((p) => p.test(str));
}

// ── Framework Definitions ────────────────────────────────────
const FRAMEWORKS = {
  TCRTE: {
    label: "TCRTE",
    systemPrompt: `You are an expert prompt engineer. Your job is to rewrite a user's raw prompt using the TCRTE framework.

TCRTE stands for:
- ROLE: Who the AI should act as
- CONTEXT: Background information that helps the AI understand the situation
- TASK: A clear, specific description of what must be done
- CONSTRAINTS: Rules, limits, or requirements the output must follow
- OUTPUT FORMAT: How the response should be structured

Rules you must follow:
1. Preserve the original intent completely — do not change the topic.
2. Improve clarity and specificity.
3. Use the exact section headers: ROLE, CONTEXT, TASK, CONSTRAINTS, OUTPUT FORMAT
4. Return ONLY the improved prompt. No explanations, no preamble.`,
  },
  CoT: {
    label: "Chain-of-Thought",
    systemPrompt: `You are an expert prompt engineer. Your job is to rewrite a user's raw prompt using the Chain-of-Thought (CoT) framework.

Chain-of-Thought prompts include:
- A clear task statement
- An instruction to think step-by-step
- Optionally: a worked example or reasoning scaffold

Rules you must follow:
1. Preserve the original intent completely.
2. Add explicit reasoning instructions ("think step by step", "show your reasoning").
3. Break complex tasks into clear sequential stages.
4. Return ONLY the improved prompt. No explanations, no preamble.`,
  },
  FewShot: {
    label: "Few-Shot",
    systemPrompt: `You are an expert prompt engineer. Your job is to rewrite a user's raw prompt using the Few-Shot framework.

Few-Shot prompts include:
- A clear task description
- 2-3 examples showing the pattern (input → output)
- A final prompt asking for the actual response

Rules you must follow:
1. Preserve the original intent completely.
2. Create relevant, realistic examples that demonstrate the desired pattern.
3. Make examples clearly labeled (Example 1, Example 2, etc).
4. Return ONLY the improved prompt. No explanations, no preamble.`,
  },
};

// ── DOM refs ─────────────────────────────────────────────────
const tabNav          = document.getElementById("tabNav");
const tabBtns         = document.querySelectorAll(".tab-btn");
const userStrip       = document.getElementById("userStrip");
const userAvatar      = document.getElementById("userAvatar");
const userName        = document.getElementById("userName");
const tierBadge       = document.getElementById("tierBadge");
const signoutBtn      = document.getElementById("signoutBtn");
const googleSigninBtn = document.getElementById("googleSigninBtn");
const signinStatus    = document.getElementById("signinStatus");
const rawPromptEl     = document.getElementById("rawPrompt");
const perfectPromptEl = document.getElementById("perfectPrompt");
const perfectBtn      = document.getElementById("perfectBtn");
const statusBar       = document.getElementById("statusBar");
const outputSection   = document.getElementById("outputSection");
const copyBtn         = document.getElementById("copyBtn");
const clearBtn        = document.getElementById("clearBtn");
const usageUsed       = document.getElementById("usageUsed");
const usageLimit      = document.getElementById("usageLimit");
const usageRemaining  = document.getElementById("usageRemaining");
const limitResetTime  = document.getElementById("limitResetTime");
const backBtn         = document.getElementById("backBtn");
const footerStatus    = document.getElementById("footerStatus");
const tokenStats      = document.getElementById("tokenStats");
// token stat elements are referenced by id directly in showTokenStats
const historyList     = document.getElementById("historyList");
const filterBtns      = document.querySelectorAll(".filter-btn");

// ── State ─────────────────────────────────────────────────────
let currentUser       = null;
let selectedFramework = "TCRTE";
let currentFilter     = "all";
let historyCache      = [];

// ── Helpers ───────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.add("active");
}

function showStatus(el, msg, type = "error") {
  el.textContent = msg;
  el.className   = `status-bar ${type}`;
}
function hideStatus(el) { el.className = "status-bar"; el.textContent = ""; }

function setLoading(on) {
  perfectBtn.disabled    = on;
  perfectBtn.textContent = on ? "⏳ Optimizing…" : "✦ PERFECT THIS PROMPT";
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function updateUserStrip(user) {
  if (!user) { userStrip.style.display = "none"; tabNav.classList.remove("visible"); return; }
  userStrip.style.display = "flex";
  tabNav.classList.add("visible");
  userAvatar.src  = user.avatar || "";
  userName.textContent = user.displayName || user.email || "";
  tierBadge.textContent = user.tier || "basic";
  tierBadge.className   = `tier-badge ${user.tier || "basic"}`;
}

function updateUsageBar(user) {
  if (!user) return;
  const used      = user.promptsUsed  || 0;
  const limit     = user.promptsLimit || 10;
  const remaining = Math.max(0, limit - used);
  usageUsed.textContent      = used;
  usageLimit.textContent     = user.tier === "admin" ? "∞" : limit;
  usageRemaining.textContent = user.tier === "admin" ? "Unlimited" : `${remaining} left`;
  usageRemaining.className   = "usage-count";
  if (user.tier !== "admin") {
    const pct = used / limit;
    if (pct >= 0.9) usageRemaining.classList.add("danger");
    else if (pct >= 0.7) usageRemaining.classList.add("warn");
  }
}

// ── Token stats display ───────────────────────────────────────
function showTokenStats(ts) {
  if (!ts) { tokenStats.classList.remove("visible"); return; }

  const { rawOutputTokens, optimizedOutputTokens, savingsPct, costPer100Raw, costPer100Optimized } = ts;
  const max = Math.max(rawOutputTokens, optimizedOutputTokens, 1);

  document.getElementById("barRaw").style.width = `${(rawOutputTokens / max) * 100}%`;
  document.getElementById("barOpt").style.width = `${(optimizedOutputTokens / max) * 100}%`;
  document.getElementById("valRaw").textContent = rawOutputTokens;
  document.getElementById("valOpt").textContent = optimizedOutputTokens;
  document.getElementById("costRaw").textContent = `$${costPer100Raw.toFixed(2)}`;
  document.getElementById("costOpt").textContent = `$${costPer100Optimized.toFixed(2)}`;

  const badge = document.getElementById("savingsBadge");
  if (savingsPct > 0) {
    badge.textContent = `▼ ${savingsPct}% fewer output tokens with Promptly`;
    badge.className = "savings-badge";
  } else if (savingsPct < 0) {
    badge.textContent = "Simple prompts may not benefit from optimization";
    badge.className = "savings-badge negative";
  } else {
    badge.textContent = "Same output token count";
    badge.className = "savings-badge";
  }

  tokenStats.classList.add("visible");
}

// ── Framework cards ───────────────────────────────────────────
document.querySelectorAll(".fw-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".fw-card").forEach((c) => c.classList.remove("active"));
    card.classList.add("active");
    selectedFramework = card.dataset.framework;
  });
});

// ── Tab switching ─────────────────────────────────────────────
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.tab === "history") {
      showView("history");
      loadHistory();
    } else {
      showView("main");
    }
  });
});

// ── History filter ────────────────────────────────────────────
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderHistory(historyCache);
  });
});

// ── Render history ────────────────────────────────────────────
function renderHistory(entries) {
  const filtered = currentFilter === "favourites"
    ? entries.filter((e) => e.favourite)
    : entries;

  if (filtered.length === 0) {
    historyList.innerHTML = `
      <div class="history-empty">
        <span>${currentFilter === "favourites" ? "★" : "📭"}</span>
        ${currentFilter === "favourites" ? "No favourites yet." : "No history yet. Optimize a prompt to get started."}
      </div>`;
    return;
  }

  historyList.innerHTML = filtered.map((entry) => {
    const ts = entry.tokenStats || {};
    const rawOut = ts.rawOutputTokens ?? null;
    const optOut = ts.optimizedOutputTokens ?? null;
    const savingsPct = ts.savingsPct ?? null;
    const savingsLabel = savingsPct === null ? "" : savingsPct > 0
      ? `▼ ${savingsPct}% tokens`
      : savingsPct < 0
      ? "Simple prompt"
      : "±0%";
    const savingsClass = savingsPct > 0 ? "pos" : savingsPct < 0 ? "neg" : "";

    return `
      <div class="history-card ${entry.favourite ? "is-favourite" : ""}" data-id="${entry._id}">
        <div class="hcard-top">
          <div class="hcard-meta">
            <span class="hcard-framework">${entry.framework}</span>
            <span class="hcard-date">${formatDate(entry.createdAt)}</span>
          </div>
          <div class="hcard-actions">
            <button class="hcard-btn copy-btn" data-id="${entry._id}" title="Copy optimized prompt">Copy</button>
            <button class="hcard-btn fav-btn ${entry.favourite ? "active" : ""}" data-id="${entry._id}" title="Toggle favourite">★</button>
            <button class="hcard-btn del-btn" data-id="${entry._id}" title="Delete">✕</button>
          </div>
        </div>
        <div class="hcard-prompt"><strong>Raw:</strong> ${entry.rawPrompt}</div>
        <div class="hcard-tokens">
          <span class="hcard-token-pill">${rawOut ?? "—"}→${optOut ?? "—"} output tokens</span>
          ${savingsLabel ? `<span class="hcard-reduction ${savingsClass}">${savingsLabel}</span>` : ""}
        </div>
      </div>`;
  }).join("");

  // ── Wire up card buttons ──
  historyList.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entry = historyCache.find((e) => e._id === btn.dataset.id);
      if (!entry) return;
      navigator.clipboard.writeText(entry.optimizedPrompt).then(() => {
        btn.textContent = "✓";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      });
    });
  });

  historyList.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { data, ok } = await toggleFavourite(btn.dataset.id);
      if (!ok) return;
      const entry = historyCache.find((e) => e._id === btn.dataset.id);
      if (entry) {
        entry.favourite = data.favourite;
        const card = historyList.querySelector(`.history-card[data-id="${btn.dataset.id}"]`);
        if (card) {
          card.classList.toggle("is-favourite", entry.favourite);
          btn.classList.toggle("active", entry.favourite);
        }
        if (currentFilter === "favourites") renderHistory(historyCache);
      }
    });
  });

  historyList.querySelectorAll(".del-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { ok } = await deleteHistoryEntry(btn.dataset.id);
      if (!ok) return;
      historyCache = historyCache.filter((e) => e._id !== btn.dataset.id);
      renderHistory(historyCache);
    });
  });
}

// ── Load history from API ─────────────────────────────────────
async function loadHistory() {
  historyList.innerHTML = `<div class="history-loading">Loading…</div>`;
  const { ok, data } = await getHistory();
  if (!ok) {
    historyList.innerHTML = `<div class="history-empty"><span>⚠</span>Failed to load history.</div>`;
    return;
  }
  historyCache = data.history || [];
  renderHistory(historyCache);
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  footerStatus.textContent = "Loading…";
  const token = await getStoredToken();
  if (!token || isTokenExpired(token)) {
    updateUserStrip(null);
    showView("signin");
    footerStatus.textContent = "";
    return;
  }

  const { ok, status, data } = await getMe();
  if (!ok) {
    if (status === 401) {
      await clearAuth();
      updateUserStrip(null);
      showView("signin");
    } else {
      const cached = await getStoredUser();
      if (cached) {
        currentUser = cached;
        updateUserStrip(cached);
        updateUsageBar(cached);
        showView("main");
        showStatus(statusBar, "⚠ Could not refresh — showing cached data.", "warning");
      } else {
        showView("signin");
      }
    }
    footerStatus.textContent = "";
    return;
  }

  currentUser = data.user;
  await saveUser(currentUser);
  updateUserStrip(currentUser);
  updateUsageBar(currentUser);
  footerStatus.textContent = "";
  showView("main");
}

// ── Sign In ───────────────────────────────────────────────────
googleSigninBtn.addEventListener("click", async () => {
  googleSigninBtn.disabled = true;
  googleSigninBtn.textContent = "Signing in…";
  hideStatus(signinStatus);

  chrome.runtime.sendMessage({ type: "SIGN_IN" }, async (response) => {
    googleSigninBtn.disabled = false;
    googleSigninBtn.innerHTML = `
      <svg class="google-logo" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google`;

    if (!response || !response.success) {
      showStatus(signinStatus, `✗ ${response?.error || "Sign in failed. Please try again."}`, "error");
      return;
    }

    currentUser = response.user;
    updateUserStrip(currentUser);
    updateUsageBar(currentUser);
    showView("main");
  });
});

// ── Sign Out ──────────────────────────────────────────────────
signoutBtn.addEventListener("click", async () => {
  chrome.runtime.sendMessage({ type: "SIGN_OUT" }, () => {
    currentUser = null;
    updateUserStrip(null);
    tokenStats.classList.remove("visible");
    historyCache = [];
    showView("signin");
  });
});

// ── Perfect a Prompt ──────────────────────────────────────────
async function perfectPrompt() {
  let rawText = rawPromptEl.value.trim();

  if (!rawText) {
    showStatus(statusBar, "⚠ Please enter a prompt before clicking Perfect.");
    return;
  }
  if (looksLikeInjection(rawText)) {
    showStatus(statusBar, "⚠ Input contains invalid characters or patterns.");
    return;
  }
  if (rawText.length > MAX_PROMPT_LENGTH) {
    showStatus(statusBar, `⚠ Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer (currently ${rawText.length}).`);
    return;
  }
  rawText = sanitizeInput(rawText);
  if (!rawText) {
    showStatus(statusBar, "⚠ Prompt is empty after sanitization.");
    return;
  }

  hideStatus(statusBar);
  setLoading(true);
  perfectPromptEl.value = "";
  tokenStats.classList.remove("visible");

  const framework = FRAMEWORKS[selectedFramework];
  const { ok, status, data } = await optimizePrompt(rawText, selectedFramework, framework.systemPrompt);

  setLoading(false);

  if (status === 429) {
    if (data.resetsAt) {
      const resetDate = new Date(data.resetsAt);
      limitResetTime.textContent = resetDate.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", timeZone: "America/New_York"
      }) + " EST";
    }
    showView("limit");
    return;
  }
  if (status === 401) { await clearAuth(); showView("signin"); return; }
  if (!ok) {
    showStatus(statusBar, `✗ ${data.error || "Something went wrong. Please try again."}`);
    return;
  }

  perfectPromptEl.value = data.result;
  showTokenStats(data.tokenStats || null);

  if (data.usage && currentUser) {
    currentUser.promptsUsed  = data.usage.used;
    currentUser.promptsLimit = data.usage.limit;
    updateUsageBar(currentUser);
    await saveUser(currentUser);
  }

  outputSection.classList.remove("reveal");
  void outputSection.offsetWidth;
  outputSection.classList.add("reveal");

  showStatus(statusBar, "✓ Prompt optimized successfully!", "success");

  // Refresh history cache so next History tab visit is fresh
  historyCache = [];
}

perfectBtn.addEventListener("click", perfectPrompt);
rawPromptEl.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); perfectPrompt(); }
});

// ── Copy ──────────────────────────────────────────────────────
copyBtn.addEventListener("click", () => {
  const text = perfectPromptEl.value.trim();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = "Copied!";
    copyBtn.classList.add("copied");
    setTimeout(() => { copyBtn.textContent = "Copy"; copyBtn.classList.remove("copied"); }, 2000);
  });
});

// ── Clear ─────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  perfectPromptEl.value = "";
  tokenStats.classList.remove("visible");
  hideStatus(statusBar);
});

// ── Back from limit view ──────────────────────────────────────
backBtn.addEventListener("click", () => {
  tabBtns.forEach((b) => b.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="optimize"]').classList.add("active");
  showView("main");
});

// ── Live char counter ─────────────────────────────────────────
rawPromptEl.addEventListener("input", () => {
  const len = rawPromptEl.value.length;
  const counter = document.getElementById("charCounter");
  if (!counter) return;
  counter.textContent = `${len} / ${MAX_PROMPT_LENGTH}`;
  counter.style.color = len > 950 ? "var(--danger)" : len > 850 ? "var(--gold)" : "var(--muted)";
});

// ── Kick off ──────────────────────────────────────────────────
init();
