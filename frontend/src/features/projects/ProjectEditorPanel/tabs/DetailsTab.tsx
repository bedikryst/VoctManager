/**
 * @file DetailsTab.tsx
 * @description Handles creation and editing of base project metadata and production timelines.
 * Features "Dirty State Tracking" with a Floating Action Bar (FAB) to defer API syncing.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/DetailsTab
 */

import React, { useMemo, useState, useCallback } from "react";
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
  FileText,
  Upload,
  Eye,
} from "lucide-react";

import { useLocations } from "@/features/logistics/api/logistics.queries";
import { getAvailableTimezones } from "@/shared/lib/time/timezone";
import type { Project } from "@/shared/types";
import { useDetailsForm } from "../hooks/useDetailsForm";
import { useProjectArtistsDictionary } from "../../api/project.queries";
import { ProjectService } from "../../api/project.service";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";
import { Input } from "@/shared/ui/primitives/Input";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

interface DetailsTabProps {
  project: Project | null;
  onSuccess: (updatedProject?: Project) => void;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

export const DetailsTab = ({
  project,
  onSuccess,
  onDirtyStateChange,
}: DetailsTabProps): React.JSX.Element => {
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
    pendingPdfFile,
    pendingPdfRemoval,
    handleSelectPdfFile,
    handleRemovePdf,
    handleCancelPdfChange,
  } = useDetailsForm(project?.id, onSuccess, onDirtyStateChange);

  const [isScorePdfPreviewOpen, setScorePdfPreviewOpen] = useState(false);

  const fetchScorePdfBlob = useCallback(
    () =>
      project?.id
        ? ProjectService.fetchScorePdfBlob(String(project.id))
        : Promise.reject(new Error("No project ID")),
    [project?.id],
  );
  const timezones = getAvailableTimezones();

  const { data: locationsData } = useLocations();
  const { data: artists } = useProjectArtistsDictionary();

  const displayLocations = locationsData ?? [];
  const conductors = useMemo(
    () => artists.filter((artist) => artist.voice_type === "DIR"),
    [artists],
  );

  return (
    <div className="relative mx-auto max-w-4xl pb-24">
      <AnimatePresence>
        {isDirty && (
          <motion.div
            key="fab-menu"
            initial={{ y: 100, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 100, opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 z-(--z-toast) w-[90%] max-w-md md:bottom-10"
          >
            <GlassCard
              variant="solid"
              padding="sm"
              isHoverable={false}
              className="flex items-center justify-between gap-4 rounded-2xl"
            >
              <div className="ml-2 flex flex-col">
                <Eyebrow color="gold">
                  {t("projects.details_tab.fab.unsaved", "Niezapisane Zmiany")}
                </Eyebrow>
                <Text size="xs" color="muted">
                  {t(
                    "projects.details_tab.fab.description",
                    "ZmodyfikowaĹ‚eĹ› ustawienia projektu.",
                  )}
                </Text>
              </div>

              <Button
                form="details-form"
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                leftIcon={<Save size={16} aria-hidden="true" />}
              >
                {t("projects.details_tab.fab.save", "Zapisz Zmiany")}
              </Button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-8 flex items-center gap-3">
        <Briefcase
          className="text-ethereal-gold"
          size={22}
          aria-hidden="true"
        />
        <Heading as="h2" size="xl" weight="medium">
          {t("projects.details_tab.header.title", "SzczegĂłĹ‚y Wydarzenia")}
        </Heading>
      </div>

      <form id="details-form" onSubmit={handleSubmit} className="space-y-8">
        <GlassCard variant="ethereal" padding="md" isHoverable={false}>
          <SectionHeader
            title={t(
              "projects.details_tab.sections.title_desc",
              "TytuĹ‚ i Opis",
            )}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <Input
                label={t(
                  "projects.details_tab.fields.title",
                  "TytuĹ‚ Projektu *",
                )}
                type="text"
                required
                value={formData.title}
                onChange={(event) =>
                  setFormData({ ...formData, title: event.target.value })
                }
              />
            </div>

            <Input
              label={t(
                "projects.details_tab.fields.date_time",
                "Data i Czas *",
              )}
              type="datetime-local"
              required
              value={formData.date_time}
              onChange={(event) =>
                setFormData({ ...formData, date_time: event.target.value })
              }
            />

            <Select
              label={t(
                "projects.details_tab.fields.timezone",
                "Strefa Czasowa *",
              )}
              required
              value={formData.timezone}
              onChange={(event) =>
                setFormData({ ...formData, timezone: event.target.value })
              }
            >
              {timezones.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone.replace(/_/g, " ")}
                </option>
              ))}
            </Select>

            <Select
              label={t(
                "projects.details_tab.fields.location",
                "Lokalizacja / Miejsce",
              )}
              value={formData.location_id || ""}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  location_id: event.target.value || null,
                })
              }
            >
              <option value="">
                {t(
                  "common.select_location",
                  "--- Wybierz zapisaną lokalizację ---",
                )}
              </option>
              {displayLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                  {location.formatted_address
                    ? ` - ${location.formatted_address.split(",")[0]}`
                    : ""}
                </option>
              ))}
            </Select>

            <Select
              label={t("projects.details_tab.fields.conductor", "Dyrygent")}
              value={formData.conductor || ""}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  conductor: event.target.value || null,
                })
              }
            >
              <option value="">
                {t(
                  "projects.details_tab.fields.conductor_placeholder",
                  "--- Wybierz dyrygenta ---",
                )}
              </option>
              {conductors.map((conductor) => (
                <option key={conductor.id} value={conductor.id}>
                  {`${conductor.first_name} ${conductor.last_name}`.trim()}
                </option>
              ))}
            </Select>
          </div>
        </GlassCard>

        <GlassCard variant="ethereal" padding="md" isHoverable={false}>
          <SectionHeader
            title={t(
              "projects.details_tab.sections.logistics",
              "ZbiĂłrka i Dress Code",
            )}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Input
              label={t(
                "projects.details_tab.fields.call_time",
                "ZbiĂłrka (Call Time)",
              )}
              type="datetime-local"
              value={formData.call_time || ""}
              onChange={(event) =>
                setFormData({ ...formData, call_time: event.target.value })
              }
            />
            <Input
              label={t(
                "projects.details_tab.fields.dress_code_female",
                "Opcjonalnie: Panie",
              )}
              type="text"
              value={formData.dress_code_female || ""}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  dress_code_female: event.target.value,
                })
              }
            />
            <Input
              label={t(
                "projects.details_tab.fields.dress_code_male",
                "Opcjonalnie: Panowie",
              )}
              type="text"
              value={formData.dress_code_male || ""}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  dress_code_male: event.target.value,
                })
              }
            />
          </div>
        </GlassCard>

        <GlassCard variant="ethereal" padding="md" isHoverable={false}>
          <SectionHeader
            title={t(
              "projects.details_tab.sections.notes",
              "Notatki Produkcyjne",
            )}
          />
          <Textarea
            label={t(
              "projects.details_tab.fields.description",
              "Opis wydarzenia",
            )}
            rows={4}
            value={formData.description || ""}
            onChange={(event) =>
              setFormData({ ...formData, description: event.target.value })
            }
            placeholder={t(
              "projects.details_tab.placeholders.description",
              "np. ProszÄ™ o punktualnoĹ›Ä‡...",
            )}
          />
        </GlassCard>

        <GlassCard
          variant="outline"
          padding="md"
          isHoverable={false}
          className="border-ethereal-sage/30 bg-ethereal-sage/5"
        >
          <div className="mb-6 flex items-center gap-3">
            <PlayCircle
              className="text-ethereal-sage"
              size={18}
              aria-hidden="true"
            />
            <Eyebrow color="sage">
              {t(
                "projects.details_tab.sections.references",
                "Referencje Muzyczne",
              )}
            </Eyebrow>
          </div>
          <Input
            label={t(
              "projects.details_tab.fields.spotify",
              "Playlista (Spotify)",
            )}
            type="url"
            value={formData.spotify_playlist_url || ""}
            onChange={(event) =>
              setFormData({
                ...formData,
                spotify_playlist_url: event.target.value,
              })
            }
            placeholder={t(
              "projects.details_tab.placeholders.spotify",
              "Wklej link do playlisty z referencjami...",
            )}
          />
        </GlassCard>

        <GlassCard
          variant="outline"
          padding="md"
          isHoverable={false}
          className="border-ethereal-amethyst/30 bg-ethereal-amethyst/5"
        >
          <div className="mb-5 flex items-center gap-3">
            <FileText
              className="text-ethereal-amethyst"
              size={18}
              aria-hidden="true"
            />
            <Eyebrow color="amethyst">
              {t(
                "projects.details_tab.sections.score_pdf",
                "Partytura Koncertu (PDF)",
              )}
            </Eyebrow>
          </div>

          {/* Existing PDF — show preview + delete unless overridden */}
          {project?.score_pdf && !pendingPdfRemoval && !pendingPdfFile && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-ethereal-amethyst/30 bg-ethereal-amethyst/10 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText
                  size={13}
                  className="shrink-0 text-ethereal-amethyst"
                  aria-hidden="true"
                />
                <Text size="sm" color="muted" className="truncate">
                  {t(
                    "projects.details_tab.score_pdf.current",
                    "Bieżący plik PDF",
                  )}
                </Text>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setScorePdfPreviewOpen(true)}
                  leftIcon={<Eye size={12} aria-hidden="true" />}
                >
                  {t("projects.details_tab.score_pdf.preview", "Podgląd")}
                </Button>
                <Button
                  type="button"
                  variant="icon"
                  size="icon"
                  onClick={handleRemovePdf}
                  aria-label={t(
                    "projects.details_tab.score_pdf.delete_aria",
                    "Usuń PDF",
                  )}
                  className="text-ethereal-crimson/70 hover:text-ethereal-crimson"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {/* Pending removal notice */}
          {pendingPdfRemoval && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-ethereal-crimson/30 bg-ethereal-crimson/10 px-4 py-3">
              <Text size="sm" color="muted">
                {t(
                  "projects.details_tab.score_pdf.pending_removal",
                  "PDF zostanie usunięty po zapisaniu zmian.",
                )}
              </Text>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelPdfChange}
              >
                {t("common.actions.undo", "Cofnij")}
              </Button>
            </div>
          )}

          {/* Pending new file notice */}
          {pendingPdfFile && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-ethereal-sage/30 bg-ethereal-sage/10 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText
                  size={13}
                  className="shrink-0 text-ethereal-sage"
                  aria-hidden="true"
                />
                <Text size="sm" color="muted" className="truncate">
                  {pendingPdfFile.name}
                </Text>
              </div>
              <Button
                type="button"
                variant="icon"
                size="icon"
                onClick={handleCancelPdfChange}
                aria-label={t("common.actions.cancel", "Anuluj")}
              >
                <Trash2 size={13} aria-hidden="true" />
              </Button>
            </div>
          )}

          {/* File-picker drop zone */}
          {!pendingPdfFile && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ethereal-amethyst/30 px-6 py-5 text-center transition-colors hover:border-ethereal-amethyst/60 hover:bg-ethereal-amethyst/5">
              <Upload
                size={18}
                className="text-ethereal-amethyst/50"
                aria-hidden="true"
              />
              <Text size="sm" color="muted">
                {project?.score_pdf && !pendingPdfRemoval
                  ? t(
                      "projects.details_tab.score_pdf.replace",
                      "Kliknij, aby zastąpić plik PDF",
                    )
                  : t(
                      "projects.details_tab.score_pdf.upload",
                      "Kliknij, aby dodać partytury / program (PDF)",
                    )}
              </Text>
              <input
                type="file"
                accept=".pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSelectPdfFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </GlassCard>

        {/* Score PDF preview modal — outside the form, above run-sheet */}
        {project?.score_pdf && (
          <PdfViewerModal
            isOpen={isScorePdfPreviewOpen}
            title={t(
              "projects.details_tab.score_pdf.modal_title",
              "Partytura Koncertu",
            )}
            subtitle={project.title}
            fileName={`Score_${project.title.replace(/\s+/g, "_")}.pdf`}
            fetchBlob={fetchScorePdfBlob}
            docKey={project.id}
            onClose={() => setScorePdfPreviewOpen(false)}
          />
        )}

        <GlassCard variant="ethereal" padding="md" isHoverable={false}>
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <ListOrdered
                className="text-ethereal-amethyst"
                size={18}
                aria-hidden="true"
              />
              <Eyebrow color="amethyst">
                {t(
                  "projects.details_tab.sections.run_sheet",
                  "Harmonogram Dnia Koncertu",
                )}
              </Eyebrow>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRunSheetItem}
              leftIcon={<Plus size={14} aria-hidden="true" />}
            >
              {t(
                "projects.details_tab.buttons.add_run_sheet",
                "Dodaj punkt harmonogramu",
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {sortedRunSheet.length === 0 ? (
              <GlassCard
                variant="light"
                padding="md"
                isHoverable={false}
                className="flex flex-col items-center border-dashed text-center"
              >
                <ListOrdered
                  size={24}
                  className="mb-2 text-ethereal-graphite/40"
                  aria-hidden="true"
                />
                <Text size="xs" color="muted">
                  {t(
                    "projects.details_tab.empty.run_sheet",
                    "Brak punktĂłw harmonogramu. Dodaj pierwszy!",
                  )}
                </Text>
              </GlassCard>
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
                    >
                      <GlassCard
                        variant="solid"
                        padding="sm"
                        isHoverable={false}
                        className="flex flex-col items-start gap-3 md:flex-row md:items-center"
                      >
                        <div className="relative w-full shrink-0 md:w-32">
                          <Clock
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ethereal-graphite/60"
                            aria-hidden="true"
                          />
                          <Input
                            type="time"
                            required
                            value={item.time}
                            onChange={(event) =>
                              handleUpdateRunSheetItem(
                                safeId,
                                "time",
                                event.target.value,
                              )
                            }
                            className="pl-9 font-mono"
                            placeholder={t(
                              "projects.details_tab.run_sheet.time",
                              "Godz.",
                            )}
                          />
                        </div>
                        <div className="w-full flex-1">
                          <Input
                            type="text"
                            required
                            value={item.title}
                            onChange={(event) =>
                              handleUpdateRunSheetItem(
                                safeId,
                                "title",
                                event.target.value,
                              )
                            }
                            placeholder={t(
                              "projects.details_tab.run_sheet.title",
                              "TytuĹ‚",
                            )}
                          />
                        </div>
                        <div className="w-full flex-1">
                          <Input
                            type="text"
                            value={item.description || ""}
                            onChange={(event) =>
                              handleUpdateRunSheetItem(
                                safeId,
                                "description",
                                event.target.value,
                              )
                            }
                            className="italic"
                            placeholder={t(
                              "projects.details_tab.run_sheet.description",
                              "Opis (opcjonalny)",
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="icon"
                          size="icon"
                          onClick={() => handleRemoveRunSheetItem(safeId)}
                          aria-label={t("common.actions.delete", "UsuĹ„")}
                          className="self-end md:self-auto"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      </GlassCard>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </GlassCard>
      </form>
    </div>
  );
};
