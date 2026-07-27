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
import { Controller, useWatch } from "react-hook-form";

import { ConfirmModal } from "@ui/composites/ConfirmModal";
import { Button } from "@ui/primitives/Button";
import { Checkbox } from "@ui/primitives/Checkbox";
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
    className="block border-b border-hairline-strong pb-2.5"
  >
    {children}
  </Eyebrow>
);

/** A sentence under a field. An overline would set it uppercase and tracked
 *  out, which is a label's clothing on a piece of prose. */
const FieldHint = ({ children }: { children: React.ReactNode }) => (
  <Text as="p" size="xs" color="muted" className="ml-1 mt-2">
    {children}
  </Text>
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
      // A Radix layer inside the panel — an open select, a menu — dismisses
      // itself on Escape and marks the event handled. Without this the same
      // keypress also closes the panel behind it, unsaved-changes prompt and all.
      if (event.defaultPrevented) return;
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
            className="fixed inset-0 z-focus-trap bg-ethereal-ink/30 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            key="artist-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-focus-trap flex w-full max-w-xl flex-col border-l border-ethereal-incense/20 bg-ethereal-parchment shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="z-20 flex shrink-0 items-center justify-between border-b border-hairline-strong bg-ethereal-alabaster/80 p-6 backdrop-blur-xl md:p-8">
              <Heading as="h3" size="2xl" weight="bold">
                {artist?.id
                  ? t("artists.editor.title_edit", "Edycja Profilu")
                  : t("artists.editor.title_new", "Nowy Artysta")}
              </Heading>
              <div className="flex items-center gap-2">
                {artist?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNotifyModal(true)}
                    leftIcon={<Send size={14} aria-hidden="true" />}
                    className="text-ethereal-amethyst hover:text-ethereal-amethyst"
                  >
                    {t("artists.editor.message_artist", "Napisz wiadomość")}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={handleCloseRequest}
                  aria-label={t("common.actions.close", "Zamknij")}
                  className="rounded-control border border-ethereal-incense/20 bg-ethereal-alabaster p-2.5 text-ethereal-graphite shadow-sm transition-all hover:bg-ethereal-marble hover:text-ethereal-ink active:scale-95"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 overflow-y-auto p-6 md:p-8">
              <form
                onSubmit={onSubmit}
                className="flex min-h-full flex-col space-y-8 rounded-surface border border-hairline bg-ethereal-alabaster/60 p-6 shadow-glass-ethereal backdrop-blur-xl md:p-8"
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
                              <FieldHint>
                                {t(
                                  "artists.editor.first_name_vocative_hint",
                                  "Forma używana w powitaniach, np. w mailach.",
                                )}
                              </FieldHint>
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
                          <FieldHint>
                            {t(
                              "artists.editor.email_locked",
                              "Adres logowania — zmienić może go tylko właściciel konta, w swoich ustawieniach.",
                            )}
                          </FieldHint>
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
                        <Controller
                          control={form.control}
                          name="language"
                          render={({ field }) => (
                            <Select
                              label={t(
                                "artists.editor.language",
                                "Język wiadomości *",
                              )}
                              name={field.name}
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                              disabled={isSubmitting || !!artist?.id}
                              error={errorText(errors.language?.message)}
                              options={[
                                { value: "pl", label: "Polski" },
                                { value: "en", label: "English" },
                                { value: "fr", label: "Français" },
                              ]}
                            />
                          )}
                        />
                        {artist?.id && (
                          <FieldHint>
                            {t(
                              "artists.editor.language_edit_disabled",
                              "Język jest zarządzany indywidualnie przez artystę w ustawieniach konta.",
                            )}
                          </FieldHint>
                        )}
                      </div>
                      <div>
                        <Controller
                          control={form.control}
                          name="salutation"
                          render={({ field }) => (
                            <Select
                              label={t("common.salutation.label", "Forma zwrotu")}
                              name={field.name}
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                              disabled={isSubmitting || !!artist?.id}
                              // Both prefs are disabled on edit, so a rejection
                              // here is unreachable by the user and used to stop
                              // the submit with nothing on screen to explain it.
                              error={errorText(errors.salutation?.message)}
                              options={[
                                {
                                  value: "N",
                                  label: t("common.salutation.neutral", "Neutralna"),
                                },
                                {
                                  value: "F",
                                  label: t("common.salutation.feminine", "Kobieca"),
                                },
                                {
                                  value: "M",
                                  label: t("common.salutation.masculine", "Męska"),
                                },
                              ]}
                            />
                          )}
                        />
                        <FieldHint>
                          {artist?.id
                            ? t(
                                "artists.editor.salutation_edit_disabled",
                                "Forma zwrotu jest zarządzana przez członka w ustawieniach konta.",
                              )
                            : t(
                                "artists.editor.salutation_hint",
                                "Tylko dla powitań. Podpowiadane na podstawie głosu.",
                              )}
                        </FieldHint>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 pt-2">
                    <SectionTitle>
                      {t("artists.editor.section_voice", "Profil Wokalny")}
                    </SectionTitle>

                    <Controller
                      control={form.control}
                      name="voice_type"
                      render={({ field }) => (
                        <Select
                          label={t("artists.editor.voice_type", "Rodzaj Głosu *")}
                          name={field.name}
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          // Until the dictionary lands the field says it is
                          // waiting, rather than offering one placeholder voice
                          // that would be submitted verbatim.
                          disabled={isSubmitting || voiceTypes.length === 0}
                          placeholder={
                            voiceTypes.length === 0
                              ? t("artists.editor.loading", "Ładowanie...")
                              : undefined
                          }
                          error={errorText(errors.voice_type?.message)}
                          options={voiceTypes}
                        />
                      )}
                    />

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

                    <Controller
                      control={form.control}
                      name="sight_reading_skill"
                      render={({ field }) => (
                        <Select
                          label={t(
                            "artists.editor.sight_reading",
                            "Czytanie a vista (Ocena)",
                          )}
                          name={field.name}
                          value={field.value ? String(field.value) : ""}
                          onValueChange={field.onChange}
                          disabled={isSubmitting}
                          placeholder={t("artists.editor.no_rating", "Brak oceny")}
                          clearLabel={t("artists.editor.no_rating", "Brak oceny")}
                          options={[1, 2, 3, 4, 5].map((value) => ({
                            value: String(value),
                            label: t("artists.editor.stars_count", {
                              defaultValue: "{{count}} Gwiazdki",
                              count: value,
                            }),
                          }))}
                        />
                      )}
                    />
                  </div>

                  {artist?.id && (
                    <div className="border-t border-hairline-strong pt-6">
                      <label className="flex cursor-pointer items-center gap-4 rounded-control border border-hairline-strong bg-ethereal-alabaster/70 p-4 shadow-glass-ethereal transition-colors hover:border-ethereal-gold/40">
                        {/* `Checkbox` is a controlled primitive (the tick is
                            drawn from the prop, not the DOM node), so this one
                            field cannot ride on `register`. */}
                        <Controller
                          control={form.control}
                          name="is_active"
                          render={({ field }) => (
                            <Checkbox
                              size="md"
                              checked={Boolean(field.value)}
                              onChange={(event) =>
                                field.onChange(event.target.checked)
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              disabled={isSubmitting}
                            />
                          )}
                        />
                        <div>
                          <Text size="sm" weight="bold">
                            {t(
                              "artists.editor.active_access_title",
                              "Aktywny dostęp do platformy",
                            )}
                          </Text>
                          <Text as="p" size="xs" color="muted" className="mt-1">
                            {t(
                              "artists.editor.active_access_desc",
                              "Zablokuje logowanie w przypadku odznaczenia.",
                            )}
                          </Text>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 left-0 right-0 z-40 -mx-6 -mb-8 mt-8 rounded-b-surface border-t border-hairline-strong bg-ethereal-alabaster/85 p-4 shadow-[0_-10px_30px_rgba(22,20,18,0.05)] backdrop-blur-xl md:-mx-8 md:p-6">
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
