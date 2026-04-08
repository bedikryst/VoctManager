/**
 * @file useArtistForm.ts
 * @description Encapsulates complex form state, dirty tracking, and API payload construction.
 * Delegates actual network requests strictly to the Query/Mutation layer.
 * Fully internationalized.
 * @module features/artists/hooks/useArtistForm
 */

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Artist, VoiceTypeOption } from "../../../shared/types";
import { useCreateArtist, useUpdateArtist } from "../api/artist.queries";
import type { ArtistCreateDTO, ArtistUpdateDTO } from "../types/artist.dto";

export interface ArtistFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  voice_type: string;
  is_active: boolean;
  sight_reading_skill: string;
  vocal_range_bottom: string;
  vocal_range_top: string;
}

export const useArtistForm = (
  artist: Artist | null,
  voiceTypes: VoiceTypeOption[],
  initialSearchContext: string,
  onClose: () => void,
) => {
  const { t } = useTranslation();
  const createMutation = useCreateArtist();
  const updateMutation = useUpdateArtist();

  const initialFormData = useMemo<ArtistFormData>(() => {
    let defaultFirst = "";
    let defaultLast = "";

    if (!artist && initialSearchContext) {
      const parts = initialSearchContext.trim().split(" ");
      defaultFirst = parts[0] || "";
      defaultLast = parts.slice(1).join(" ") || "";
    }

    return {
      first_name: artist?.first_name || defaultFirst,
      last_name: artist?.last_name || defaultLast,
      email: artist?.email || "",
      phone_number: artist?.phone_number || "",
      voice_type:
        artist?.voice_type ||
        (voiceTypes.length > 0 ? voiceTypes[0].value : "SOP"),
      is_active: artist?.is_active ?? true,
      sight_reading_skill: artist?.sight_reading_skill
        ? String(artist.sight_reading_skill)
        : "",
      vocal_range_bottom: artist?.vocal_range_bottom || "",
      vocal_range_top: artist?.vocal_range_top || "",
    };
  }, [artist, voiceTypes, initialSearchContext]);

  const [formData, setFormData] = useState<ArtistFormData>(initialFormData);

  const isFormDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const toastId = toast.loading(
      artist?.id
        ? t("artists.form.toast.updating", "Aktualizowanie profilu...")
        : t("artists.form.toast.creating", "Tworzenie konta artysty..."),
    );

    const payload = {
      ...formData,
      sight_reading_skill: formData.sight_reading_skill
        ? parseInt(formData.sight_reading_skill, 10)
        : undefined,
    };

    try {
      if (artist?.id) {
        await updateMutation.mutateAsync({
          id: artist.id,
          data: payload as ArtistUpdateDTO,
        });
        toast.success(
          t(
            "artists.form.toast.update_success",
            "Zaktualizowano profil artysty.",
          ),
          { id: toastId },
        );
      } else {
        await createMutation.mutateAsync(payload as ArtistCreateDTO);
        toast.success(
          t(
            "artists.form.toast.create_success",
            "Dodano artystę. Konto wygenerowane!",
          ),
          { id: toastId },
        );
      }

      setFormData(formData);
      onClose();
    } catch (err: any) {
      console.error("[ArtistEditor] Form submission failed:", err);
      const isEmailTaken = err?.response?.data?.email;

      toast.error(
        isEmailTaken
          ? t(
              "artists.form.toast.email_taken",
              "Ten adres e-mail jest już zajęty.",
            )
          : t("common.errors.save_error", "Błąd zapisu"),
        {
          id: toastId,
          description: t(
            "artists.form.toast.save_error_desc",
            "Sprawdź poprawność danych i spróbuj ponownie.",
          ),
        },
      );
    }
  };

  return {
    formData,
    setFormData,
    initialFormData,
    isFormDirty,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    handleSubmit,
  };
};
