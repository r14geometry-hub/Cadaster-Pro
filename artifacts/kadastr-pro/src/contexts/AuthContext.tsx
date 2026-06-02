import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey, type User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react/src/custom-fetch";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
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
  const queryClient = useQueryClient();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("kadastr_token"));
  }, []);

  const { data: user, isLoading } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("kadastr_token", newToken);
    setToken(newToken);
    queryClient.setQueryData(getGetMeQueryKey(), newUser);
  };

  const logout = () => {
    localStorage.removeItem("kadastr_token");
    setToken(null);
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user: user || null, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
