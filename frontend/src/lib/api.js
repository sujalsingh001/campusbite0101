import axios from "axios";

const configuredBackendUrl = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const isVercelHostedFrontend =
  typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app");
const baseURL = isVercelHostedFrontend
  ? "/api"
  : configuredBackendUrl
    ? `${configuredBackendUrl}/api`
    : "/api";

const API = axios.create({
  baseURL,
});

// Attach token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("campusbite_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
