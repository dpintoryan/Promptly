// ============================================================
//  middleware/rateLimit.js
//  Checks tier limits and handles the daily reset logic.
//  Must run AFTER authMiddleware (req.user must exist).
// ============================================================

const { getLimitForTier, isUnlimited } = require("../utils/tiers");

async function tierRateLimit(req, res, next) {
  const user = req.user;

  // ── Admin: skip all checks ───────────────────────────────
  if (isUnlimited(user.tier)) {
    return next();
  }

  // ── Check and reset daily counter if a new day started ──
  const wasReset = user.checkAndResetDaily();
  if (wasReset) {
    // Save the reset to the database before proceeding
    await user.save();
  }

  // ── Enforce the daily limit ──────────────────────────────
  const limit = getLimitForTier(user.tier);

  if (user.promptsUsed >= limit) {
    return res.status(429).json({
      success:  false,
      error:    "DAILY_LIMIT_REACHED",
      tier:     user.tier,
      limit,
      used:     user.promptsUsed,
      resetsAt: user.getNextResetTime(),
      message:  `You've used all ${limit} prompts for today. Resets at midnight EST.`,
    });
  }

  // Under the limit — proceed to the route handler
  next();
}

module.exports = tierRateLimit;
