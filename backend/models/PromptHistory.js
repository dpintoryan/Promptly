// ============================================================
//  models/PromptHistory.js
// ============================================================

const mongoose = require("mongoose");

const promptHistorySchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },
    framework: {
      type:     String,
      required: true,
      enum:     ["TCRTE", "CoT", "FewShot"],
    },
    rawPrompt: {
      type:      String,
      required:  true,
      maxlength: 1000,
    },
    optimizedPrompt: {
      type:     String,
      required: true,
    },
    tokenStats: {
      rawOutputTokens:       { type: Number, required: true },
      optimizedOutputTokens: { type: Number, required: true },
      savedTokens:           { type: Number, required: true },
      savingsPct:            { type: Number, required: true },
      costPer100Raw:         { type: Number, required: true },
      costPer100Optimized:   { type: Number, required: true },
    },
    favourite: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ── Trim to last 10 entries per user after save ───────────────
promptHistorySchema.post("save", async function () {
  const History = this.constructor;
  const count   = await History.countDocuments({ userId: this.userId });
  if (count > 10) {
    const excess  = count - 10;
    const oldest  = await History.find({ userId: this.userId, favourite: false })
      .sort({ createdAt: 1 }).limit(excess).select("_id");
    if (oldest.length > 0) {
      await History.deleteMany({ _id: { $in: oldest.map((e) => e._id) } });
    } else {
      const oldestAll = await History.find({ userId: this.userId })
        .sort({ createdAt: 1 }).limit(excess).select("_id");
      await History.deleteMany({ _id: { $in: oldestAll.map((e) => e._id) } });
    }
  }
});

module.exports = mongoose.model("PromptHistory", promptHistorySchema);
