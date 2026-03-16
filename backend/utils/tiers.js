// ============================================================
//  utils/tiers.js
//  Central source of truth for all tier configuration.
//  Add new tiers or adjust limits here only.
// ============================================================

const TIERS = {
  basic: {
    name:       "Basic",
    dailyLimit: 10,
    unlimited:  false,
  },
  pro: {
    name:       "Pro",
    dailyLimit: 50,
    unlimited:  false,
  },
  admin: {
    name:       "Admin",
    dailyLimit: Infinity,
    unlimited:  true,
  },
};

// Returns the daily prompt limit for a given tier string.
function getLimitForTier(tier) {
  return TIERS[tier]?.dailyLimit ?? TIERS.basic.dailyLimit;
}

// Returns true if this tier has unlimited prompts.
function isUnlimited(tier) {
  return TIERS[tier]?.unlimited === true;
}

module.exports = { TIERS, getLimitForTier, isUnlimited };
