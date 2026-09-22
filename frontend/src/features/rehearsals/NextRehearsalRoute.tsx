/**
 * @file NextRehearsalRoute.tsx
 * @description A stable address for "the evening I am walking into" — the one
 * the home-screen shortcut can point at, since the rehearsal's own URL carries
 * an id that changes every week.
 *
 * It resolves and steps aside: the next rehearsal this reader is called to
 * becomes a replacing navigation to that evening's page, so the back gesture
 * returns to whatever came before the shortcut rather than to this route. With
 * no evening ahead — an empty season, or a reader with no seat — the schedule
 * is the honest landing, and it says so itself.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { useScheduleData } from "@/features/schedule/hooks/useScheduleData";
import { useScheduleSubject } from "@/features/schedule/hooks/useScheduleSubject";

/** An evening counts as ahead by the same four-hour grace the schedule's two
 *  tabs divide on — a rehearsal that started an hour ago is still the one the
 *  shortcut is being tapped for. */
const PAST_GRACE_MS = 4 * 60 * 60 * 1000;

export default function NextRehearsalRoute(): React.JSX.Element {
  const { t } = useTranslation();
  const subject = useScheduleSubject();
  const { allEvents, isLoading } = useScheduleData(subject);

  if (isLoading) {
    return (
      <EtherealLoader
        message={t("schedule.rehearsal.next.resolving", "Szukam najbliższej próby...")}
      />
    );
  }

  const threshold = Date.now() - PAST_GRACE_MS;
  const next = allEvents
    .filter(
      (event) =>
        event.type === "REHEARSAL" &&
        !isNaN(event.date_time.getTime()) &&
        event.date_time.getTime() >= threshold,
    )
    .sort((left, right) => left.date_time.getTime() - right.date_time.getTime())[0];

  if (!next) return <Navigate to="/panel/schedule" replace />;

  return (
    <Navigate
      to={`/panel/schedule/rehearsal/${String((next.rawObj as { id: string }).id)}`}
      replace
    />
  );
}
