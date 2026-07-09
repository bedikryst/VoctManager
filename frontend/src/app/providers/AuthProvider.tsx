/**
 * @file AuthProvider.tsx
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
import { isAxiosError } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import api, { type AuthRequestConfig } from "@/shared/api/api";
import { clearPersistedQueryCache } from "@/shared/api/queryPersistence";
import { clearAllOffline } from "@/shared/offline/offlineClient";
import { changeAppLanguage } from "@/shared/config/i18n";
import type { AuthProfile, AuthUser } from "@/shared/auth/auth.types";
import { settingsKeys } from "@/features/settings/api/settings.queries";
import type { UserMeDTO } from "@/features/settings/types/settings.dto";
import { notificationKeys } from "@/features/notifications/api/notifications.queries";

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
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const silentAuthCheckConfig: AuthRequestConfig = {
  skipAuthRefresh: true,
  skipAuthRedirect: true,
};

const fetchArtistSelf = async (): Promise<ArtistSelfResponse | null> => {
  try {
    const response = await api.get<ArtistSelfResponse>(
      "/api/artists/me/",
      silentAuthCheckConfig,
    );

    return response.status === 204 || !response.data ? null : response.data;
  } catch (error: unknown) {
    if (
      isAxiosError(error) &&
      (error.response?.status === 404 || error.response?.status === 204)
    ) {
      return null;
    }

    console.warn("Artist self profile was unavailable during auth bootstrap.", error);
    return null;
  }
};

const buildAuthUser = async (): Promise<AuthUser> => {
  const [identityResponse, artistResponse] = await Promise.all([
    api.get<UserIdentityResponse>("/api/users/me/", silentAuthCheckConfig),
    fetchArtistSelf(),
  ]);

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

const toUserMeDTO = (user: AuthUser): UserMeDTO => ({
  id: user.id,
  email: user.email,
  first_name: user.first_name ?? "",
  last_name: user.last_name ?? "",
  voice_type: user.voice_type ?? null,
  voice_type_display: user.voice_type_display ?? null,
  profile: user.profile
    ? {
        role: user.profile.role,
        is_manager: user.profile.is_manager,
        is_artist: user.profile.is_artist,
        is_crew: user.profile.is_crew,
        avatar_url: user.profile.avatar_url ?? null,
        avatar_thumb_url: user.profile.avatar_thumb_url ?? null,
        phone_number: user.profile.phone_number ?? "",
        language: user.profile.language ?? "pl",
        timezone: user.profile.timezone ?? "UTC",
        salutation: user.profile.salutation ?? "N",
        clothing_size: user.profile.clothing_size ?? "",
        shoe_size: user.profile.shoe_size ?? "",
        height_cm: user.profile.height_cm ?? null,
        calendar_token: user.profile.calendar_token ?? "",
      }
    : null,
});

const primeSessionIdentityCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  user: AuthUser,
): void => {
  queryClient.setQueryData<UserMeDTO>(settingsKeys.data, toUserMeDTO(user));
};

export const AuthProvider = ({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const userLang = user?.profile?.language;
    if (userLang) {
      // The authenticated user's stored preference is the source of truth for the
      // language they read the app in AND the language their notifications arrive
      // in — adopt it on login/refresh so the two never diverge.
      changeAppLanguage(userLang);
    }
  }, [user?.profile?.language]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authUser = await buildAuthUser();
        primeSessionIdentityCache(queryClient, authUser);
        setUser(authUser);
      } catch (error: unknown) {
        setUser(null);
        console.info(
          "Authentication check completed: User is unauthenticated.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [queryClient]);

  const refreshUser = async () => {
    try {
      const freshUser = await buildAuthUser();
      primeSessionIdentityCache(queryClient, freshUser);
      setUser(freshUser);
    } catch (error) {
      console.error("Failed to refresh user session data", error);
    }
  };

  const login = async (
    email: string,
    password: string,
  ): Promise<LoginResponse> => {
    try {
      await api.post("/api/token/", { email, password });
      const authUser = await buildAuthUser();
      primeSessionIdentityCache(queryClient, authUser);
      setUser(authUser);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: notificationKeys.lists(),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount(),
          exact: true,
        }),
      ]);

      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        isAxiosError(error) && error.response?.data?.detail
          ? error.response.data.detail
          : "Błąd logowania. Sprawdź dane wejściowe.";

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = async () => {
    try {
      await api.post("/api/logout/");
    } catch (error: unknown) {
      console.error("Logout process encountered an error:", error);
    } finally {
      setUser(null);
      queryClient.clear();
      // Drop every offline trace too — query snapshot, downloaded scores/audio
      // and any queued writes — so nothing leaks to the next user on a shared
      // device.
      clearPersistedQueryCache();
      void clearAllOffline();
      window.location.href = "/login";
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser,
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
