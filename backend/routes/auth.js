// ============================================================
//  routes/auth.js
// ============================================================

const express = require("express");
const jwt     = require("jsonwebtoken");

const User           = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { isUnlimited, getLimitForTier } = require("../utils/tiers");

const router = express.Router();

const ADMIN_EMAIL = "YOUR_ADMIN_EMAIL@gmail.com";

function createJWT(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, tier: user.tier },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function buildUserResponse(user) {
  const limit = isUnlimited(user.tier) ? null : getLimitForTier(user.tier);
  return {
    displayName:  user.displayName,
    email:        user.email,
    avatar:       user.avatar,
    tier:         user.tier,
    promptsUsed:  user.promptsUsed,
    promptsLimit: limit,
    resetsAt:     user.getNextResetTime(),
  };
}

// ============================================================
//  POST /auth/google
//  Receives a Google OAuth access token from chrome.identity.
//  Verifies it by calling Google's userinfo endpoint,
//  then creates/updates the user and returns a JWT.
// ============================================================
router.post("/google", async (req, res) => {
  const { idToken } = req.body; // this is actually an access token from chrome.identity

  if (!idToken) {
    return res.status(400).json({ success: false, error: "Token is required." });
  }

  try {
    // Verify the access token by fetching the user's profile from Google
    const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!googleRes.ok) {
      return res.status(401).json({ success: false, error: "Invalid Google token." });
    }

    const profile = await googleRes.json();
    const { sub: googleId, email, name, picture } = profile;

    if (!googleId || !email) {
      return res.status(401).json({ success: false, error: "Could not retrieve Google profile." });
    }

    // Assign tier — admin if email matches, otherwise basic
    const tier = email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "basic";

    // Upsert user record
    const user = await User.findOneAndUpdate(
      { googleId },
      {
        $set: {
          email:       email.toLowerCase(),
          displayName: name,
          avatar:      picture,
          tier,
        },
        $setOnInsert: {
          promptsUsed:   0,
          lastResetDate: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    const token = createJWT(user);

    return res.json({ success: true, token, user: buildUserResponse(user) });

  } catch (err) {
    console.error("[/auth/google] Error:", err.message);
    return res.status(500).json({ success: false, error: "Authentication failed. Please try again." });
  }
});

// ============================================================
//  GET /auth/me
// ============================================================
router.get("/me", authMiddleware, async (req, res) => {
  const user = req.user;
  const wasReset = user.checkAndResetDaily();
  if (wasReset) await user.save();
  return res.json({ success: true, user: buildUserResponse(user) });
});

// ============================================================
//  POST /auth/signout
// ============================================================
router.post("/signout", authMiddleware, (req, res) => {
  return res.json({ success: true, message: "Signed out." });
});

module.exports = router;
