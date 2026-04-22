/**
 * @file DetailsTab.tsx
 * @description Handles creation and editing of base project metadata and production timelines.
 * Features "Dirty State Tracking" with a Floating Action Bar (FAB) to defer API syncing.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/DetailsTab
 */

import React, { useMemo } from "react";
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

import { getAvailableTimezones } from "@/shared/lib/time/timezone";
import type { Project } from "@/shared/types";
import { useDetailsForm } from "../hooks/useDetailsForm";
import { useProjectArtistsDictionary } from "../../api/project.queries";
import { Input } from "@/shared/ui/primitives/Input";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { useLocationsData } from "@/features/logistics/hooks/useLocationsData";

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
  } = useDetailsForm(project, onSuccess, onDirtyStateChange);
  const timezones = getAvailableTimezones();

  const { displayLocations, isLoading: isLocationsLoading } =
    useLocationsData();
  const { data: artists = [], isLoading: isArtistsLoading } =
    useProjectArtistsDictionary();
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
                    "Zmodyfikowałeś ustawienia projektu.",
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
          {t("projects.details_tab.header.title", "Szczegóły Wydarzenia")}
        </Heading>
      </div>

      <form id="details-form" onSubmit={handleSubmit} className="space-y-8">
        <GlassCard variant="ethereal" padding="md" isHoverable={false}>
          <SectionHeader
            title={t(
              "projects.details_tab.sections.title_desc",
              "Tytuł i Opis",
            )}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <Input
                label={t(
                  "projects.details_tab.fields.title",
                  "Tytuł Projektu *",
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
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
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
              disabled={isLocationsLoading}
            >
              <option value="">
                {isLocationsLoading
                  ? t("common.loading", "Ładowanie...")
                  : t(
                      "common.select_location",
                      "--- Wybierz zapisaną lokalizację ---",
                    )}
              </option>
              {displayLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                  {loc.formatted_address
                    ? ` - ${loc.formatted_address.split(",")[0]}`
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
              disabled={isArtistsLoading}
            >
              <option value="">
                {isArtistsLoading
                  ? t("common.loading", "Ładowanie...")
                  : t(
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
              "Zbiórka i Dress Code",
            )}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Input
              label={t(
                "projects.details_tab.fields.call_time",
                "Zbiórka (Call Time)",
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
              "np. Proszę o punktualność...",
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
                    "Brak punktów harmonogramu. Dodaj pierwszy!",
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
                        <div className="flex-1 w-full">
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
                              "Tytuł",
                            )}
                          />
                        </div>
                        <div className="flex-1 w-full">
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
                          aria-label={t("common.actions.delete", "Usuń")}
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
