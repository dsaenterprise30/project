import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required.'],
    trim: true,
  },
  mobileNumber: {
    type: Number,
    required: [true, 'Mobile number is required.'],
    unique: true,
    trim: true,
    match: [/^91[0-9]{10}$/, 'Please fill a valid 10-digit mobile number.'],
  },
  email: {
    type: String,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required.'],
    minlength: [6, 'Password must be at least 6 characters long.'],
  },
  registrationDate: {
    type: Date,
    default: Date.now,
  },
  type: {
    type: String,
    enum: ['Agent', 'Admin'],
    default: 'Agent',
  },

  // Subscription state
  subscriptionActive: {
    type: Boolean,
    default: false,     // ❗️Default false – becomes true only after successful payment/webhook
  },
  subscriptionStatus: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Inactive",
  },
  subscriptionId: {
    type: String,
    default: null,
  },
  subscriptionExpiry: {
    type: Date,
    default: null,      // Will be calculated based on 7 days trial + 1 month for first time
  },
  paymentId: {
    type: String,
    default: null,
  },

  // Whether 7 days free trial benefit has already been used
  hasUsedTrial: {
    type: Boolean,
    default: false,
  },
});

const User = mongoose.model('User', UserSchema);
export default User;
