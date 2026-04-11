/**
 * @file useLocationForm.ts
 * @description Encapsulates complex form state, validation, and API logic using RHF and Zod.
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useCreateLocation, useUpdateLocation } from "../api/logistics.queries";
import {
  locationFormSchema,
  type LocationFormValues,
  type LocationDto,
} from "../types/logistics.dto";

export const useLocationForm = (
  location: LocationDto | null,
  onClose: () => void,
) => {
  const { t } = useTranslation();
  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: location?.name || "",
      category: location?.category || "CONCERT_HALL",
      formatted_address: location?.formatted_address || "",
      google_place_id: location?.google_place_id || null,
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      internal_notes: location?.internal_notes || "",
    },
  });

  useEffect(() => {
    if (location) {
      form.reset(location);
    }
  }, [location, form]);

  const handleGooglePlaceSelect = (placeData: Partial<LocationFormValues>) => {
    if (placeData.name)
      form.setValue("name", placeData.name, {
        shouldValidate: true,
        shouldDirty: true,
      });
    if (placeData.formatted_address)
      form.setValue("formatted_address", placeData.formatted_address, {
        shouldValidate: true,
        shouldDirty: true,
      });
    if (placeData.google_place_id)
      form.setValue("google_place_id", placeData.google_place_id, {
        shouldDirty: true,
      });
    if (placeData.latitude)
      form.setValue("latitude", parseFloat(placeData.latitude.toFixed(6)), {
        shouldDirty: true,
      });
    if (placeData.longitude)
      form.setValue("longitude", parseFloat(placeData.longitude.toFixed(6)), {
        shouldDirty: true,
      });
  };

  const onSubmit = async (data: LocationFormValues) => {
    const toastId = toast.loading(
      location?.id
        ? t("logistics.toast.updating", "Aktualizacja...")
        : t("logistics.toast.creating", "Tworzenie..."),
    );

    try {
      if (location?.id) {
        await updateMutation.mutateAsync({
          id: location.id,
          data: { ...data, is_active: true },
        });
        toast.success(t("logistics.toast.update_success", "Zaktualizowano!"), {
          id: toastId,
        });
      } else {
        await createMutation.mutateAsync(data);
        toast.success(t("logistics.toast.create_success", "Dodano!"), {
          id: toastId,
        });
      }
      onClose();
    } catch (error) {
      console.error("[VoctManager API Error]:", error);
      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        id: toastId,
      });
    }
  };

  return {
    form, // Expose the entire RHF object for the UI
    handleGooglePlaceSelect,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    isDirty: form.formState.isDirty,
    onSubmit: form.handleSubmit(onSubmit),
  };
};
