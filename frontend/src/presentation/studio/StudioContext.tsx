import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { upApi, UpApiClient } from '../../infrastructure/api/UpApiClient';

export interface StudioUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface StudioContextValue {
  api: UpApiClient;
  user: StudioUser | null;
  ready: boolean;
  notice: string | null;
  error: string | null;
  setNotice: (message: string | null) => void;
  setError: (message: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = upApi;
  const [user, setUser] = useState<StudioUser | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      if (!api.isAuthenticated) {
        if (active) setReady(true);
        return;
      }
      try {
        const me = await api.me();
        if (active) setUser({ id: me.id, email: me.email, name: me.name, role: me.role });
      } catch {
        api.setToken(null);
      } finally {
        if (active) setReady(true);
      }
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, [api]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const data = await api.login(email, password);
      setUser({ id: data.user.email, email: data.user.email, name: data.user.name, role: 'owner' });
    },
    [api]
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      setError(null);
      const data = await api.register(email, password, name);
      setUser({ id: data.user.email, email: data.user.email, name: data.user.name, role: 'owner' });
    },
    [api]
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, [api]);

  const value = useMemo<StudioContextValue>(
    () => ({ api, user, ready, notice, error, setNotice, setError, login, register, logout }),
    [api, user, ready, notice, error, login, register, logout]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within a StudioProvider');
  return ctx;
}
