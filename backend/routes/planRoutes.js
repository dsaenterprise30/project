import express from "express";
import SubscriptionPlan from "../models/subscriptionPlan.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).select("-razorpayPlanId");
    return res.json(plans);
  } catch (err) {
    console.error("Failed to fetch plans:", err);
    return res.status(500).json({ message: "Server error fetching plans" });
  }
});

export default router;
