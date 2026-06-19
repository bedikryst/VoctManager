/**
 * @file AddToCalendar.tsx
 * @description Per-event "add to calendar" control — a small menu offering a
 * Google Calendar template link and an Apple/Outlook .ics download for one
 * rehearsal or concert. Generated entirely client-side (see calendarLinks).
 * @module features/schedule/components/AddToCalendar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, ExternalLink, Download } from "lucide-react";

import { cn } from "@/shared/lib/utils";
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
  downloadIcs,
  type CalendarEventInput,
} from "@/shared/lib/calendar/calendarLinks";
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
  const { t } = useTranslation();

  // The UI title drops the "Próba:" prefix (the badge carries it); the calendar
  // entry re-adds it so the event reads clearly outside the app.
  const calendarTitle =
    event.type === "REHEARSAL"
      ? `${t("schedule.event.rehearsal_prefix", "Próba:")} ${event.title}`
      : event.title;
  const input: CalendarEventInput = {
    title: calendarTitle,
    start: event.date_time,
    description: event.focus || event.description || undefined,
    location: event.location?.name,
    uid: event.id,
  };
  const safeName = calendarTitle.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 60);

  const isDark = tone === "dark";

  if (layout === "inline") {
    const darkBtn =
      "border-ethereal-incense/40 bg-ethereal-incense/10 text-ethereal-parchment hover:border-ethereal-gold/50 hover:bg-ethereal-incense/20";
    return (
      <div>
        <Eyebrow color={isDark ? "parchment-muted" : "muted"} className="mb-1.5 flex items-center gap-1.5">
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<CalendarPlus size={13} aria-hidden="true" />}
          className={cn(
            tone === "dark" &&
              "border-ethereal-incense/40 bg-ethereal-incense/10 text-ethereal-parchment hover:border-ethereal-gold/50 hover:bg-ethereal-incense/20",
            triggerClassName,
          )}
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
