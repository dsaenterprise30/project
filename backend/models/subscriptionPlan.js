import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    planType: { type: String, required: true, unique: true },
    price: Number,
    interval: {
      type: String,
      enum: ["monthly", "yearly"],
    },
    duration: Number, // in months
    razorpayPlanId: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
