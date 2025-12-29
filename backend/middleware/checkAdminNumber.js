// middleware/checkAdminNumber.js
export const checkAdminNumber = (req, res, next) => {
  try {
    const mobileNumberRaw = req.mobileNumber || req.userMobile || req.user?.mobileNumber || '';
    const mobileNumber = String(mobileNumberRaw || '').trim();

    if (!mobileNumber) {
      return res.status(401).json({ message: "Unauthorized: User phone number missing" });
    }

    const ADMIN_NUMBER_RAW = process.env.ADMIN_NUMBER;
    if (!ADMIN_NUMBER_RAW) {
      console.error("ADMIN_NUMBER not set in .env file");
      return res.status(500).json({ message: "Server configuration error" });
    }
    const ADMIN_NUMBER = String(ADMIN_NUMBER_RAW).trim();

    // direct string compare (you can adapt normalization if your ADMIN_NUMBER has country code)
    if (mobileNumber !== ADMIN_NUMBER && mobileNumber !== `91${ADMIN_NUMBER}` && (`91${mobileNumber}` !== ADMIN_NUMBER)) {
      // basic normalization: admin stored with/without 91
      return res.status(403).json({ message: "Access denied: Admin only" });
    }

    next();
  } catch (error) {
    console.error("Error in checkAdminNumber middleware:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
