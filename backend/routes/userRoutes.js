import express from "express";
const router = express.Router();

import {
  registerUser,
  forgotPassword,
  loginUser,
  resetPassword,
  adminLogin,
  logout,
  getAllUsers,
  getUserByContact,
  createSubscription,
  getSubscriptionStatus,
  deleteUser,
  updateUser,
} from "../controllers/userController.js";

import { verifyAccessToken } from "../middleware/userAuth.js";
import { checkAdminNumber } from "../middleware/checkAdminNumber.js";
import checkSubscription from "../middleware/checkSubscription.js";

// Import the User model
import User from "../models/User.js";

// User routes

// Route 1 - Register new user
router.post("/create", registerUser);

// Route 2 - Login existing user
// Don't check subscription before login — loginUser will validate subscription status and return a clear message if inactive
router.post("/login", loginUser);

// Route 3 - Forgot password (password reset request)
router.post("/forgot", forgotPassword);

// Route 4 - Forgot password (verify OTP and reset password)
router.post("/reset-password", resetPassword);

// Route 5 - Admin login
router.post("/admin-login", adminLogin);

// Route 6 - Logout user
router.post("/logout", logout);

// Route to get user by contact number
router.get("/findByContact/:contact", getUserByContact);

// Admin routes

// Route 7 - Get all users (Admin only)
router.get("/all-users", verifyAccessToken, checkAdminNumber, getAllUsers);

// Route 8 - Get user by contact
router.get("/contact/:mobileNumber", async (req, res) => {
  const { mobileNumber } = req.params;
  try {
    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// Route 9 - Delete User (Admin only)
router.delete("/delete/:id", verifyAccessToken, checkAdminNumber, deleteUser);

// Route 13 - Update User (Admin only)
router.put("/update/:id", verifyAccessToken, checkAdminNumber, updateUser);

// Subscription routes

// Route 9 - Create subscription for logged-in user (optional / admin)
router.post("/create-subscription", verifyAccessToken, createSubscription);

// Route 10 - Get subscription status for logged-in user
router.get("/subscription-status", verifyAccessToken, getSubscriptionStatus);

// Route 11 - Access premium features for subscribed users
router.get("/premium-feature", verifyAccessToken, checkSubscription, (req, res) => {
  res.json({ success: true, message: "You have access to premium content 🎉" });
});

export default router;
