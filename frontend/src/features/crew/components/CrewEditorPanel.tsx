/**
 * @file CrewEditorPanel.tsx
 * @description Slide-over editor for creating or updating a collaborator profile.
 * Built on Ethereal primitives — Heading/Eyebrow typography, Select primitive,
 * Input with native label slot — and a portal-managed motion shell.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewEditorPanel
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CheckCircle2, X } from "lucide-react";

import type { Collaborator } from "@/shared/types";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Divider } from "@/shared/ui/primitives/Divider";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import {
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";

import { getCrewSpecialtyOptions } from "../constants/crewSpecialties";
import { useCrewForm } from "../hooks/useCrewForm";
import type { CrewFormData } from "../types/crew.dto";

import { CrewSpecialtyBadge } from "./CrewSpecialtyBadge";

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
}: CrewEditorPanelProps): React.ReactPortal | null {
  const { t } = useTranslation();
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const {
    formData,
    setFormData,
    initialFormData,
    isFormDirty,
    isSubmitting,
    handleSubmit,
  } = useCrewForm(person, initialSearchContext, onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  useEffect(() => {
    if (!isOpen || showExitConfirm) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleCloseRequest();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseRequest, isOpen, showExitConfirm]);

  const forceClose = () => {
    setShowExitConfirm(false);
    onClose();
  };

  const specialtyOptions = getCrewSpecialtyOptions(t);

  if (!mounted) return null;

  const updateField = <K extends keyof CrewFormData>(
    key: K,
    value: CrewFormData[K],
  ) => setFormData({ ...formData, [key]: value });

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <React.Fragment key="crew-panel-wrapper">
          <motion.div
            key="crew-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseRequest}
            className="fixed inset-0 z-focus-trap bg-ethereal-ink/35 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            key="crew-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-focus-trap flex w-full max-w-md flex-col border-l border-ethereal-incense/20 bg-ethereal-alabaster/95 shadow-glass-solid backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
          >
            <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-ethereal-incense/15 bg-ethereal-marble/60 px-6 py-5 backdrop-blur-xl md:px-8">
              <div className="min-w-0 space-y-1.5">
                <Eyebrow color="muted">
                  {t("crew.editor.eyebrow", "Profil współpracownika")}
                </Eyebrow>
                <Heading as="h3" size="2xl" truncate>
                  {person?.id
                    ? t("crew.editor.title_edit", "Edycja danych")
                    : t("crew.editor.title_new", "Nowy współpracownik")}
                </Heading>
              </div>
              <button
                type="button"
                onClick={handleCloseRequest}
                aria-label={t("crew.editor.close_aria", "Zamknij panel")}
                className="rounded-xl border border-ethereal-incense/20 bg-ethereal-marble/70 p-2.5 text-ethereal-graphite shadow-sm transition-all duration-300 hover:border-ethereal-gold/40 hover:text-ethereal-ink active:scale-95"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="relative flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
              <form
                onSubmit={handleSubmit}
                className="flex min-h-full flex-col gap-7 rounded-3xl border border-ethereal-incense/15 bg-ethereal-marble/65 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl md:p-8"
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

                  <Select
                    label={t("crew.editor.specialty", "Specjalizacja *")}
                    value={formData.specialty}
                    onChange={(event) =>
                      updateField(
                        "specialty",
                        event.target.value as CrewFormData["specialty"],
                      )
                    }
                    disabled={isSubmitting}
                  >
                    {specialtyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/60 px-4 py-3">
                    <Text size="xs" color="graphite">
                      {t(
                        "crew.editor.specialty_preview",
                        "Wybrana specjalizacja",
                      )}
                    </Text>
                    <CrewSpecialtyBadge
                      specialty={formData.specialty}
                      size="sm"
                    />
                  </div>

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

                <div className="sticky bottom-0 -mx-6 -mb-6 mt-auto border-t border-ethereal-incense/15 bg-ethereal-marble/80 px-6 py-5 backdrop-blur-xl md:-mx-8 md:-mb-8 md:px-8">
                  <Button
                    type="submit"
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
                </div>
              </form>
            </div>

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
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>,
    document.body,
  );
}
