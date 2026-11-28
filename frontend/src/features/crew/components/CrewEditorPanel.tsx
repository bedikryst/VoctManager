/**
 * @file CrewEditorPanel.tsx
 * @description The editor that creates or updates a collaborator, on
 * `SidePanel`. Closing with unsaved changes asks first.
 * @module features/crew/components/CrewEditorPanel
 */

import React, { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";

import type { Collaborator } from "@/shared/types";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { SidePanel } from "@/shared/ui/composites/SidePanel";
import { Divider } from "@/shared/ui/primitives/Divider";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Eyebrow } from "@/shared/ui/primitives/typography";

import { getCrewSpecialtyOptions } from "../constants/crewSpecialties";
import { useCrewForm } from "../hooks/useCrewForm";
import type { CrewFormData } from "../types/crew.dto";

interface CrewEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  person: Collaborator | null;
  initialSearchContext?: string;
}

export function CrewEditorPanel({
  isOpen,
  onClose,
  person,
  initialSearchContext = "",
}: CrewEditorPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const {
    formData,
    setFormData,
    initialFormData,
    isFormDirty,
    isSubmitting,
    handleSubmit,
  } = useCrewForm(person, initialSearchContext, onClose, isOpen);

  useEffect(() => {
    if (isOpen) setFormData(initialFormData);
  }, [initialFormData, isOpen, setFormData]);

  const handleCloseRequest = React.useCallback(() => {
    if (isFormDirty) {
      setShowExitConfirm(true);
      return;
    }
    onClose();
  }, [isFormDirty, onClose]);

  const forceClose = () => {
    setShowExitConfirm(false);
    onClose();
  };

  const specialtyOptions = getCrewSpecialtyOptions(t);

  const updateField = <K extends keyof CrewFormData>(
    key: K,
    value: CrewFormData[K],
  ) => setFormData({ ...formData, [key]: value });

  return (
    <SidePanel
      isOpen={isOpen}
      onCloseRequest={handleCloseRequest}
      size="md"
      title={
        person?.id
          ? t("crew.editor.title_edit", "Edycja danych")
          : t("crew.editor.title_new", "Nowy współpracownik")
      }
      footer={
        <Button
          type="submit"
          form={formId}
          variant="primary"
          fullWidth
          disabled={isSubmitting}
          isLoading={isSubmitting}
          leftIcon={
            !isSubmitting ? (
              <CheckCircle2 size={16} aria-hidden="true" />
            ) : undefined
          }
        >
          {t("crew.editor.btn_save", "Zapisz do bazy")}
        </Button>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="flex min-h-full flex-col gap-7 rounded-surface border border-ethereal-incense/15 bg-ethereal-marble/65 p-6 shadow-[inset_0_1px_0_var(--glass-highlight)] md:p-8"
      >
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <Eyebrow color="gold">
              {t("crew.editor.contact_person", "Osoba kontaktowa")}
            </Eyebrow>
            <Divider variant="gradient-right" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={t("crew.editor.first_name", "Imię *")}
              type="text"
              required
              value={formData.first_name}
              onChange={(event) =>
                updateField("first_name", event.target.value)
              }
              disabled={isSubmitting}
              autoComplete="given-name"
            />
            <Input
              label={t("crew.editor.last_name", "Nazwisko *")}
              type="text"
              required
              value={formData.last_name}
              onChange={(event) =>
                updateField("last_name", event.target.value)
              }
              disabled={isSubmitting}
              autoComplete="family-name"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={t("crew.editor.email", "E-mail")}
              type="email"
              value={formData.email}
              onChange={(event) =>
                updateField("email", event.target.value)
              }
              disabled={isSubmitting}
              autoComplete="email"
            />
            <Input
              label={t("crew.editor.phone", "Telefon")}
              type="tel"
              value={formData.phone_number}
              onChange={(event) =>
                updateField("phone_number", event.target.value)
              }
              disabled={isSubmitting}
              autoComplete="tel"
            />
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <Eyebrow color="gold">
              {t(
                "crew.editor.business_profile",
                "Profil działalności",
              )}
            </Eyebrow>
            <Divider variant="gradient-right" />
          </div>

          {/* No "chosen specialty" preview under it: the select prints
              the same label two rows higher. */}
          <Select
            label={t("crew.editor.specialty", "Specjalizacja *")}
            value={formData.specialty}
            onValueChange={(value) =>
              updateField(
                "specialty",
                value as CrewFormData["specialty"],
              )
            }
            disabled={isSubmitting}
            options={specialtyOptions}
          />

          <Input
            label={t(
              "crew.editor.company_name",
              "Firma / Marka (opcjonalnie)",
            )}
            type="text"
            placeholder={t(
              "crew.editor.company_placeholder",
              "np. SoundTech Pro Sp. z o.o.",
            )}
            value={formData.company_name}
            onChange={(event) =>
              updateField("company_name", event.target.value)
            }
            disabled={isSubmitting}
            autoComplete="organization"
          />
        </section>
      </form>

      <ConfirmModal
        isOpen={showExitConfirm}
        title={t(
          "crew.editor.confirm_exit_title",
          "Masz niezapisane zmiany!",
        )}
        description={t(
          "crew.editor.confirm_exit_desc",
          "Wprowadziłeś zmiany w formularzu, które nie zostały zapisane. Zamknięcie panelu spowoduje ich utratę.",
        )}
        onConfirm={forceClose}
        onCancel={() => setShowExitConfirm(false)}
      />
    </SidePanel>
  );
}
