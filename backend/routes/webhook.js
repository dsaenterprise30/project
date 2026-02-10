// webhook.js
import express from "express";
import crypto from "crypto";
import User from "../models/User.js";
import dotenv from "dotenv";
import SubscriptionPlan from "../models/subscriptionPlan.js";
dotenv.config();

const router = express.Router();

// Helper: add N months
const addMonths = (date, months) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Handle edge cases (e.g., Jan 31 + 1 month -> Feb 28/29)
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
};

// ... (existing helper addOneMonth removed or replaced) ...

// Since we need raw body to verify signature, we define a raw body route
router.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      const rawBody = req.body; // Buffer
      const receivedSig = req.headers["x-razorpay-signature"];

      if (!receivedSig) {
        console.warn("No signature header on webhook");
        return res.status(400).json({ status: "failed", message: "Missing signature" });
      }

      const shasum = crypto.createHmac("sha256", secret);
      shasum.update(rawBody);
      const digest = shasum.digest("hex");

      if (digest !== receivedSig) {
        console.warn("Webhook signature mismatch", { digest, receivedSig });
        return res.status(400).json({ status: "failed", message: "Invalid signature" });
      }

      // Parse payload AFTER signature verified
      const bodyJson = JSON.parse(rawBody.toString("utf8"));
      const event = bodyJson.event;
      const payload = bodyJson.payload || {};

      // Helper to get duration from plan
      const getPlanDuration = async (planId) => {
        if (!planId) return 1; // Default to 1 month
        try {
          // Avoid circular dependency issues if possible, or just standard import
          // SubscriptionPlan is imported at top
          const plan = await SubscriptionPlan.findOne({ razorpayPlanId: planId });
          return plan ? plan.duration : 1;
        } catch (e) {
          console.error("Error finding plan duration:", e);
          return 1;
        }
      };

      // Handle first activation of subscription
      if (event === "subscription.activated") {
        const subscriptionEntity = payload.subscription?.entity;
        if (subscriptionEntity) {
          const subscriptionId = subscriptionEntity.id;
          const planId = subscriptionEntity.plan_id;
          const user = await User.findOne({ subscriptionId });

          if (user) {
            const now = new Date();
            const duration = await getPlanDuration(planId);

            if (!user.hasUsedTrial) {
              // Trial Logic (if needed, or just standard start)
              // Assuming trial is fixed 7 days, OR just start immediately
              // If trial is NOT part of this flow anymore, simpler:
              const expiry = addMonths(now, duration);

              user.subscriptionActive = true;
              user.subscriptionStatus = "Active";
              user.subscriptionExpiry = expiry;
              user.hasUsedTrial = true; // Mark trial as used
            } else {
              const base = user.subscriptionExpiry && user.subscriptionExpiry > now ? user.subscriptionExpiry : now;
              const expiry = addMonths(base, duration);

              user.subscriptionActive = true;
              user.subscriptionStatus = "Active";
              user.subscriptionExpiry = expiry;
            }

            if (subscriptionEntity.customer_details?.email && !user.email) {
              user.email = subscriptionEntity.customer_details.email;
            }

            // Update plan info if missing
            if (planId) {
              const plan = await SubscriptionPlan.findOne({ razorpayPlanId: planId });
              if (plan) {
                user.planType = plan.planType;
                user.planName = plan.name;
                user.planPrice = plan.price;
              }
            }

            await user.save();
            console.log(`✅ Subscription activated for ${user.mobileNumber}. Expires: ${user.subscriptionExpiry} (${duration} months)`);
          } else {
            console.warn("subscription.activated: user not found for subscriptionId:", subscriptionId);
          }
        }
      }

      // Invoice paid (automatic recurring charge)
      if (event === "invoice.paid") {
        const invoiceEntity = payload.invoice?.entity;
        const subscriptionEntity = payload.subscription?.entity;
        // Note: invoice.paid payload usually has subscription_id inside invoice entity

        if (invoiceEntity && invoiceEntity.subscription_id) {
          const subscriptionId = invoiceEntity.subscription_id;

          // Try to get plan_id from invoice line items or subscription entity if available
          // Usually we look up User to see their current plan or fetch generic default
          // Ideally we fetch the subscription from Razorpay API to get plan_id, 
          // but here we can try to look up the user's current plan or just default 1.
          // Better: The User model should store the plan_id? Or we just assume the same plan.
          // Let's rely on the User's stored planType to find the duration, or default 1.

          const user = await User.findOne({ subscriptionId });
          if (user) {
            let duration = 1;
            if (user.planType) {
              const plan = await SubscriptionPlan.findOne({ planType: user.planType });
              if (plan) duration = plan.duration;
            }

            const now = new Date();
            const base = user.subscriptionExpiry && user.subscriptionExpiry > now ? user.subscriptionExpiry : now;
            const expiry = addMonths(base, duration);

            user.subscriptionActive = true;
            user.subscriptionStatus = "Active";
            user.subscriptionExpiry = expiry;

            // Update Payment ID if available
            if (invoiceEntity.payment_id) {
              user.paymentId = invoiceEntity.payment_id;
            }

            if (invoiceEntity.customer_email && !user.email) {
              user.email = invoiceEntity.customer_email;
            }

            await user.save();
            console.log(`📅 Invoice paid: extended subscription for ${user.mobileNumber} to ${user.subscriptionExpiry} (+${duration} months)`);
          } else {
            console.warn("invoice.paid: user not found for subscriptionId:", invoiceEntity.subscription_id);
          }
        }
      }

      // Subscription charged (Backup/Alternative for renewal)
      if (event === "subscription.charged") {
        const subscriptionEntity = payload.subscription?.entity;
        const paymentEntity = payload.payment?.entity; // Payment details often included

        if (subscriptionEntity) {
          const subscriptionId = subscriptionEntity.id;
          const planId = subscriptionEntity.plan_id;

          const user = await User.findOne({ subscriptionId });
          if (user) {
            const duration = await getPlanDuration(planId);
            const now = new Date();
            const base = user.subscriptionExpiry && user.subscriptionExpiry > now ? user.subscriptionExpiry : now;
            const expiry = addMonths(base, duration);

            user.subscriptionActive = true;
            user.subscriptionStatus = "Active";
            user.subscriptionExpiry = expiry;

            // Update Payment ID from payment entity
            if (paymentEntity && paymentEntity.id) {
              user.paymentId = paymentEntity.id;
            }

            if (subscriptionEntity.customer_email && !user.email) {
              user.email = subscriptionEntity.customer_email;
            }

            await user.save();
            console.log(`✅ Subscription charged: extended for ${user.mobileNumber} to ${user.subscriptionExpiry} (+${duration} months)`);
          } else {
            console.warn("subscription.charged: user not found for subscriptionId:", subscriptionId);
          }
        }
      }

      if (event === "subscription.cancelled" || event === "subscription.halted" || event === "subscription.paused") {
        const subscriptionEntity = payload.subscription?.entity;
        if (subscriptionEntity) {
          const subscriptionId = subscriptionEntity.id;
          await User.findOneAndUpdate({ subscriptionId }, { subscriptionActive: false, subscriptionStatus: "Inactive" });
          console.log(`❌ Subscription cancelled/paused: ${subscriptionId}`);
        }
      }

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Error in webhook:", error && error.message, error);
      res.status(500).json({ status: "failed", message: "Server error in webhook", error: error && error.message });
    }
  }
);

export default router;
