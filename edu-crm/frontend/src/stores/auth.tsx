import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  STORAGE_KEY_TOKEN,
  STORAGE_KEY_USER,
  api,
  extractErrorMessage,
  unwrapData,
} from '../utils/api';

export type UserRole = 'ADMIN' | 'MANAGER' | 'TEACHER' | 'CASHIER' | (string & {});

export interface User {
  id: number;
  email: string;
  role: UserRole;
  name?: string | null;
  phone?: string | null;
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearLoginError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface LoginResponse {
  token: string;
  user: User;
}

function parseStoredUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'number' && typeof parsed.email === 'string') {
      return parsed as User;
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const storedUser = parseStoredUser(localStorage.getItem(STORAGE_KEY_USER));

    if (storedToken) setToken(storedToken);
    if (storedUser) setUser(storedUser);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoginError(null);
    try {
      const res = await api.post<LoginResponse>(
        '/api/auth/login',
        { email, password },
        { headers: { 'Content-Type': 'application/json' } },
      );
      const payload = unwrapData<LoginResponse>(res) as LoginResponse | null;
      const { token: newToken, user: newUser }: LoginResponse = payload ?? (res.data as LoginResponse);

      localStorage.setItem(STORAGE_KEY_TOKEN, newToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));

      setToken(newToken);
      setUser(newUser);
    } catch (error) {
      const message = extractErrorMessage(error);
      setLoginError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    setToken(null);
    setUser(null);
    setLoginError(null);
  }, []);

  const clearLoginError = useCallback(() => setLoginError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      loading,
      loginError,
      login,
      logout,
      clearLoginError,
    }),
    [user, token, loading, loginError, login, logout, clearLoginError],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  }
  return ctx;
}

export function useAuthorized(allowedRoles: UserRole[]): { authorized: boolean; user: User | null } {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return { authorized: false, user: null };
  if (allowedRoles.length === 0) return { authorized: true, user };
  return { authorized: allowedRoles.includes(user.role), user };
}
