/**
 * @file useGeneralSettings.ts
 * @description Enterprise-grade custom hook for managing the general settings form state.
 * Handles data synchronization, deep equality checks for 'dirty' state, and mutation flow.
 * Ensures strict TypeScript compliance with the expanded UpdatePreferencesPayload.
 * @module features/settings/hooks
 */

import { useState, useEffect, useMemo } from "react";
import { useSettingsData, useUpdatePreferences } from "../api/settings.queries";
import { UpdatePreferencesPayload } from "../types/settings.dto";
import { useTranslation } from "react-i18next";

export function useGeneralSettings() {
  const { data: user, isLoading: isFetching } = useSettingsData();
  const { mutateAsync: updatePreferences, isPending } = useUpdatePreferences();
  const { i18n } = useTranslation();
  const [formData, setFormData] = useState<UpdatePreferencesPayload>({
    first_name: "",
    last_name: "",
    profile: {
      phone_number: "",
      language: "pl",
      timezone: "UTC",
      // Logistics fields required by DTO (maintained silently)
      dietary_preference: "none",
      dietary_notes: "",
      clothing_size: "",
      shoe_size: "",
      height_cm: null,
    },
  });

  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message?: string;
  }>({ type: null });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        profile: {
          phone_number: user.profile?.phone_number || "",
          language: user.profile?.language || "pl",
          timezone: user.profile?.timezone || "UTC",
          // Preserving logistics data to satisfy TS and prevent accidental overwrite
          dietary_preference: user.profile?.dietary_preference || "none",
          dietary_notes: user.profile?.dietary_notes || "",
          clothing_size: user.profile?.clothing_size || "",
          shoe_size: user.profile?.shoe_size || "",
          height_cm: user.profile?.height_cm || null,
        },
      });
    }
  }, [user]);

  const isDirty = useMemo(() => {
    if (!user) return false;
    const initialData: UpdatePreferencesPayload = {
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      profile: {
        phone_number: user.profile?.phone_number || "",
        language: user.profile?.language || "pl",
        timezone: user.profile?.timezone || "UTC",
        dietary_preference: user.profile?.dietary_preference || "none",
        dietary_notes: user.profile?.dietary_notes || "",
        clothing_size: user.profile?.clothing_size || "",
        shoe_size: user.profile?.shoe_size || "",
        height_cm: user.profile?.height_cm || null,
      },
    };
    // Deep comparison za pomocą stringify (wydajne i bezpieczne dla prostych DTO)
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || isPending) return;

    setStatus({ type: null });

    try {
      await updatePreferences(formData);
      setStatus({ type: "success" });

      const newLang = formData.profile.language;
      if (newLang && i18n.language !== newLang) {
        i18n.changeLanguage(newLang);
        document.documentElement.lang = newLang; // synchronizacja a11y
      }

      // Ukrywamy komunikat o sukcesie po 3 sekundach
      setTimeout(() => setStatus({ type: null }), 3000);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message ||
        "Wystąpił błąd podczas zapisywania zmian.";
      setStatus({ type: "error", message: errorMsg });
    }
  };

  const handleChange = (
    field: keyof UpdatePreferencesPayload,
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileChange = (
    field: keyof UpdatePreferencesPayload["profile"],
    value: string | number | null,
  ) => {
    setFormData((prev) => ({
      ...prev,
      profile: { ...prev.profile, [field]: value },
    }));
  };

  return {
    user,
    formData,
    isFetching,
    isPending,
    isDirty,
    status,
    handleChange,
    handleProfileChange,
    handleSubmit,
  };
}
