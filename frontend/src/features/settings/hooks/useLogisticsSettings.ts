import { useState, useEffect, useMemo } from "react";
import { useSettingsData, useUpdatePreferences } from "../api/settings.queries";
import { UpdatePreferencesPayload } from "../types/settings.dto";

export function useLogisticsSettings() {
  const { data: user, isLoading: isFetching } = useSettingsData();
  const { mutateAsync: updatePreferences, isPending } = useUpdatePreferences();

  const [formData, setFormData] = useState({
    dietary_preference: "none",
    dietary_notes: "",
    clothing_size: "",
    shoe_size: "",
    height_cm: "" as string | number, // trzymamy jako string dla formularza, parsujemy przy wysyłce
  });

  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message?: string;
  }>({ type: null });

  useEffect(() => {
    if (user?.profile) {
      setFormData({
        dietary_preference: user.profile.dietary_preference || "none",
        dietary_notes: user.profile.dietary_notes || "",
        clothing_size: user.profile.clothing_size || "",
        shoe_size: user.profile.shoe_size || "",
        height_cm: user.profile.height_cm || "",
      });
    }
  }, [user]);

  const isDirty = useMemo(() => {
    if (!user?.profile) return false;
    const initial = {
      dietary_preference: user.profile.dietary_preference || "none",
      dietary_notes: user.profile.dietary_notes || "",
      clothing_size: user.profile.clothing_size || "",
      shoe_size: user.profile.shoe_size || "",
      height_cm: user.profile.height_cm || "",
    };
    return JSON.stringify(formData) !== JSON.stringify(initial);
  }, [formData, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || isPending || !user) return;

    setStatus({ type: null });

    // Budujemy pełen payload, zachowując istniejące dane Generalne (imię, język itd.)
    const payload: UpdatePreferencesPayload = {
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      profile: {
        phone_number: user.profile?.phone_number || "",
        language: user.profile?.language || "pl",
        timezone: user.profile?.timezone || "UTC",
        dietary_preference: formData.dietary_preference,
        dietary_notes: formData.dietary_notes,
        clothing_size: formData.clothing_size,
        shoe_size: formData.shoe_size,
        height_cm: formData.height_cm
          ? parseInt(formData.height_cm.toString(), 10)
          : null,
      },
    };

    try {
      await updatePreferences(payload);
      setStatus({ type: "success" });
      setTimeout(() => setStatus({ type: null }), 3000);
    } catch (error: any) {
      setStatus({
        type: "error",
        message: "Błąd podczas zapisywania logistyki.",
      });
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return {
    formData,
    isFetching,
    isPending,
    isDirty,
    status,
    handleChange,
    handleSubmit,
  };
}
