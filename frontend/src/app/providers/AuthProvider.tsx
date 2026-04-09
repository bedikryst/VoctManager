/**
 * @file AuthContext.tsx
 * @description Authentication Context Provider.
 * Manages global authentication state, JWT lifecycle, and user profile data.
 * Exposes a custom hook (useAuth) to protect routes and conditionally render UI.
 * @architecture Enterprise 2026 Standards
 * @module context/AuthContext
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import api, { type AuthRequestConfig } from "../../shared/api/api";
import i18n from "../../shared/config/i18n";

export interface AuthUser {
  id: string | number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_admin?: boolean;
  artist_profile_id?: string | number;
  voice_type_display?: string;
  profile?: {
    language?: string;
    [key: string]: any;
  };
}

export interface LoginResponse {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userLang = user?.profile?.language;
    if (userLang && i18n.language !== userLang) {
      i18n.changeLanguage(userLang);
      document.documentElement.lang = userLang;
    }

    const checkAuth = async () => {
      try {
        const silentAuthCheckConfig: AuthRequestConfig = {
          skipAuthRefresh: true,
          skipAuthRedirect: true,
        };
        const response = await api.get<AuthUser>(
          "/api/artists/me/",
          silentAuthCheckConfig,
        );
        setUser(response.data);
      } catch (error) {
        // Not authenticated, stay logged out
        setUser(null);
        console.log("User not authenticated");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (
    email: string,
    password: string,
  ): Promise<LoginResponse> => {
    try {
      await api.post("/api/token/", { email, password });

      // Get user data after successful login
      const userResponse = await api.get<AuthUser>("/api/artists/me/");
      setUser(userResponse.data);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          "Błąd logowania. Sprawdź dane wejściowe.",
      };
    }
  };

  const logout = async () => {
    try {
      await api.post("/api/logout/");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
