// ============================================================
//  middleware/globalRateLimit.js
//  Two layers of IP-based rate limiting:
//
//  1. globalLimiter   — 100 requests per 15 min per IP
//     Catches bots hammering every endpoint indiscriminately.
//
//  2. authLimiter     — 10 requests per 15 min per IP
//     Tighter limit on auth endpoints to slow brute-force
//     or token-farming attempts.
//
//  These run BEFORE JWT auth, so even unauthenticated
//  requests are throttled.
// ============================================================

const rateLimit = require("express-rate-limit");

// ── Global limiter — applied to every route ───────────────────
const globalLimiter = rateLimit({
  windowMs:          15 * 60 * 1000,  // 15 minutes
  max:               100,              // 100 requests per window per IP
  standardHeaders:   true,
  legacyHeaders:     false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    return req.headers["x-forwarded-for"]?.split(",")[0].trim()
      || req.ip
      || "unknown";
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error:   "TOO_MANY_REQUESTS",
      message: "Too many requests from this IP. Please wait 15 minutes before trying again.",
    });
  },
});

// ── Auth limiter — applied only to /auth/* routes ─────────────
const authLimiter = rateLimit({
  windowMs:          15 * 60 * 1000,  // 15 minutes
  max:               10,               // only 10 auth attempts per window
  standardHeaders:   true,
  legacyHeaders:     false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    return req.headers["x-forwarded-for"]?.split(",")[0].trim()
      || req.ip
      || "unknown";
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error:   "AUTH_RATE_LIMITED",
      message: "Too many sign-in attempts. Please wait 15 minutes before trying again.",
    });
  },
});

module.exports = { globalLimiter, authLimiter };
