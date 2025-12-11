// jwtController.js
import jwt from 'jsonwebtoken';

// Build payload from either a user object or a plain mobileNumber string
const buildTokenPayload = (input) => {
  // If input is an object (user), prefer its _id and mobileNumber
  if (input && typeof input === 'object') {
    const userId = input._id || input.userId || input.id || null;
    const mobileNumber = input.mobileNumber || input.mobile || null;
    const payload = {};
    if (userId) payload.userId = String(userId);
    if (mobileNumber) payload.mobileNumber = String(mobileNumber);
    // If neither present, fallback to signing the whole object under mobileNumber to keep compatibility
    if (!payload.userId && !payload.mobileNumber) {
      payload.mobileNumber = String(input);
    }
    return payload;
  }

  // Otherwise input is probably the mobile number string
  if (input) {
    return { mobileNumber: String(input) };
  }

  return {};
};

//generate access token 
export const generateAccessToken = (userOrMobile) => {
  const payload = buildTokenPayload(userOrMobile);
  // Ensure payload has both keys when possible; this allows verifyAccessToken to read userId + mobileNumber
  return jwt.sign(payload, process.env.JWT_ACCESS_TOKEN_SECRET, { 
      expiresIn: '2h' 
  });
};

//generate refresh token
export const generateRefreshToken = (userOrMobile) => {
  const payload = buildTokenPayload(userOrMobile);
  return jwt.sign(payload, process.env.JWT_REFRESH_TOKEN_SECRET, { 
      expiresIn: '7d' 
  });
};

//Function to Call Generate Tokens & Send Cookie
export const sendTokenResponse = (res, userOrMobile) => {
  const accessToken = generateAccessToken(userOrMobile);
  const refreshToken = generateRefreshToken(userOrMobile);
  res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7*24*60*60*1000 // 7 days
  });

  res.json({ accessToken });
};
