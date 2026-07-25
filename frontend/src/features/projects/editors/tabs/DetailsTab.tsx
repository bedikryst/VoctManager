/**
 * @file DetailsTab.tsx
 * @description Creation and editing of base project metadata and production timelines.
 * Defers API sync via dirty-state tracking surfaced through the shared `EditorActionBar`.
 * Sections are `SectionCard`s laid out in two balanced columns on desktop (the two tall
 * sections — identity & run-sheet — split apart).
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
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Text } from "@/shared/ui/primitives/typography";

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
  } = useDetailsForm(project?.id, onSuccess, onDirtyStateChange);

  const { data: locationsData } = useLocations();
  const { data: artists } = useProjectArtistsDictionary();

  const timezoneOptions = useMemo<SelectOption[]>(
    () =>
      getAvailableTimezones().map((timezone) => ({
        value: timezone,
        label: timezone.replace(/_/g, " "),
      })),
    [],
  );

  const locationOptions = useMemo<SelectOption[]>(
    () =>
      (locationsData ?? []).map((location) => ({
        value: String(location.id),
        label: location.formatted_address
          ? `${location.name} - ${location.formatted_address.split(",")[0]}`
          : location.name,
      })),
    [locationsData],
  );

  const conductorOptions = useMemo<SelectOption[]>(
    () =>
      artists
        .filter((artist) => artist.voice_type === "DIR")
        .map((artist) => ({
          value: String(artist.id),
          label: `${artist.first_name} ${artist.last_name}`.trim(),
        })),
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
          <SectionCard
            as="h2"
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
                onValueChange={(timezone) =>
                  setFormData({ ...formData, timezone })
                }
                options={timezoneOptions}
              />

              <Select
                label={t(
                  "projects.details_tab.fields.location",
                  "Lokalizacja / Miejsce",
                )}
                value={formData.location_id || ""}
                onValueChange={(locationId) =>
                  setFormData({
                    ...formData,
                    location_id: locationId || null,
                  })
                }
                placeholder={t(
                  "projects.details_tab.placeholders.location",
                  "Wybierz zapisaną lokalizację",
                )}
                clearLabel={t(
                  "projects.details_tab.placeholders.location_clear",
                  "Bez lokalizacji",
                )}
                options={locationOptions}
              />

              <Select
                label={t("projects.details_tab.fields.conductor", "Dyrygent")}
                value={formData.conductor || ""}
                onValueChange={(conductor) =>
                  setFormData({
                    ...formData,
                    conductor: conductor || null,
                  })
                }
                placeholder={t(
                  "projects.details_tab.placeholders.conductor",
                  "Wybierz dyrygenta",
                )}
                clearLabel={t(
                  "projects.details_tab.placeholders.conductor_clear",
                  "Bez dyrygenta",
                )}
                options={conductorOptions}
              />
            </div>
          </SectionCard>

          <SectionCard
            as="h2"
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
          </SectionCard>

          <SectionCard
            as="h2"
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
          </SectionCard>
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <SectionCard
            as="h2"
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
                <div className="flex flex-col items-center gap-2 rounded-control border border-dashed border-hairline-strong py-8 text-center">
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
                        className="flex flex-col items-start gap-3 rounded-control border border-hairline bg-ethereal-alabaster/50 p-2.5 sm:flex-row sm:items-center"
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
          </SectionCard>

          <SectionCard
            as="h2"
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
          </SectionCard>

        </div>
      </form>
    </div>
  );
};
