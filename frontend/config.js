const isLocalhost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname === '[::1]' || 
    window.location.hostname.startsWith('192.168.') || 
    window.location.hostname.startsWith('10.') || 
    window.location.hostname.startsWith('172.') ||
    window.location.hostname.endsWith('.local') ||
    window.location.hostname === '';

// Automatically points to the correct origin if served by the backend, or localhost/production fallback
export const API_BASE_URL = isLocalhost 
    ? (["3000", "5000"].includes(window.location.port) 
        ? window.location.origin 
        : `${window.location.protocol}//${window.location.hostname || 'localhost'}:3000`)
    : "https://project-tbbc.onrender.com";

