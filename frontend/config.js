// Centralized API Configuration

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Automatically points to the correct origin if served by the backend, or localhost/production fallback
export const API_BASE_URL = isLocalhost 
    ? (["3000", "5000"].includes(window.location.port) ? window.location.origin : "http://localhost:3000")
    : "https://project-tbbc.onrender.com";

