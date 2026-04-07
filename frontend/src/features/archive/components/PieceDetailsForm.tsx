/**
 * @file PieceDetailsForm.tsx
 * @description Pure presentation component for creating or updating repertoire metadata.
 * Delegates all state management, dirty tracking, and API interactions to usePieceForm.
 * @module panel/archive/components/PieceDetailsForm
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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

import type { Composer, VoiceLineOption } from "../../../shared/types";
import type { EnrichedPiece } from "../types/archive.dto";
import { Button } from "../../../shared/ui/Button";
import { Input } from "../../../shared/ui/Input";
import { usePieceForm, SubmitAction } from "../hooks/usePieceForm";

export const EPOCHS = [
  { value: "MED", label: "Średniowiecze" },
  { value: "REN", label: "Renesans" },
  { value: "BAR", label: "Barok" },
  { value: "CLA", label: "Klasycyzm" },
  { value: "ROM", label: "Romantyzm" },
  { value: "M20", label: "XX wiek" },
  { value: "CON", label: "Muzyka Współczesna" },
  { value: "POP", label: "Rozrywka" },
  { value: "FOLK", label: "Folk / Ludowa" },
];

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
  "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
const STYLE_TEXTAREA =
  "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] resize-none font-medium text-xs leading-relaxed";

export default function PieceDetailsForm({
  piece,
  composers,
  voiceLines,
  onSuccess,
  onDirtyStateChange,
  initialSearchContext = "",
}: PieceDetailsFormProps): React.JSX.Element {
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
        {/* SECTION 1: Core Metadata */}
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395] mb-2 ml-1">
              Tytuł Utworu *
            </label>
            <Input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="np. Lacrimosa"
              disabled={isSubmitting}
              className="text-lg font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className={STYLE_LABEL}>Kompozytor</label>
                <button
                  type="button"
                  onClick={() => setIsAddingComposer(!isAddingComposer)}
                  className="text-[9px] text-[#002395] font-medium antialiased uppercase tracking-widest hover:underline"
                  disabled={isSubmitting}
                >
                  {isAddingComposer ? "Wróć do wyszukiwarki" : "+ Dodaj Nowego"}
                </button>
              </div>

              {isAddingComposer ? (
                <div className="flex flex-col gap-3 bg-white/50 backdrop-blur-sm p-5 border border-stone-200/80 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="text"
                      placeholder="Imię"
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
                      placeholder="Nazwisko *"
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
                      placeholder="Rok ur."
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
                      placeholder="Rok śm."
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
                    placeholder="Szukaj na liście (lub zostaw puste)"
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
                          — Tradycyjny / Nieznany —
                        </div>
                        {filteredComposers.map((c) => (
                          <div
                            key={c.id}
                            onMouseDown={() => {
                              setFormData((prev) => ({
                                ...prev,
                                composer: String(c.id),
                              }));
                              setIsCompDropdownOpen(false);
                            }}
                            className="px-4 py-3 text-sm font-medium text-stone-800 hover:bg-[#002395] hover:text-white cursor-pointer transition-colors"
                          >
                            {c.last_name} {c.first_name}{" "}
                            {c.birth_year ? (
                              <span className="opacity-60 font-medium ml-1">
                                ({c.birth_year}-{c.death_year || ""})
                              </span>
                            ) : (
                              ""
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div>
              <label className={STYLE_LABEL}>Aranżer</label>
              <Input
                type="text"
                value={formData.arranger}
                onChange={(e) =>
                  setFormData({ ...formData, arranger: e.target.value })
                }
                placeholder="np. John Rutter"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2">
              <label className={STYLE_LABEL}>Epoka Muzyczna</label>
              <select
                value={formData.epoch}
                onChange={(e) =>
                  setFormData({ ...formData, epoch: e.target.value })
                }
                className={`${STYLE_SELECT} font-medium appearance-none`}
                disabled={isSubmitting}
              >
                <option value="">— Wybierz Epokę —</option>
                {EPOCHS.map((ep) => (
                  <option key={ep.value} value={ep.value}>
                    {ep.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={STYLE_LABEL}>Rok Powstania</label>
              <Input
                type="number"
                placeholder="np. 1741"
                value={formData.composition_year || ""}
                onChange={(e) =>
                  setFormData({ ...formData, composition_year: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className={STYLE_LABEL}>Język</label>
              <Input
                type="text"
                value={formData.language}
                onChange={(e) =>
                  setFormData({ ...formData, language: e.target.value })
                }
                placeholder="np. Łacina"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Execution & Planning */}
        <div className="border-t border-stone-200/60 pt-8 space-y-6">
          <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-800 flex items-center gap-2.5">
            <Music size={16} className="text-[#002395]" aria-hidden="true" />{" "}
            Wymagania Wykonawcze
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={STYLE_LABEL}>
                Obsada Wokalna (Zapis Tradycyjny)
              </label>
              <Input
                type="text"
                value={formData.voicing}
                onChange={(e) =>
                  setFormData({ ...formData, voicing: e.target.value })
                }
                placeholder="np. SSAATTBB, Chór + Soliści"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-[9px] font-medium antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1 flex items-center gap-1.5">
                <Clock size={12} aria-hidden="true" /> Szacowany Czas Trwania
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  placeholder="Minuty"
                  value={formData.durationMins || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, durationMins: e.target.value })
                  }
                  rightElement="min"
                  disabled={isSubmitting}
                />
                <span className="text-stone-300 font-medium text-lg">:</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="Sekundy"
                  value={formData.durationSecs || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, durationSecs: e.target.value })
                  }
                  rightElement="sek"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="border border-stone-200/60 rounded-2xl overflow-hidden shadow-sm mt-6 bg-white/40">
            <div className="bg-stone-50/50 backdrop-blur-sm p-5 border-b border-stone-200/60">
              <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 mb-1.5">
                Algorytm Obsady (Divisi)
              </h4>
              <p className="text-[9px] uppercase tracking-widest font-medium antialiased text-stone-400 mb-4 leading-relaxed max-w-lg">
                Wybierz głosy i ustal minimalną ilość śpiewaków do weryfikacji
                braków kadrowych w trybie Mikro-Obsady.
              </p>

              <div className="flex flex-wrap gap-2.5">
                {voiceLines
                  .filter(
                    (vl) =>
                      !requirements.some(
                        (r) => r.voice_line === String(vl.value),
                      ),
                  )
                  .map((vl) => (
                    <button
                      key={String(vl.value)}
                      type="button"
                      // UWAGA: Usunięto 'voice_line_display' - wysyłamy czyste DTO!
                      onClick={() =>
                        setRequirements([
                          ...requirements,
                          { voice_line: String(vl.value), quantity: 1 },
                        ])
                      }
                      className="px-4 py-2 bg-white border border-stone-200/80 text-stone-600 hover:text-[#002395] hover:border-[#002395]/40 hover:bg-blue-50/50 text-[9px] font-medium antialiased uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                      disabled={isSubmitting}
                    >
                      <Plus size={12} aria-hidden="true" /> {vl.label}
                    </button>
                  ))}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {requirements.length > 0 ? (
                requirements.map((req, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-white/80 border border-stone-200/60 px-5 py-3 rounded-xl shadow-sm transition-colors"
                  >
                    {/* Dynamicznie szukamy etykiety, zamiast trzymać ją w state */}
                    <span className="text-[10px] font-medium antialiased text-[#002395] uppercase tracking-widest">
                      {voiceLines.find((v) => v.value === req.voice_line)
                        ?.label || req.voice_line}
                    </span>
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200/80 rounded-lg shadow-inner px-1 py-1">
                        <button
                          type="button"
                          onClick={() => handleRequirementChange(idx, -1)}
                          disabled={req.quantity <= 1 || isSubmitting}
                          className="p-2 text-stone-400 hover:text-stone-800 disabled:opacity-30 transition-colors active:scale-95 bg-white rounded-md shadow-sm"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-medium text-stone-800 w-6 text-center">
                          {req.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRequirementChange(idx, 1)}
                          disabled={isSubmitting}
                          className="p-2 text-stone-400 hover:text-stone-800 transition-colors active:scale-95 bg-white rounded-md shadow-sm"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newReqs = [...requirements];
                          newReqs.splice(idx, 1);
                          setRequirements(newReqs);
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
                  Brak zdefiniowanych wymagań.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: Materials & Content */}
        <div className="border-t border-stone-200/60 pt-8 space-y-6">
          <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-800 flex items-center gap-2.5">
            <AlignLeft
              size={16}
              className="text-[#002395]"
              aria-hidden="true"
            />{" "}
            Materiały i Teksty
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={STYLE_LABEL}>Tekst Oryginalny</label>
              <textarea
                value={formData.lyrics_original}
                onChange={(e) =>
                  setFormData({ ...formData, lyrics_original: e.target.value })
                }
                rows={5}
                className={STYLE_TEXTAREA}
                placeholder="Wklej oryginalny tekst utworu..."
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className={STYLE_LABEL}>Tłumaczenie (Notatki)</label>
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
                placeholder="Wklej polskie tłumaczenie..."
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
                Referencja YouTube
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
                placeholder="https://youtube.com/watch?v=..."
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
                Referencja Spotify
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
                placeholder="https://open.spotify.com/track/..."
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="p-6 border border-stone-200/60 rounded-2xl bg-white/40 shadow-sm mt-4">
            <label className={STYLE_LABEL}>
              Partytura / Nuty (Opcjonalnie PDF)
            </label>
            {piece?.sheet_music && !selectedFile && (
              <p className="text-[9px] uppercase font-medium antialiased tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                <CheckCircle2
                  size={14}
                  className="text-emerald-500"
                  aria-hidden="true"
                />{" "}
                Dokument nutowy jest już załączony w bazie.
              </p>
            )}
            <input
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              onChange={(e) =>
                setSelectedFile(e.target.files ? e.target.files[0] : null)
              }
              className="w-full mt-1 text-sm text-stone-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[9px] file:font-medium file:antialiased file:uppercase file:tracking-widest file:bg-white file:text-[#002395] file:shadow-sm hover:file:bg-blue-50 hover:file:text-[#001766] cursor-pointer border border-stone-200/60 rounded-xl bg-white/50 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="sticky bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-stone-200/60 p-4 md:p-6 -mx-6 md:-mx-8 -mb-8 mt-8 flex flex-col sm:flex-row gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-b-2xl">
        {!piece?.id && (
          <Button
            type="submit"
            variant="outline"
            onClick={() => setSubmitAction("SAVE_AND_ADD")} // 2. Ustawiamy stan tuż przed odpaleniem natywnego eventu w <form>
            disabled={isSubmitting}
            isLoading={isSubmitting && submitAction === "SAVE_AND_ADD"}
            leftIcon={
              !(isSubmitting && submitAction === "SAVE_AND_ADD") ? (
                <Plus size={16} />
              ) : undefined
            }
            className="flex-1"
          >
            Zapisz i dodaj kolejny
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
          {piece?.id ? "Zapisz Zmiany" : "Zapisz i zamknij"}
        </Button>
      </div>
    </form>
  );
}
