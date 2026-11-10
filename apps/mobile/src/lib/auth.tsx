/**
 * Mobile auth provider — mirrors the web AuthProvider.
 * Bootstraps by hydrating the secure token cache, then fetching /auth/me.
 * Owns the socket lifecycle: connects on login, disconnects on logout.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponse, UserProfile } from '@mehfil/shared';
import { http, setUnauthorizedHandler } from './api';
import { tokenStore } from './storage';
import { disconnectSocket, getSocket } from './socket';

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
  displayName: string;
  dateOfBirth?: string;
  acceptedAge?: boolean;
  phone?: string;
}

interface AuthValue {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (input: RegisterInput) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

async function persist(res: AuthResponse) {
  await tokenStore.set(res.tokens.accessToken, res.tokens.refreshToken);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    await tokenStore.load();
    if (!tokenStore.access) {
      setLoading(false);
      return;
    }
    try {
      const me = await http.get<UserProfile>('/auth/me');
      setUser(me);
      getSocket(); // establish realtime connection once authenticated
    } catch {
      await tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      disconnectSocket();
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await http.post<AuthResponse>('/auth/login', { email, password });
    await persist(res);
    setUser(res.user);
    getSocket();
    return res.user;
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await http.post<AuthResponse>('/auth/register', input);
      if (res?.tokens) {
        await persist(res);
        setUser(res.user);
        getSocket();
        return res.user;
      }
      // Registration may require email verification before issuing tokens.
      return login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    const refresh = tokenStore.refresh;
    try {
      if (refresh) {
        await http.post('/auth/logout', { refreshToken: refresh }, { skipRefresh: true });
      }
    } catch {
      /* ignore */
    }
    disconnectSocket();
    await tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshUser: loadMe,
      setUser,
    }),
    [user, loading, login, register, logout, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
