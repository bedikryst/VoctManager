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
  type ReactNode,
} from "react";
import api, { type AuthRequestConfig } from "../../shared/api/api";
import i18n from "../../shared/config/i18n";
import type {
  AuthProfile,
  AuthUser,
} from "../../shared/auth/auth.types";

interface UserIdentityResponse {
  id: string | number;
  email: string;
  first_name?: string;
  last_name?: string;
  voice_type?: string | null;
  voice_type_display?: string | null;
  profile?: AuthProfile | null;
}

interface ArtistSelfResponse {
  id: string | number;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  voice_type?: string | null;
  voice_type_display?: string | null;
  profile?: AuthProfile | null;
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

const silentAuthCheckConfig: AuthRequestConfig = {
  skipAuthRefresh: true,
  skipAuthRedirect: true,
};

const buildAuthUser = async (): Promise<AuthUser> => {
  const identityResponse = await api.get<UserIdentityResponse>(
    "/api/users/me/",
    silentAuthCheckConfig,
  );

  const artistResponse = await api
    .get<ArtistSelfResponse>("/api/artists/me/", silentAuthCheckConfig)
    .then((response) => response.data)
    .catch(() => null);

  return {
    id: identityResponse.data.id,
    email: identityResponse.data.email || artistResponse?.email || "",
    username: artistResponse?.username,
    first_name:
      identityResponse.data.first_name || artistResponse?.first_name || "",
    last_name:
      identityResponse.data.last_name || artistResponse?.last_name || "",
    artist_profile_id: artistResponse?.id ?? null,
    voice_type: identityResponse.data.voice_type ?? artistResponse?.voice_type,
    voice_type_display:
      identityResponse.data.voice_type_display ??
      artistResponse?.voice_type_display,
    profile: identityResponse.data.profile ?? artistResponse?.profile ?? null,
  };
};

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
  }, [user?.profile?.language]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setUser(await buildAuthUser());
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
      setUser(await buildAuthUser());

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
