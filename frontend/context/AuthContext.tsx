"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "@/lib/api";

export type User = {
  id: number;
  name: string;
  email: string;
  role: "producteur" | "consommateur" | "admin";
  latitude: number | null;
  longitude: number | null;
  credits: number;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: "producteur" | "consommateur";
  latitude?: number;
  longitude?: number;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_KEY = "energie_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Au chargement : retrouver la session à partir du token sauvegardé
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }
    api<User>("/me", { token: saved })
      .then((u) => {
        setToken(saved);
        setUser(u);
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const startSession = (u: User, t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
  };

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api<{ user: User; token: string }>("/login", {
      method: "POST",
      body: { email, password },
    });
    startSession(res.user, res.token);
    return res.user;
  };

  const register = async (payload: RegisterPayload) => {
    const res = await api<{ user: User; token: string }>("/register", {
      method: "POST",
      body: payload,
    });
    startSession(res.user, res.token);
  };

  const logout = async () => {
    try {
      if (token) await api("/logout", { method: "POST", token });
    } catch {
      // le token peut déjà être invalide : on déconnecte quand même côté client
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    if (!token) return;
    setUser(await api<User>("/me", { token }));
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}