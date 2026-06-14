import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey, type User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react/src/custom-fetch";

function isBlockedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; data?: { error?: string } | null };
  return e.status === 403 && e.data?.error === "Вы заблокированы";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isBlocked: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("kadastr_token"));
  const [isBlocked, setIsBlocked] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("kadastr_token"));
  }, []);

  const { data: user, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  // Detect blocked from /users/me response
  useEffect(() => {
    if (isBlockedError(error)) setIsBlocked(true);
  }, [error]);

  // Detect blocked from any query failure during active session (TanStack Query v5)
  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated") {
        const action = (event as unknown as { action?: { type?: string; error?: unknown } }).action;
        if (action?.type === "error" && isBlockedError(action.error)) {
          setIsBlocked(true);
        }
      }
    });
    return () => unsub();
  }, [queryClient]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("kadastr_token", newToken);
    setToken(newToken);
    setIsBlocked(false);
    queryClient.setQueryData(getGetMeQueryKey(), newUser);
  };

  const logout = () => {
    localStorage.removeItem("kadastr_token");
    setToken(null);
    setIsBlocked(false);
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user: user || null, token, isLoading, isBlocked, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
