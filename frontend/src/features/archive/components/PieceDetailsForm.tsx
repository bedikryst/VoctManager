/**
 * @file PieceDetailsForm.tsx
 * @description Pure presentation component for creating or updating repertoire metadata.
 * Delegates all state management, dirty tracking, and API interactions to usePieceForm.
 * @module panel/archive/components/PieceDetailsForm
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Plus,
  Minus,
  Trash2,
  Clock,
  Music,
  Youtube,
  AlignLeft,
} from "lucide-react";

import type { Composer, VoiceLineOption } from "@/shared/types";
import type { EnrichedPiece } from "../types/archive.dto";
import { Button } from "@ui/primitives/Button";
import { Input } from "@ui/primitives/Input";
import { usePieceForm, SubmitAction } from "../hooks/usePieceForm";
import { getArchiveEpochOptions } from "../constants/archiveEpochs";

interface PieceDetailsFormProps {
  piece: EnrichedPiece | null;
  composers: Composer[];
  voiceLines: VoiceLineOption[];
  onSuccess: (updatedPiece: EnrichedPiece, actionType: SubmitAction) => void;
  onDirtyStateChange?: (isDirty: boolean) => void;
  initialSearchContext?: string;
}

const STYLE_LABEL =
  "block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";
const STYLE_SELECT =
  "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
const STYLE_TEXTAREA =
  "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] resize-none font-medium text-xs leading-relaxed";

export default function PieceDetailsForm({
  piece,
  composers,
  voiceLines,
  onSuccess,
  onDirtyStateChange,
  initialSearchContext = "",
}: PieceDetailsFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const epochOptions = getArchiveEpochOptions(t);

  const {
    formData,
    setFormData,
    requirements,
    setRequirements,
    selectedFile,
    setSelectedFile,
    fileInputRef,
    isSubmitting,
    submitAction,
    setSubmitAction,
    handleSubmit,
    isAddingComposer,
    setIsAddingComposer,
    newComposerData,
    setNewComposerData,
    compSearchTerm,
    setCompSearchTerm,
    isCompDropdownOpen,
    setIsCompDropdownOpen,
    filteredComposers,
    handleRequirementChange,
  } = usePieceForm(
    piece,
    composers,
    initialSearchContext,
    onDirtyStateChange,
    onSuccess,
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] relative flex flex-col min-h-full"
    >
      <div className="flex-1 space-y-8">
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-brand mb-2 ml-1">
              {t("archive.form.fields.title", "Tytuł utworu *")}
            </label>
            <Input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder={t(
                "archive.form.placeholders.title",
                "np. Lacrimosa",
              )}
              disabled={isSubmitting}
              className="text-lg font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className={STYLE_LABEL}>
                  {t("archive.form.fields.composer", "Kompozytor")}
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingComposer(!isAddingComposer)}
                  className="text-[9px] text-brand font-medium antialiased uppercase tracking-widest hover:underline"
                  disabled={isSubmitting}
                >
                  {isAddingComposer
                    ? t(
                        "archive.form.actions.back_to_search",
                        "Wróć do wyszukiwarki",
                      )
                    : t("archive.form.actions.add_new", "+ Dodaj nowego")}
                </button>
              </div>

              {isAddingComposer ? (
                <div className="flex flex-col gap-3 bg-white/50 backdrop-blur-sm p-5 border border-stone-200/80 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="text"
                      placeholder={t(
                        "archive.form.placeholders.composer_first_name",
                        "Imię",
                      )}
                      value={newComposerData.first_name}
                      onChange={(e) =>
                        setNewComposerData({
                          ...newComposerData,
                          first_name: e.target.value,
                        })
                      }
                      disabled={isSubmitting}
                    />
                    <Input
                      type="text"
                      placeholder={t(
                        "archive.form.placeholders.composer_last_name",
                        "Nazwisko *",
                      )}
                      required
                      value={newComposerData.last_name}
                      onChange={(e) =>
                        setNewComposerData({
                          ...newComposerData,
                          last_name: e.target.value,
                        })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      placeholder={t(
                        "archive.form.placeholders.composer_birth_year",
                        "Rok ur.",
                      )}
                      value={newComposerData.birth_year}
                      onChange={(e) =>
                        setNewComposerData({
                          ...newComposerData,
                          birth_year: e.target.value,
                        })
                      }
                      disabled={isSubmitting}
                    />
                    <Input
                      type="number"
                      placeholder={t(
                        "archive.form.placeholders.composer_death_year",
                        "Rok śm.",
                      )}
                      value={newComposerData.death_year}
                      onChange={(e) =>
                        setNewComposerData({
                          ...newComposerData,
                          death_year: e.target.value,
                        })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    type="text"
                    placeholder={t(
                      "archive.form.placeholders.composer_search",
                      "Szukaj na liście (lub zostaw puste)",
                    )}
                    value={compSearchTerm}
                    onChange={(e) => {
                      setCompSearchTerm(e.target.value);
                      setFormData((prev) => ({ ...prev, composer: "" }));
                      setIsCompDropdownOpen(true);
                    }}
                    onFocus={() => setIsCompDropdownOpen(true)}
                    onBlur={() =>
                      setTimeout(() => setIsCompDropdownOpen(false), 200)
                    }
                    disabled={isSubmitting}
                    className="font-medium"
                  />
                  <AnimatePresence>
                    {isCompDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-xl border border-stone-200/60 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] max-h-48 overflow-y-auto overflow-hidden"
                      >
                        <div
                          onMouseDown={() => {
                            setFormData((prev) => ({ ...prev, composer: "" }));
                            setCompSearchTerm("");
                            setIsCompDropdownOpen(false);
                          }}
                          className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-stone-400 hover:bg-stone-50 cursor-pointer border-b border-stone-100"
                        >
                          {t(
                            "archive.form.composer.unknown",
                            "— Tradycyjny / Nieznany —",
                          )}
                        </div>
                        {filteredComposers.map((composer) => (
                          <div
                            key={composer.id}
                            onMouseDown={() => {
                              setFormData((prev) => ({
                                ...prev,
                                composer: String(composer.id),
                              }));
                              setIsCompDropdownOpen(false);
                            }}
                            className="px-4 py-3 text-sm font-medium text-stone-800 hover:bg-brand hover:text-white cursor-pointer transition-colors"
                          >
                            {composer.last_name} {composer.first_name}{" "}
                            {composer.birth_year ? (
                              <span className="opacity-60 font-medium ml-1">
                                ({composer.birth_year}-
                                {composer.death_year || ""})
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div>
              <label className={STYLE_LABEL}>
                {t("archive.form.fields.arranger", "Aranżer")}
              </label>
              <Input
                type="text"
                value={formData.arranger}
                onChange={(e) =>
                  setFormData({ ...formData, arranger: e.target.value })
                }
                placeholder={t(
                  "archive.form.placeholders.arranger",
                  "np. John Rutter",
                )}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2">
              <label className={STYLE_LABEL}>
                {t("archive.form.fields.epoch", "Epoka muzyczna")}
              </label>
              <select
                value={formData.epoch}
                onChange={(e) =>
                  setFormData({ ...formData, epoch: e.target.value })
                }
                className={`${STYLE_SELECT} font-medium appearance-none`}
                disabled={isSubmitting}
              >
                <option value="">
                  {t("archive.form.placeholders.epoch", "— Wybierz epokę —")}
                </option>
                {epochOptions.map((epoch) => (
                  <option key={epoch.value} value={epoch.value}>
                    {epoch.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={STYLE_LABEL}>
                {t("archive.form.fields.composition_year", "Rok powstania")}
              </label>
              <Input
                type="number"
                placeholder={t(
                  "archive.form.placeholders.composition_year",
                  "np. 1741",
                )}
                value={formData.composition_year || ""}
                onChange={(e) =>
                  setFormData({ ...formData, composition_year: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className={STYLE_LABEL}>
                {t("archive.form.fields.language", "Język")}
              </label>
              <Input
                type="text"
                value={formData.language}
                onChange={(e) =>
                  setFormData({ ...formData, language: e.target.value })
                }
                placeholder={t(
                  "archive.form.placeholders.language",
                  "np. Łacina",
                )}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-stone-200/60 pt-8 space-y-6">
          <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-800 flex items-center gap-2.5">
            <Music size={16} className="text-brand" aria-hidden="true" />{" "}
            {t("archive.form.sections.requirements", "Wymagania wykonawcze")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={STYLE_LABEL}>
                {t(
                  "archive.form.fields.voicing",
                  "Obsada wokalna (zapis tradycyjny)",
                )}
              </label>
              <Input
                type="text"
                value={formData.voicing}
                onChange={(e) =>
                  setFormData({ ...formData, voicing: e.target.value })
                }
                placeholder={t(
                  "archive.form.placeholders.voicing",
                  "np. SSAATTBB, Chór + Soliści",
                )}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-[9px] font-medium antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1 flex items-center gap-1.5">
                <Clock size={12} aria-hidden="true" />{" "}
                {t("archive.form.fields.duration", "Szacowany czas trwania")}
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  placeholder={t(
                    "archive.form.placeholders.duration_minutes",
                    "Minuty",
                  )}
                  value={formData.durationMins || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, durationMins: e.target.value })
                  }
                  rightElement={t("archive.form.units.minutes_short", "min")}
                  disabled={isSubmitting}
                />
                <span className="text-stone-300 font-medium text-lg">:</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  placeholder={t(
                    "archive.form.placeholders.duration_seconds",
                    "Sekundy",
                  )}
                  value={formData.durationSecs || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, durationSecs: e.target.value })
                  }
                  rightElement={t("archive.form.units.seconds_short", "sek")}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="border border-stone-200/60 rounded-2xl overflow-hidden shadow-sm mt-6 bg-white/40">
            <div className="bg-stone-50/50 backdrop-blur-sm p-5 border-b border-stone-200/60">
              <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 mb-1.5">
                {t("archive.form.sections.divisi", "Algorytm obsady (Divisi)")}
              </h4>
              <p className="text-[9px] uppercase tracking-widest font-medium antialiased text-stone-400 mb-4 leading-relaxed max-w-lg">
                {t(
                  "archive.form.descriptions.divisi",
                  "Wybierz głosy i ustal minimalną ilość śpiewaków do weryfikacji braków kadrowych w trybie mikro-obsady.",
                )}
              </p>

              <div className="flex flex-wrap gap-2.5">
                {voiceLines
                  .filter(
                    (voiceLine) =>
                      !requirements.some(
                        (requirement) =>
                          requirement.voice_line === String(voiceLine.value),
                      ),
                  )
                  .map((voiceLine) => (
                    <button
                      key={String(voiceLine.value)}
                      type="button"
                      onClick={() =>
                        setRequirements([
                          ...requirements,
                          { voice_line: String(voiceLine.value), quantity: 1 },
                        ])
                      }
                      className="px-4 py-2 bg-white border border-stone-200/80 text-stone-600 hover:text-brand hover:border-brand/40 hover:bg-blue-50/50 text-[9px] font-medium antialiased uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                      disabled={isSubmitting}
                    >
                      <Plus size={12} aria-hidden="true" /> {voiceLine.label}
                    </button>
                  ))}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {requirements.length > 0 ? (
                requirements.map((requirement, index) => (
                  <div
                    key={`${requirement.voice_line}-${index}`}
                    className="flex justify-between items-center bg-white/80 border border-stone-200/60 px-5 py-3 rounded-xl shadow-sm transition-colors"
                  >
                    <span className="text-[10px] font-medium antialiased text-brand uppercase tracking-widest">
                      {voiceLines.find(
                        (voiceLine) =>
                          String(voiceLine.value) === requirement.voice_line,
                      )?.label || requirement.voice_line}
                    </span>
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200/80 rounded-lg shadow-inner px-1 py-1">
                        <button
                          type="button"
                          onClick={() => handleRequirementChange(index, -1)}
                          disabled={requirement.quantity <= 1 || isSubmitting}
                          className="p-2 text-stone-400 hover:text-stone-800 disabled:opacity-30 transition-colors active:scale-95 bg-white rounded-md shadow-sm"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-medium text-stone-800 w-6 text-center">
                          {requirement.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRequirementChange(index, 1)}
                          disabled={isSubmitting}
                          className="p-2 text-stone-400 hover:text-stone-800 transition-colors active:scale-95 bg-white rounded-md shadow-sm"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextRequirements = [...requirements];
                          nextRequirements.splice(index, 1);
                          setRequirements(nextRequirements);
                        }}
                        disabled={isSubmitting}
                        className="text-stone-300 hover:text-red-500 p-2.5 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100 active:scale-95"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[10px] font-medium antialiased uppercase tracking-widest text-stone-400 italic text-center py-6">
                  {t(
                    "archive.form.empty.requirements",
                    "Brak zdefiniowanych wymagań.",
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-stone-200/60 pt-8 space-y-6">
          <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-800 flex items-center gap-2.5">
            <AlignLeft size={16} className="text-brand" aria-hidden="true" />{" "}
            {t("archive.form.sections.materials", "Materiały i teksty")}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={STYLE_LABEL}>
                {t("archive.form.fields.lyrics_original", "Tekst oryginalny")}
              </label>
              <textarea
                value={formData.lyrics_original}
                onChange={(e) =>
                  setFormData({ ...formData, lyrics_original: e.target.value })
                }
                rows={5}
                className={STYLE_TEXTAREA}
                placeholder={t(
                  "archive.form.placeholders.lyrics_original",
                  "Wklej oryginalny tekst utworu...",
                )}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className={STYLE_LABEL}>
                {t(
                  "archive.form.fields.lyrics_translation",
                  "Tłumaczenie (notatki)",
                )}
              </label>
              <textarea
                value={formData.lyrics_translation}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lyrics_translation: e.target.value,
                  })
                }
                rows={5}
                className={STYLE_TEXTAREA}
                placeholder={t(
                  "archive.form.placeholders.lyrics_translation",
                  "Wklej polskie tłumaczenie...",
                )}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1 flex items-center gap-1.5">
                <Youtube
                  size={14}
                  className="text-red-600"
                  aria-hidden="true"
                />{" "}
                {t(
                  "archive.form.fields.reference_youtube",
                  "Referencja YouTube",
                )}
              </label>
              <Input
                type="url"
                value={formData.reference_recording_youtube}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reference_recording_youtube: e.target.value,
                  })
                }
                placeholder={t(
                  "archive.form.placeholders.reference_youtube",
                  "https://youtube.com/watch?v=...",
                )}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1 flex items-center gap-1.5">
                <Music
                  size={14}
                  className="text-emerald-600"
                  aria-hidden="true"
                />{" "}
                {t(
                  "archive.form.fields.reference_spotify",
                  "Referencja Spotify",
                )}
              </label>
              <Input
                type="url"
                value={formData.reference_recording_spotify}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reference_recording_spotify: e.target.value,
                  })
                }
                placeholder={t(
                  "archive.form.placeholders.reference_spotify",
                  "https://open.spotify.com/track/...",
                )}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="p-6 border border-stone-200/60 rounded-2xl bg-white/40 shadow-sm mt-4">
            <label className={STYLE_LABEL}>
              {t(
                "archive.form.fields.sheet_music",
                "Partytura / nuty (opcjonalnie PDF)",
              )}
            </label>
            {piece?.sheet_music && !selectedFile && (
              <p className="text-[9px] uppercase font-medium antialiased tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                <CheckCircle2
                  size={14}
                  className="text-emerald-500"
                  aria-hidden="true"
                />{" "}
                {t(
                  "archive.form.status.sheet_music_attached",
                  "Dokument nutowy jest już załączony w bazie.",
                )}
              </p>
            )}
            <input
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              onChange={(e) =>
                setSelectedFile(e.target.files ? e.target.files[0] : null)
              }
              className="w-full mt-1 text-sm text-stone-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[9px] file:font-medium file:antialiased file:uppercase file:tracking-widest file:bg-white file:text-brand file:shadow-sm hover:file:bg-blue-50 hover:file:text-brand-dark cursor-pointer border border-stone-200/60 rounded-xl bg-white/50 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-stone-200/60 p-4 md:p-6 -mx-6 md:-mx-8 -mb-8 mt-8 flex flex-col sm:flex-row gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-b-2xl">
        {!piece?.id && (
          <Button
            type="submit"
            variant="outline"
            onClick={() => setSubmitAction("SAVE_AND_ADD")}
            disabled={isSubmitting}
            isLoading={isSubmitting && submitAction === "SAVE_AND_ADD"}
            leftIcon={
              !(isSubmitting && submitAction === "SAVE_AND_ADD") ? (
                <Plus size={16} />
              ) : undefined
            }
            className="flex-1"
          >
            {t("archive.form.actions.save_add", "Zapisz i dodaj kolejny")}
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          onClick={() => setSubmitAction("SAVE_AND_CLOSE")}
          disabled={isSubmitting}
          isLoading={isSubmitting && submitAction === "SAVE_AND_CLOSE"}
          leftIcon={
            !(isSubmitting && submitAction === "SAVE_AND_CLOSE") ? (
              <CheckCircle2 size={16} />
            ) : undefined
          }
          className="flex-1"
        >
          {piece?.id
            ? t("archive.form.actions.save_changes", "Zapisz zmiany")
            : t("archive.form.actions.save_close", "Zapisz i zamknij")}
        </Button>
      </div>
    </form>
  );
}
