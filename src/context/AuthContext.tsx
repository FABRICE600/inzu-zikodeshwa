import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { apiRequest, UserProfile } from '../lib/api.ts';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  loginWithPassword: (identifier: string, password: string) => Promise<void>;
  registerWithPassword: (payload: {
    fullName: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    password: string;
    role: 'tenant' | 'landlord';
  }) => Promise<{ demoOtp?: string }>;
  loginWithGoogle: (role?: 'tenant' | 'landlord') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  // Token stored strictly in memory (never localStorage)
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setToken(idToken);
          const data = await apiRequest<{ user: UserProfile }>('/api/auth/me', { token: idToken });
          setUser(data.user);
        } catch {
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<{ user: UserProfile }>('/api/auth/me', { token });
      setUser(data.user);
    } catch {
      // Ignore refresh failures
    }
  }, [token]);

  const loginWithPassword = async (identifier: string, password: string) => {
    const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
    setToken(data.token);
    setUser(data.user);
  };

  const registerWithPassword = async (payload: {
    fullName: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    password: string;
    role: 'tenant' | 'landlord';
  }) => {
    const data = await apiRequest<{ token: string; user: UserProfile; demoOtp?: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
    setToken(data.token);
    setUser(data.user);
    return { demoOtp: data.demoOtp };
  };

  const loginWithGoogle = async (role?: 'tenant' | 'landlord') => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    setToken(idToken);
    const data = await apiRequest<{ user: UserProfile }>('/api/auth/sync-google', {
      method: 'POST',
      token: idToken,
      body: JSON.stringify({ role }),
    });
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignore if signed in via local JWT
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginWithPassword,
        registerWithPassword,
        loginWithGoogle,
        logout,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
