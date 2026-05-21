// paymentRoutes.js
import express from "express";
import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import User from "../models/User.js";
import dotenv from "dotenv";
import SubscriptionPlan from "../models/subscriptionPlan.js";
dotenv.config();

const router = express.Router();

// Helper: create or find customer in Razorpay using mobileNumber (contact)
async function findOrCreateCustomerByContact({ mobileNumber, fullName, email }) {
  const contactPlain = String(mobileNumber).replace(/^\+/, "");
  try {
    const customer = await razorpay.customers.create({
      name: fullName || `User ${contactPlain.slice(-4)}`,
      contact: contactPlain,
      email: email || undefined,
    });
    return customer;
  } catch (err) {
    // If Razorpay returns a duplicate-customer error, try to fetch customers by contact using list (best-effort)
    console.warn("create customer failed, trying fallback list:", err && err.message);
    try {
      const list = await razorpay.customers.all({ contact: contactPlain, count: 5 });
      if (list && list.items && list.items.length > 0) return list.items[0];
    } catch (e) {
      console.warn("fallback customer list also failed:", e && e.message);
    }
    throw err;
  }
}

// Route to create a new subscription
router.post("/create-subscription", async (req, res) => {
  const { mobileNumber, planType } = req.body;

  try {
    if (!mobileNumber || !planType) {
      return res.status(400).json({ message: "Mobile number and planType are required" });
    }

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check for active subscription
    if (user.subscriptionStatus === "Active") {
      // If user is trying to subscribe to the SAME plan, block it
      if (user.planType === planType) {
        return res.status(400).json({ message: "You are already subscribed to this plan." });
      }

      // If different plan (Upgrade/Downgrade):
      // 1. Cancel the OLD subscription (stop auto-renewal)
      if (user.subscriptionId) {
        try {
          await razorpay.subscriptions.cancel(user.subscriptionId);
          console.log(`Cancelled old subscription ${user.subscriptionId} for upgrade/downgrade.`);
        } catch (err) {
          console.warn("Failed to cancel old subscription (might be already cancelled):", err.message);
          // Continue anyway to allow new subscription
        }
      }

      // 2. Proceed to create NEW subscription below... (User pays NOW)
    }

    const plan = await SubscriptionPlan.findOne({ planType, isActive: true });
    if (!plan) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const razorCustomer = await findOrCreateCustomerByContact({
      mobileNumber: user.mobileNumber,
      fullName: user.fullName || user.name,
      email: user.email,
    });

    // Calculate the exact end date based on plan duration in months
    const now = new Date();
    const addMonths = (date, months) => {
      const d = new Date(date);
      const day = d.getDate();
      d.setMonth(d.getMonth() + months);
      if (d.getDate() < day) d.setDate(0);
      return d;
    };

    // Set a minimal validity window that still allows ongoing automatic renewals
    // (This ensures the UPI mandate remains valid for automatic renewals, but keeps the window as short as possible)
    let totalCount = 12; // Default: 12 cycles (e.g., 1 year of monthly charges)
    if (plan.interval === "yearly") {
      totalCount = 2; // 2 years (2 yearly cycles)
    } else if (plan.interval === "monthly" && plan.duration === 6) {
      totalCount = 2; // 1 year (2 half-yearly cycles)
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: plan.razorpayPlanId,
      customer_notify: 1,
      total_count: totalCount,
      customer_id: razorCustomer.id,
    });

    await User.findOneAndUpdate(
      { mobileNumber },
      {
        subscriptionId: subscription.id,
        subscriptionStatus: "Inactive",
        planType: plan.planType,
        planName: plan.name,
        planPrice: plan.price,
      }
    );

    res.json({
      status: "success",
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// Route to verify a subscription payment manually
router.post("/verify-subscription", async (req, res) => {
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("RAZORPAY_KEY_SECRET is missing");
      return res.status(500).json({ status: "failed", message: "Server misconfiguration" });
    }

    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(razorpay_payment_id + "|" + razorpay_subscription_id);
    const expectedSignature = shasum.digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ status: "failed", message: "Invalid signature" });
    }

    const user = await User.findOne({ subscriptionId: razorpay_subscription_id });
    if (!user) {
      return res.status(404).json({ status: "failed", message: "User not found" });
    }

    // Check if it's already active (e.g. webhook was faster)
    if (user.subscriptionStatus !== "Active") {
      // Determine the duration of the plan in months
      let duration = 1;
      if (user.planType) {
        const plan = await SubscriptionPlan.findOne({ planType: user.planType });
        if (plan) {
          duration = plan.interval === "yearly" ? plan.duration * 12 : plan.duration;
        }
      }

      // Calculate expiry
      const now = new Date();
      const addMonths = (date, months) => {
        const d = new Date(date);
        const day = d.getDate();
        d.setMonth(d.getMonth() + months);
        if (d.getDate() < day) d.setDate(0);
        return d;
      };

      let expiry;
      if (!user.hasUsedTrial) {
        expiry = addMonths(now, duration);
        user.hasUsedTrial = true;
      } else {
        const base = user.subscriptionExpiry && user.subscriptionExpiry > now ? user.subscriptionExpiry : now;
        expiry = addMonths(base, duration);
      }

      user.subscriptionActive = true;
      user.subscriptionStatus = "Active";
      user.subscriptionExpiry = expiry;
      user.paymentId = razorpay_payment_id;

      await user.save();
    }

    res.json({ status: "success", message: "Payment verified successfully" });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ status: "failed", message: "Server error" });
  }
});

export default router;
