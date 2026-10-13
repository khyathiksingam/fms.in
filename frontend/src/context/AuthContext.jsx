import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken } from '../utils/api';

const AuthContext = createContext();

function withActiveDepartment(profile) {
  if (profile?.role_name !== 'hod' || !profile.assigned_departments?.length) {
    localStorage.removeItem('ffms_active_department');
    return profile;
  }
  const savedId = localStorage.getItem('ffms_active_department');
  const selected = profile.assigned_departments.find(department => String(department.id) === savedId)
    || profile.assigned_departments.find(department => department.id === profile.department_id)
    || profile.assigned_departments[0];
  localStorage.setItem('ffms_active_department', String(selected.id));
  return { ...profile, department_id: selected.id, department_name: selected.name, department_code: selected.code };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collegeSettings, setCollegeSettings] = useState(null);

  // Fetch public college settings
  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.get('/settings/public');
      if (data && data.settings) {
        setCollegeSettings(data.settings);
      }
    } catch (err) {
      console.warn('Failed to load branding settings:', err.message);
    }
  }, []);

  // Check existing token and fetch profile
  const checkAuth = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.get('/auth/me');
      if (data && data.user) {
        setUser(withActiveDepartment(data.user));
      } else {
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.warn('Session verification failed:', err.message);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    checkAuth();
  }, [fetchSettings, checkAuth]);

  useEffect(() => {
    if (!user || user.must_change_password) return undefined;
    const heartbeat = window.setInterval(() => {
      api.post('/auth/heartbeat').catch(err => {
        if (err.status === 401) {
          setToken(null);
          setUser(null);
        }
      });
    }, 60 * 1000);
    return () => window.clearInterval(heartbeat);
  }, [user]);

  const login = async (username, password) => {
    const data = await api.post('/auth/login', { username, password });
    if (data && data.token) {
      setToken(data.token);
      const profile = withActiveDepartment(data.user);
      setUser(profile);
      return profile;
    }
    throw new Error('Login failed: Invalid server response');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      setToken(null);
      localStorage.removeItem('ffms_active_department');
      setUser(null);
    }
  };

  // Quick switch role helper for easy testing without manual typing
  const quickSwitchUser = async (username, password) => {
    setLoading(true);
    try {
      await login(username, password);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const data = await api.get('/auth/me');
      if (data && data.user) {
        setUser(withActiveDepartment(data.user));
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const refreshSettings = async () => {
    fetchSettings();
  };

  const isAdmin = user?.role_name === 'admin';
  const isHOD = user?.role_name === 'hod';
  const isFaculty = user?.role_name === 'faculty';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        collegeSettings,
        login,
        logout,
        quickSwitchUser,
        refreshUser,
        refreshSettings,
        isAdmin,
        isHOD,
        isFaculty,
        isAuthenticated: Boolean(user)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
