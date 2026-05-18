import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getMessaging, isSupported } from "firebase/messaging";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyDndeRNMZ_qn07ziIzQeqRrVUKHL5pyqYA",
  authDomain: "campusbite-e54ec.firebaseapp.com",
  projectId: "campusbite-e54ec",
  storageBucket: "campusbite-e54ec.firebasestorage.app",
  messagingSenderId: "73001842134",
  appId: "1:73001842134:web:3937db1f40947e8de22077",
};

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: process.env.REACT_APP_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
};

function readFlag(...keys) {
  return keys.some((key) => String(process.env[key] || "").toLowerCase() === "true");
}

export const firebaseCollections = Object.freeze({
  orders: process.env.REACT_APP_FIREBASE_ORDERS_COLLECTION || "orders",
  users: process.env.REACT_APP_FIREBASE_USERS_COLLECTION || "users",
});

export const useFirebaseOrders = readFlag("REACT_APP_USE_FIREBASE_ORDERS", "USE_FIREBASE");
export const useRailwayFallback = readFlag("REACT_APP_USE_RAILWAY_FALLBACK", "USE_RAILWAY_FALLBACK");
export const firebaseDebugEnabled = readFlag("REACT_APP_DEBUG_FIREBASE", "DEBUG_FIREBASE");
export const firebaseFunctionsRegion = process.env.REACT_APP_FIREBASE_FUNCTIONS_REGION || "us-central1";
const firebaseFunctionsBaseUrl = (process.env.REACT_APP_FIREBASE_FUNCTIONS_BASE_URL || "").replace(/\/+$/, "");

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, firebaseFunctionsRegion);
export const firebaseProjectId = firebaseConfig.projectId;

export function getFirebaseFunctionUrl(name) {
  if (firebaseFunctionsBaseUrl) {
    return `${firebaseFunctionsBaseUrl}/${name}`;
  }

  return `https://${firebaseFunctionsRegion}-${firebaseProjectId}.cloudfunctions.net/${name}`;
}

export function debugFirebaseLog(message, details) {
  if (!firebaseDebugEnabled || typeof console === "undefined") {
    return;
  }

  if (typeof details === "undefined") {
    console.log("[FirebaseDebug]", message);
    return;
  }

  console.log("[FirebaseDebug]", message, details);
}

let messagingPromise;

export async function getFirebaseMessaging() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported) => (supported ? getMessaging(app) : null))
      .catch(() => null);
  }

  return messagingPromise;
}
