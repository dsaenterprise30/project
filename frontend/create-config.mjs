import fs from 'fs';

const firebaseConfigFilePath = './frontend/firebaseConfig.js';
const razorpayConfigFilePath = './frontend/razorpayConfig.js';

// 1) Firebase config
const firebaseConfigContent = `
export const firebaseConfig = {
  apiKey: "${process.env.PUBLIC_FIREBASE_API_KEY}",
  authDomain: "${process.env.PUBLIC_FIREBASE_AUTH_DOMAIN}",
  projectId: "${process.env.PUBLIC_FIREBASE_PROJECT_ID}",
  storageBucket: "${process.env.PUBLIC_FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${process.env.PUBLIC_FIREBASE_APP_ID}",
  measurementId: "${process.env.PUBLIC_FIREBASE_MEASUREMENT_ID}"
};
`;

fs.writeFileSync(firebaseConfigFilePath, firebaseConfigContent);
console.log('✅ Successfully created firebaseConfig.js for deployment inside /frontend!');

// 2) Razorpay config
const razorpayConfigContent = `
export const RAZORPAY_KEY_ID = "${process.env.PUBLIC_RAZORPAY_KEY_ID}";
`;

fs.writeFileSync(razorpayConfigFilePath, razorpayConfigContent);
console.log('✅ Successfully created razorpayConfig.js for deployment inside /frontend!');
