import User from "../models/User.js";
import { syncUserSubscription } from "../utils/subscriptionSync.js";

async function checkSubscription(req, res, next) {
  try {
    const userId = req.userId; // ✅ set by verifyAccessToken
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const now = new Date();

    // If no active subscription or expired, attempt live sync with Razorpay first
    if (!user.subscriptionActive || !user.subscriptionExpiry || user.subscriptionExpiry < now) {
      if (user.subscriptionId) {
        const syncResult = await syncUserSubscription(user);
        if (syncResult.active) {
          return next();
        }
      }

      user.subscriptionActive = false;
      user.subscriptionStatus = "Inactive";
      await user.save();

      return res.status(403).json({
        success: false,
        message: "⚠️ Please subscribe to continue.",
        subscriptionActive: false,
        subscriptionStatus: user.subscriptionStatus,
      });
    }

    next();
  } catch (error) {
    console.error("checkSubscription error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
}

export default checkSubscription;
