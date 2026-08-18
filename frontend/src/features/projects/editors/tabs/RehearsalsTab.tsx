/**
 * @file RehearsalsTab.tsx
 * @description Rehearsal-scheduling console: a compose form (left) paired with the
 * project's runway to the concert (right), so a conductor adds a session and sees
 * it land in the schedule without leaving the view. Two columns on desktop, a
 * single stacked scroll on tablet/phone. The schedule is height-capped with
 * internal scroll so it never runs the page off the screen.
 * The form asks four things and states one (the timezone, which follows the room
 * it was booked in); everything else it used to ask was a control competing with
 * the only action on the card.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/RehearsalsTab
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { formatInTimeZone } from "date-fns-tz";
import {
  CalendarClock,
  CalendarRange,
  MapPin,
  MicVocal,
  UserCheck,
  Users,
} from "lucide-react";

import { useRehearsalsTab } from "../hooks/useRehearsalsTab";
import { getEventMomentPresentation } from "../../lib/projectPresentation";
import type { RehearsalTargetType } from "../types";
import { RehearsalTimelineRow } from "./components/RehearsalTimelineRow";
import { cn } from "@/shared/lib/utils";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { AutosaveStatus } from "@/shared/ui/composites/AutosaveStatus";
import { Button } from "@/shared/ui/primitives/Button";
import {
  DateTimeField,
  type CalendarMarker,
} from "@/shared/ui/composites/DateTimeField";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { TogglePill } from "../../components/TogglePill";
import { TimezoneField } from "../../components/TimezoneField";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

/** Weeknight rehearsals are the house pattern; the picker only proposes it. */
const REHEARSAL_DEFAULT_TIME = "18:00";
const DEFAULT_TIMEZONE = "Europe/Warsaw";

interface RehearsalsTabProps {
  projectId: string;
}

export const RehearsalsTab = ({
  projectId,
}: RehearsalsTabProps): React.JSX.Element | null => {
  const { t } = useTranslation();

  const {
    isSubmitting,
    editingRehearsal,
    rehearsalToDelete,
    setRehearsalToDelete,
    isDeleting,
    formData,
    setFormData,
    targetType,
    setTargetType,
    selectedSections,
    customParticipants,
    invitedCount,
    project,
    projectRehearsals,
    upcomingTimeline,
    pastTimeline,
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

  const isEditing = editingRehearsal !== null;

  /* Only a named call can be empty by mistake. Tutti names nobody on purpose —
     flagging it gold would make the ordinary case look like an error. */
  const isCallEmpty = targetType !== "TUTTI" && invitedCount === 0;

  // The day the runway leads to, named for what the ensemble is singing at: it
  // marks the calendar and closes the timeline, and both must say the same word.
  const eventMomentLabel = getEventMomentPresentation(project?.event_kind);
  const eventMoment = t(
    eventMomentLabel.labelKey,
    eventMomentLabel.fallbackLabel,
  );

  /**
   * What the project already occupies, in the timezone each entry was booked
   * in — a rehearsal stored as an instant is only "the 14th" when read back
   * through the room's own zone.
   */
  const calendarMarkers = useMemo<CalendarMarker[]>(() => {
    const markers: CalendarMarker[] = [];

    if (project?.date_time) {
      markers.push({
        date: formatInTimeZone(
          new Date(project.date_time),
          project.timezone || DEFAULT_TIMEZONE,
          "yyyy-MM-dd",
        ),
        tone: "gold",
        label: eventMoment,
      });
    }

    projectRehearsals.forEach((rehearsal) => {
      // The session being edited is the one moving; marking its current day
      // would read as a clash with itself.
      if (editingRehearsal && rehearsal.id === editingRehearsal.id) {
        return;
      }

      markers.push({
        date: formatInTimeZone(
          new Date(rehearsal.date_time),
          rehearsal.timezone || DEFAULT_TIMEZONE,
          "yyyy-MM-dd",
        ),
        tone: "sage",
        label: t("projects.rehearsals.markers.rehearsal", "Próba"),
      });
    });

    return markers;
  }, [
    editingRehearsal,
    eventMoment,
    project?.date_time,
    project?.timezone,
    projectRehearsals,
    t,
  ]);

  const targetOptions: readonly SegmentedTabItem<RehearsalTargetType>[] = [
    {
      id: "TUTTI",
      label: t("projects.rehearsals.form.type_tutti", "Tutti"),
      Icon: Users,
    },
    {
      id: "SECTIONAL",
      label: t("projects.rehearsals.form.type_sectional", "Sekcyjna"),
      Icon: MicVocal,
    },
    {
      id: "CUSTOM",
      label: t("projects.rehearsals.form.type_custom", "Wybrani"),
      Icon: UserCheck,
    },
  ];

  const voiceSections = [
    { id: "S", label: t("projects.rehearsals.voices.sopranos", "Soprany") },
    { id: "A", label: t("projects.rehearsals.voices.altos", "Alty") },
    { id: "T", label: t("projects.rehearsals.voices.tenors", "Tenory") },
    { id: "B", label: t("projects.rehearsals.voices.basses", "Basy") },
  ];

  const nextUpcomingKey = upcomingTimeline.find(
    (entry) => entry.rehearsal !== null,
  )?.key;

  const concertTitle = project?.title ?? "";

  const renderTimeline = (
    entries: typeof upcomingTimeline,
    isPast: boolean,
  ): React.JSX.Element => (
    <ul className="divide-y divide-hairline">
      {entries.map((entry) => (
        <RehearsalTimelineRow
          key={entry.key}
          entry={entry}
          castSize={projectParticipations.length}
          isNext={!isPast && entry.key === nextUpcomingKey}
          isEditing={
            entry.rehearsal !== null &&
            entry.key === String(editingRehearsal?.id)
          }
          isPast={isPast}
          concertTitle={concertTitle}
          eventMoment={eventMoment}
          onEdit={() => {
            if (entry.rehearsal) handleEditClick(entry.rehearsal);
          }}
          onDelete={() => {
            if (entry.rehearsal) handleDeleteClick(entry.rehearsal.id);
          }}
        />
      ))}
    </ul>
  );

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-6 pb-12 lg:grid-cols-12 lg:items-start">
        {/* ── Compose form ─────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="lg:col-span-5">
          <SectionCard
            as="h2"
            bodyClassName="gap-5"
            icon={
              <CalendarClock
                size={15}
                className={
                  isEditing ? "text-ethereal-amethyst" : "text-ethereal-gold"
                }
                aria-hidden="true"
              />
            }
            title={
              isEditing
                ? t("projects.rehearsals.form.title_edit", "Edytuj próbę")
                : t("projects.rehearsals.form.title", "Zaplanuj nową próbę")
            }
            // Which session is on the bench. "Edit mode" alone is not enough
            // when the row being edited sits in the other column.
            action={
              editingRehearsal ? (
                <Badge variant="amethyst">
                  {formatLocalizedDate(
                    editingRehearsal.date_time,
                    { day: "numeric", month: "short" },
                    undefined,
                    editingRehearsal.timezone,
                  )}
                </Badge>
              ) : undefined
            }
            footer={
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2.5 self-start rounded-control px-1.5 py-1 transition-colors hover:bg-ethereal-ink/3">
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
                  <Text as="span" size="sm" color="graphite">
                    {t(
                      "projects.rehearsals.form.mandatory",
                      "Obecność obowiązkowa",
                    )}
                  </Text>
                </label>

                <div className="flex gap-2">
                  {isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      disabled={isSubmitting}
                      className="flex-1 sm:flex-none"
                    >
                      {t("common.actions.cancel", "Anuluj")}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    className="flex-1 sm:flex-none"
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
            }
          >
            <DateTimeField
              label={t("projects.rehearsals.form.date_time", "Data i godzina *")}
              required
              value={formData.date_time}
              onChange={(date_time) => setFormData({ ...formData, date_time })}
              disabled={isSubmitting}
              // The runway in the other column, folded into the month itself:
              // what the conductor needs while picking a date is which days the
              // project already occupies.
              markers={calendarMarkers}
              defaultTime={REHEARSAL_DEFAULT_TIME}
            />

            <Select
              label={t("projects.rehearsals.form.location", "Sala próby *")}
              required
              leftIcon={<MapPin aria-hidden="true" />}
              value={formData.location_id}
              onValueChange={(nextLocationId) => {
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
              placeholder={t(
                "projects.rehearsals.form.location_placeholder",
                "Wybierz salę",
              )}
              options={locations.map((location) => ({
                value: String(location.id),
                label: location.name,
              }))}
            />

            <TimezoneField
              timezone={formData.timezone}
              onChange={(timezone) => setFormData({ ...formData, timezone })}
              disabled={isSubmitting}
            />

            <Textarea
              label={t(
                "projects.rehearsals.form.focus",
                "Plan próby / repertuar",
              )}
              rows={3}
              value={formData.focus}
              placeholder={t(
                "projects.rehearsals.form.focus_placeholder",
                "np. Requiem cz. 1–3",
              )}
              onChange={(event) =>
                setFormData({ ...formData, focus: event.target.value })
              }
              disabled={isSubmitting}
            />

            {/* No second surface for this group: a card inside a card is what
                made the form read as two stacked panels. A hairline and an
                overline carry the same division for a tenth of the ink. */}
            <div className="flex flex-col gap-3 border-t border-hairline pt-5">
              <Eyebrow color="muted">
                {t("projects.rehearsals.form.who", "Kto jest wezwany?")}
              </Eyebrow>

              <SegmentedTabs
                wrap
                items={targetOptions}
                value={targetType}
                onChange={setTargetType}
                ariaLabel={t(
                  "projects.rehearsals.form.who",
                  "Kto jest wezwany?",
                )}
              />

              <div className="flex items-center gap-1.5 pl-1">
                <Users
                  size={12}
                  className={cn(
                    "shrink-0",
                    isCallEmpty
                      ? "text-ethereal-gold"
                      : "text-ethereal-graphite/40",
                  )}
                  aria-hidden="true"
                />
                <Caption color={isCallEmpty ? "gold" : "muted"}>
                  {targetType === "TUTTI"
                    ? invitedCount === 0
                      ? t(
                          "projects.rehearsals.status.tutti_empty_cast",
                          "Cały zespół — obsada dołączy później",
                        )
                      : t(
                          "projects.rehearsals.status.tutti_count",
                          "Cały zespół — obecnie {{count}} os.",
                          { count: invitedCount },
                        )
                    : t(
                        "projects.rehearsals.status.invited",
                        "Wezwanych: {{count}}",
                        { count: invitedCount },
                      )}
                </Caption>
              </div>

              <AnimatePresence mode="wait">
                {targetType === "SECTIONAL" && (
                  <motion.div
                    key="sectional"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex flex-wrap gap-2 border-t border-hairline pt-4"
                  >
                    {voiceSections.map((section) => (
                      <TogglePill
                        key={section.id}
                        label={section.label}
                        active={selectedSections.includes(section.id)}
                        onChange={() => toggleSection(section.id)}
                        disabled={isSubmitting}
                      />
                    ))}
                  </motion.div>
                )}

                {targetType === "CUSTOM" && (
                  <motion.div
                    key="custom"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="grid max-h-50 grid-cols-1 gap-2 overflow-y-auto border-t border-hairline pr-1 pt-4 sm:grid-cols-2"
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
                            "flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                            isSelected
                              ? "border-ethereal-gold/40 bg-ethereal-gold/15"
                              : "border-hairline-strong bg-ethereal-marble hover:border-ethereal-gold/30",
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
                            size="overline-sm"
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
            </div>
          </SectionCard>
        </form>

        {/* ── The runway ───────────────────────────────────────────────── */}
        <SectionCard
          as="h2"
          scroll
          className="max-h-[78dvh] lg:col-span-7"
          bodyClassName="p-0"
          icon={<CalendarRange size={15} aria-hidden="true" />}
          title={t("projects.rehearsals.list.title", "Harmonogram prób")}
          action={
            projectRehearsals.length > 0 ? (
              <Badge variant="neutral">{projectRehearsals.length}</Badge>
            ) : undefined
          }
        >
          {projectRehearsals.length > 0 ? (
            <>
              {upcomingTimeline.length > 0 && (
                <section>
                  <TimelineGroupHeader
                    label={t(
                      "projects.rehearsals.list.group_upcoming",
                      "Najbliższe",
                    )}
                  />
                  {renderTimeline(upcomingTimeline, false)}
                </section>
              )}

              {pastTimeline.length > 0 && (
                <section>
                  <TimelineGroupHeader
                    label={t("projects.rehearsals.list.group_past", "Zakończone")}
                  />
                  {renderTimeline(pastTimeline, true)}
                </section>
              )}
            </>
          ) : (
            <StatePanel
              variant="inline"
              className="px-6 py-12"
              icon={<CalendarRange size={24} aria-hidden="true" />}
              title={t(
                "projects.rehearsals.empty.no_rehearsals",
                "Brak zaplanowanych prób",
              )}
              description={t(
                "projects.rehearsals.empty.no_rehearsals_desc",
                "Pierwsza zapisana próba pojawi się w tym harmonogramie, przed datą wydarzenia.",
              )}
            />
          )}
        </SectionCard>
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

/**
 * Sticky inside the card's own scroll region, so a long record never leaves the
 * reader guessing which side of "now" they are looking at.
 */
const TimelineGroupHeader = ({
  label,
}: {
  readonly label: string;
}): React.JSX.Element => (
  <div className="sticky top-0 z-10 border-b border-hairline bg-ethereal-alabaster/92 px-5 py-2 backdrop-blur-sm">
    <Eyebrow size="overline-sm" color="muted">
      {label}
    </Eyebrow>
  </div>
);
