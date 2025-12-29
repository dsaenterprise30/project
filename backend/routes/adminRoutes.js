import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import User from "../models/User.js";

const router = express.Router();

// Admin Login
router.post("/login", async (req, res) => {
  const { mobileNumber, password } = req.body;
  try {
    // Check if admin exists
    const user = await User.findOne({ mobileNumber });
    if (!mobileNumber) {
      return res.status(400).json({ message: "Admin not found" });
    }

    //checks is the user have admin login.
    if (!user.mobileNumber === process.env.ADMIN_NUMBER) {
      return res.status().json({
        message:"Access denied, only admin can access."
      })

    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // If login is successful, return a token
    res.status(200).json({
        status: 'success',
        message: 'User logged in successfully',
        data: generateAccessToken(existingUser.mobileNumber),
    });

    res.status(200).json({
      status: "success",
      token,
      data: {
        fullName: admin.fullName,
        mobileNumber: admin.mobileNumber,
        role: "admin"
      }
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
