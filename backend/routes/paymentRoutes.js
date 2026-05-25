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

    // Configure standard recurring mandate validity limits for UPI Autopay.
    // (Bypasses Google Pay's 4-day one-time mandate cap by ensuring totalCount is sufficiently large,
    // and explicitly sets end_at to display the exact intended validity period).
    let totalCount = 11; // 1 month plan: 11 transaction cycles
    if (plan.planType === "YEARLY") {
      totalCount = 12; // 12 cycles
    } else if (plan.planType === "HALF_YEARLY") {
      totalCount = 12; // 12 cycles
    }

    const subscriptionPayload = {
      plan_id: plan.razorpayPlanId,
      customer_notify: 1,
      total_count: totalCount,
      customer_id: razorCustomer.id,
    };

    // Explicitly set mandate end_at validity to exactly 1 year or 6 months from now
    const now = new Date();
    if (plan.planType === "YEARLY") {
      const oneYearFromNow = new Date(now);
      oneYearFromNow.setFullYear(now.getFullYear() + 1);
      oneYearFromNow.setDate(oneYearFromNow.getDate() + 1); // 1-day buffer
      subscriptionPayload.end_at = Math.floor(oneYearFromNow.getTime() / 1000);
    } else if (plan.planType === "HALF_YEARLY") {
      const sixMonthsFromNow = new Date(now);
      sixMonthsFromNow.setMonth(now.getMonth() + 6);
      sixMonthsFromNow.setDate(sixMonthsFromNow.getDate() + 1); // 1-day buffer
      subscriptionPayload.end_at = Math.floor(sixMonthsFromNow.getTime() / 1000);
    }

    const subscription = await razorpay.subscriptions.create(subscriptionPayload);

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

    let user = await User.findOne({ subscriptionId: razorpay_subscription_id });
    
    // 🔄 Robust Fallback: If subscription ID is overwritten or mismatched in the database,
    // fetch details from Razorpay to find the user by their contact number and heal the state.
    if (!user) {
      console.log(`⚠️ Subscription ID ${razorpay_subscription_id} not found in DB. Initiating fallback customer lookup...`);
      try {
        const rzpSub = await razorpay.subscriptions.fetch(razorpay_subscription_id);
        if (rzpSub && rzpSub.customer_id) {
          const rzpCustomer = await razorpay.customers.fetch(rzpSub.customer_id);
          if (rzpCustomer && rzpCustomer.contact) {
            let contactNum = rzpCustomer.contact.replace(/\D/g, "");
            if (contactNum.length === 10) {
              contactNum = "91" + contactNum;
            }
            const mobileNumber = Number(contactNum);
            
            user = await User.findOne({ mobileNumber });
            if (user) {
              console.log(`✅ Robust Fallback: Found user ${user.fullName} (${mobileNumber}) via contact. Healing subscriptionId...`);
              user.subscriptionId = razorpay_subscription_id;
              
              if (rzpSub.plan_id) {
                const plan = await SubscriptionPlan.findOne({ razorpayPlanId: rzpSub.plan_id });
                if (plan) {
                  user.planType = plan.planType;
                  user.planName = plan.name;
                  user.planPrice = plan.price;
                }
              }
              await user.save();
            }
          }
        }
      } catch (err) {
        console.error("❌ Robust Fallback customer lookup failed:", err.message);
      }
    }

    if (!user) {
      return res.status(404).json({ status: "failed", message: "User not found" });
    }

    // Check if it's already active (e.g. webhook was faster)
    if (user.subscriptionStatus !== "Active") {
      // Determine the duration of the plan
      // Determine the duration of the plan in months
      let durationInMonths = 1;
      if (user.planType) {
        const plan = await SubscriptionPlan.findOne({ planType: user.planType });
        if (plan) {
          durationInMonths = plan.interval === "yearly" ? (plan.duration * 12) : (plan.duration || 1);
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
        expiry = addMonths(now, durationInMonths);
        user.hasUsedTrial = true;
      } else {
        const base = user.subscriptionExpiry && user.subscriptionExpiry > now ? user.subscriptionExpiry : now;
        expiry = addMonths(base, durationInMonths);
      }

      user.subscriptionActive = true;
      user.subscriptionStatus = "Active";
      user.subscriptionExpiry = expiry;
      user.paymentId = razorpay_payment_id;

      await user.save();

      // Cancel auto-renewal for Yearly and Half-Yearly plans immediately so they end once their time finishes
      if (user.planType === "YEARLY" || user.planType === "HALF_YEARLY") {
        try {
          await razorpay.subscriptions.cancel(user.subscriptionId);
          console.log(`Auto-cancelled renewal for ${user.planType} subscription: ${user.subscriptionId}`);
        } catch (err) {
          console.warn(`Failed to auto-cancel subscription ${user.subscriptionId}:`, err.message);
        }
      }
    }

    res.json({ status: "success", message: "Payment verified successfully" });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ status: "failed", message: "Server error" });
  }
});

export default router;
