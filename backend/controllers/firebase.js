// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyArmp7LtzuH4GKXUX9xKKMgaMHV1ioSeKU",
  authDomain: "realestate-ba037.firebaseapp.com",
  projectId: "realestate-ba037",
  storageBucket: "realestate-ba037.firebasestorage.app",
  messagingSenderId: "1014619180710",
  appId: "1:1014619180710:web:49f231abc721762a472e67",
  measurementId: "G-YS2N7C27EC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);