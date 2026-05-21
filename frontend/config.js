// Centralized API Configuration
const isLocalhost = 
  window.location.hostname === "localhost" || 
  window.location.hostname === "127.0.0.1" || 
  window.location.hostname === "";

export const API_BASE_URL = isLocalhost 
  ? "http://localhost:5000" 
  : "https://project-tbbc.onrender.com";
