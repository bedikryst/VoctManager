/**
 * @file AddToCalendar.tsx
 * @description Per-event "add to calendar" control — a small menu offering a
 * Google Calendar template link and an Apple/Outlook .ics download for one
 * rehearsal or concert. The entry is generated client-side (see
 * calendarLinks); a project's block is the one the server resolved for this
 * reader's plan, the same the subscribed feed reserves.
 * @module features/schedule/components/AddToCalendar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, ExternalLink, Download } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useArtistPreview } from "@/app/providers/ArtistPreviewProvider";
import { INERT_SURFACE } from "@/shared/ui/primitives/inertSurface";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import {
  buildGoogleCalendarUrl,
  FALLBACK_DURATION_MINUTES,
  downloadIcs,
  type CalendarEventInput,
} from "@/shared/lib/calendar/calendarLinks";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import type { Project } from "@/shared/types";
import { getEventMomentPresentation } from "@/features/projects/lib/projectPresentation";
import { usePlanStartNote } from "../hooks/usePlanStartNote";
import type { TimelineEvent } from "../types/schedule.dto";

interface AddToCalendarProps {
  event: TimelineEvent;
  /** Surface the trigger sits on, so it contrasts correctly. */
  tone?: "light" | "dark";
  triggerClassName?: string;
  /**
   * `menu` (default) is a single dropdown trigger. `inline` renders the two
   * options as flat buttons — used inside a BottomSheet, where a portalled
   * dropdown would otherwise stack *behind* the sheet.
   */
  layout?: "menu" | "inline";
}

export const AddToCalendar = ({
  event,
  tone = "light",
  triggerClassName,
  layout = "menu",
}: AddToCalendarProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  // Inside a preview both routes would put the singer's rehearsal into the
  // MANAGER's calendar. Nothing is written server-side, but the control would
  // act on the wrong person's diary, so it stays visible and does nothing.
  const { isPreview } = useArtistPreview();

  // The UI title drops the "Próba:" prefix (the badge carries it); the calendar
  // entry re-adds it so the event reads clearly outside the app.
  const project = event.type === "PROJECT" ? (event.rawObj as Project) : null;
  const planStartNote = usePlanStartNote(event.planStart, project);

  const calendarTitle =
    event.type === "REHEARSAL"
      ? `${t("schedule.event.rehearsal_prefix", "Próba:")} ${event.title}`
      : event.title;

  // A project's entry opens where this reader's plan does: the call, or the
  // departure the day before. An entry opening at 14:00 on Saturday says
  // what 14:00 is, where, and when the concert itself is, as the feed's
  // (`_project_description`) does, or the reader takes the opening hour for
  // the downbeat and the entry's location, the concert venue, for the meeting
  // point. Joined by a middle dot: the formatted date carries commas of its own.
  const leadRows: string[] = [];
  if (project) {
    const formatMoment = (value: Date): string =>
      formatLocalizedDate(
        value,
        {
          weekday: "short",
          day: "numeric",
          month: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
        i18n.language,
        project.timezone,
      );
    if (event.planStart && planStartNote) {
      const planStartFacts = [
        planStartNote.title,
        formatMoment(event.planStart.at),
        event.planStart.place,
      ]
        .filter(Boolean)
        .join(" · ");
      leadRows.push(
        `${t("schedule.card.plan_start", "Początek planu:")} ${planStartFacts}`,
      );
    }
    if (event.calendarEntry && event.calendarEntry.start < event.date_time) {
      const moment = getEventMomentPresentation(project.event_kind);
      leadRows.push(
        `${t(moment.labelKey, moment.fallbackLabel)}: ${formatMoment(event.date_time)}`,
      );
    }
  }
  const description = [...leadRows, event.focus || event.description]
    .filter(Boolean)
    .join("\n");

  const input: CalendarEventInput = {
    title: calendarTitle,
    start: event.calendarEntry?.start ?? event.date_time,
    // The conductor's own end where there is one; otherwise the block matching
    // this kind of event, so the button and the season feed reserve the same
    // evening — they used to disagree by an hour on every rehearsal.
    end: event.calendarEntry?.end ?? event.ends_at ?? undefined,
    fallbackDurationMinutes:
      event.type === "REHEARSAL"
        ? FALLBACK_DURATION_MINUTES.rehearsal
        : FALLBACK_DURATION_MINUTES.event,
    description: description || undefined,
    location: event.location?.name,
    uid: event.id,
  };
  const safeName = calendarTitle.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 60);

  const isDark = tone === "dark";

  if (layout === "inline") {
    const darkBtn =
      "border-ethereal-incense/40 bg-ethereal-incense/10 text-ink-on-inverse hover:border-ethereal-gold/50 hover:bg-ethereal-incense/20";
    return (
      <div inert={isPreview} className={cn(isPreview && INERT_SURFACE)}>
        <Eyebrow color={isDark ? "ink-on-inverse-muted" : "muted"} className="mb-1.5 flex items-center gap-1.5">
          <CalendarPlus size={12} aria-hidden="true" />
          {t("schedule.calendar.menu_label", "Zapisz wydarzenie")}
        </Eyebrow>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="touch"
            leftIcon={<ExternalLink size={13} aria-hidden="true" />}
            onClick={() =>
              window.open(
                buildGoogleCalendarUrl(input),
                "_blank",
                "noopener,noreferrer",
              )
            }
            className={cn("w-full sm:w-auto", isDark && darkBtn)}
          >
            {t("schedule.calendar.google", "Google Calendar")}
          </Button>
          <Button
            variant="outline"
            size="touch"
            leftIcon={<Download size={13} aria-hidden="true" />}
            onClick={() => downloadIcs(input, safeName)}
            className={cn("w-full sm:w-auto", isDark && darkBtn)}
          >
            {t("schedule.calendar.ics", "Apple / Outlook (.ics)")}
          </Button>
        </div>
      </div>
    );
  }

  const triggerClasses = cn(
    tone === "dark" &&
      "border-ethereal-incense/40 bg-ethereal-incense/10 text-ink-on-inverse hover:border-ethereal-gold/50 hover:bg-ethereal-incense/20",
    triggerClassName,
  );

  if (isPreview) {
    return (
      <Button
        variant="outline"
        size="sm"
        inert
        leftIcon={<CalendarPlus size={13} aria-hidden="true" />}
        className={cn(triggerClasses, INERT_SURFACE)}
      >
        {t("schedule.calendar.add", "Dodaj do kalendarza")}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<CalendarPlus size={13} aria-hidden="true" />}
          className={triggerClasses}
        >
          {t("schedule.calendar.add", "Dodaj do kalendarza")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>
          {t("schedule.calendar.menu_label", "Zapisz wydarzenie")}
        </DropdownMenuLabel>
        <DropdownMenuItem
          icon={<ExternalLink size={15} aria-hidden="true" />}
          onSelect={() =>
            window.open(
              buildGoogleCalendarUrl(input),
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          {t("schedule.calendar.google", "Google Calendar")}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<Download size={15} aria-hidden="true" />}
          onSelect={() => downloadIcs(input, safeName)}
        >
          {t("schedule.calendar.ics", "Apple / Outlook (.ics)")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
