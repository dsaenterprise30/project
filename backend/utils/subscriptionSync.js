// backend/utils/subscriptionSync.js
import razorpay from "../config/razorpay.js";
import SubscriptionPlan from "../models/subscriptionPlan.js";

/**
 * Syncs a user's subscription status live with Razorpay API.
 * If Razorpay subscription is active and has a valid future period end date,
 * automatically updates user's subscriptionActive, subscriptionStatus, and subscriptionExpiry in MongoDB.
 * 
 * @param {Object} user - Mongoose User document
 * @returns {Promise<{ synced: boolean, active: boolean, user: Object }>}
 */
export async function syncUserSubscription(user) {
  if (!user || !user.subscriptionId) {
    return { synced: false, active: user ? user.subscriptionActive : false, user };
  }

  try {
    const rzpSub = await razorpay.subscriptions.fetch(user.subscriptionId);
    if (!rzpSub) {
      return { synced: false, active: user.subscriptionActive, user };
    }

    const now = new Date();
    // Razorpay current_end is Unix timestamp in seconds
    const currentEnd = rzpSub.current_end ? new Date(rzpSub.current_end * 1000) : null;
    const isRzpActive = rzpSub.status === "active" || rzpSub.status === "authenticated";

    if (isRzpActive && currentEnd && currentEnd > now) {
      user.subscriptionActive = true;
      user.subscriptionStatus = "Active";
      user.subscriptionExpiry = currentEnd;

      // Ensure plan details are populated if missing
      if (rzpSub.plan_id && (!user.planType || !user.planName)) {
        const plan = await SubscriptionPlan.findOne({ razorpayPlanId: rzpSub.plan_id });
        if (plan) {
          user.planType = plan.planType;
          user.planName = plan.name;
          user.planPrice = plan.price;
        }
      }

      await user.save();
      console.log(`✅ Live Sync Success: Re-activated user ${user.mobileNumber} (${user.fullName}) via Razorpay until ${currentEnd.toISOString()}`);
      return { synced: true, active: true, user };
    } else if (rzpSub.status === "cancelled" || rzpSub.status === "halted" || rzpSub.status === "paused" || rzpSub.status === "expired") {
      // If Razorpay indicates subscription is no longer active and expiry has passed
      if (!user.subscriptionExpiry || user.subscriptionExpiry <= now) {
        user.subscriptionActive = false;
        user.subscriptionStatus = rzpSub.status === "cancelled" ? "Cancelled" : "Inactive";
        await user.save();
      }
      return { synced: true, active: user.subscriptionActive, user };
    }
  } catch (err) {
    console.error(`⚠️ Live Sync Warning for user ${user.mobileNumber} (${user.subscriptionId}):`, err.message);
  }

  return { synced: false, active: user.subscriptionActive, user };
}
