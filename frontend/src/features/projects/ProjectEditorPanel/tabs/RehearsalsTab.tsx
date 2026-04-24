/**
 * @file RehearsalsTab.tsx
 * @description Orchestrates rehearsal scheduling and targeted participation selection.
 * Uses typed location relations and shared primitives for the project editor workspace.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/RehearsalsTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar1,
  Clock,
  Edit2,
  MapPin,
  MicVocal,
  Target,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import { useRehearsalsTab } from "../hooks/useRehearsalsTab";
import type { RehearsalTargetType } from "../types";
import { cn } from "@/shared/lib/utils";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Badge } from "@/shared/ui/primitives/Badge";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { getAvailableTimezones } from "@/shared/lib/time/timezone";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  getLocationLabel,
  isPastProjectDate,
} from "../../lib/projectPresentation";

interface RehearsalsTabProps {
  projectId: string;
}

export const RehearsalsTab = ({
  projectId,
}: RehearsalsTabProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const timezones = getAvailableTimezones();

  const {
    isSubmitting,
    isEditing,
    rehearsalToDelete,
    setRehearsalToDelete,
    isDeleting,
    formData,
    setFormData,
    targetType,
    setTargetType,
    selectedSections,
    customParticipants,
    projectRehearsals,
    projectParticipations,
    artistMap,
    locations,
    handleSubmit,
    handleEditClick,
    handleCancelEdit,
    handleDeleteClick,
    executeDelete,
    toggleSection,
    toggleCustomParticipant,
  } = useRehearsalsTab(projectId);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <form onSubmit={handleSubmit}>
        <GlassCard
          variant="ethereal"
          padding="md"
          isHoverable={false}
          className="flex flex-col gap-6"
        >
          <div className="flex items-center gap-2.5 border-b border-ethereal-incense/10 pb-3">
            <Clock
              size={16}
              className={
                isEditing ? "text-ethereal-crimson" : "text-ethereal-gold"
              }
              aria-hidden="true"
            />
            <Eyebrow color="default">
              {isEditing
                ? t("projects.rehearsals.form.title_edit", "Edytuj próbę")
                : t("projects.rehearsals.form.title", "Zaplanuj nową próbę")}
            </Eyebrow>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Input
              label={t(
                "projects.rehearsals.form.date_time",
                "Data i godzina *",
              )}
              type="datetime-local"
              required
              value={formData.date_time}
              onChange={(event) =>
                setFormData({ ...formData, date_time: event.target.value })
              }
              disabled={isSubmitting}
            />

            <Select
              label={t("projects.rehearsals.form.timezone", "Strefa czasowa *")}
              required
              value={formData.timezone}
              onChange={(event) =>
                setFormData({ ...formData, timezone: event.target.value })
              }
              disabled={isSubmitting}
            >
              {timezones.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone.replace(/_/g, " ")}
                </option>
              ))}
            </Select>

            <Select
              label={t("projects.rehearsals.form.location", "Lokalizacja *")}
              required
              value={formData.location_id}
              onChange={(event) => {
                const nextLocationId = event.target.value;
                const selectedLocation =
                  locations.find(
                    (location) => String(location.id) === nextLocationId,
                  ) ?? null;

                setFormData({
                  ...formData,
                  location_id: nextLocationId,
                  timezone: selectedLocation?.timezone ?? formData.timezone,
                });
              }}
              disabled={isSubmitting}
            >
              <option value="">
                {t(
                  "projects.rehearsals.form.location_placeholder",
                  "Wybierz lokalizację",
                )}
              </option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </div>

          <Textarea
            label={t(
              "projects.rehearsals.form.focus",
              "Plan próby / repertuar (Focus)",
            )}
            rows={2}
            value={formData.focus}
            placeholder={t(
              "projects.rehearsals.form.focus_placeholder",
              "np. Requiem cz. 1-3",
            )}
            onChange={(event) =>
              setFormData({ ...formData, focus: event.target.value })
            }
            disabled={isSubmitting}
          />

          <GlassCard
            variant="light"
            padding="sm"
            isHoverable={false}
            className="overflow-hidden"
          >
            <Eyebrow color="muted" className="mb-4 ml-1">
              {t("projects.rehearsals.form.who", "Kto jest wezwany na próbę?")}
            </Eyebrow>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              {[
                {
                  id: "TUTTI",
                  label: t("projects.rehearsals.form.type_tutti", "Tutti"),
                  icon: <Users size={14} aria-hidden="true" />,
                },
                {
                  id: "SECTIONAL",
                  label: t(
                    "projects.rehearsals.form.type_sectional",
                    "Próba sekcyjna",
                  ),
                  icon: <MicVocal size={14} aria-hidden="true" />,
                },
                {
                  id: "CUSTOM",
                  label: t(
                    "projects.rehearsals.form.type_custom",
                    "Wybrane osoby",
                  ),
                  icon: <UserCheck size={14} aria-hidden="true" />,
                },
              ].map((type) => (
                <Button
                  key={type.id}
                  type="button"
                  variant={targetType === type.id ? "primary" : "ghost"}
                  onClick={() => setTargetType(type.id as RehearsalTargetType)}
                  className="flex-1"
                  leftIcon={type.icon}
                >
                  {type.label}
                </Button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {targetType === "SECTIONAL" && (
                <motion.div
                  key="sectional"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-wrap gap-2 overflow-hidden border-t border-ethereal-incense/10 pt-4"
                >
                  {[
                    {
                      id: "S",
                      label: t(
                        "projects.rehearsals.voices.sopranos",
                        "Soprany",
                      ),
                    },
                    {
                      id: "A",
                      label: t("projects.rehearsals.voices.altos", "Alty"),
                    },
                    {
                      id: "T",
                      label: t("projects.rehearsals.voices.tenors", "Tenory"),
                    },
                    {
                      id: "B",
                      label: t("projects.rehearsals.voices.basses", "Basy"),
                    },
                  ].map((section) => (
                    <Button
                      key={section.id}
                      type="button"
                      variant={
                        selectedSections.includes(section.id)
                          ? "secondary"
                          : "ghost"
                      }
                      size="sm"
                      onClick={() => toggleSection(section.id)}
                    >
                      {section.label}
                    </Button>
                  ))}
                </motion.div>
              )}

              {targetType === "CUSTOM" && (
                <motion.div
                  key="custom"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className=" grid max-h-[200px] grid-cols-1 gap-2 border-t border-ethereal-incense/10 pt-4 sm:grid-cols-2 md:grid-cols-3 overflow-y-auto pr-1"
                >
                  {projectParticipations.map((participation) => {
                    const artist = artistMap.get(String(participation.artist));
                    if (!artist) return null;

                    const isSelected = customParticipants.includes(
                      String(participation.id),
                    );

                    return (
                      <Button
                        key={participation.id}
                        type="button"
                        variant={isSelected ? "primary" : "ghost"}
                        size="sm"
                        fullWidth
                        onClick={() =>
                          toggleCustomParticipant(String(participation.id))
                        }
                        className="justify-between px-3"
                      >
                        <Text size="xs" weight="medium" truncate>
                          {artist.first_name} {artist.last_name}
                        </Text>
                        <Eyebrow color="inherit" className="ml-2 opacity-60">
                          {artist.voice_type_display || artist.voice_type || ""}
                        </Eyebrow>
                      </Button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>

          <div className="flex flex-col items-start justify-between gap-5 pt-3 md:flex-row md:items-center">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-ethereal-marble/50">
              <input
                type="checkbox"
                checked={formData.is_mandatory}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    is_mandatory: event.target.checked,
                  })
                }
                className="h-4 w-4 cursor-pointer rounded border-ethereal-incense/40 text-ethereal-gold focus:ring-ethereal-gold focus:ring-offset-0"
                disabled={isSubmitting}
              />
              <Eyebrow color="default">
                {t(
                  "projects.rehearsals.form.mandatory",
                  "Obecność obowiązkowa",
                )}
              </Eyebrow>
            </label>

            <div className="flex w-full gap-3 md:w-auto">
              {isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  className="w-full md:w-auto"
                >
                  {t("common.actions.cancel", "Anuluj")}
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                className="w-full md:w-auto"
              >
                {isEditing
                  ? t("projects.rehearsals.form.update", "Aktualizuj")
                  : t("projects.rehearsals.form.submit", "Zapisz w kalendarzu")}
              </Button>
            </div>
          </div>
        </GlassCard>
      </form>

      <div className="space-y-4">
        <div className="mb-4 flex items-center gap-2 px-1">
          <Calendar1
            size={16}
            className="text-ethereal-gold"
            aria-hidden="true"
          />
          <Eyebrow color="default">
            {t("projects.rehearsals.list.title", "Harmonogram prób")}
          </Eyebrow>
        </div>

        {projectRehearsals.length > 0 ? (
          projectRehearsals.map((rehearsal) => {
            const isPast = isPastProjectDate(rehearsal.date_time);
            const invitedCount = rehearsal.invited_participations?.length || 0;
            const isTutti =
              invitedCount === 0 ||
              invitedCount === projectParticipations.length;
            const locationLabel = getLocationLabel(rehearsal.location);

            return (
              <GlassCard
                key={rehearsal.id}
                variant="light"
                padding="sm"
                isHoverable={false}
                className={cn("transition-opacity", isPast && "opacity-60")}
              >
                <div className="flex flex-col justify-between gap-5 p-2 md:flex-row md:items-center">
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={isPast ? "neutral" : "warning"}>
                        {formatLocalizedDate(
                          rehearsal.date_time,
                          { day: "numeric", month: "short" },
                          undefined,
                          rehearsal.timezone,
                        )}
                      </Badge>

                      <DualTimeDisplay
                        value={rehearsal.date_time}
                        timeZone={rehearsal.timezone}
                        icon={<Clock size={14} aria-hidden="true" />}
                        containerClassName={cn(
                          "rounded-lg border px-3 py-1.5 shadow-glass-ethereal",
                          isPast
                            ? "border-ethereal-incense/20 bg-ethereal-marble/50 text-ethereal-graphite"
                            : "border-ethereal-gold/20 bg-ethereal-gold/10 text-ethereal-ink",
                        )}
                        primaryTimeClassName="text-sm font-bold tracking-tight"
                        localTimeClassName="ml-2 border-l border-current pl-2 text-[10px] opacity-60"
                      />

                      {isPast && (
                        <Badge variant="neutral">
                          {t(
                            "projects.rehearsals.status.finished",
                            "Zakończona",
                          )}
                        </Badge>
                      )}

                      <Badge variant={isTutti ? "success" : "neutral"}>
                        {isTutti
                          ? t("projects.rehearsals.status.tutti", "TUTTI")
                          : t(
                              "projects.rehearsals.status.invited",
                              "Wezwanych: {{count}}",
                              { count: invitedCount },
                            )}
                      </Badge>

                      {!rehearsal.is_mandatory && (
                        <Badge variant="danger">
                          {t(
                            "projects.rehearsals.status.optional",
                            "Opcjonalna",
                          )}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin
                          size={14}
                          className="text-ethereal-graphite/40"
                          aria-hidden="true"
                        />
                        {rehearsal.location ? (
                          <LocationPreview
                            locationRef={rehearsal.location}
                            variant="minimal"
                            fallback={locationLabel || undefined}
                          />
                        ) : (
                          <Text size="xs" color="muted">
                            {t("common.labels.not_available", "Brak danych")}
                          </Text>
                        )}
                      </div>
                      {rehearsal.focus && (
                        <div className="flex items-start gap-2 pl-0.5">
                          <Target
                            size={14}
                            className="mt-0.5 shrink-0 text-ethereal-gold"
                            aria-hidden="true"
                          />
                          <Text size="xs" className="italic opacity-80">
                            {rehearsal.focus}
                          </Text>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(rehearsal)}
                      title={t("projects.rehearsals.actions.edit", "Edytuj")}
                    >
                      <Edit2 size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(rehearsal.id)}
                      title={t("projects.rehearsals.actions.delete", "Usuń")}
                      className="text-ethereal-crimson hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </GlassCard>
            );
          })
        ) : (
          <GlassCard
            variant="light"
            padding="lg"
            isHoverable={false}
            className="flex flex-col items-center border-dashed text-center"
          >
            <Calendar1
              size={32}
              className="mb-3 opacity-20"
              aria-hidden="true"
            />
            <Eyebrow color="muted">
              {t(
                "projects.rehearsals.empty.no_rehearsals",
                "Brak zaplanowanych prób",
              )}
            </Eyebrow>
          </GlassCard>
        )}
      </div>

      <ConfirmModal
        isOpen={rehearsalToDelete !== null}
        title={t("projects.rehearsals.modal.delete_title", "Usunąć tę próbę?")}
        description={t(
          "projects.rehearsals.modal.delete_desc",
          "Powiązane listy obecności zostaną usunięte bezpowrotnie.",
        )}
        confirmText={t("common.actions.delete", "Usuń")}
        isDestructive={true}
        onConfirm={executeDelete}
        onCancel={() => setRehearsalToDelete(null)}
        isLoading={isDeleting}
      />
    </div>
  );
};
