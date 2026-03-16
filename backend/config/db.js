// ============================================================
//  config/db.js
//  Connects to MongoDB Atlas via Mongoose.
//  Called once at server startup.
// ============================================================

const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("ERROR: MONGODB_URI environment variable is not set.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("✦ MongoDB connected successfully.");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
