/**
 * @file CrewEditorPanel.tsx
 * @description The editor that creates or updates a collaborator, on
 * `SidePanel`. Closing with unsaved changes asks first.
 *
 * Two sections under sans sub-headings, on the panel's own ground: who the
 * person is and how to reach them, then what they do and for which company,
 * the two facts the crew list prints under the name.
 * @module features/crew/components/CrewEditorPanel
 */

import React, { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Collaborator } from "@/shared/types";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { FormSection } from "@/shared/ui/composites/FormSection";
import { SidePanel } from "@/shared/ui/composites/SidePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";

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
  const isNewEntry = !person?.id;

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
        isNewEntry
          ? t("crew.editor.title_new", "Nowa osoba")
          : t("crew.editor.title_edit", "Edytuj osobę")
      }
      footer={
        <Button
          type="submit"
          form={formId}
          variant="primary"
          casing="sentence"
          fullWidth
          disabled={isSubmitting}
          isLoading={isSubmitting}
        >
          {isNewEntry
            ? t("crew.editor.submit", "Dodaj osobę")
            : t("crew.editor.save", "Zapisz")}
        </Button>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-9">
        <FormSection
          heading={t("crew.editor.section_contact", "Dane kontaktowe")}
          className="space-y-5"
        >
          {/* Only the name pairs up: an e-mail address in half of a 28 rem
              panel is cut off. */}
          <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
            <Input
              label={t("crew.editor.first_name", "Imię")}
              type="text"
              required
              value={formData.first_name}
              onChange={(event) => updateField("first_name", event.target.value)}
              disabled={isSubmitting}
              autoComplete="given-name"
            />
            <Input
              label={t("crew.editor.last_name", "Nazwisko")}
              type="text"
              required
              value={formData.last_name}
              onChange={(event) => updateField("last_name", event.target.value)}
              disabled={isSubmitting}
              autoComplete="family-name"
            />
          </div>
          <Input
            label={t("crew.editor.email", "E-mail")}
            type="email"
            value={formData.email}
            onChange={(event) => updateField("email", event.target.value)}
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
        </FormSection>

        <FormSection
          heading={t("crew.editor.section_work", "Działalność")}
          className="space-y-5"
        >
          {/* No "chosen specialty" preview under it: the select prints
              the same label two rows higher. */}
          <Select
            label={t("crew.editor.specialty", "Specjalizacja")}
            value={formData.specialty}
            onValueChange={(value) =>
              updateField("specialty", value as CrewFormData["specialty"])
            }
            disabled={isSubmitting}
            options={specialtyOptions}
          />

          <Input
            label={t("crew.editor.company_name", "Firma")}
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
        </FormSection>
      </form>

      <ConfirmModal
        isOpen={showExitConfirm}
        title={t("common.unsaved_title", "Masz niezapisane zmiany!")}
        description={t(
          "common.unsaved_desc",
          "Wprowadziłeś zmiany w formularzu, które nie zostały zapisane. Zamknięcie edytora spowoduje ich utratę.",
        )}
        onConfirm={forceClose}
        onCancel={() => setShowExitConfirm(false)}
      />
    </SidePanel>
  );
}
