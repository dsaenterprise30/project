// paymentRoutes.js
import express from "express";
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

    const totalCount =
      plan.interval === "yearly" ? 1 : plan.duration;

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


export default router;
