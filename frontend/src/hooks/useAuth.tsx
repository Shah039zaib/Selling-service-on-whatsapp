'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { api, getProfile, logout as apiLogout } from '@/lib/api';
import { socketClient } from '@/lib/socket';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = api.getToken();
      if (!token) {
        setUser(null);
        return;
      }

      const response = await getProfile();
      if (response.success && response.data) {
        setUser(response.data);
        socketClient.connect(token);
      } else {
        setUser(null);
        api.setToken(null);
      }
    } catch {
      setUser(null);
      api.setToken(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refreshUser();
      setIsLoading(false);
    };
    init();

    return () => {
      socketClient.disconnect();
    };
  }, []);

  const login = (token: string, userData: User) => {
    api.setToken(token);
    setUser(userData);
    socketClient.connect(token);
  };

  const logout = () => {
    apiLogout();
    setUser(null);
    socketClient.disconnect();
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  // Return default context during SSR/SSG to avoid build errors
  if (context === undefined) {
    return defaultAuthContext;
  }
  return context;
}

export { AuthContext };
