/**
 * @file useArtistForm.ts
 * @description Encapsulates form state, Zod validation, and API payload construction using RHF.
 * @module features/artists/hooks/useArtistForm
 */

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Artist, VoiceTypeOption } from "../../../shared/types";
import { useCreateArtist, useUpdateArtist } from "../api/artist.queries";
import {
  artistFormSchema,
  type ArtistFormValues,
  type ArtistCreateDTO,
  type ArtistUpdateDTO,
} from "../types/artist.dto";

export const useArtistForm = (
  artist: Artist | null,
  voiceTypes: VoiceTypeOption[],
  initialSearchContext: string,
  onClose: () => void,
) => {
  const { t } = useTranslation();
  const createMutation = useCreateArtist();
  const updateMutation = useUpdateArtist();

  const defaultNames = useMemo(() => {
    let first = "";
    let last = "";
    if (!artist && initialSearchContext) {
      const parts = initialSearchContext.trim().split(" ");
      first = parts[0] || "";
      last = parts.slice(1).join(" ") || "";
    }
    return { first, last };
  }, [artist, initialSearchContext]);

  const form = useForm<ArtistFormValues>({
    resolver: zodResolver(artistFormSchema),
    defaultValues: {
      first_name: artist?.first_name || defaultNames.first,
      last_name: artist?.last_name || defaultNames.last,
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
      language: "pl",
    },
  });

  useEffect(() => {
    if (artist) {
      form.reset({
        first_name: artist.first_name,
        last_name: artist.last_name,
        email: artist.email,
        phone_number: artist.phone_number || "",
        voice_type: artist.voice_type,
        is_active: artist.is_active,
        sight_reading_skill: artist.sight_reading_skill
          ? String(artist.sight_reading_skill)
          : "",
        vocal_range_bottom: artist.vocal_range_bottom || "",
        vocal_range_top: artist.vocal_range_top || "",
        language: "pl",
      });
    } else {
      form.reset({
        first_name: defaultNames.first,
        last_name: defaultNames.last,
        email: "",
        phone_number: "",
        voice_type: voiceTypes.length > 0 ? voiceTypes[0].value : "SOP",
        is_active: true,
        sight_reading_skill: "",
        vocal_range_bottom: "",
        vocal_range_top: "",
        language: "pl",
      });
    }
  }, [artist, defaultNames, voiceTypes, form]);

  const onSubmit = async (data: ArtistFormValues) => {
    const toastId = toast.loading(
      artist?.id
        ? t("artists.form.toast.updating", "Aktualizowanie profilu...")
        : t("artists.form.toast.creating", "Tworzenie konta artysty..."),
    );

    const basePayload: ArtistCreateDTO = {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email.trim(),
      voice_type: data.voice_type,
      phone_number: data.phone_number?.trim() || undefined,
      vocal_range_bottom: data.vocal_range_bottom?.trim() || undefined,
      vocal_range_top: data.vocal_range_top?.trim() || undefined,
      sight_reading_skill: data.sight_reading_skill
        ? parseInt(data.sight_reading_skill, 10)
        : null,
      language: data.language,
    };

    try {
      if (artist?.id) {
        const { language, ...safeBasePayload } = basePayload;
        const updatePayload: ArtistUpdateDTO = {
          ...safeBasePayload,
          is_active: data.is_active,
        };
        await updateMutation.mutateAsync({
          id: artist.id,
          data: updatePayload,
        });
        toast.success(
          t(
            "artists.form.toast.update_success",
            "Zaktualizowano profil artysty.",
          ),
          { id: toastId },
        );
      } else {
        await createMutation.mutateAsync(basePayload);
        toast.success(
          t(
            "artists.form.toast.create_success",
            "Dodano artystę. Konto wygenerowane!",
          ),
          { id: toastId },
        );
      }
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
    form,
    isDirty: form.formState.isDirty,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    onSubmit: form.handleSubmit(onSubmit),
  };
};
