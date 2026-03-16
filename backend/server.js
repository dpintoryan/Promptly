// ============================================================
//  Promptly – server.js
//  Main entry point with full security middleware stack.
// ============================================================

require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./config/db");
const { globalLimiter, authLimiter } = require("./middleware/globalRateLimit");

const authRouter     = require("./routes/auth");
const optimizeRouter = require("./routes/optimize");
const historyRouter  = require("./routes/history");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Validate required environment variables ──────────────────
const REQUIRED_ENV = ["OPENAI_API_KEY", "MONGODB_URI", "JWT_SECRET", "GOOGLE_CLIENT_ID"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`ERROR: Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

// ── Connect to MongoDB ───────────────────────────────────────
connectDB();

// ── Security headers (Helmet) ────────────────────────────────
// Sets safe HTTP headers: removes X-Powered-By, adds
// X-Content-Type-Options, X-Frame-Options, HSTS, etc.
app.use(helmet());

// ── Trust Railway's reverse proxy ────────────────────────────
app.set("trust proxy", 1);

// ── CORS ─────────────────────────────────────────────────────
app.use(cors());

// ── Body parsing with size limit ─────────────────────────────
// Reject any request body over 50kb — prevents payload flood attacks
app.use(express.json({ limit: "50kb" }));

// ── NoSQL injection protection ───────────────────────────────
// Strips $ and . from keys in req.body, req.params, req.query
// Prevents MongoDB operator injection e.g. { "$gt": "" }
app.use(mongoSanitize({
  replaceWith: "_",      // replace $ and . with _ instead of removing
  onSanitizeError: (req, res) => {
    res.status(400).json({
      success: false,
      error:   "Invalid characters detected in request.",
    });
  },
}));

// ── Global IP rate limit (all routes) ────────────────────────
app.use(globalLimiter);

// ── Routes ───────────────────────────────────────────────────
// Auth routes get a stricter rate limit on top of the global one
app.use("/auth",     authLimiter, authRouter);
app.use("/optimize", optimizeRouter);
app.use("/history",  historyRouter);

// ── Health check ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 fallback ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route '${req.method} ${req.path}' not found.` });
});

// ── Global error handler ─────────────────────────────────────
// Catches any unhandled errors thrown in route handlers
app.use((err, req, res, next) => {
  console.error("[server] Unhandled error:", err.message);
  res.status(500).json({ success: false, error: "An unexpected error occurred." });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✦ Promptly backend running on port ${PORT}`);
});
