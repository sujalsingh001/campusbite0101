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

  const studentLogin = useCallback(async (auid, phone) => {
    const payload = auid ? { auid } : { phone };
    const { data } = await API.post('/auth/student/login', payload);
    localStorage.setItem('campusbite_token', data.token);
    setUser(data.user);
    return data;
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

  const logout = useCallback(() => {
    localStorage.removeItem('campusbite_token');
    setUser(null);
  }, [setUser]);

  const value = useMemo(() => ({ 
    user, 
    loading, 
    studentLogin, 
    staffLogin, 
    adminLogin, 
    logout 
  }), [user, loading, studentLogin, staffLogin, adminLogin, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
