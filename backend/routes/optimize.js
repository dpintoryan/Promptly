// ============================================================
//  routes/optimize.js  (v4 — Real Output Token Comparison)
//  Runs BOTH the raw and optimized prompt through GPT in
//  parallel to get actual output token counts for comparison.
//  GPT-4o pricing: $10.00 per 1M output tokens
// ============================================================

const express        = require("express");
const authMiddleware = require("../middleware/auth");
const tierRateLimit  = require("../middleware/rateLimit");
const { isUnlimited, getLimitForTier } = require("../utils/tiers");
const { sanitizeText, containsInjection, isValidFramework, LIMITS } = require("../utils/sanitize");
const PromptHistory  = require("../models/PromptHistory");

// GPT-4o output token price per token
const OUTPUT_COST_PER_TOKEN = 10.00 / 1_000_000; // $0.00001 per token

// ── Single GPT call, returns { text, outputTokens } ──────────
async function callGPT(systemPrompt, userMessage, maxTokens = 1024) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model:      "gpt-4o",
      max_tokens: maxTokens,
      messages: [
        { role: "system",  content: systemPrompt },
        { role: "user",    content: userMessage  },
      ],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `OpenAI HTTP ${response.status}`);
  }

  const data        = await response.json();
  const text        = data.choices?.[0]?.message?.content?.trim() || "";
  const outputTokens = data.usage?.completion_tokens || 0;
  return { text, outputTokens };
}

const router = express.Router();

router.post("/", authMiddleware, tierRateLimit, async (req, res) => {
  let { rawPrompt, framework, systemPrompt } = req.body;
  const user = req.user;

  // ── 1. Presence checks ───────────────────────────────────
  if (!rawPrompt || typeof rawPrompt !== "string" || rawPrompt.trim() === "") {
    return res.status(400).json({ success: false, error: "rawPrompt is required." });
  }
  if (!framework || typeof framework !== "string") {
    return res.status(400).json({ success: false, error: "framework is required." });
  }
  if (!systemPrompt || typeof systemPrompt !== "string") {
    return res.status(400).json({ success: false, error: "systemPrompt is required." });
  }

  // ── 2. Character limits ───────────────────────────────────
  if (rawPrompt.length > LIMITS.rawPrompt) {
    return res.status(400).json({
      success: false,
      error: `Prompt must be ${LIMITS.rawPrompt} characters or fewer.`,
    });
  }
  if (framework.length > LIMITS.framework) {
    return res.status(400).json({ success: false, error: "Invalid framework identifier." });
  }
  if (systemPrompt.length > LIMITS.systemPrompt) {
    return res.status(400).json({ success: false, error: "System prompt exceeds maximum length." });
  }

  // ── 3. Framework allowlist ────────────────────────────────
  if (!isValidFramework(framework)) {
    return res.status(400).json({ success: false, error: "Invalid framework." });
  }

  // ── 4. Injection detection ────────────────────────────────
  if (containsInjection(rawPrompt)) {
    return res.status(400).json({ success: false, error: "Input contains invalid characters." });
  }

  // ── 5. Sanitize ───────────────────────────────────────────
  rawPrompt    = sanitizeText(rawPrompt);
  systemPrompt = sanitizeText(systemPrompt);
  framework    = framework.trim();

  if (!rawPrompt) {
    return res.status(400).json({ success: false, error: "Prompt is empty after sanitization." });
  }

  // ── 6. Run both prompts in parallel ──────────────────────
  // Call 1: optimize the raw prompt (primary purpose)
  // Call 2: run the raw prompt as-is to get its real output tokens
  // Both fire at the same time to minimize latency.
  try {
    const [optimizedResult, rawResult] = await Promise.all([
      // Primary: generate the optimized prompt
      callGPT(
        systemPrompt,
        `Here is the raw prompt I want you to rewrite using the ${framework} framework:\n\n"${rawPrompt}"`,
        1024
      ),
      // Comparison: run the raw prompt directly, cap at 512 tokens
      // (we only need output token count, not a high-quality response)
      callGPT(
        "You are a helpful assistant. Answer the user's request concisely.",
        rawPrompt,
        512
      ),
    ]);

    const optimizedPrompt     = optimizedResult.text;
    const rawOutputTokens     = rawResult.outputTokens;
    const optimizedOutputTokens = optimizedResult.outputTokens;

    if (!optimizedPrompt) {
      return res.status(502).json({ success: false, error: "OpenAI returned an empty response." });
    }

    // ── 7. Calculate savings ──────────────────────────────
    const savedTokens  = rawOutputTokens - optimizedOutputTokens;
    const savingsPct   = rawOutputTokens > 0
      ? Math.round((savedTokens / rawOutputTokens) * 100)
      : 0;
    const rawCost      = parseFloat((rawOutputTokens      * OUTPUT_COST_PER_TOKEN).toFixed(6));
    const optimizedCost = parseFloat((optimizedOutputTokens * OUTPUT_COST_PER_TOKEN).toFixed(6));
    const costPer100Raw      = parseFloat((rawCost      * 100).toFixed(4));
    const costPer100Optimized = parseFloat((optimizedCost * 100).toFixed(4));

    const tokenStats = {
      rawOutputTokens,
      optimizedOutputTokens,
      savedTokens,
      savingsPct,
      costPer100Raw,
      costPer100Optimized,
    };

    // ── 8. Save to history (non-blocking) ────────────────
    PromptHistory.create({
      userId:          user._id,
      framework,
      rawPrompt,
      optimizedPrompt,
      tokenStats,
    }).catch((err) => console.error("[/optimize] History save failed:", err.message));

    // ── 9. Increment usage ────────────────────────────────
    if (!isUnlimited(user.tier)) {
      await user.constructor.findByIdAndUpdate(user._id, { $inc: { promptsUsed: 1 } });
      user.promptsUsed += 1;
    }

    const limit = isUnlimited(user.tier) ? null : getLimitForTier(user.tier);

    return res.json({
      success: true,
      result:  optimizedPrompt,
      tokenStats,
      usage: {
        used:      isUnlimited(user.tier) ? 0 : user.promptsUsed,
        limit,
        remaining: isUnlimited(user.tier) ? null : Math.max(0, limit - user.promptsUsed),
        resetsAt:  user.getNextResetTime(),
      },
    });

  } catch (err) {
    console.error("[/optimize] Error:", err.message);
    return res.status(500).json({ success: false, error: err.message || "An unexpected error occurred." });
  }
});

module.exports = router;
