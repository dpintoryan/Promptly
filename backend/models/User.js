// ============================================================
//  models/User.js
//  Mongoose schema for PromptPerfect users.
// ============================================================

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    // Unique ID from Google OAuth — our primary lookup key
    googleId: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    email: {
      type:     String,
      required: true,
      unique:   true,
      lowercase: true,
      trim:     true,
    },

    displayName: {
      type:    String,
      default: "",
    },

    // Google profile picture URL
    avatar: {
      type:    String,
      default: "",
    },

    // "basic" | "pro" | "admin"
    tier: {
      type:    String,
      enum:    ["basic", "pro", "admin"],
      default: "basic",
    },

    // How many prompts the user has used today
    promptsUsed: {
      type:    Number,
      default: 0,
    },

    // The date when promptsUsed was last reset to 0
    // Used to detect when a new day has started (in EST)
    lastResetDate: {
      type:    Date,
      default: () => new Date(),
    },
  },
  {
    // Automatically manages createdAt and updatedAt fields
    timestamps: true,
  }
);

// ── Instance method: check if the daily counter needs resetting ──
// Resets at midnight EST (UTC-5, or UTC-4 during daylight saving).
UserSchema.methods.checkAndResetDaily = function () {
  const now = new Date();

  // Get midnight EST tonight as a UTC timestamp.
  // "America/New_York" handles EST/EDT automatically.
  const nowEST   = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const lastEST  = new Date(this.lastResetDate.toLocaleString("en-US", { timeZone: "America/New_York" }));

  const todayMidnightEST = new Date(nowEST);
  todayMidnightEST.setHours(0, 0, 0, 0);

  // If the last reset was before today's midnight EST, reset the counter
  if (lastEST < todayMidnightEST) {
    this.promptsUsed   = 0;
    this.lastResetDate = now;
    return true; // indicates a reset happened
  }
  return false;
};

// ── Instance method: calculate when the counter resets next ──
// Returns a UTC ISO string for midnight EST tonight.
UserSchema.methods.getNextResetTime = function () {
  const now    = new Date();
  const nowEST = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

  // Next midnight EST
  const nextMidnight = new Date(nowEST);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);

  // Convert back to UTC — EST is UTC-5 (or UTC-4 during EDT)
  const offsetMs = now.getTime() - nowEST.getTime();
  return new Date(nextMidnight.getTime() + offsetMs).toISOString();
};

module.exports = mongoose.model("User", UserSchema);
