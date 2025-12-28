// paymentRoutes.js
import express from "express";
import razorpay from "../config/razorpay.js";
import User from "../models/User.js";
import dotenv from "dotenv";
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
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ status: "failed", message: "Mobile number is required" });
    }

    // Find user in DB
    const user = await User.findOne({ mobileNumber: mobileNumber });
    if (!user) {
      return res.status(404).json({ status: "failed", message: "User not found" });
    }

    // Create or reuse a Razorpay customer for this user (recommended)
    let razorCustomer;
    try {
      razorCustomer = await findOrCreateCustomerByContact({
        mobileNumber,
        fullName: user.fullName,
        email: user.email || undefined,
      });
    } catch (err) {
      console.error("Razorpay customer creation error:", err && err.message);
      return res.status(500).json({ status: "failed", message: "Failed to create customer for payment provider" });
    }

    // Create subscription using Plan ID and customer_id
    const payload = {
      plan_id: process.env.RAZORPAY_PLAN_ID,
      customer_notify: 1,
      total_count: 12,
      customer_id: razorCustomer.id,
    };

    const subscription = await razorpay.subscriptions.create(payload);

    // Save subscription id to user
    await User.findOneAndUpdate(
      { mobileNumber: mobileNumber },
      {
        subscriptionId: subscription.id,
        subscriptionStatus: "Inactive", // subscription will be marked Active on webhook activation
      }
    );

    return res.json({
      status: "success",
      message: "Subscription created. Complete payment through Razorpay.",
      subscriptionId: subscription.id,
      subscription,
    });
  } catch (error) {
    console.error("Error in create-subscription:", error && error.message, error);
    return res.status(500).json({
      status: "failed",
      message: "Server error while creating subscription",
      error: error && error.message,
    });
  }
});

export default router;
