import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import API from '@/lib/api';
import { auth } from "@/lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('campusbite_token');
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (localStorage.getItem('campusbite_token')) return;

      if (firebaseUser) {
        setUser({
          ...firebaseUser,
          email: firebaseUser.email,
          role: "student",
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    if (token) {
      API.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('campusbite_token');
          if (auth.currentUser) {
            setUser({
              ...auth.currentUser,
              email: auth.currentUser.email,
              role: "student",
            });
          } else {
            setUser(null);
          }
        })
        .finally(() => setLoading(false));
    }

    return unsubscribe;
  }, []); // Empty deps is correct - only runs once on mount

  const studentLogin = useCallback(async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@acharya.ac.in")) {
      throw new Error("Use your @acharya.ac.in email address");
    }

    try {
      const res = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      setUser({
        ...res.user,
        email: res.user.email,
        role: "student",
      });
      return res.user;
    } catch (err) {
      throw new Error("Email or password is incorrect");
    }
  }, [setUser]);

  const registerStudent = useCallback(async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@acharya.ac.in")) {
      throw new Error("Use your @acharya.ac.in email address");
    }

    try {
      const res = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      setUser({
        ...res.user,
        email: res.user.email,
        role: "student",
      });
      return res.user;
    } catch (err) {
      throw new Error("User already exists. Please sign in");
    }
  }, [setUser]);

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
    setUser(null);
  }, [setUser]);

  const value = useMemo(() => ({ 
    user, 
    loading, 
    studentLogin, 
    registerStudent,
    staffLogin, 
    adminLogin, 
    logout 
  }), [user, loading, studentLogin, registerStudent, staffLogin, adminLogin, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
