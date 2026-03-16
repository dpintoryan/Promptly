// ============================================================
//  middleware/auth.js
//  Verifies the JWT sent in the Authorization header.
//  Attaches the decoded user payload to req.user.
// ============================================================

const jwt  = require("jsonwebtoken");
const User = require("../models/User");

async function authMiddleware(req, res, next) {
  // Expect: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error:   "UNAUTHORIZED",
      message: "No token provided. Please sign in.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify the token signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the live user record so tier/usage changes are reflected immediately
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error:   "UNAUTHORIZED",
        message: "User not found. Please sign in again.",
      });
    }

    // Attach to request for use in route handlers
    req.user = user;
    next();

  } catch (err) {
    // jwt.verify throws if expired or tampered
    return res.status(401).json({
      success: false,
      error:   "TOKEN_INVALID",
      message: "Session expired or invalid. Please sign in again.",
    });
  }
}

module.exports = authMiddleware;
