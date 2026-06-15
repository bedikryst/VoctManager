/**
 * @file useLogisticsEvents.ts
 * @description Joins concerts (projects) and rehearsals against the full
 * location records so the atlas can plot *when & where* the ensemble moves —
 * not just a static venue address book. The inline LocationSnippet on
 * project/rehearsal payloads omits coordinates, so we resolve the full
 * LocationDto (with lat/lng) by id here, entirely client-side — zero backend.
 *
 * Derives: upcoming event feed, per-venue activity (for the dossier), a live
 * timezone roster (world-clock band) and headline schedule metrics.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/hooks/useLogisticsEvents
 */

import { useMemo } from "react";

import type { Project, Rehearsal } from "@/shared/types";
import { PROJECT_STATUS } from "@/features/projects/constants/projectDomain";

import {
  useLogisticsProjects,
  useLogisticsRehearsals,
} from "../api/logistics.queries";
import {
  type EventImminence,
  resolveImminence,
} from "../constants/eventImminence";
import type { LocationDto } from "../types/logistics.dto";

export type LogisticsEventType = "CONCERT" | "REHEARSAL";

export interface LogisticsEvent {
  id: string;
  type: LogisticsEventType;
  title: string;
  /** Secondary line — project title for a rehearsal, or the rehearsal focus. */
  subtitle: string | null;
  date: Date;
  timezone: string;
  projectId: string;
  locationId: string | null;
  /** Full record (carries coordinates) resolved from the location dictionary. */
  location: LocationDto | null;
  isMandatory: boolean;
  imminence: EventImminence;
}

export interface VenueActivity {
  upcoming: LogisticsEvent[];
  past: LogisticsEvent[];
  nextEvent: LogisticsEvent | null;
}

export interface TimezoneClock {
  timezone: string;
  city: string;
  venueCount: number;
  nextEvent: LogisticsEvent | null;
}

export interface LogisticsScheduleMetrics {
  upcomingCount: number;
  todayCount: number;
  weekCount: number;
  liveVenues: number;
}

const tzCity = (timezone: string): string => {
  if (!timezone) return "—";
  const tail = timezone.split("/").pop() ?? timezone;
  return tail.replace(/_/g, " ");
};

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

export interface UseLogisticsEventsResult {
  events: LogisticsEvent[];
  upcomingEvents: LogisticsEvent[];
  venueActivity: Map<string, VenueActivity>;
  timezoneClocks: TimezoneClock[];
  scheduleMetrics: LogisticsScheduleMetrics;
}

export const useLogisticsEvents = (
  locations: LocationDto[],
): UseLogisticsEventsResult => {
  const { data: projects } = useLogisticsProjects();
  const { data: rehearsals } = useLogisticsRehearsals();

  const locationMap = useMemo(() => {
    const map = new Map<string, LocationDto>();
    locations.forEach((location) => map.set(String(location.id), location));
    return map;
  }, [locations]);

  const events = useMemo<LogisticsEvent[]>(() => {
    const now = new Date();
    const projectTitleById = new Map<string, string>();
    const collected: LogisticsEvent[] = [];

    (projects ?? []).forEach((project: Project) => {
      projectTitleById.set(String(project.id), project.title);
      if (project.status === PROJECT_STATUS.CANCELLED) return;

      const date = new Date(project.date_time);
      if (!isValidDate(date)) return;

      const locationId = project.location?.id
        ? String(project.location.id)
        : null;

      collected.push({
        id: `concert-${project.id}`,
        type: "CONCERT",
        title: project.title,
        subtitle: null,
        date,
        timezone: project.location?.timezone || project.timezone || "UTC",
        projectId: String(project.id),
        locationId,
        location: locationId ? (locationMap.get(locationId) ?? null) : null,
        isMandatory: true,
        imminence: resolveImminence(date, now),
      });
    });

    (rehearsals ?? []).forEach((rehearsal: Rehearsal) => {
      const date = new Date(rehearsal.date_time);
      if (!isValidDate(date)) return;

      const locationId = rehearsal.location?.id
        ? String(rehearsal.location.id)
        : null;
      const parentTitle = projectTitleById.get(String(rehearsal.project));

      collected.push({
        id: `rehearsal-${rehearsal.id}`,
        type: "REHEARSAL",
        title: rehearsal.focus?.trim() || parentTitle || "Próba",
        subtitle: rehearsal.focus?.trim() ? (parentTitle ?? null) : null,
        date,
        timezone:
          rehearsal.location?.timezone || rehearsal.timezone || "UTC",
        projectId: String(rehearsal.project),
        locationId,
        location: locationId ? (locationMap.get(locationId) ?? null) : null,
        isMandatory: rehearsal.is_mandatory ?? true,
        imminence: resolveImminence(date, now),
      });
    });

    return collected.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [projects, rehearsals, locationMap]);

  const upcomingEvents = useMemo(
    () => events.filter((event) => event.imminence !== "PAST"),
    [events],
  );

  const venueActivity = useMemo(() => {
    const map = new Map<string, VenueActivity>();
    events.forEach((event) => {
      if (!event.locationId) return;
      const bucket = map.get(event.locationId) ?? {
        upcoming: [],
        past: [],
        nextEvent: null,
      };
      if (event.imminence === "PAST") {
        bucket.past.push(event);
      } else {
        bucket.upcoming.push(event);
        if (!bucket.nextEvent || event.date < bucket.nextEvent.date) {
          bucket.nextEvent = event;
        }
      }
      map.set(event.locationId, bucket);
    });
    // Most recent past first; upcoming already chronological from `events`.
    map.forEach((bucket) => bucket.past.reverse());
    return map;
  }, [events]);

  const timezoneClocks = useMemo<TimezoneClock[]>(() => {
    const byTimezone = new Map<string, TimezoneClock>();

    // Prefer timezones that actually host upcoming events (tour-relevant),
    // falling back to every active venue so the band is never empty.
    const sources = locations.filter((location) => location.timezone);
    sources.forEach((location) => {
      const tz = location.timezone;
      const activity = venueActivity.get(String(location.id));
      const existing = byTimezone.get(tz);
      const nextEvent = activity?.nextEvent ?? null;
      if (existing) {
        existing.venueCount += 1;
        if (
          nextEvent &&
          (!existing.nextEvent || nextEvent.date < existing.nextEvent.date)
        ) {
          existing.nextEvent = nextEvent;
        }
      } else {
        byTimezone.set(tz, {
          timezone: tz,
          city: tzCity(tz),
          venueCount: 1,
          nextEvent,
        });
      }
    });

    return Array.from(byTimezone.values()).sort((a, b) => {
      // Timezones with imminent events float to the front.
      const aDate = a.nextEvent?.date.getTime() ?? Number.POSITIVE_INFINITY;
      const bDate = b.nextEvent?.date.getTime() ?? Number.POSITIVE_INFINITY;
      if (aDate !== bDate) return aDate - bDate;
      return a.city.localeCompare(b.city);
    });
  }, [locations, venueActivity]);

  const scheduleMetrics = useMemo<LogisticsScheduleMetrics>(() => {
    let todayCount = 0;
    let weekCount = 0;
    upcomingEvents.forEach((event) => {
      if (event.imminence === "TODAY") {
        todayCount += 1;
        weekCount += 1;
      } else if (event.imminence === "SOON") {
        weekCount += 1;
      }
    });
    let liveVenues = 0;
    venueActivity.forEach((activity) => {
      if (activity.upcoming.length > 0) liveVenues += 1;
    });
    return {
      upcomingCount: upcomingEvents.length,
      todayCount,
      weekCount,
      liveVenues,
    };
  }, [upcomingEvents, venueActivity]);

  return {
    events,
    upcomingEvents,
    venueActivity,
    timezoneClocks,
    scheduleMetrics,
  };
};
