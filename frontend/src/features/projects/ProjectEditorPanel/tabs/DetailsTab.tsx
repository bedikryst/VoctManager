/**
 * @file DetailsTab.tsx
 * @description Handles creation and editing of base project metadata and production timelines.
 * Features "Dirty State Tracking" with a Floating Action Bar (FAB) to defer API syncing.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/DetailsTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Plus,
  Trash2,
  ListOrdered,
  Briefcase,
  PlayCircle,
  Save,
} from "lucide-react";

import type { Project } from "../../../../shared/types";
import { useDetailsForm } from "../hooks/useDetailsForm";
import { Input } from "../../../../shared/ui/Input";
import { Button } from "../../../../shared/ui/Button";

interface DetailsTabProps {
  project: Project | null;
  onSuccess: (updatedProject?: Project) => void;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

const STYLE_LABEL =
  "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";
const STYLE_GLASS_TEXTAREA =
  "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-stone-400";

export default function DetailsTab({
  project,
  onSuccess,
  onDirtyStateChange,
}: DetailsTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    formData,
    setFormData,
    sortedRunSheet,
    isDirty,
    isSubmitting,
    handleAddRunSheetItem,
    handleUpdateRunSheetItem,
    handleRemoveRunSheetItem,
    handleSubmit,
  } = useDetailsForm(project, onSuccess, onDirtyStateChange);

  return (
    <div className="max-w-4xl mx-auto pb-24 relative">
      <AnimatePresence>
        {isDirty && (
          <motion.div
            key="fab-menu"
            initial={{ y: 100, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 100, opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 md:bottom-10 left-1/2 z-[200] w-[90%] max-w-md bg-white/90 backdrop-blur-xl border border-white/60 shadow-[0_20px_40px_rgb(0,0,0,0.12)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl p-4 flex items-center justify-between"
          >
            <div className="flex flex-col ml-2">
              <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">
                {t("projects.details_tab.fab.unsaved", "Niezapisane Zmiany")}
              </span>
              <span className="text-xs text-stone-500">
                {t(
                  "projects.details_tab.fab.description",
                  "Zmodyfikowałeś ustawienia projektu.",
                )}
              </span>
            </div>

            <Button
              form="details-form"
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              leftIcon={<Save size={16} aria-hidden="true" />}
              className="shadow-sm"
            >
              {t("projects.details_tab.fab.save", "Zapisz Zmiany")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2 mb-2">
          <Briefcase className="text-[#002395]" size={20} aria-hidden="true" />
          {t("projects.details_tab.header.title", "Szczegóły Wydarzenia")}
        </h2>
      </div>

      <form id="details-form" onSubmit={handleSubmit} className="space-y-8">
        {/* Metadane Główne */}
        <div className="bg-white/40 border border-stone-200/60 rounded-2xl p-6 md:p-8 shadow-sm">
          <h3 className="text-sm font-bold text-stone-800 mb-6 flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#002395]"
              aria-hidden="true"
            ></span>
            {t("projects.details_tab.sections.title_desc", "Tytuł i Opis")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className={STYLE_LABEL}>
                {t("projects.details_tab.fields.title", "Tytuł Projektu *")}
              </label>
              <Input
                type="text"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div>
              <label className={STYLE_LABEL}>
                {t("projects.details_tab.fields.date_time", "Data i Czas *")}
              </label>
              <Input
                type="datetime-local"
                required
                value={formData.date_time}
                onChange={(e) =>
                  setFormData({ ...formData, date_time: e.target.value })
                }
              />
            </div>
            <div>
              <label className={STYLE_LABEL}>
                {t(
                  "projects.details_tab.fields.location",
                  "Lokalizacja / Miejsce",
                )}
              </label>
              <Input
                type="text"
                value={formData.location || ""}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Logistyka */}
        <div className="bg-white/40 border border-stone-200/60 rounded-2xl p-6 md:p-8 shadow-sm">
          <h3 className="text-sm font-bold text-stone-800 mb-6 flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              aria-hidden="true"
            ></span>
            {t(
              "projects.details_tab.sections.logistics",
              "Zbiórka i Dress Code",
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={STYLE_LABEL}>
                {t(
                  "projects.details_tab.fields.call_time",
                  "Zbiórka (Call Time)",
                )}
              </label>
              <Input
                type="datetime-local"
                value={formData.call_time || ""}
                onChange={(e) =>
                  setFormData({ ...formData, call_time: e.target.value })
                }
              />
            </div>
            <div>
              <label className={STYLE_LABEL}>
                {t(
                  "projects.details_tab.fields.dress_code_female",
                  "Opcjonalnie: Panie",
                )}
              </label>
              <Input
                type="text"
                value={formData.dress_code_female || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dress_code_female: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className={STYLE_LABEL}>
                {t(
                  "projects.details_tab.fields.dress_code_male",
                  "Opcjonalnie: Panowie",
                )}
              </label>
              <Input
                type="text"
                value={formData.dress_code_male || ""}
                onChange={(e) =>
                  setFormData({ ...formData, dress_code_male: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Notatki */}
        <div className="bg-white/40 border border-stone-200/60 rounded-2xl p-6 md:p-8 shadow-sm">
          <h3 className="text-sm font-bold text-stone-800 mb-6 flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full bg-orange-400"
              aria-hidden="true"
            ></span>
            {t("projects.details_tab.sections.notes", "Notatki Produkcyjne")}
          </h3>
          <div>
            <label className={STYLE_LABEL}>
              {t("projects.details_tab.fields.description", "Opis wydarzenia")}
            </label>
            <textarea
              rows={4}
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className={STYLE_GLASS_TEXTAREA}
              placeholder={t(
                "projects.details_tab.placeholders.description",
                "np. Proszę o punktualność...",
              )}
            />
          </div>
        </div>

        {/* Referencje */}
        <div className="bg-[#1DB954]/5 border border-[#1DB954]/20 rounded-2xl p-6 md:p-8 shadow-sm">
          <h3 className="text-sm font-bold text-stone-800 mb-6 flex items-center gap-2">
            <PlayCircle
              className="text-[#1DB954]"
              size={16}
              aria-hidden="true"
            />
            {t(
              "projects.details_tab.sections.references",
              "Referencje Muzyczne",
            )}
          </h3>
          <div>
            <label className={STYLE_LABEL}>
              {t("projects.details_tab.fields.spotify", "Playlista (Spotify)")}
            </label>
            <Input
              type="url"
              value={formData.spotify_playlist_url || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  spotify_playlist_url: e.target.value,
                })
              }
              placeholder={t(
                "projects.details_tab.placeholders.spotify",
                "Wklej link do playlisty z referencjami...",
              )}
            />
          </div>
        </div>

        {/* Harmonogram (Run Sheet) */}
        <div className="bg-white/40 border border-stone-200/60 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full bg-purple-500"
                aria-hidden="true"
              ></span>
              {t(
                "projects.details_tab.sections.run_sheet",
                "Harmonogram Dnia Koncertu",
              )}
            </h3>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddRunSheetItem}
              leftIcon={<Plus size={14} aria-hidden="true" />}
              className="text-xs"
            >
              {t(
                "projects.details_tab.buttons.add_run_sheet",
                "Dodaj punkt harmonogramu",
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {sortedRunSheet.length === 0 ? (
              <div className="text-center py-10 bg-stone-50/50 rounded-xl border border-dashed border-stone-200 flex flex-col items-center">
                <ListOrdered
                  size={24}
                  className="text-stone-300 mb-2"
                  aria-hidden="true"
                />
                <p className="text-xs text-stone-500">
                  {t(
                    "projects.details_tab.empty.run_sheet",
                    "Brak punktów harmonogramu. Dodaj pierwszy!",
                  )}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {sortedRunSheet.map((item) => {
                  const safeId = String(item.id);

                  return (
                    <motion.div
                      key={safeId}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-white p-3 rounded-xl border border-stone-200/60 shadow-sm"
                    >
                      <div className="flex-shrink-0 w-full md:w-32 relative">
                        <Clock
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                          aria-hidden="true"
                        />
                        <input
                          type="time"
                          required
                          value={item.time}
                          onChange={(e) =>
                            handleUpdateRunSheetItem(
                              safeId,
                              "time",
                              e.target.value,
                            )
                          }
                          className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all font-mono"
                          placeholder={t(
                            "projects.details_tab.run_sheet.time",
                            "Godz.",
                          )}
                        />
                      </div>
                      <div className="flex-1 w-full relative">
                        <input
                          type="text"
                          required
                          value={item.title}
                          onChange={(e) =>
                            handleUpdateRunSheetItem(
                              safeId,
                              "title",
                              e.target.value,
                            )
                          }
                          className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all font-bold"
                          placeholder={t(
                            "projects.details_tab.run_sheet.title",
                            "Tytuł",
                          )}
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <input
                          type="text"
                          value={item.description || ""}
                          onChange={(e) =>
                            handleUpdateRunSheetItem(
                              safeId,
                              "description",
                              e.target.value,
                            )
                          }
                          className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all italic"
                          placeholder={t(
                            "projects.details_tab.run_sheet.description",
                            "Opis (opcjonalny)",
                          )}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRunSheetItem(safeId)}
                        className="p-2.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 self-end md:self-auto"
                        aria-label={t("common.actions.delete", "Usuń")}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
