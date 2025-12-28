import mongoose from "mongoose";
import dotenv from "dotenv";
import SubscriptionPlan from "../models/subscriptionPlan.js";

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

await SubscriptionPlan.create([
  {
    name: "Monthly Plan",
    planType: "MONTHLY",
    price: 1999,
    interval: "monthly",
    duration: 1,
    razorpayPlanId: "plan_Rl8vBqXsXZqYK8"
  },
  {
    name: "Half Yearly Plan",
    planType: "HALF_YEARLY",
    price: 10000,
    interval: "monthly",
    duration: 6,
    razorpayPlanId: "plan_RwyKHUivjtDSTY"
  },
  {
    name: "Yearly Plan",
    planType: "YEARLY",
    price: 20000,
    interval: "yearly",
    duration: 1,
    razorpayPlanId: "plan_RwyMoXHvXTCHHD"
  }
]);



console.log("Basic plan seeded");
process.exit();
