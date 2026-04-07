/**
 * @file useCrewForm.ts
 * @description Manages form state, dirty tracking, and persistence for the Crew editor.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Collaborator } from "../../../shared/types";
import { useSaveCrewMember } from "../api/crew.queries";
import type { CrewFormData } from "../types/crew.dto";

export const useCrewForm = (
  person: Collaborator | null,
  initialSearchContext: string,
  onClose: () => void,
) => {
  const saveMutation = useSaveCrewMember();

  const initialFormData = useMemo<CrewFormData>(() => {
    let defaultCompany = "";
    let defaultLastName = "";

    if (!person && initialSearchContext) {
      if (initialSearchContext.includes(" ")) {
        defaultLastName = initialSearchContext;
      } else {
        defaultCompany = initialSearchContext;
      }
    }

    return {
      first_name: person?.first_name || "",
      last_name: person?.last_name || defaultLastName,
      email: person?.email || "",
      phone_number: person?.phone_number || "",
      company_name: person?.company_name || defaultCompany,
      specialty: person?.specialty || "OTHER",
    };
  }, [person, initialSearchContext]);

  const [formData, setFormData] = useState<CrewFormData>(initialFormData);

  const isFormDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    const toastId = toast.loading(
      person?.id ? "Aktualizowanie danych..." : "Dodawanie współpracownika...",
    );

    try {
      await saveMutation.mutateAsync({ id: person?.id, data: formData });
      toast.success(
        person?.id
          ? "Zaktualizowano profil współpracownika."
          : "Dodano nową osobę do bazy.",
        {
          id: toastId,
        },
      );
      setFormData(formData);
      onClose();
    } catch (error) {
      toast.error("Wystąpił błąd podczas zapisywania danych.", {
        id: toastId,
        description: "Sprawdź poprawność danych i spróbuj ponownie.",
      });
    }
  };

  return {
    formData,
    setFormData,
    initialFormData,
    isFormDirty,
    isSubmitting: saveMutation.isPending,
    handleSubmit,
  };
};
