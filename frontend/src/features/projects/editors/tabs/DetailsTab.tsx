/**
 * @file DetailsTab.tsx
 * @description Creation and editing of base project metadata and production timelines.
 * Defers API sync via dirty-state tracking surfaced through the shared `EditorActionBar`.
 * Sections share one `FormSection` shell (solid card + bordered header) and lay out in two
 * balanced columns on desktop (the two tall sections — identity & run-sheet — split apart).
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/DetailsTab
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlignLeft,
  Clock,
  Info,
  ListOrdered,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";

import { useLocations } from "@/features/logistics/api/logistics.queries";
import { getAvailableTimezones } from "@/shared/lib/time/timezone";
import type { Project } from "@/shared/types";
import { useDetailsForm } from "../hooks/useDetailsForm";
import { useProjectArtistsDictionary } from "../../api/project.queries";
import { Input } from "@/shared/ui/primitives/Input";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface DetailsTabProps {
  project: Project | null;
  onSuccess: (updatedProject?: Project) => void;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

interface FormSectionProps {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** Consistent section shell: a solid card with a bordered icon+title header. */
const FormSection = ({
  icon,
  title,
  action,
  children,
}: FormSectionProps): React.JSX.Element => (
  <GlassCard variant="solid" padding="md" isHoverable={false}>
    <div className="mb-6 flex items-center justify-between gap-3 border-b border-ethereal-ink/6 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 text-ethereal-gold/70" aria-hidden="true">
          {icon}
        </span>
        <Eyebrow as="h2" color="graphite" className="truncate">
          {title}
        </Eyebrow>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children}
  </GlassCard>
);

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
  } = useDetailsForm(project?.id, onSuccess, onDirtyStateChange);

  const timezones = getAvailableTimezones();

  const { data: locationsData } = useLocations();
  const { data: artists } = useProjectArtistsDictionary();

  const displayLocations = locationsData ?? [];
  const conductors = useMemo(
    () => artists.filter((artist) => artist.voice_type === "DIR"),
    [artists],
  );

  return (
    <div className="relative w-full pb-24">
      <EditorActionBar
        isOpen={isDirty}
        description={t(
          "projects.details_tab.fab.description",
          "Zmodyfikowałeś ustawienia projektu.",
        )}
        formId="details-form"
        confirmText={t("projects.details_tab.fab.save", "Zapisz zmiany")}
        isLoading={isSubmitting}
      />

      <form
        id="details-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start"
      >
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <FormSection
            icon={<Info size={15} aria-hidden="true" />}
            title={t("projects.details_tab.sections.title_desc", "Tytuł i Opis")}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input
                  label={t("projects.details_tab.fields.title", "Tytuł Projektu *")}
                  type="text"
                  required
                  value={formData.title}
                  onChange={(event) =>
                    setFormData({ ...formData, title: event.target.value })
                  }
                />
              </div>

              <Input
                label={t("projects.details_tab.fields.date_time", "Data i Czas *")}
                type="datetime-local"
                required
                value={formData.date_time}
                onChange={(event) =>
                  setFormData({ ...formData, date_time: event.target.value })
                }
              />

              <Select
                label={t("projects.details_tab.fields.timezone", "Strefa Czasowa *")}
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
                  {t("common.select_location", "--- Wybierz zapisaną lokalizację ---")}
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
          </FormSection>

          <FormSection
            icon={<Clock size={15} aria-hidden="true" />}
            title={t("projects.details_tab.sections.logistics", "Zbiórka i Dress Code")}
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <Input
                label={t("projects.details_tab.fields.call_time", "Zbiórka (Call Time)")}
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
                  setFormData({ ...formData, dress_code_female: event.target.value })
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
                  setFormData({ ...formData, dress_code_male: event.target.value })
                }
              />
            </div>
          </FormSection>

          <FormSection
            icon={<PlayCircle size={15} aria-hidden="true" />}
            title={t("projects.details_tab.sections.references", "Referencje Muzyczne")}
          >
            <Input
              label={t("projects.details_tab.fields.spotify", "Playlista (Spotify)")}
              type="url"
              value={formData.spotify_playlist_url || ""}
              onChange={(event) =>
                setFormData({ ...formData, spotify_playlist_url: event.target.value })
              }
              placeholder={t(
                "projects.details_tab.placeholders.spotify",
                "Wklej link do playlisty z referencjami...",
              )}
            />
          </FormSection>
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <FormSection
            icon={<ListOrdered size={15} aria-hidden="true" />}
            title={t(
              "projects.details_tab.sections.run_sheet",
              "Harmonogram Dnia Koncertu",
            )}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRunSheetItem}
                leftIcon={<Plus size={14} aria-hidden="true" />}
              >
                {t("projects.details_tab.buttons.add_run_sheet", "Dodaj punkt")}
              </Button>
            }
          >
            <div className="space-y-3">
              {sortedRunSheet.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ethereal-ink/10 py-8 text-center">
                  <ListOrdered
                    size={24}
                    className="text-ethereal-incense/30"
                    aria-hidden="true"
                  />
                  <Text size="sm" color="muted">
                    {t(
                      "projects.details_tab.empty.run_sheet",
                      "Brak punktów harmonogramu. Dodaj pierwszy!",
                    )}
                  </Text>
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
                        className="flex flex-col items-start gap-3 rounded-xl border border-ethereal-ink/6 bg-ethereal-alabaster/50 p-2.5 sm:flex-row sm:items-center"
                      >
                        <div className="relative w-full shrink-0 sm:w-32">
                          <Clock
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ethereal-graphite/50"
                            aria-hidden="true"
                          />
                          <Input
                            type="time"
                            required
                            value={item.time}
                            onChange={(event) =>
                              handleUpdateRunSheetItem(safeId, "time", event.target.value)
                            }
                            className="pl-9 font-mono"
                            placeholder={t("projects.details_tab.run_sheet.time", "Godz.")}
                          />
                        </div>
                        <div className="w-full flex-1">
                          <Input
                            type="text"
                            required
                            value={item.title}
                            onChange={(event) =>
                              handleUpdateRunSheetItem(safeId, "title", event.target.value)
                            }
                            placeholder={t("projects.details_tab.run_sheet.title", "Tytuł")}
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
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRunSheetItem(safeId)}
                          aria-label={t("common.actions.delete", "Usuń")}
                          className="self-end text-ethereal-graphite/50 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson sm:self-auto"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </FormSection>

          <FormSection
            icon={<AlignLeft size={15} aria-hidden="true" />}
            title={t("projects.details_tab.sections.notes", "Notatki Produkcyjne")}
          >
            <Textarea
              label={t("projects.details_tab.fields.description", "Opis wydarzenia")}
              rows={4}
              value={formData.description || ""}
              onChange={(event) =>
                setFormData({ ...formData, description: event.target.value })
              }
              placeholder={t(
                "projects.details_tab.placeholders.description",
                "np. Proszę o punktualność...",
              )}
            />
          </FormSection>

        </div>
      </form>
    </div>
  );
};
