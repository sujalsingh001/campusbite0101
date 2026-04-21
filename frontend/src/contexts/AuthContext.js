import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  linkWithPhoneNumber,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import API from '@/lib/api';
import { auth, db } from "@/lib/firebase";

const AuthContext = createContext(null);
let currentUser = null;

function mapFirebaseUser(firebaseUser, profileData = {}) {
  if (!firebaseUser) return null;
  return {
    ...firebaseUser,
    email: firebaseUser.email,
    auid: profileData.auid || firebaseUser.uid || "",
    phoneNumber: profileData.phoneNumber || firebaseUser.phoneNumber || "",
    phoneVerified: Boolean(profileData.phoneVerified || firebaseUser.phoneNumber),
    role: "student",
  };
}

function normalizePhoneNumber(phoneNumber) {
  const rawValue = (phoneNumber || "").trim();
  if (!rawValue) {
    throw new Error("Phone number is required");
  }

  if (!/^\d{10}$/.test(rawValue)) {
    throw new Error("Enter a valid 10-digit phone number");
  }

  return `+91${rawValue}`;
}

function setupRecaptcha(authInstance, containerId = "recaptcha-container") {
  if (typeof window !== "undefined" && window.recaptchaVerifier) {
    window.recaptchaVerifier.clear();
  }

  window.recaptchaVerifier = new RecaptchaVerifier(authInstance, containerId, {
    size: "normal",
  });

  return window.recaptchaVerifier;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [resolvedCurrentUser, setResolvedCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const firebaseUserRef = useRef(null);
  const profileUnsubscribeRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);
  const confirmationResultRef = useRef(null);
  const pendingPhoneNumberRef = useRef("");
  const otpBypassEnabled = process.env.REACT_APP_FIREBASE_TEST_OTP_BYPASS === "true";

  const syncBackendStudentSession = useCallback(async ({ email, password, auid, phone = "" }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const loginPayload = { email: normalizedEmail, password };

    try {
      const loginResponse = await API.post("/auth/student/login", loginPayload);
      localStorage.setItem("campusbite_token", loginResponse.data.token);
      setUser(loginResponse.data.user);
      return loginResponse.data;
    } catch (loginError) {
      if (loginError?.response?.status !== 404) {
        throw loginError;
      }

      const fallbackAuid = (auid || firebaseUserRef.current?.uid || normalizedEmail.split("@")[0] || "").trim().toUpperCase();
      await API.post("/auth/register", {
        email: normalizedEmail,
        password,
        auid: fallbackAuid || auid || normalizedEmail.split("@")[0].toUpperCase(),
        phone,
      });

      const loginResponse = await API.post("/auth/student/login", loginPayload);
      localStorage.setItem("campusbite_token", loginResponse.data.token);
      setUser(loginResponse.data.user);
      return loginResponse.data;
    }
  }, [setUser]);

  const applyFirebaseUser = useCallback((firebaseUser, profileData = {}) => {
    const normalizedUser = mapFirebaseUser(firebaseUser, profileData);
    currentUser = normalizedUser;
    setResolvedCurrentUser(normalizedUser);
    console.log("[Auth] auth state changed", normalizedUser);

    if (!localStorage.getItem('campusbite_token')) {
      setUser(normalizedUser);
    }

    return normalizedUser;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('campusbite_token');
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      firebaseUserRef.current = firebaseUser;

      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
        profileUnsubscribeRef.current = null;
      }

      if (!firebaseUser) {
        applyFirebaseUser(null);
        setLoading(false);
        return;
      }

      profileUnsubscribeRef.current = onSnapshot(
        doc(db, "users", firebaseUser.uid),
        (snapshot) => {
          applyFirebaseUser(firebaseUser, snapshot.exists() ? snapshot.data() : {});
          setLoading(false);
        },
        () => {
          applyFirebaseUser(firebaseUser);
          setLoading(false);
        },
      );
    });

    if (token) {
      API.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('campusbite_token');
          setUser(currentUser);
        })
        .finally(() => setLoading(false));
    }

    return () => {
      unsubscribe();
      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
      }
    };
  }, [applyFirebaseUser]); // Empty deps is correct - only runs once on mount

  useEffect(() => {
    console.log("[Auth] currentUser value", resolvedCurrentUser);
  }, [resolvedCurrentUser]);

  const studentLogin = useCallback(async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@acharya.ac.in")) {
      throw new Error("Use your @acharya.ac.in email address");
    }

    let res;
    try {
      res = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      throw new Error("Email or password is incorrect");
    }

    firebaseUserRef.current = res.user;
    let profileData = {};
    try {
      const profileSnapshot = await getDoc(doc(db, "users", res.user.uid));
      profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
    } catch (profileError) {
      profileData = {};
    }

    applyFirebaseUser(res.user, profileData);

    try {
      await syncBackendStudentSession({
        email: normalizedEmail,
        password,
        auid: profileData.auid || res.user.uid,
        phone: profileData.phoneNumber || res.user.phoneNumber || "",
      });
    } catch (syncError) {
      throw new Error(syncError?.response?.data?.detail || syncError?.message || "Unable to sync student session");
    }

    return res.user;
  }, [applyFirebaseUser, syncBackendStudentSession]);

  const registerStudent = useCallback(async (email, password, details = {}) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@acharya.ac.in")) {
      throw new Error("Use your @acharya.ac.in email address");
    }

    let res;
    try {
      res = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      throw new Error("User already exists. Please sign in");
    }

    firebaseUserRef.current = res.user;
    const normalizedAuid = (details.auid || "").trim().toUpperCase();
    const normalizedPhone = (details.phone || "").trim();

    await setDoc(doc(db, "users", res.user.uid), {
      email: normalizedEmail,
      auid: normalizedAuid || res.user.uid,
      phoneNumber: normalizedPhone,
      phoneVerified: false,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    applyFirebaseUser(res.user, {
      auid: normalizedAuid || res.user.uid,
      phoneNumber: normalizedPhone,
      phoneVerified: false,
    });

    try {
      await syncBackendStudentSession({
        email: normalizedEmail,
        password,
        auid: normalizedAuid || res.user.uid,
        phone: normalizedPhone,
      });
    } catch (syncError) {
      throw new Error(syncError?.response?.data?.detail || syncError?.message || "Unable to sync student session");
    }

    return res.user;
  }, [applyFirebaseUser, syncBackendStudentSession]);

  const resetStudentPassword = useCallback(async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@acharya.ac.in")) {
      throw new Error("Use your @acharya.ac.in email address");
    }

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      return { message: "Password reset email sent" };
    } catch (err) {
      throw new Error("Unable to send password reset email");
    }
  }, []);

  const sendOTP = useCallback(async (phoneNumber, recaptchaContainerId = "recaptcha-container") => {
    if (!firebaseUserRef.current?.uid) {
      throw new Error("Please wait, loading user...");
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    try {
      confirmationResultRef.current = null;

      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }

      recaptchaVerifierRef.current = setupRecaptcha(auth, recaptchaContainerId);
      await recaptchaVerifierRef.current.render();

      confirmationResultRef.current = await linkWithPhoneNumber(
        firebaseUserRef.current,
        normalizedPhoneNumber,
        recaptchaVerifierRef.current,
      );
      pendingPhoneNumberRef.current = normalizedPhoneNumber;

      return { phoneNumber: normalizedPhoneNumber };
    } catch (err) {
      console.error("Firebase phone OTP send failed:", err);

      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }

      if (err?.code === "auth/invalid-phone-number") {
        throw new Error("Enter a valid 10-digit phone number");
      }
      if (err?.code === "auth/too-many-requests") {
        throw new Error("Too many OTP requests. Please try again later");
      }
      if (err?.code === "auth/network-request-failed") {
        throw new Error("Network issue while sending OTP");
      }
      if (err?.code === "auth/captcha-check-failed") {
        throw new Error("Unable to verify reCAPTCHA. Please try again");
      }
      if (err?.code === "auth/provider-already-linked") {
        throw new Error("Phone number is already verified");
      }
      throw new Error("Unable to send OTP right now");
    }
  }, []);

  const verifyOTP = useCallback(async (code) => {
    const normalizedCode = (code || "").trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new Error("Enter a valid 6-digit OTP");
    }

    if (!firebaseUserRef.current?.uid) {
      throw new Error("Please wait, loading user...");
    }

    try {
      if (otpBypassEnabled && normalizedCode === "123456" && pendingPhoneNumberRef.current) {
        await setDoc(doc(db, "users", firebaseUserRef.current.uid), {
          email: firebaseUserRef.current.email || "",
          phoneNumber: pendingPhoneNumberRef.current,
          phoneVerified: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        applyFirebaseUser(firebaseUserRef.current, {
          phoneNumber: pendingPhoneNumberRef.current,
          phoneVerified: true,
        });

        return {
          phoneNumber: pendingPhoneNumberRef.current,
          phoneVerified: true,
        };
      }

      if (!confirmationResultRef.current || !pendingPhoneNumberRef.current) {
        throw new Error("Send OTP first");
      }

      const result = await confirmationResultRef.current.confirm(normalizedCode);
      firebaseUserRef.current = result.user || firebaseUserRef.current;

      await setDoc(doc(db, "users", firebaseUserRef.current.uid), {
        email: firebaseUserRef.current.email || "",
        phoneNumber: pendingPhoneNumberRef.current,
        phoneVerified: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      applyFirebaseUser(firebaseUserRef.current, {
        phoneNumber: pendingPhoneNumberRef.current,
        phoneVerified: true,
      });

      return {
        phoneNumber: pendingPhoneNumberRef.current,
        phoneVerified: true,
      };
    } catch (err) {
      if (err?.code === "auth/invalid-verification-code") {
        throw new Error("OTP is incorrect");
      }
      if (err?.code === "auth/code-expired") {
        throw new Error("OTP has expired. Please resend it");
      }
      if (err?.code === "auth/network-request-failed") {
        throw new Error("Network issue while verifying OTP");
      }
      throw new Error(err.message || "Unable to verify OTP");
    }
  }, [applyFirebaseUser, otpBypassEnabled]);

  const staffLogin = useCallback(async (email, password) => {
    const { data } = await API.post('/auth/staff/login', { email, password });
    localStorage.setItem('campusbite_token', data.token);
    setUser(data.user);
    return data;
  }, [setUser]);

  const adminLogin = useCallback(async (email, password) => {
    const { data } = await API.post('/auth/admin/login', { email, password });
    localStorage.setItem('campusbite_token', data.token);
    setUser(data.user);
    return data;
  }, [setUser]);

  const logout = useCallback(async () => {
    localStorage.removeItem('campusbite_token');
    try {
      await signOut(auth);
    } catch (err) {
      // Ignore Firebase sign-out errors for backend-only sessions.
    }
    currentUser = null;
    firebaseUserRef.current = null;
    confirmationResultRef.current = null;
    pendingPhoneNumberRef.current = "";
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
    setResolvedCurrentUser(null);
    setUser(null);
  }, [setUser, setResolvedCurrentUser]);

  const value = useMemo(() => ({ 
    user, 
    currentUser: resolvedCurrentUser,
    loading, 
    studentLogin, 
    registerStudent,
    sendOTP,
    verifyOTP,
    resetStudentPassword,
    staffLogin, 
    adminLogin, 
    logout 
  }), [user, resolvedCurrentUser, loading, studentLogin, registerStudent, sendOTP, verifyOTP, resetStudentPassword, staffLogin, adminLogin, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
