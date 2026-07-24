/**
 * @file ArtistEditorPanel.tsx
 * @description Slide-over panel for creating or editing artist profiles.
 * Uses React Hook Form for zero-lag rendering and Zod for validation, and the
 * shared Ethereal primitives (Input/Select with built-in label + error) so the
 * editor matches the rest of the 2026 surface language.
 * @module features/artists/components/ArtistEditorPanel
 */

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, CheckCircle2, Send } from "lucide-react";
import { useWatch } from "react-hook-form";

import { ConfirmModal } from "@ui/composites/ConfirmModal";
import { Button } from "@ui/primitives/Button";
import { Input } from "@ui/primitives/Input";
import { Select } from "@ui/primitives/Select";
import { Eyebrow, Heading, Text } from "@ui/primitives/typography";
import type { Artist, VoiceTypeOption } from "@/shared/types";
import { useArtistForm } from "../hooks/useArtistForm";
import { voiceToSalutation } from "../types/artist.dto";
import { NewThreadModal } from "@/features/messages/components/NewThreadModal";

interface ArtistEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  artist: Artist | null;
  voiceTypes: VoiceTypeOption[];
  initialSearchContext?: string;
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Eyebrow
    as="h4"
    color="gold"
    className="block border-b border-ethereal-ink/8 pb-2.5"
  >
    {children}
  </Eyebrow>
);

export default function ArtistEditorPanel({
  isOpen,
  onClose,
  artist,
  voiceTypes,
  initialSearchContext = "",
}: ArtistEditorPanelProps): React.ReactPortal | null {
  const { t } = useTranslation();
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { form, isDirty, isSubmitting, onSubmit } = useArtistForm(
    artist,
    voiceTypes,
    initialSearchContext,
    onClose,
    isOpen,
  );

  const { errors } = form.formState;
  const errorText = (key?: string) => (key ? t(key) : undefined);

  // Past activation the address is that person's sign-in credential, and the
  // server refuses to move it from here. Lock the field rather than let a
  // manager type a change that can only come back rejected.
  const isEmailLocked = Boolean(artist?.id && artist.account_activated);

  const firstNameValue = useWatch({ control: form.control, name: "first_name" });
  const languageValue = useWatch({ control: form.control, name: "language" });
  const voiceValue = useWatch({ control: form.control, name: "voice_type" });

  // Suggest the form of address from the voice part when creating (manager can
  // still override). Never runs on edit — that field is disabled there.
  const { setValue } = form;
  useEffect(() => {
    if (!artist && voiceValue) {
      setValue("salutation", voiceToSalutation(voiceValue));
    }
  }, [artist, voiceValue, setValue]);

  const handleCloseRequest = useCallback(() => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen && !showExitConfirm) {
        handleCloseRequest();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseRequest, isOpen, showExitConfirm]);

  const forceClose = () => {
    setShowExitConfirm(false);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="artist-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseRequest}
            style={{ zIndex: 99 }}
            className="fixed inset-0 bg-ethereal-ink/30 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            key="artist-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{ zIndex: 100 }}
            className="fixed inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-ethereal-incense/20 bg-ethereal-parchment shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="z-20 flex flex-shrink-0 items-center justify-between border-b border-ethereal-ink/8 bg-ethereal-alabaster/80 p-6 backdrop-blur-xl md:p-8">
              <Heading as="h3" size="2xl" weight="bold">
                {artist?.id
                  ? t("artists.editor.title_edit", "Edycja Profilu")
                  : t("artists.editor.title_new", "Nowy Artysta")}
              </Heading>
              <div className="flex items-center gap-2">
                {artist?.id && (
                  <button
                    type="button"
                    onClick={() => setShowNotifyModal(true)}
                    title={t("artists.editor.message_artist", "Napisz wiadomość")}
                    className="flex items-center gap-1.5 rounded-xl border border-ethereal-amethyst/30 bg-ethereal-alabaster px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ethereal-amethyst shadow-sm transition-all hover:bg-ethereal-amethyst/10 active:scale-95"
                  >
                    <Send size={14} aria-hidden="true" />
                    {t("artists.editor.message_artist", "Napisz wiadomość")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseRequest}
                  aria-label={t("common.actions.close", "Zamknij")}
                  className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster p-2.5 text-ethereal-graphite shadow-sm transition-all hover:bg-ethereal-marble hover:text-ethereal-ink active:scale-95"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 overflow-y-auto p-6 md:p-8">
              <form
                onSubmit={onSubmit}
                className="flex min-h-full flex-col space-y-8 rounded-2xl border border-ethereal-ink/6 bg-ethereal-alabaster/60 p-6 shadow-glass-ethereal backdrop-blur-xl md:p-8"
              >
                <div className="flex-1 space-y-8">
                  <div className="space-y-5">
                    <SectionTitle>
                      {t("artists.editor.section_basic", "Dane Podstawowe")}
                    </SectionTitle>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div className="space-y-3">
                        <Input
                          type="text"
                          label={t("artists.editor.first_name", "Imię *")}
                          {...form.register("first_name")}
                          disabled={isSubmitting}
                          error={errorText(errors.first_name?.message)}
                          className="font-bold"
                        />
                        <AnimatePresence>
                          {firstNameValue && languageValue === "pl" && (
                            <motion.div
                              key="vocative-input"
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.18 }}
                            >
                              <Input
                                type="text"
                                label={t(
                                  "artists.editor.first_name_vocative",
                                  "Wołacz",
                                )}
                                {...form.register("first_name_vocative")}
                                placeholder={t(
                                  "artists.editor.first_name_vocative_placeholder",
                                  "np. Krystianie",
                                )}
                                disabled={isSubmitting}
                                className="font-medium text-ethereal-amethyst"
                              />
                              <Text
                                as="p"
                                size="xs"
                                color="muted"
                                className="ml-1 mt-1.5"
                              >
                                {t(
                                  "artists.editor.first_name_vocative_hint",
                                  "Forma używana w powitaniach, np. w mailach.",
                                )}
                              </Text>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <Input
                        type="text"
                        label={t("artists.editor.last_name", "Nazwisko *")}
                        {...form.register("last_name")}
                        disabled={isSubmitting}
                        error={errorText(errors.last_name?.message)}
                        className="font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div>
                        <Input
                          type="email"
                          label={t("artists.editor.email", "E-mail *")}
                          {...form.register("email")}
                          disabled={isSubmitting || isEmailLocked}
                          error={errorText(errors.email?.message)}
                        />
                        {isEmailLocked && (
                          <Eyebrow color="muted" className="mt-2 block">
                            {t(
                              "artists.editor.email_locked",
                              "Adres logowania — zmienić może go tylko właściciel konta, w swoich ustawieniach.",
                            )}
                          </Eyebrow>
                        )}
                      </div>
                      <Input
                        type="tel"
                        label={t("artists.editor.phone", "Telefon")}
                        {...form.register("phone_number")}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div>
                        <Select
                          label={t(
                            "artists.editor.language",
                            "Język wiadomości *",
                          )}
                          {...form.register("language")}
                          className="font-bold"
                          disabled={isSubmitting || !!artist?.id}
                        >
                          <option value="pl">Polski</option>
                          <option value="en">English</option>
                          <option value="fr">Français</option>
                        </Select>
                        {artist?.id && (
                          <Text
                            as="p"
                            size="xs"
                            color="muted"
                            className="ml-1 mt-2"
                          >
                            {t(
                              "artists.editor.language_edit_disabled",
                              "Język jest zarządzany indywidualnie przez artystę w ustawieniach konta.",
                            )}
                          </Text>
                        )}
                      </div>
                      <div>
                        <Select
                          label={t("common.salutation.label", "Forma zwrotu")}
                          {...form.register("salutation")}
                          className="font-bold"
                          disabled={isSubmitting || !!artist?.id}
                        >
                          <option value="N">{t("common.salutation.neutral", "Neutralna")}</option>
                          <option value="F">{t("common.salutation.feminine", "Kobieca")}</option>
                          <option value="M">{t("common.salutation.masculine", "Męska")}</option>
                        </Select>
                        <Text as="p" size="xs" color="muted" className="ml-1 mt-2">
                          {artist?.id
                            ? t(
                                "artists.editor.salutation_edit_disabled",
                                "Forma zwrotu jest zarządzana przez członka w ustawieniach konta.",
                              )
                            : t(
                                "artists.editor.salutation_hint",
                                "Tylko dla powitań. Podpowiadane na podstawie głosu.",
                              )}
                        </Text>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 pt-2">
                    <SectionTitle>
                      {t("artists.editor.section_voice", "Profil Wokalny")}
                    </SectionTitle>

                    <Select
                      label={t("artists.editor.voice_type", "Rodzaj Głosu *")}
                      {...form.register("voice_type")}
                      className="font-bold"
                      disabled={isSubmitting}
                      error={errorText(errors.voice_type?.message)}
                    >
                      {voiceTypes.length > 0 ? (
                        voiceTypes.map((voiceType) => (
                          <option key={voiceType.value} value={voiceType.value}>
                            {voiceType.label}
                          </option>
                        ))
                      ) : (
                        <option value="SOP">
                          {t("artists.editor.loading", "Ładowanie...")}
                        </option>
                      )}
                    </Select>

                    <div className="grid grid-cols-2 gap-5">
                      <Input
                        type="text"
                        label={t("artists.editor.range_low", "Skala (Dół)")}
                        title={t(
                          "artists.editor.range_low_title",
                          "Najniższy dźwięk",
                        )}
                        {...form.register("vocal_range_bottom")}
                        placeholder={t(
                          "artists.editor.range_low_placeholder",
                          "np. G2",
                        )}
                        disabled={isSubmitting}
                        className="text-center font-bold text-ethereal-gold"
                      />
                      <Input
                        type="text"
                        label={t("artists.editor.range_high", "Skala (Góra)")}
                        title={t(
                          "artists.editor.range_high_title",
                          "Najwyższy dźwięk",
                        )}
                        {...form.register("vocal_range_top")}
                        placeholder={t(
                          "artists.editor.range_high_placeholder",
                          "np. C5",
                        )}
                        disabled={isSubmitting}
                        className="text-center font-bold text-ethereal-gold"
                      />
                    </div>

                    <Select
                      label={t(
                        "artists.editor.sight_reading",
                        "Czytanie a vista (Ocena)",
                      )}
                      {...form.register("sight_reading_skill")}
                      className="font-bold"
                      disabled={isSubmitting}
                    >
                      <option value="">
                        {t("artists.editor.no_rating", "— Brak oceny —")}
                      </option>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={String(value)}>
                          {t("artists.editor.stars_count", {
                            defaultValue: "{{count}} Gwiazdki",
                            count: value,
                          })}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {artist?.id && (
                    <div className="border-t border-ethereal-ink/8 pt-6">
                      <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-ethereal-ink/8 bg-ethereal-alabaster/70 p-4 shadow-glass-ethereal transition-colors hover:border-ethereal-gold/40">
                        <input
                          type="checkbox"
                          {...form.register("is_active")}
                          className="h-5 w-5 cursor-pointer rounded-md accent-ethereal-gold"
                          disabled={isSubmitting}
                        />
                        <div>
                          <Text size="sm" weight="bold">
                            {t(
                              "artists.editor.active_access_title",
                              "Aktywny dostęp do platformy",
                            )}
                          </Text>
                          <Eyebrow color="muted" className="mt-1 block">
                            {t(
                              "artists.editor.active_access_desc",
                              "Zablokuje logowanie w przypadku odznaczenia.",
                            )}
                          </Eyebrow>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 left-0 right-0 z-40 -mx-6 -mb-8 mt-8 rounded-b-2xl border-t border-ethereal-ink/8 bg-ethereal-alabaster/85 p-4 shadow-[0_-10px_30px_rgba(22,20,18,0.05)] backdrop-blur-xl md:-mx-8 md:p-6">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    fullWidth
                    leftIcon={
                      !isSubmitting ? (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      ) : undefined
                    }
                  >
                    {artist?.id
                      ? t("artists.editor.save_profile", "Zapisz Profil")
                      : t("artists.editor.create_artist", "Utwórz Artystę")}
                  </Button>
                </div>
              </form>
            </div>

            <ConfirmModal
              isOpen={showExitConfirm}
              title={t(
                "artists.editor.unsaved_title",
                "Masz niezapisane zmiany!",
              )}
              description={t(
                "artists.editor.unsaved_desc",
                "Wprowadziłeś zmiany w formularzu, które nie zostały zapisane. Zamknięcie panelu spowoduje ich utratę.",
              )}
              onConfirm={forceClose}
              onCancel={() => setShowExitConfirm(false)}
            />

            {artist && (
              <NewThreadModal
                isOpen={showNotifyModal}
                onClose={() => setShowNotifyModal(false)}
                isManager
                presetArtistId={artist.id}
                presetArtistName={`${artist.first_name} ${artist.last_name}`}
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
