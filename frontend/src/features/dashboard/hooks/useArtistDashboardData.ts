/**
 * @file useArtistDashboardData.ts
 * @description Home-screen read model for the chorister. Sourced from the
 * server-joined schedule dashboard — the SAME CQRS read model the calendar uses
 * — instead of the former five-collection client-side join. So "what's next",
 * the RSVP and the attendance mirror are computed once and never drift between
 * /panel and /panel/schedule.
 * @module panel/dashboard/hooks/useArtistDashboardData
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { artistKeys } from "@/features/artists/api/artist.queries";
import { ArtistService } from "@/features/artists/api/artist.service";
import { useScheduleData } from "@/features/schedule/hooks/useScheduleData";
import { useScheduleDashboard } from "@/features/schedule/api/schedule.queries";
import type { TimelineEvent } from "@/features/schedule/types/schedule.dto";

const ANONYMOUS_ARTIST_QUERY_ID = "anonymous";
const WORKSPACE_STALE_TIME = 1000 * 60 * 5;

export const useArtistDashboardData = (artistId?: string | number) => {
  const { t } = useTranslation();

  // One server-joined read model, shared with /panel/schedule: the home hero,
  // RSVP and attendance mirror can never disagree with the calendar.
  const { isLoading, filteredEvents, attendanceStats, handleAbsenceSubmit } =
    useScheduleData(artistId);

  // Same query key → React Query dedupes this; it only surfaces error/refetch
  // for the page shell (useScheduleData swallows both).
  const { isError, refetch: refetchSchedule } = useScheduleDashboard(artistId);

  const { data: artistProfile, refetch: refetchProfile } = useQuery({
    queryKey: artistKeys.artists.details(artistId ?? ANONYMOUS_ARTIST_QUERY_ID),
    queryFn: () => ArtistService.getById(artistId!),
    enabled: !!artistId,
    staleTime: WORKSPACE_STALE_TIME,
  });

  // The very next thing on the horizon — keeps the hero spotlight.
  const nextEvent: TimelineEvent | null = filteredEvents[0] ?? null;

  // The concert the chorister is working toward — the first upcoming PROJECT.
  // When the next event already *is* that concert, the hero covers it and the
  // consumer suppresses the "goal" strip to avoid saying it twice.
  const goalConcert = useMemo<TimelineEvent | null>(
    () => filteredEvents.find((event) => event.type === "PROJECT") ?? null,
    [filteredEvents],
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) return t("dashboard.artist.greeting_night", "Dobrej nocy");
    if (hour < 12) return t("dashboard.artist.greeting_morning", "Dzień dobry");
    if (hour < 18)
      return t("dashboard.artist.greeting_afternoon", "Dobrego popołudnia");
    return t("dashboard.artist.greeting_evening", "Dobry wieczór");
  }, [t]);

  const refetch = (): void => {
    void refetchSchedule();
    void refetchProfile();
  };

  return {
    isLoading,
    isError,
    refetch,
    nextEvent,
    goalConcert,
    attendanceStats,
    handleAbsenceSubmit,
    greeting,
    firstNameVocative: artistProfile?.first_name_vocative ?? null,
  };
};
