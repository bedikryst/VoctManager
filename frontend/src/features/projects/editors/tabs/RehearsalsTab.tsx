/**
 * @file RehearsalsTab.tsx
 * @description Rehearsal-scheduling console: a compose form (left) paired with the live
 * schedule (right) so a conductor adds a session and sees it land in the calendar without
 * leaving the view. Two columns on desktop, a single stacked scroll on tablet/phone. The
 * schedule is height-capped with internal scroll so it never runs the page off the screen.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/RehearsalsTab
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
import { AutosaveStatus } from "@/shared/ui/composites/AutosaveStatus";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { getAvailableTimezones } from "@/shared/lib/time/timezone";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
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
    <>
      <div className="grid w-full grid-cols-1 gap-6 pb-12 lg:grid-cols-12 lg:items-start">
        {/* ── Compose form ─────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="lg:col-span-5">
          <GlassCard
            variant="solid"
            padding="md"
            isHoverable={false}
            contentClassName="gap-5"
          >
            <div className="flex items-center gap-2.5 border-b border-ethereal-ink/6 pb-3">
              <Clock
                size={16}
                className={
                  isEditing ? "text-ethereal-amethyst" : "text-ethereal-gold"
                }
                aria-hidden="true"
              />
              <Eyebrow color="default">
                {isEditing
                  ? t("projects.rehearsals.form.title_edit", "Edytuj próbę")
                  : t("projects.rehearsals.form.title", "Zaplanuj nową próbę")}
              </Eyebrow>
            </div>

            <Input
              label={t("projects.rehearsals.form.date_time", "Data i godzina *")}
              type="datetime-local"
              required
              value={formData.date_time}
              onChange={(event) =>
                setFormData({ ...formData, date_time: event.target.value })
              }
              disabled={isSubmitting}
            />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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

              <div className="mb-4 flex flex-col gap-2">
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
                    fullWidth
                    className="justify-start"
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
                    className="flex flex-wrap gap-2 overflow-hidden border-t border-ethereal-ink/6 pt-4"
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
                    className="grid max-h-50 grid-cols-1 gap-2 overflow-y-auto border-t border-ethereal-ink/6 pr-1 pt-4 sm:grid-cols-2"
                  >
                    {projectParticipations.map((participation) => {
                      const artist = artistMap.get(String(participation.artist));
                      if (!artist) return null;

                      const isSelected = customParticipants.includes(
                        String(participation.id),
                      );

                      return (
                        <button
                          key={participation.id}
                          type="button"
                          onClick={() =>
                            toggleCustomParticipant(String(participation.id))
                          }
                          aria-pressed={isSelected}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                            isSelected
                              ? "border-ethereal-gold/40 bg-ethereal-gold/15"
                              : "border-ethereal-ink/8 bg-ethereal-marble hover:border-ethereal-gold/30",
                          )}
                        >
                          <Text
                            as="span"
                            size="xs"
                            weight="medium"
                            truncate
                            color={isSelected ? "default" : "graphite"}
                          >
                            {artist.first_name} {artist.last_name}
                          </Text>
                          <Eyebrow
                            as="span"
                            color={isSelected ? "gold" : "incense-muted"}
                            className="shrink-0"
                          >
                            {artist.voice_type
                              ? t(`dashboard.layout.roles.${artist.voice_type}`)
                              : artist.voice_type_display ||
                                artist.voice_type ||
                                ""}
                          </Eyebrow>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>

            <div className="flex flex-col items-start justify-between gap-4 border-t border-ethereal-ink/6 pt-4 md:flex-row md:items-center">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-1 py-1.5 transition-colors hover:bg-ethereal-alabaster/60">
                <Checkbox
                  checked={formData.is_mandatory}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      is_mandatory: event.target.checked,
                    })
                  }
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
                    : t(
                        "projects.rehearsals.form.submit",
                        "Zapisz w kalendarzu",
                      )}
                </Button>
              </div>
            </div>
          </GlassCard>
        </form>

        {/* ── Live schedule ────────────────────────────────────────────── */}
        <GlassCard
          variant="solid"
          padding="none"
          isHoverable={false}
          className="flex max-h-[78dvh] flex-col lg:col-span-7"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ethereal-ink/6 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <Calendar1
                size={15}
                className="text-ethereal-gold/70"
                aria-hidden="true"
              />
              <Eyebrow as="h2" color="graphite">
                {t("projects.rehearsals.list.title", "Harmonogram prób")}
              </Eyebrow>
            </div>
            {projectRehearsals.length > 0 && (
              <Badge variant="neutral">{projectRehearsals.length}</Badge>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {projectRehearsals.length > 0 ? (
              <ul className="divide-y divide-ethereal-ink/6">
                {projectRehearsals.map((rehearsal) => {
                  const isPast = isPastProjectDate(rehearsal.date_time);
                  const invitedCount =
                    rehearsal.invited_participations?.length || 0;
                  const isTutti =
                    invitedCount === 0 ||
                    invitedCount === projectParticipations.length;
                  const locationLabel = getLocationLabel(rehearsal.location);

                  return (
                    <li
                      key={rehearsal.id}
                      className={cn(
                        "flex flex-col justify-between gap-4 p-4 transition-opacity md:flex-row md:items-start",
                        isPast && "opacity-60",
                      )}
                    >
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="neutral">
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
                              "rounded-lg border px-3 py-1.5",
                              isPast
                                ? "border-ethereal-ink/8 bg-ethereal-marble text-ethereal-graphite"
                                : "border-ethereal-gold/25 bg-ethereal-gold/10 text-ethereal-ink",
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
                            <Badge variant="neutral">
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
                              <Text size="sm" color="graphite" className="italic">
                                {rehearsal.focus}
                              </Text>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(rehearsal)}
                          title={t("projects.rehearsals.actions.edit", "Edytuj")}
                          aria-label={t(
                            "projects.rehearsals.actions.edit",
                            "Edytuj",
                          )}
                        >
                          <Edit2 size={16} aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(rehearsal.id)}
                          title={t("projects.rehearsals.actions.delete", "Usuń")}
                          aria-label={t(
                            "projects.rehearsals.actions.delete",
                            "Usuń",
                          )}
                          className="text-ethereal-crimson hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <Calendar1
                  size={28}
                  className="text-ethereal-incense/30"
                  aria-hidden="true"
                />
                <Eyebrow color="muted">
                  {t(
                    "projects.rehearsals.empty.no_rehearsals",
                    "Brak zaplanowanych prób",
                  )}
                </Eyebrow>
              </div>
            )}
          </div>
        </GlassCard>
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

      <AutosaveStatus isSaving={isSubmitting || isDeleting} />
    </>
  );
};
