/**
 * @file ArtistDashboard.tsx
 * @description The chorister's home — a mobile-first "what now" cockpit, not a
 * navigation directory. A single focused column: today's greeting, the next
 * event spotlight (RSVP + concert prep, reused from the calendar so the two can
 * never disagree), the concert you're working toward with your part-readiness,
 * your attendance mirror, and a one-tap toolkit led by an instant Kamerton.
 * @module panel/dashboard/ArtistDashboard
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/app/providers/AuthProvider";
import { useArtistDashboardData } from "./hooks/useArtistDashboardData";

import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

import { NextEventHero } from "@/features/schedule/components/NextEventHero";
import { MyAttendancePanel } from "@/features/schedule/components/MyAttendancePanel";

import { GoalConcertCard } from "./components/GoalConcertCard";
import { ArtistQuickTools } from "./components/ArtistQuickTools";
import { ArtistEmptyState } from "./components/ArtistEmptyState";
import { DashboardErrorState } from "./components/DashboardErrorState";
import { UnreadMessagesAlert } from "./components/UnreadMessagesAlert";
import { WelcomeMoment } from "./components/WelcomeMoment";

export default function ArtistDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();

  const {
    isLoading,
    isError,
    refetch,
    nextEvent,
    goalConcert,
    attendanceStats,
    handleAbsenceSubmit,
    greeting,
    firstNameVocative,
  } = useArtistDashboardData(user?.artist_profile_id ?? undefined);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <EtherealLoader
          message={t("dashboard.shared.syncing", "Strojenie Rezonansu...")}
        />
      </div>
    );
  }

  if (isError) {
    return <DashboardErrorState onRetry={refetch} />;
  }

  const highlight =
    user?.profile?.language === "pl" && firstNameVocative
      ? firstNameVocative
      : user?.first_name || t("common.artist_generic", "Artysty");

  const todayLabel = formatLocalizedDate(
    new Date(),
    { weekday: "long", day: "numeric", month: "long" },
    undefined,
    user?.profile?.timezone,
  );

  // The concert you're rehearsing toward only earns its own strip when the next
  // event isn't already that concert (the hero would otherwise say it twice).
  const showGoalStrip = Boolean(
    goalConcert && (!nextEvent || nextEvent.id !== goalConcert.id),
  );

  return (
    <PageTransition>
      {/* No own horizontal padding — the app shell provides the gutter. A single
          centred column, mobile-first; the calendar and "Moja Karta" share it. */}
      <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-6 pt-4 sm:pt-6">
        <PageHeader
          size="standard"
          className="!mb-0"
          roleText={todayLabel}
          title={greeting}
          titleHighlight={highlight}
        />

        <WelcomeMoment name={highlight} />

        <UnreadMessagesAlert />

        {nextEvent ? (
          <NextEventHero event={nextEvent} onSubmitReport={handleAbsenceSubmit} />
        ) : (
          <ArtistEmptyState />
        )}

        {showGoalStrip && goalConcert && <GoalConcertCard event={goalConcert} />}

        {attendanceStats.rate !== null && (
          <MyAttendancePanel stats={attendanceStats} />
        )}

        <ArtistQuickTools />
      </div>
    </PageTransition>
  );
}
