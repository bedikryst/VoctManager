/**
 * @file LogisticsEventRow.tsx
 * @description Upcoming-event row for the command rail. A calendar chip tinted
 * by imminence, the concert/rehearsal title and its venue. Clicking flies the
 * atlas to the venue and opens its dossier (events without coordinates are
 * inert but still listed so nothing silently disappears).
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LogisticsEventRow
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { MapPin, Music, Repeat } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import {
  daysUntil,
  getImminenceDefinition,
} from "../constants/eventImminence";
import type { LogisticsEvent } from "../hooks/useLogisticsEvents";

interface LogisticsEventRowProps {
  event: LogisticsEvent;
  isActive: boolean;
  onSelect: (locationId: string) => void;
}

const formatRelativeDay = (date: Date, t: TFunction): string => {
  const diff = daysUntil(date);
  if (diff <= 0) return t("logistics.imminence.today", "Dziś");
  if (diff === 1) return t("logistics.timezone.tomorrow", "Jutro");
  if (diff <= 7)
    return t("logistics.timezone.in_days", "za {{count}} dni", { count: diff });
  return "";
};

const LogisticsEventRowComponent = ({
  event,
  isActive,
  onSelect,
}: LogisticsEventRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const imminence = getImminenceDefinition(event.imminence);
  const TypeIcon = event.type === "CONCERT" ? Music : Repeat;
  const dayNumber = new Intl.DateTimeFormat("pl-PL", { day: "numeric" }).format(
    event.date,
  );
  const monthShort = new Intl.DateTimeFormat("pl-PL", { month: "short" })
    .format(event.date)
    .replace(".", "");
  const relative = formatRelativeDay(event.date, t);
  const isClickable = Boolean(event.locationId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-pressed={isClickable ? isActive : undefined}
      onClick={() => isClickable && onSelect(event.locationId as string)}
      onKeyDown={(domEvent) => {
        if (!isClickable) return;
        if (domEvent.key === "Enter" || domEvent.key === " ") {
          domEvent.preventDefault();
          onSelect(event.locationId as string);
        }
      }}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
        isClickable && "cursor-pointer",
        isActive
          ? "border-ethereal-gold/45 bg-ethereal-gold/[0.06] ring-1 ring-ethereal-gold/25"
          : "border-ethereal-ink/8 bg-ethereal-alabaster hover:border-ethereal-gold/30",
      )}
    >
      <div
        className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border tabular-nums"
        style={{
          borderColor: imminence.marker,
          backgroundColor: "color-mix(in srgb, var(--color-ethereal-marble) 88%, transparent)",
        }}
        aria-hidden="true"
      >
        <span
          className="text-base font-semibold leading-none text-ethereal-ink"
        >
          {dayNumber}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wider text-ethereal-graphite/70">
          {monthShort}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <TypeIcon
            size={12}
            strokeWidth={1.75}
            aria-hidden="true"
            style={{ color: imminence.marker }}
            className="shrink-0"
          />
          <Eyebrow color="muted">
            {event.type === "CONCERT"
              ? t("logistics.event.concert", "Koncert")
              : t("logistics.event.rehearsal", "Próba")}
          </Eyebrow>
        </div>
        <Text
          as="p"
          size="sm"
          weight="semibold"
          truncate
          className="mt-0.5 text-ethereal-ink"
        >
          {event.title}
        </Text>
        <Caption color="muted" truncate className="mt-0.5 flex items-center gap-1">
          <MapPin size={10} aria-hidden="true" className="shrink-0" />
          {event.location?.name ??
            t("logistics.event.no_venue", "Bez lokacji")}
        </Caption>
      </div>

      {relative && (
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              imminence.pulse && "animate-pulse",
            )}
            style={{ backgroundColor: imminence.marker }}
            aria-hidden="true"
          />
          <Text
            as="span"
            size="xs"
            weight="semibold"
            className="whitespace-nowrap text-ethereal-graphite"
          >
            {relative}
          </Text>
        </div>
      )}
    </motion.div>
  );
};

export const LogisticsEventRow = React.memo(LogisticsEventRowComponent);
LogisticsEventRow.displayName = "LogisticsEventRow";
