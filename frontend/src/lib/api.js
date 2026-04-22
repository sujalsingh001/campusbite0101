import axios from "axios";

const configuredBackendUrl = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const isProductionBuild = process.env.NODE_ENV === "production";
const apiBaseUrl = isProductionBuild
  ? "/api"
  : configuredBackendUrl
    ? `${configuredBackendUrl}/api`
    : "/api";

function isRailwayUploadsUrl(value) {
  if (typeof value !== "string" || !value) return false;
  if (value.startsWith("/uploads/")) return true;

  try {
    const parsed = new URL(value);
    return parsed.pathname.startsWith("/uploads/") && (
      parsed.hostname.endsWith(".railway.app")
      || (configuredBackendUrl && parsed.host === new URL(configuredBackendUrl).host)
    );
  } catch {
    return false;
  }
}

function normalizeAssetUrl(value) {
  if (!isRailwayUploadsUrl(value)) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
}

function normalizeResponseData(data) {
  if (Array.isArray(data)) {
    return data.map(normalizeResponseData);
  }

  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, normalizeResponseData(value)])
    );
  }

  if (typeof data === "string") {
    return normalizeAssetUrl(data);
  }

  return data;
}

export function getApiUrl(path = "") {
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${apiBaseUrl}${normalizedPath}`;
}

const API = axios.create({
  baseURL: apiBaseUrl,
});

// Attach token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("campusbite_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use((response) => {
  response.data = normalizeResponseData(response.data);
  return response;
});

export default API;
