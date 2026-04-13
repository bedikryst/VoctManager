/**
 * @file ArtistEditorPanel.tsx
 * @description Slide-over panel for creating or editing artist profiles.
 * Utilizes React Hook Form for zero-lag rendering and Zod for absolute validation.
 * @module panel/artists/ArtistEditorPanel
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, CheckCircle2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

import { ConfirmModal } from "@ui/composites/ConfirmModal";
import { Button } from "@ui/primitives/Button";
import { Input } from "@ui/primitives/Input";
import type { Artist, VoiceTypeOption } from "@/shared/types";
import { useArtistForm } from "../hooks/useArtistForm";

interface ArtistEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  artist: Artist | null;
  voiceTypes: VoiceTypeOption[];
  initialSearchContext?: string;
}

const STYLE_LABEL =
  "block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";
const STYLE_SELECT =
  "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function ArtistEditorPanel({
  isOpen,
  onClose,
  artist,
  voiceTypes,
  initialSearchContext = "",
}: ArtistEditorPanelProps): React.ReactPortal | null {
  const { t } = useTranslation();
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { form, isDirty, isSubmitting, onSubmit } = useArtistForm(
    artist,
    voiceTypes,
    initialSearchContext,
    onClose,
  );

  const handleCloseRequest = () => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

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
  }, [isOpen, showExitConfirm, isDirty]);

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
            style={{ zIndex: 9998 }}
            className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            key="artist-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{ zIndex: 9999 }}
            className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#f4f2ee] shadow-2xl flex flex-col border-l border-white/60"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center p-6 md:p-8 border-b border-stone-200/50 bg-white/80 backdrop-blur-xl flex-shrink-0 z-20">
              <h3 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
                {artist?.id
                  ? t("artists.editor.title_edit", "Edycja Profilu")
                  : t("artists.editor.title_new", "Nowy Artysta")}
              </h3>
              <button
                type="button"
                onClick={handleCloseRequest}
                className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-2.5 rounded-2xl active:scale-95"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 relative">
              <form
                onSubmit={onSubmit}
                className="space-y-8 bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] relative flex flex-col min-h-full"
              >
                <div className="flex-1 space-y-8">
                  <div className="space-y-5">
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-brand border-b border-stone-200/60 pb-2">
                      {t("artists.editor.section_basic", "Dane Podstawowe")}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={STYLE_LABEL}>
                          {t("artists.editor.first_name", "Imię *")}
                        </label>
                        <Input
                          type="text"
                          {...form.register("first_name")}
                          disabled={isSubmitting}
                          className={cn(
                            "font-bold",
                            form.formState.errors.first_name &&
                              "border-red-500",
                          )}
                        />
                        {form.formState.errors.first_name && (
                          <p className="text-red-500 text-xs mt-1.5 ml-1">
                            {t(
                              form.formState.errors.first_name
                                .message as string,
                            )}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={STYLE_LABEL}>
                          {t("artists.editor.last_name", "Nazwisko *")}
                        </label>
                        <Input
                          type="text"
                          {...form.register("last_name")}
                          disabled={isSubmitting}
                          className={cn(
                            "font-bold",
                            form.formState.errors.last_name && "border-red-500",
                          )}
                        />
                        {form.formState.errors.last_name && (
                          <p className="text-red-500 text-xs mt-1.5 ml-1">
                            {t(
                              form.formState.errors.last_name.message as string,
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={STYLE_LABEL}>
                          {t("artists.editor.email", "E-mail *")}
                        </label>
                        <Input
                          type="email"
                          {...form.register("email")}
                          disabled={isSubmitting}
                          className={cn(
                            form.formState.errors.email && "border-red-500",
                          )}
                        />
                        {form.formState.errors.email && (
                          <p className="text-red-500 text-xs mt-1.5 ml-1">
                            {t(form.formState.errors.email.message as string)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={STYLE_LABEL}>
                          {t("artists.editor.phone", "Telefon")}
                        </label>
                        <Input
                          type="tel"
                          {...form.register("phone_number")}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                    <div>
                      <label className={STYLE_LABEL}>
                        {t("artists.editor.language", "Język komunikacji *")}
                      </label>
                      <select
                        {...form.register("language")}
                        className={cn(
                          STYLE_SELECT,
                          "font-bold appearance-none",
                          artist?.id &&
                            "opacity-60 bg-stone-100 cursor-not-allowed",
                        )}
                        disabled={isSubmitting || !!artist?.id}
                      >
                        <option value="pl">Polski</option>
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                      </select>
                      {artist?.id && (
                        <p className="text-stone-500 text-[10px] font-medium mt-2 ml-1">
                          {t(
                            "artists.editor.language_edit_disabled",
                            "Język jest zarządzany indywidualnie przez artystę w ustawieniach konta.",
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-5 pt-4">
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-brand border-b border-stone-200/60 pb-2">
                      {t("artists.editor.section_voice", "Profil Wokalny")}
                    </h4>

                    <div>
                      <label className={STYLE_LABEL}>
                        {t("artists.editor.voice_type", "Rodzaj Głosu *")}
                      </label>
                      <select
                        {...form.register("voice_type")}
                        className={cn(
                          STYLE_SELECT,
                          "font-bold appearance-none",
                          form.formState.errors.voice_type && "border-red-500",
                        )}
                        disabled={isSubmitting}
                      >
                        {voiceTypes.length > 0 ? (
                          voiceTypes.map((voiceType) => (
                            <option
                              key={voiceType.value}
                              value={voiceType.value}
                            >
                              {voiceType.label}
                            </option>
                          ))
                        ) : (
                          <option value="SOP">
                            {t("artists.editor.loading", "Ładowanie...")}
                          </option>
                        )}
                      </select>
                      {form.formState.errors.voice_type && (
                        <p className="text-red-500 text-xs mt-1.5 ml-1">
                          {t(
                            form.formState.errors.voice_type.message as string,
                          )}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label
                          className={STYLE_LABEL}
                          title={t(
                            "artists.editor.range_low_title",
                            "Najniższy dźwięk",
                          )}
                        >
                          {t("artists.editor.range_low", "Skala (Dół)")}
                        </label>
                        <Input
                          type="text"
                          {...form.register("vocal_range_bottom")}
                          placeholder={t(
                            "artists.editor.range_low_placeholder",
                            "np. G2",
                          )}
                          disabled={isSubmitting}
                          className="text-center font-bold text-brand"
                        />
                      </div>
                      <div>
                        <label
                          className={STYLE_LABEL}
                          title={t(
                            "artists.editor.range_high_title",
                            "Najwyższy dźwięk",
                          )}
                        >
                          {t("artists.editor.range_high", "Skala (Góra)")}
                        </label>
                        <Input
                          type="text"
                          {...form.register("vocal_range_top")}
                          placeholder={t(
                            "artists.editor.range_high_placeholder",
                            "np. C5",
                          )}
                          disabled={isSubmitting}
                          className="text-center font-bold text-brand"
                        />
                      </div>
                    </div>

                    <div>
                      <label className={STYLE_LABEL}>
                        {t(
                          "artists.editor.sight_reading",
                          "Czytanie a vista (Ocena)",
                        )}
                      </label>
                      <select
                        {...form.register("sight_reading_skill")}
                        className={cn(
                          STYLE_SELECT,
                          "font-bold appearance-none",
                        )}
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
                      </select>
                    </div>
                  </div>

                  {artist?.id && (
                    <div className="pt-6 border-t border-stone-200/60">
                      <label className="flex items-center gap-4 p-4 border border-stone-200/80 rounded-xl bg-white/50 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] cursor-pointer hover:border-brand/40 transition-colors">
                        <input
                          type="checkbox"
                          {...form.register("is_active")}
                          className="w-5 h-5 text-brand focus:ring-brand/20 border-stone-300 rounded-md cursor-pointer"
                          disabled={isSubmitting}
                        />
                        <div>
                          <span className="block text-sm font-bold text-stone-800">
                            {t(
                              "artists.editor.active_access_title",
                              "Aktywny dostęp do platformy",
                            )}
                          </span>
                          <span className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mt-1">
                            {t(
                              "artists.editor.active_access_desc",
                              "Zablokuje logowanie w przypadku odznaczenia.",
                            )}
                          </span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-stone-200/60 p-4 md:p-6 -mx-6 md:-mx-8 -mb-8 mt-8 flex flex-col sm:flex-row gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-b-2xl">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    leftIcon={
                      !isSubmitting ? (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      ) : undefined
                    }
                    className="w-full"
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
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
