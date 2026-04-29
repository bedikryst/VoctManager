/**
 * @file PieceDetailsForm.tsx
 * @description Pure presentation component for creating or updating repertoire metadata.
 * Delegates all state management, dirty tracking, and API interactions to usePieceForm.
 * @architecture Enterprise SaaS 2026
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
import { Select } from "@ui/primitives/Select";
import { Textarea } from "@ui/primitives/Textarea";
import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { Eyebrow, Text } from "@ui/primitives/typography";
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
      className="flex flex-col min-h-full gap-6"
    >
      {/* ── Title ── */}
      <GlassCard variant="ethereal" className="p-6 md:p-8 space-y-6">
        <div>
          <Eyebrow as="label" color="gold" className="mb-2 ml-1 block">
            {t("archive.form.fields.title", "Tytuł utworu *")}
          </Eyebrow>
          <Input
            type="text"
            required
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            placeholder={t("archive.form.placeholders.title", "np. Lacrimosa")}
            disabled={isSubmitting}
            className="text-lg font-medium"
          />
        </div>

        {/* ── Composer + Arranger ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-end mb-2">
              <Eyebrow as="label" color="muted" className="ml-1">
                {t("archive.form.fields.composer", "Kompozytor")}
              </Eyebrow>
              <button
                type="button"
                onClick={() => setIsAddingComposer(!isAddingComposer)}
                className="text-[9px] text-ethereal-gold font-medium antialiased uppercase tracking-widest hover:underline"
                disabled={isSubmitting}
              >
                {isAddingComposer
                  ? t("archive.form.actions.back_to_search", "Wróć do wyszukiwarki")
                  : t("archive.form.actions.add_new", "+ Dodaj nowego")}
              </button>
            </div>

            {isAddingComposer ? (
              <div className="flex flex-col gap-3 bg-ethereal-alabaster/60 backdrop-blur-sm p-5 border border-ethereal-incense/20 rounded-xl shadow-glass-ethereal">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="text"
                    placeholder={t("archive.form.placeholders.composer_first_name", "Imię")}
                    value={newComposerData.first_name}
                    onChange={(e) =>
                      setNewComposerData({ ...newComposerData, first_name: e.target.value })
                    }
                    disabled={isSubmitting}
                  />
                  <Input
                    type="text"
                    placeholder={t("archive.form.placeholders.composer_last_name", "Nazwisko *")}
                    required
                    value={newComposerData.last_name}
                    onChange={(e) =>
                      setNewComposerData({ ...newComposerData, last_name: e.target.value })
                    }
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder={t("archive.form.placeholders.composer_birth_year", "Rok ur.")}
                    value={newComposerData.birth_year}
                    onChange={(e) =>
                      setNewComposerData({ ...newComposerData, birth_year: e.target.value })
                    }
                    disabled={isSubmitting}
                  />
                  <Input
                    type="number"
                    placeholder={t("archive.form.placeholders.composer_death_year", "Rok śm.")}
                    value={newComposerData.death_year}
                    onChange={(e) =>
                      setNewComposerData({ ...newComposerData, death_year: e.target.value })
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
                      className="absolute z-50 w-full mt-2 bg-ethereal-alabaster/95 backdrop-blur-xl border border-ethereal-incense/20 rounded-xl shadow-glass-solid max-h-48 overflow-y-auto overflow-hidden no-scrollbar"
                    >
                      <div
                        onMouseDown={() => {
                          setFormData((prev) => ({ ...prev, composer: "" }));
                          setCompSearchTerm("");
                          setIsCompDropdownOpen(false);
                        }}
                        className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-ethereal-graphite hover:bg-ethereal-parchment cursor-pointer border-b border-ethereal-incense/20"
                      >
                        {t("archive.form.composer.unknown", "— Tradycyjny / Nieznany —")}
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
                          className="px-4 py-3 text-sm font-medium text-ethereal-ink hover:bg-ethereal-gold/10 hover:text-ethereal-ink cursor-pointer transition-colors"
                        >
                          {composer.last_name} {composer.first_name}{" "}
                          {composer.birth_year ? (
                            <Text as="span" size="xs" color="graphite" className="ml-1">
                              ({composer.birth_year}-{composer.death_year || ""})
                            </Text>
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
            <Input
              label={t("archive.form.fields.arranger", "Aranżer")}
              type="text"
              value={formData.arranger}
              onChange={(e) =>
                setFormData({ ...formData, arranger: e.target.value })
              }
              placeholder={t("archive.form.placeholders.arranger", "np. John Rutter")}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* ── Epoch / Year / Language ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2">
            <Select
              label={t("archive.form.fields.epoch", "Epoka muzyczna")}
              value={formData.epoch}
              onChange={(e) => setFormData({ ...formData, epoch: e.target.value })}
              disabled={isSubmitting}
            >
              <option value="">{t("archive.form.placeholders.epoch", "— Wybierz epokę —")}</option>
              {epochOptions.map((epoch) => (
                <option key={epoch.value} value={epoch.value}>
                  {epoch.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Input
              label={t("archive.form.fields.composition_year", "Rok powstania")}
              type="number"
              placeholder={t("archive.form.placeholders.composition_year", "np. 1741")}
              value={formData.composition_year || ""}
              onChange={(e) =>
                setFormData({ ...formData, composition_year: e.target.value })
              }
              disabled={isSubmitting}
            />
          </div>
          <div>
            <Input
              label={t("archive.form.fields.language", "Język")}
              type="text"
              value={formData.language}
              onChange={(e) =>
                setFormData({ ...formData, language: e.target.value })
              }
              placeholder={t("archive.form.placeholders.language", "np. Łacina")}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </GlassCard>

      {/* ── Wymagania wykonawcze ── */}
      <GlassCard variant="ethereal" className="p-6 md:p-8 space-y-6">
        <SectionHeader
          title={t("archive.form.sections.requirements", "Wymagania wykonawcze")}
          icon={<Music size={16} />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Input
              label={t("archive.form.fields.voicing", "Obsada wokalna (zapis tradycyjny)")}
              type="text"
              value={formData.voicing}
              onChange={(e) =>
                setFormData({ ...formData, voicing: e.target.value })
              }
              placeholder={t("archive.form.placeholders.voicing", "np. SSAATTBB, Chór + Soliści")}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <Eyebrow as="label" color="muted" className="mb-2 ml-1 flex items-center gap-1.5 block">
              <Clock size={12} aria-hidden="true" />{" "}
              {t("archive.form.fields.duration", "Szacowany czas trwania")}
            </Eyebrow>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                placeholder={t("archive.form.placeholders.duration_minutes", "Minuty")}
                value={formData.durationMins || ""}
                onChange={(e) =>
                  setFormData({ ...formData, durationMins: e.target.value })
                }
                rightElement={t("archive.form.units.minutes_short", "min")}
                disabled={isSubmitting}
              />
              <Text as="span" color="graphite" className="text-lg font-medium">:</Text>
              <Input
                type="number"
                min={0}
                max={59}
                placeholder={t("archive.form.placeholders.duration_seconds", "Sekundy")}
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

        {/* ── Divisi ── */}
        <div className="border border-ethereal-incense/20 rounded-2xl overflow-hidden shadow-glass-ethereal">
          <div className="bg-ethereal-alabaster/60 backdrop-blur-sm p-5 border-b border-ethereal-incense/20">
            <Eyebrow className="mb-1.5">
              {t("archive.form.sections.divisi", "Algorytm obsady (Divisi)")}
            </Eyebrow>
            <Text size="xs" color="graphite" className="mb-4 leading-relaxed max-w-lg">
              {t(
                "archive.form.descriptions.divisi",
                "Wybierz głosy i ustal minimalną ilość śpiewaków do weryfikacji braków kadrowych w trybie mikro-obsady.",
              )}
            </Text>

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
                    className="px-4 py-2 bg-ethereal-alabaster/80 border border-ethereal-incense/20 text-ethereal-graphite hover:text-ethereal-gold hover:border-ethereal-gold/30 hover:bg-ethereal-gold/5 text-[9px] font-medium antialiased uppercase tracking-widest rounded-xl transition-all shadow-glass-ethereal flex items-center gap-1.5 active:scale-95"
                    disabled={isSubmitting}
                  >
                    <Plus size={12} aria-hidden="true" /> {voiceLine.label}
                  </button>
                ))}
            </div>
          </div>

          <div className="p-4 space-y-3 bg-ethereal-alabaster/20">
            {requirements.length > 0 ? (
              requirements.map((requirement, index) => (
                <div
                  key={`${requirement.voice_line}-${index}`}
                  className="flex justify-between items-center bg-ethereal-alabaster/60 border border-ethereal-incense/20 px-5 py-3 rounded-xl shadow-glass-ethereal transition-colors"
                >
                  <Eyebrow className="!mb-0 text-ethereal-gold">
                    {voiceLines.find(
                      (voiceLine) =>
                        String(voiceLine.value) === requirement.voice_line,
                    )?.label || requirement.voice_line}
                  </Eyebrow>
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2 bg-ethereal-parchment/40 border border-ethereal-incense/20 rounded-lg shadow-inner px-1 py-1">
                      <button
                        type="button"
                        onClick={() => handleRequirementChange(index, -1)}
                        disabled={requirement.quantity <= 1 || isSubmitting}
                        className="p-2 text-ethereal-graphite hover:text-ethereal-ink disabled:opacity-30 transition-colors active:scale-95 bg-ethereal-alabaster/80 rounded-md shadow-sm"
                      >
                        <Minus size={12} />
                      </button>
                      <Text as="span" size="xs" className="font-medium w-6 text-center">
                        {requirement.quantity}
                      </Text>
                      <button
                        type="button"
                        onClick={() => handleRequirementChange(index, 1)}
                        disabled={isSubmitting}
                        className="p-2 text-ethereal-graphite hover:text-ethereal-ink transition-colors active:scale-95 bg-ethereal-alabaster/80 rounded-md shadow-sm"
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
                      className="text-ethereal-incense hover:text-ethereal-crimson p-2.5 rounded-lg hover:bg-ethereal-crimson/10 transition-colors border border-transparent hover:border-ethereal-crimson/20 active:scale-95"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <Text
                size="xs"
                color="graphite"
                className="italic text-center py-6 uppercase tracking-widest"
              >
                {t("archive.form.empty.requirements", "Brak zdefiniowanych wymagań.")}
              </Text>
            )}
          </div>
        </div>
      </GlassCard>

      {/* ── Materiały i teksty ── */}
      <GlassCard variant="ethereal" className="p-6 md:p-8 space-y-6">
        <SectionHeader
          title={t("archive.form.sections.materials", "Materiały i teksty")}
          icon={<AlignLeft size={16} />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Textarea
            label={t("archive.form.fields.lyrics_original", "Tekst oryginalny")}
            value={formData.lyrics_original}
            onChange={(e) =>
              setFormData({ ...formData, lyrics_original: e.target.value })
            }
            rows={5}
            placeholder={t("archive.form.placeholders.lyrics_original", "Wklej oryginalny tekst utworu...")}
            disabled={isSubmitting}
          />
          <Textarea
            label={t("archive.form.fields.lyrics_translation", "Tłumaczenie (notatki)")}
            value={formData.lyrics_translation}
            onChange={(e) =>
              setFormData({ ...formData, lyrics_translation: e.target.value })
            }
            rows={5}
            placeholder={t("archive.form.placeholders.lyrics_translation", "Wklej polskie tłumaczenie...")}
            disabled={isSubmitting}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Eyebrow as="label" color="muted" className="mb-2 ml-1 flex items-center gap-1.5 block">
              <Youtube size={14} className="text-ethereal-crimson" aria-hidden="true" />{" "}
              {t("archive.form.fields.reference_youtube", "Referencja YouTube")}
            </Eyebrow>
            <Input
              type="url"
              value={formData.reference_recording_youtube}
              onChange={(e) =>
                setFormData({ ...formData, reference_recording_youtube: e.target.value })
              }
              placeholder={t("archive.form.placeholders.reference_youtube", "https://youtube.com/watch?v=...")}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <Eyebrow as="label" color="muted" className="mb-2 ml-1 flex items-center gap-1.5 block">
              <Music size={14} className="text-ethereal-sage" aria-hidden="true" />{" "}
              {t("archive.form.fields.reference_spotify", "Referencja Spotify")}
            </Eyebrow>
            <Input
              type="url"
              value={formData.reference_recording_spotify}
              onChange={(e) =>
                setFormData({ ...formData, reference_recording_spotify: e.target.value })
              }
              placeholder={t("archive.form.placeholders.reference_spotify", "https://open.spotify.com/track/...")}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* ── Sheet music PDF ── */}
        <div className="p-6 border border-ethereal-incense/20 rounded-2xl bg-ethereal-alabaster/40 shadow-glass-ethereal">
          <Eyebrow as="label" color="muted" className="mb-3 block">
            {t("archive.form.fields.sheet_music", "Partytura / nuty (opcjonalnie PDF)")}
          </Eyebrow>
          {piece?.sheet_music && !selectedFile && (
            <Text size="xs" color="sage" className="mb-4 flex items-center gap-2">
              <CheckCircle2 size={14} aria-hidden="true" />{" "}
              {t("archive.form.status.sheet_music_attached", "Dokument nutowy jest już załączony w bazie.")}
            </Text>
          )}
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            onChange={(e) =>
              setSelectedFile(e.target.files ? e.target.files[0] : null)
            }
            className="w-full mt-1 text-sm text-ethereal-graphite file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[9px] file:font-medium file:antialiased file:uppercase file:tracking-widest file:bg-ethereal-gold/10 file:text-ethereal-gold hover:file:bg-ethereal-gold/20 cursor-pointer border border-ethereal-incense/20 rounded-xl bg-ethereal-alabaster/60 backdrop-blur-sm shadow-glass-ethereal transition-all"
            disabled={isSubmitting}
          />
        </div>
      </GlassCard>

      {/* ── Sticky footer ── */}
      <div className="sticky bottom-0 left-0 right-0 z-40 bg-ethereal-parchment/90 backdrop-blur-xl border-t border-ethereal-incense/20 p-4 md:p-6 mt-2 flex flex-col sm:flex-row gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
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
