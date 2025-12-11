import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  mobileNumber: { type: Number, required: true, unique: true },
  password: { type: String, required: true }, // bcrypt hash
  createdAt: { type: Date, default: Date.now }
});

// Explicitly tell Mongoose to use "admins" collection
export default mongoose.model("Admin", AdminSchema);
