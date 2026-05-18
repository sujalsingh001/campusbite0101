import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  getIdTokenResult,
  linkWithPhoneNumber,
  signInWithCustomToken,
} from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import API from '@/lib/api';
import {
  auth,
  db,
  debugFirebaseLog,
  getFirebaseFunctionUrl,
} from "@/lib/firebase";

const AuthContext = createContext(null);
let currentUser = null;

function mapFirebaseUser(firebaseUser, profileData = {}, authClaims = {}) {
  if (!firebaseUser) return null;
  const role = authClaims.role || profileData.role || "student";
  return {
    ...firebaseUser,
    uid: firebaseUser.uid,
    email: authClaims.email || profileData.email || firebaseUser.email || "",
    auid: profileData.auid || authClaims.auid || "",
    phoneNumber: profileData.phoneNumber || authClaims.phoneNumber || firebaseUser.phoneNumber || "",
    phoneVerified: role === "student" && Boolean(profileData.phoneVerified || authClaims.phoneVerified || firebaseUser.phoneNumber),
    role,
    canteen_id: authClaims.canteenId || profileData.canteen_id || "",
    canteen_name: authClaims.canteenName || profileData.canteen_name || "",
  };
}

function isStudentIdentity(value) {
  return value?.role === "student";
}

function isStaffIdentity(value) {
  return value?.role === "canteen_staff";
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

function normalizeStudentAuid(auid) {
  return (auid || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
}

function deriveStudentAuidFromEmail(email) {
  return normalizeStudentAuid((email || "").trim().split("@")[0] || "");
}

async function readFirebaseAuthClaims(firebaseUser) {
  if (!firebaseUser) {
    return {};
  }

  try {
    const result = await getIdTokenResult(firebaseUser);
    return result?.claims || {};
  } catch (error) {
    debugFirebaseLog("Unable to read Firebase auth claims", {
      message: error?.message || String(error),
    });
    return {};
  }
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

  const saveStudentProfile = useCallback(async (firebaseUser, profileData = {}) => {
    if (!firebaseUser?.uid) {
      return;
    }

    const update = {
      email: firebaseUser.email || "",
      updatedAt: serverTimestamp(),
    };

    const normalizedAuid = normalizeStudentAuid(profileData.auid);
    if (normalizedAuid) {
      update.auid = normalizedAuid;
    }

    if (typeof profileData.phoneNumber === "string" && profileData.phoneNumber) {
      update.phoneNumber = profileData.phoneNumber;
    }

    if (typeof profileData.phoneVerified === "boolean") {
      update.phoneVerified = profileData.phoneVerified;
    }

    await setDoc(doc(db, "users", firebaseUser.uid), update, { merge: true });
  }, []);

  const applyFirebaseUser = useCallback(async (firebaseUser, profileData = {}, authClaimsOverride = null) => {
    const authClaims = authClaimsOverride || await readFirebaseAuthClaims(firebaseUser);
    const normalizedUser = mapFirebaseUser(firebaseUser, profileData, authClaims);
    currentUser = normalizedUser;
    setResolvedCurrentUser(normalizedUser);
    debugFirebaseLog("Auth state changed", {
      uid: normalizedUser?.uid || "",
      role: normalizedUser?.role || "",
      canteenId: normalizedUser?.canteen_id || "",
    });

    if (!localStorage.getItem('campusbite_token')) {
      setUser(normalizedUser);
    }

    return normalizedUser;
  }, []);

  const applyBackendStudentSession = useCallback((sessionData) => {
    if (!sessionData?.token || !sessionData?.user) {
      return null;
    }

    localStorage.setItem("campusbite_token", sessionData.token);
    const backendUser = {
      ...sessionData.user,
      role: "student",
    };
    setUser(backendUser);
    return backendUser;
  }, []);

  const loginBackendStudentSession = useCallback(async (email, password) => {
    const { data } = await API.post("/auth/student/login", { email, password });
    return applyBackendStudentSession(data);
  }, [applyBackendStudentSession]);

  const registerBackendStudentAccount = useCallback(async ({ email, password, auid, phone }) => {
    await API.post("/auth/register", {
      email,
      password,
      auid,
      phone: phone || "",
    });
  }, []);

  const ensureStaffFirebaseSession = useCallback(async (staffUser, backendTokenOverride = "") => {
    if (!isStaffIdentity(staffUser)) {
      return false;
    }

    if (isStaffIdentity(currentUser) && currentUser.canteen_id === staffUser.canteen_id) {
      return true;
    }

    const backendToken = backendTokenOverride || localStorage.getItem("campusbite_token") || "";
    if (!backendToken) {
      return false;
    }

    try {
      debugFirebaseLog("Exchanging Firebase staff session", {
        canteenId: staffUser.canteen_id || "",
      });

      const response = await fetch(getFirebaseFunctionUrl("exchangeStaffSession"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${backendToken}`,
        },
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Unable to exchange staff Firebase session");
      }

      const payload = await response.json();
      await signInWithCustomToken(auth, payload.customToken);
      debugFirebaseLog("Firebase staff session established", {
        canteenId: staffUser.canteen_id || "",
      });
      return true;
    } catch (error) {
      console.error("Firebase staff session bootstrap failed:", error);
      return false;
    }
  }, []);

  const bootstrapTemporaryStudentSession = useCallback(async ({ email, auid }) => {
    const effectiveAuid = normalizeStudentAuid(auid) || deriveStudentAuidFromEmail(email);
    if (!effectiveAuid) {
      return null;
    }

    const { data } = await API.post("/auth/student/temporary-login", {
      auid: effectiveAuid,
    });
    return applyBackendStudentSession(data);
  }, [applyBackendStudentSession]);

  const ensureBackendStudentSession = useCallback(async ({
    email,
    password,
    auid,
    phone,
    mode = "login",
  } = {}) => {
    if (localStorage.getItem("campusbite_token")) {
      return true;
    }

    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedAuid = normalizeStudentAuid(auid) || deriveStudentAuidFromEmail(normalizedEmail);

    if (mode === "register" && normalizedEmail && password && normalizedAuid) {
      try {
        await registerBackendStudentAccount({
          email: normalizedEmail,
          password,
          auid: normalizedAuid,
          phone,
        });
      } catch (error) {
        if (error?.response?.status !== 400) {
          console.error("[Auth] backend student register failed", error);
        }
      }
    }

    if (normalizedEmail && password) {
      try {
        await loginBackendStudentSession(normalizedEmail, password);
        return true;
      } catch (error) {
        console.error("[Auth] backend student login failed", error);
      }
    }

    try {
      const temporarySession = await bootstrapTemporaryStudentSession({
        email: normalizedEmail,
        auid: normalizedAuid,
      });
      return Boolean(temporarySession);
    } catch (error) {
      console.error("[Auth] temporary student session bootstrap failed", error);
      return false;
    }
  }, [bootstrapTemporaryStudentSession, loginBackendStudentSession, registerBackendStudentAccount]);

  useEffect(() => {
    const token = localStorage.getItem('campusbite_token');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      firebaseUserRef.current = firebaseUser;

      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
        profileUnsubscribeRef.current = null;
      }

      if (!firebaseUser) {
        void applyFirebaseUser(null);
        setLoading(false);
        return;
      }

      const authClaims = await readFirebaseAuthClaims(firebaseUser);
      if (authClaims.role === "canteen_staff") {
        await applyFirebaseUser(firebaseUser, {}, authClaims);
        setLoading(false);
        return;
      }

      profileUnsubscribeRef.current = onSnapshot(
        doc(db, "users", firebaseUser.uid),
        (snapshot) => {
          const profileData = snapshot.exists() ? snapshot.data() : {};
          void applyFirebaseUser(firebaseUser, profileData, authClaims);
          if (!localStorage.getItem("campusbite_token")) {
            void ensureBackendStudentSession({
              email: firebaseUser.email || "",
              auid: profileData.auid || "",
              phone: profileData.phoneNumber || "",
              mode: "bootstrap",
            });
          }
          setLoading(false);
        },
        () => {
          void applyFirebaseUser(firebaseUser, {}, authClaims);
          if (!localStorage.getItem("campusbite_token")) {
            void ensureBackendStudentSession({
              email: firebaseUser.email || "",
              mode: "bootstrap",
            });
          }
          setLoading(false);
        },
      );
    });

    if (token) {
      API.get('/auth/me')
        .then((res) => {
          setUser(res.data);
        })
        .catch(() => {
          localStorage.removeItem('campusbite_token');
          setUser(isStudentIdentity(currentUser) ? currentUser : null);
        })
        .finally(() => setLoading(false));
    }

    return () => {
      unsubscribe();
      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
      }
    };
  }, [applyFirebaseUser, ensureBackendStudentSession]); // Empty deps is correct - only runs once on mount

  useEffect(() => {
    if (loading || !isStaffIdentity(user)) {
      return;
    }

    if (isStaffIdentity(resolvedCurrentUser) && resolvedCurrentUser.canteen_id === user.canteen_id) {
      return;
    }

    void ensureStaffFirebaseSession(user);
  }, [ensureStaffFirebaseSession, loading, resolvedCurrentUser, user]);

  useEffect(() => {
    debugFirebaseLog("Resolved currentUser value", {
      uid: resolvedCurrentUser?.uid || "",
      role: resolvedCurrentUser?.role || "",
      canteenId: resolvedCurrentUser?.canteen_id || "",
    });
  }, [resolvedCurrentUser]);

  const studentLogin = useCallback(async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@acharya.ac.in")) {
      throw new Error("Use your @acharya.ac.in email address");
    }

    try {
      const res = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      firebaseUserRef.current = res.user;
      await ensureBackendStudentSession({
        email: normalizedEmail,
        password,
        mode: "login",
      });
      await applyFirebaseUser(res.user);
      return res.user;
    } catch (err) {
      throw new Error("Email or password is incorrect");
    }
  }, [applyFirebaseUser, ensureBackendStudentSession]);

  const registerStudent = useCallback(async (email, password, profile = {}) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@acharya.ac.in")) {
      throw new Error("Use your @acharya.ac.in email address");
    }

    const normalizedAuid = normalizeStudentAuid(profile.auid);
    if (!normalizedAuid) {
      throw new Error("AUID is required");
    }

    try {
      const res = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      firebaseUserRef.current = res.user;
      await saveStudentProfile(res.user, {
        auid: normalizedAuid,
        phoneNumber: profile.phoneNumber || "",
        phoneVerified: false,
      });
      await ensureBackendStudentSession({
        email: normalizedEmail,
        password,
        auid: normalizedAuid,
        phone: profile.phoneNumber || "",
        mode: "register",
      });
      await applyFirebaseUser(res.user);
      return res.user;
    } catch (err) {
      throw new Error("User already exists. Please sign in");
    }
  }, [applyFirebaseUser, ensureBackendStudentSession, saveStudentProfile]);

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

        await applyFirebaseUser(firebaseUserRef.current, {
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

      await applyFirebaseUser(firebaseUserRef.current, {
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
    void ensureStaffFirebaseSession(data.user, data.token);
    return data;
  }, [ensureStaffFirebaseSession, setUser]);

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
