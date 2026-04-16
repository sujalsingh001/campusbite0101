import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import API from '@/lib/api';
import { auth } from "@/lib/firebase";

const AuthContext = createContext(null);
let currentUser = null;

function mapFirebaseUser(firebaseUser) {
  if (!firebaseUser) return null;
  return {
    ...firebaseUser,
    email: firebaseUser.email,
    role: "student",
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [resolvedCurrentUser, setResolvedCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('campusbite_token');
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const normalizedUser = mapFirebaseUser(firebaseUser);
      currentUser = normalizedUser;
      setResolvedCurrentUser(normalizedUser);
      console.log("[Auth] auth state changed", normalizedUser);

      if (localStorage.getItem('campusbite_token')) return;

      setUser(normalizedUser);
      setLoading(false);
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

    return unsubscribe;
  }, []); // Empty deps is correct - only runs once on mount

  useEffect(() => {
    console.log("[Auth] currentUser value", resolvedCurrentUser);
  }, [resolvedCurrentUser]);

  const studentLogin = useCallback(async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@acharya.ac.in")) {
      throw new Error("Use your @acharya.ac.in email address");
    }

    try {
      const res = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const normalizedUser = mapFirebaseUser(res.user);
      currentUser = normalizedUser;
      setResolvedCurrentUser(normalizedUser);
      setUser(normalizedUser);
      return res.user;
    } catch (err) {
      throw new Error("Email or password is incorrect");
    }
  }, [setUser, setResolvedCurrentUser]);

  const registerStudent = useCallback(async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@acharya.ac.in")) {
      throw new Error("Use your @acharya.ac.in email address");
    }

    try {
      const res = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const normalizedUser = mapFirebaseUser(res.user);
      currentUser = normalizedUser;
      setResolvedCurrentUser(normalizedUser);
      setUser(normalizedUser);
      return res.user;
    } catch (err) {
      throw new Error("User already exists. Please sign in");
    }
  }, [setUser, setResolvedCurrentUser]);

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
    setResolvedCurrentUser(null);
    setUser(null);
  }, [setUser, setResolvedCurrentUser]);

  const value = useMemo(() => ({ 
    user, 
    currentUser: resolvedCurrentUser,
    loading, 
    studentLogin, 
    registerStudent,
    resetStudentPassword,
    staffLogin, 
    adminLogin, 
    logout 
  }), [user, resolvedCurrentUser, loading, studentLogin, registerStudent, resetStudentPassword, staffLogin, adminLogin, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
