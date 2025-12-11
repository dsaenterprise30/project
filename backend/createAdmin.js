import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import Admin from "./models/Admin.js";

dotenv.config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const mobile = process.env.ADMIN_NUMBER || "8591325875";   // fallback if .env not set
    const plainPassword = process.env.ADMIN_PASSWORD || "admin1234";
    const fullName = process.env.ADMIN_NAME || "Super Admin";

    const hash = await bcrypt.hash(plainPassword, 10);

    const admin = await Admin.findOneAndUpdate(
      { mobileNumber: mobile },
      { $set: { fullName, password: hash } },
      { upsert: true, new: true }
    );

    console.log("✅ Admin created/updated:", {
      id: admin._id.toString(),
      mobileNumber: admin.mobileNumber,
      fullName: admin.fullName
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating admin:", err);
    process.exit(1);
  }
})();
