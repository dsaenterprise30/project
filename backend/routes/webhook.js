// webhook.js
import express from "express";
import crypto from "crypto";
import User from "../models/User.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// Helper: add one calendar month
const addOneMonth = (date) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
};

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

      // Handle first activation of subscription
      if (event === "subscription.activated") {
        const subscriptionEntity = payload.subscription?.entity;
        if (subscriptionEntity) {
          const subscriptionId = subscriptionEntity.id;
          const user = await User.findOne({ subscriptionId });
          if (user) {
            const now = new Date();

            if (!user.hasUsedTrial) {
              const trialEnd = new Date(now);
              trialEnd.setDate(trialEnd.getDate() + 7);
              const expiry = addOneMonth(trialEnd);

              user.subscriptionActive = true;
              user.subscriptionStatus = "Active";
              user.subscriptionExpiry = expiry;
              user.hasUsedTrial = true;
            } else {
              const base = user.subscriptionExpiry && user.subscriptionExpiry > now ? user.subscriptionExpiry : now;
              const expiry = addOneMonth(base);
              user.subscriptionActive = true;
              user.subscriptionStatus = "Active";
              user.subscriptionExpiry = expiry;
            }

            if (subscriptionEntity.customer_details?.email && !user.email) {
              user.email = subscriptionEntity.customer_details.email;
            }

            await user.save();
            console.log(`✅ Subscription activated for ${user.mobileNumber}. Expires: ${user.subscriptionExpiry}`);
          } else {
            console.warn("subscription.activated: user not found for subscriptionId:", subscriptionId);
          }
        }
      }

      // Invoice paid (automatic recurring charge)
      if (event === "invoice.paid") {
        const invoiceEntity = payload.invoice?.entity;
        if (invoiceEntity && invoiceEntity.subscription_id) {
          const subscriptionId = invoiceEntity.subscription_id;
          const user = await User.findOne({ subscriptionId });
          if (user) {
            const now = new Date();
            const base = user.subscriptionExpiry && user.subscriptionExpiry > now ? user.subscriptionExpiry : now;
            const expiry = addOneMonth(base);

            user.subscriptionActive = true;
            user.subscriptionStatus = "Active";
            user.subscriptionExpiry = expiry;

            if (invoiceEntity.customer_email && !user.email) {
              user.email = invoiceEntity.customer_email;
            }

            await user.save();
            console.log(`📅 Invoice paid: extended subscription for ${user.mobileNumber} to ${user.subscriptionExpiry}`);
          } else {
            console.warn("invoice.paid: user not found for subscriptionId:", invoiceEntity.subscription_id);
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
