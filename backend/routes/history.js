// ============================================================
//  routes/history.js
//  Prompt history endpoints — all protected by JWT auth.
//
//  GET    /history         — fetch user's last 10 entries
//  DELETE /history/:id     — delete a single entry
//  PATCH  /history/:id/favourite — toggle favourite flag
// ============================================================

const express        = require("express");
const authMiddleware = require("../middleware/auth");
const PromptHistory  = require("../models/PromptHistory");

const router = express.Router();

// ── GET /history ──────────────────────────────────────────────
// Returns the user's history sorted newest first
router.get("/", authMiddleware, async (req, res) => {
  try {
    const history = await PromptHistory.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.json({ success: true, history });
  } catch (err) {
    console.error("[/history GET]", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch history." });
  }
});

// ── DELETE /history/:id ───────────────────────────────────────
// Deletes a single history entry — only if it belongs to the user
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const entry = await PromptHistory.findOneAndDelete({
      _id:    req.params.id,
      userId: req.user._id, // ensures users can only delete their own
    });

    if (!entry) {
      return res.status(404).json({ success: false, error: "Entry not found." });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[/history DELETE]", err.message);
    return res.status(500).json({ success: false, error: "Failed to delete entry." });
  }
});

// ── PATCH /history/:id/favourite ─────────────────────────────
// Toggles the favourite flag on a history entry
router.patch("/:id/favourite", authMiddleware, async (req, res) => {
  try {
    const entry = await PromptHistory.findOne({
      _id:    req.params.id,
      userId: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({ success: false, error: "Entry not found." });
    }

    entry.favourite = !entry.favourite;
    await entry.save();

    return res.json({ success: true, favourite: entry.favourite });
  } catch (err) {
    console.error("[/history PATCH favourite]", err.message);
    return res.status(500).json({ success: false, error: "Failed to update favourite." });
  }
});

module.exports = router;
