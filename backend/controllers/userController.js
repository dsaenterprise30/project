import User from '../models/User.js';
import RentFlat from '../models/rentflats.js';
import SellFlat from '../models/sellflats.js';
import bcrypt from "bcrypt";
import express from 'express';
import jwt from "jsonwebtoken";
import { generateRefreshToken, generateAccessToken, sendTokenResponse } from './jwtController.js';

// ---- Global in-memory pending user store ----
const pendingUsers = {};

// Helper: add one calendar month to a date
const addOneMonth = (date) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);

  // If month rolled over (e.g., from 31st to next month shorter), adjust
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
};

//Route 1 - Register user
export const registerUser = async (req, res) => {
  const { fullName, mobileNumber, password } = req.body;

  try {
    if (!fullName || !mobileNumber || !password) {
      return res.status(400).json({ msg: 'Please enter all fields.' });
    }

    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      return res.status(400).json({ msg: 'A user with this mobile number already exists.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters long.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashpassword = await bcrypt.hash(password, salt);

    pendingUsers[mobileNumber] = {
      fullName,
      mobileNumber,
      password: hashpassword
    };

    // ❗️User is created only as "not yet subscribed" – payment must happen
    const newUser = new User({
      fullName,
      mobileNumber,
      password: hashpassword,
      subscriptionActive: false,
      subscriptionStatus: "Inactive",
      subscriptionExpiry: null,
      hasUsedTrial: false, // first subscription will apply 7 days free + 1 month
    });

    await newUser.save();

    res.status(201).json({
      status: 'success',
      message: '✅ User registered successfully (OTP & payment pending). Please complete payment to activate your 7 days free + 1 month subscription.',
      data: {
        fullName: newUser.fullName,
        contact: newUser.mobileNumber,
        subscriptionStatus: newUser.subscriptionStatus,
        subscriptionExpiry: newUser.subscriptionExpiry
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ msg: 'Server error. Please try again later.' });
  }
};

//Route 2 - Login user
export const loginUser = async (req, res) => {
  const { mobileNumber, password } = req.body;
  try {
    if (!mobileNumber || !password) {
      return res.status(400).json({ message: 'Please enter all fields.' });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password should be at least 6 characters."
      });
    }

    const existingUser = await User.findOne({ mobileNumber });
    if (!existingUser) {
      return res.status(400).json({
        message: "Mobile number is not registered."
      });
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Password does not match."
      });
    }

    // ✅ Check subscription validity
    let subscriptionActive = existingUser.subscriptionActive;

    if (existingUser.subscriptionExpiry && existingUser.subscriptionExpiry < new Date()) {
      subscriptionActive = false;
      existingUser.subscriptionActive = false;
      existingUser.subscriptionStatus = "Inactive";
      await existingUser.save();
    }

    if (!subscriptionActive) {
      return res.status(403).json({
        message: "⚠️ Your subscription is not active or has expired. Please subscribe to continue.",
        subscriptionActive: false,
        subscriptionStatus: existingUser.subscriptionStatus || "Inactive"
      });
    }

    // ✅ Login successful (subscription is active)
    res.status(200).json({
      status: 'success',
      message: 'User logged in successfully',
      token: generateAccessToken(existingUser), // assuming this embeds userId & mobileNumber
      data: {
        userId: existingUser._id,
        fullName: existingUser.fullName,
        mobileNumber: existingUser.mobileNumber,
        subscriptionActive: existingUser.subscriptionActive,
        subscriptionStatus: existingUser.subscriptionStatus,
        subscriptionExpiry: existingUser.subscriptionExpiry,
      }
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// Route - Get User by Contact
export const getUserByContact = async (req, res) => {
  try {
    let { contact } = req.params;

    // Normalize to 91XXXXXXXXXX
    if (/^[0-9]{10}$/.test(contact)) {
      contact = "91" + contact;
    }

    // 1️⃣ Check in User collection
    const user = await User.findOne({ mobileNumber: contact });
    if (user) {
      if (user.subscriptionStatus === "Active") {
        return res.json({
          message: "user",
          fullName: user.fullName,
          mobileNumber: user.mobileNumber.toString().slice(-10),
        });
      } else {
        return res.status(403).json({ message: "User is not active." });
      }
    }

    // 2️⃣ Check in RentFlat
    const rentUserDetails = await RentFlat.findOne({ contact: contact });
    if (rentUserDetails) {
      return res.json({
        message: "rent",
        fullName: rentUserDetails.userName,
        mobileNumber: rentUserDetails.contact.toString().slice(-10),
      });
    }

    // 3️⃣ Check in SellFlat
    const sellUserDetails = await SellFlat.findOne({ contact: contact });
    if (sellUserDetails) {
      return res.json({
        message: "sell",
        fullName: sellUserDetails.userName,
        mobileNumber: sellUserDetails.contact.toString().slice(-10),
      });
    }

    // 4️⃣ Not found anywhere → allow manual entry
    return res.status(200).json({
      message: "Data is not associated with this number, You can write the name manually",
      fullName: null,
      mobileNumber: contact.slice(-10),
    });

  } catch (err) {
    console.error("Error fetching user by contact:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

//Route 3 - Forgot Password
export const forgotPassword = async (req, res) => {
  const { contact } = req.body;

  if (!contact) {
    return res.status(400).json({ msg: 'Please enter your mobile number.' });
  }

  try {
    const existingUser = await User.findOne({ mobileNumber: contact });
    if (!existingUser) {
      return res.status(400).json({ msg: 'Mobile number is not registered.' });
    }

    res.status(200).json({
      status: "success",
      message: "User exists. Proceed with OTP verification using Firebase.",
    });

  } catch (error) {
    console.error('Error processing forgot password request:', error);
    res.status(500).json({ msg: 'Server error. Please try again later.' });
  }
};

//Route 4 - reset password
export const resetPassword = async (req, res) => {
  const { contact, confirmPassword, newPassword } = req.body;

  if (!contact || !confirmPassword || !newPassword) {
    return res.status(400).json({ msg: "Mobile number, confirm password and new password are required." });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ msg: "Passwords do not match." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ msg: "Password must be at least 6 characters long." });
  }

  try {
    const user = await User.findOne({ mobileNumber: contact });
    if (!user) {
      return res.status(400).json({ msg: "User not found." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Password updated successfully. Please log in again.",
    });

  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ msg: "Server error. Please try again later." });
  }
};

// Route 5 - Admin Login
export const adminLogin = async (req, res) => {
  const { mobileNumber, password } = req.body;
  try {
    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(400).json({ message: "Admin not found" });
    }

    const adminNumber = process.env.ADMIN_NUMBER;
    const phoneNumber = user.mobileNumber;
    if (String(phoneNumber) !== String(adminNumber)) {
      return res.status(403).json({
        message: "Access denied, only admin can access."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "❌ Invalid password" });
    }

    res.status(200).json({
      status: 'success',
      message: 'Admin logged in successfully',
      token: generateAccessToken(user),
      data: {
        fullName: user.fullName,
        mobileNumber: user.mobileNumber
      }
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error: " + error.message });
  }
};

//Route 7 - Get All Users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

//Route 9 - logout User
export const logout = async (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      path: "/"
    });

    res.status(200).json({
      message: "Logged Out Successfully - Come Back Soon!"
    });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Route 10 - Create Subscription (manual / admin use only)
export const createSubscription = async (req, res) => {
  const userId = req.userId; // From verifyAccessToken middleware
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const now = new Date();

    // First subscription created manually – apply 7 days free + 1 month
    if (!user.hasUsedTrial) {
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 7);
      const expiry = addOneMonth(trialEnd);

      user.subscriptionActive = true;
      user.subscriptionStatus = "Active";
      user.subscriptionExpiry = expiry;
      user.hasUsedTrial = true;
    } else {
      // Renewal – only 1 month, no free days
      const base = user.subscriptionExpiry && user.subscriptionExpiry > now
        ? user.subscriptionExpiry
        : now;

      const expiry = addOneMonth(base);
      user.subscriptionActive = true;
      user.subscriptionStatus = "Active";
      user.subscriptionExpiry = expiry;
    }

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Subscription activated successfully.",
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiry: user.subscriptionExpiry
    });
  } catch (error) {
    console.error("Subscription Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Route 11 - Get Subscription Status
export const getSubscriptionStatus = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if subscription has expired
    if (user.subscriptionExpiry && user.subscriptionExpiry < new Date()) {
      user.subscriptionActive = false;
      user.subscriptionStatus = "Inactive";
      await user.save();
    }

    res.status(200).json({
      subscriptionActive: user.subscriptionActive,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiry: user.subscriptionExpiry
    });
  } catch (error) {
    console.error("Get Subscription Status Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
