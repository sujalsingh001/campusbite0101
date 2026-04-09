import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import API from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('campusbite_token');
    if (token) {
      API.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('campusbite_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // Empty deps is correct - only runs once on mount

  const studentLogin = useCallback(async (email, password) => {
    const { data } = await API.post('/auth/student/login', { email, password });
    localStorage.setItem('campusbite_token', data.token);
    setUser(data.user);
    return data;
  }, [setUser]);

  const registerStudent = useCallback(async (payload) => {
    const email = (payload.email || '').trim().toLowerCase();
    const auid = (payload.auid || '').trim().toUpperCase();
    const phone = (payload.phone || '').trim();
    const password = payload.password || '';

    if (!email || !auid || !phone || !password) {
      throw new Error('All fields are required');
    }

    if (!email.endsWith('@acharya.ac.in')) {
      throw new Error('Use your @acharya.ac.in college email');
    }

    if (auid.length <= 7 || !/[A-Za-z]/.test(auid) || !/[0-9]/.test(auid)) {
      throw new Error('AUID must be 8+ characters with letters and numbers');
    }

    if (!/^\d{10}$/.test(phone)) {
      throw new Error('Phone number must be exactly 10 digits');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const { data } = await API.post('/auth/register', {
      email,
      auid,
      phone,
      password,
    });
    return data;
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

  const logout = useCallback(() => {
    localStorage.removeItem('campusbite_token');
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
