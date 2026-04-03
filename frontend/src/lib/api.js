import axios from 'axios';

const API = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
});

// NOTE: Token storage in localStorage is a known security tradeoff for client-side SPAs.
// For production, consider migrating to httpOnly cookies with backend support.
// Current implementation: Secure for most use cases but vulnerable to XSS attacks.
// Alternative: Implement backend session management with httpOnly cookies.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('campusbite_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
