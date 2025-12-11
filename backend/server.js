import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import rentRoutes from "./routes/rentRoutes.js";
import sellRoutes from "./routes/sellRoutes.js";
import cookieParser from "cookie-parser";
//import adminRoutes from "./routes/adminRoutes.js"; 
//import { firebaseconfig } from "./controllers/firebase.js"; 
//import { verifyAccessToken } from "./middleware/userAuth.js"; 
//import { checkAdminNumber } from "./middleware/checkAdminNumber.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import webhookRoutes from "./routes/webhook.js";

dotenv.config();
const app = express(); // Initialize Express app

app.use(cors());

// razorpay webhook route
app.use("/api/webhook", webhookRoutes);

app.use(express.json());
app.use(cookieParser());

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/rentflats', rentRoutes);
app.use('/api/sellflats', sellRoutes);
app.use("/api/payment", paymentRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
