import axios from "axios";

const API = axios.create({
  baseURL: (process.env.REACT_APP_BACKEND_URL || "https://campusbite0101-production.up.railway.app") + "/api",
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
