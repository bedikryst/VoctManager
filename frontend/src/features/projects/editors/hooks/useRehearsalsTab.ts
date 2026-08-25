/**
 * @file useRehearsalsTab.ts
 * @description Mutation logic and state for rehearsal scheduling, plus the shape
 * the tab reads: one chronological runway (rehearsals + the concert) split at
 * "now" into what can still be acted on and what is already on the record.
 * Uses explicit location relations and timezone-safe payload construction.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/hooks/useRehearsalsTab
 */

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type {
  Artist,
  Location,
  Participation,
  Rehearsal,
  Project,
} from "@/shared/types";
import { toastApiError } from "@/shared/api/errors";
import { useLocations } from "@/features/logistics/api/logistics.queries";
import {
  useCreateRehearsal,
  useDeleteRehearsal,
  useProjectArtistsDictionary,
  useProjectParticipations,
  useProjectRehearsals,
  useProjects,
  useUpdateRehearsal,
} from "../../api/project.queries";
import {
  compareProjectDateAsc,
  isPastProjectDate,
} from "../../lib/projectPresentation";
import type { RehearsalFormData, RehearsalTargetType } from "../types";

/**
 * One stop on the project's runway to the concert. The concert itself rides in
 * this list (`rehearsal: null`) rather than in a block of its own: read in
 * order, a rehearsal that lands BELOW the concert row is visibly a planning
 * mistake, so the ordering carries the warning and no advisory copy has to.
 */
export interface RehearsalTimelineEntry {
  readonly key: string;
  readonly at: string;
  readonly timezone: string;
  readonly rehearsal: Rehearsal | null;
}

export interface UseRehearsalsTabResult {
  isSubmitting: boolean;
  /** The session the form is currently bound to — `null` means "compose new". */
  editingRehearsal: Rehearsal | null;
  rehearsalToDelete: string | null;
  setRehearsalToDelete: Dispatch<SetStateAction<string | null>>;
  isDeleting: boolean;
  formData: RehearsalFormData;
  setFormData: Dispatch<SetStateAction<RehearsalFormData>>;
  targetType: RehearsalTargetType;
  setTargetType: Dispatch<SetStateAction<RehearsalTargetType>>;
  selectedSections: string[];
  customParticipants: string[];
  /** How many people the current target selection calls against today's cast.
   *  Under `TUTTI` it is a running headcount, not a guest list — the session is
   *  stored as "everyone" and grows with the project. */
  invitedCount: number;
  project: Project | null;
  projectRehearsals: Rehearsal[];
  upcomingTimeline: RehearsalTimelineEntry[];
  pastTimeline: RehearsalTimelineEntry[];
  projectParticipations: Participation[];
  artistMap: Map<string, Artist>;
  locations: Location[];
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleEditClick: (rehearsal: Rehearsal) => void;
  handleCancelEdit: () => void;
  handleDeleteClick: (id: string) => void;
  executeDelete: () => Promise<void>;
  toggleSection: (section: string) => void;
  toggleCustomParticipant: (id: string) => void;
}

const toZonedInputString = (
  dateString?: string | null,
  timezone = "Europe/Warsaw",
): string => {
  if (!dateString) {
    return "";
  }

  try {
    return formatInTimeZone(
      new Date(dateString),
      timezone,
      "yyyy-MM-dd'T'HH:mm",
    );
  } catch {
    return "";
  }
};

const MINUTES_PER_DAY = 24 * 60;

/** Minutes since midnight for a `HH:mm` field value; null when incomplete. */
const parseClockMinutes = (time: string): number | null => {
  const [hours, minutes] = time.split(":");
  if (minutes === undefined) return null;

  const total = Number(hours) * 60 + Number(minutes);
  return Number.isFinite(total) && total >= 0 && total < MINUTES_PER_DAY
    ? total
    : null;
};

const toClockTime = (minutes: number): string => {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
};

/**
 * The two conversions between what the conductor types (a closing hour) and
 * what the API stores (a length). An end at or before the start is read as the
 * next morning rather than rejected — a rehearsal running to 00:30 is entered
 * as "00:30", and demanding a second date for it would be the wrong question.
 */
const durationFromEndTime = (
  startWallClock: string,
  endTime: string,
): number | null => {
  const start = parseClockMinutes(startWallClock.slice(11, 16));
  const end = parseClockMinutes(endTime);
  if (start === null || end === null) return null;

  const span = end - start;
  return span > 0 ? span : span + MINUTES_PER_DAY;
};

const endTimeFromDuration = (
  startWallClock: string,
  durationMinutes: number | null | undefined,
): string => {
  const start = parseClockMinutes(startWallClock.slice(11, 16));
  if (start === null || !durationMinutes) return "";

  return toClockTime(start + durationMinutes);
};

const getLocationId = (location: Rehearsal["location"]): string => {
  if (!location) {
    return "";
  }

  return typeof location === "string" ? location : location.id;
};

const EMPTY_ARTISTS: Artist[] = [];
const EMPTY_LOCATIONS: Location[] = [];
const EMPTY_PARTICIPATIONS: Participation[] = [];
const EMPTY_PROJECTS: Project[] = [];
const EMPTY_REHEARSALS: Rehearsal[] = [];

export const useRehearsalsTab = (projectId: string): UseRehearsalsTabResult => {
  const { t } = useTranslation();

  const projectsQuery = useProjects();
  const artistsQuery = useProjectArtistsDictionary();
  const participationsQuery = useProjectParticipations(projectId);
  const rehearsalsQuery = useProjectRehearsals(projectId);
  const locationsDataQuery = useLocations();
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  const artists = artistsQuery.data ?? EMPTY_ARTISTS;
  const participations = participationsQuery.data ?? EMPTY_PARTICIPATIONS;
  const rehearsals = rehearsalsQuery.data ?? EMPTY_REHEARSALS;
  const locationsData = locationsDataQuery.data ?? EMPTY_LOCATIONS;

  const project =
    projects.find((candidate) => String(candidate.id) === String(projectId)) ??
    null;
  const locations = locationsData;

  const createRehearsalMutation = useCreateRehearsal(projectId);
  const updateRehearsalMutation = useUpdateRehearsal(projectId);
  const deleteRehearsalMutation = useDeleteRehearsal(projectId);

  const [editingRehearsalId, setEditingRehearsalId] = useState<string | null>(
    null,
  );
  const [rehearsalToDelete, setRehearsalToDelete] = useState<string | null>(
    null,
  );

  const [formData, setFormData] = useState<RehearsalFormData>({
    date_time: "",
    end_time: "",
    timezone: project?.timezone || "Europe/Warsaw",
    location_id: "",
    focus: "",
    is_mandatory: true,
  });

  const [targetType, setTargetType] = useState<RehearsalTargetType>("TUTTI");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [customParticipants, setCustomParticipants] = useState<string[]>([]);

  const projectRehearsals = useMemo<Rehearsal[]>(
    () =>
      [...rehearsals].sort((left, right) =>
        compareProjectDateAsc(left.date_time, right.date_time),
      ),
    [rehearsals],
  );

  const projectParticipations = useMemo<Participation[]>(
    () =>
      participations.filter(
        (participation) => String(participation.project) === String(projectId),
      ),
    [participations, projectId],
  );

  const artistMap = useMemo(
    () => new Map(artists.map((artist) => [String(artist.id), artist])),
    [artists],
  );

  const timeline = useMemo<RehearsalTimelineEntry[]>(() => {
    const entries: RehearsalTimelineEntry[] = projectRehearsals.map(
      (rehearsal) => ({
        key: String(rehearsal.id),
        at: rehearsal.date_time,
        timezone: rehearsal.timezone,
        rehearsal,
      }),
    );

    if (project?.date_time) {
      entries.push({
        key: "concert",
        at: project.date_time,
        timezone: project.timezone,
        rehearsal: null,
      });
    }

    return entries.sort((left, right) =>
      compareProjectDateAsc(left.at, right.at),
    );
  }, [project?.date_time, project?.timezone, projectRehearsals]);

  const upcomingTimeline = useMemo<RehearsalTimelineEntry[]>(
    () => timeline.filter((entry) => !isPastProjectDate(entry.at)),
    [timeline],
  );

  const pastTimeline = useMemo<RehearsalTimelineEntry[]>(
    () => timeline.filter((entry) => isPastProjectDate(entry.at)),
    [timeline],
  );

  const locationMap = useMemo(
    () => new Map(locations.map((location) => [String(location.id), location])),
    [locations],
  );

  /**
   * Who the current selection calls, read against the cast as it stands today.
   * This is the number the form reports — never what gets stored; see
   * `buildInvitedPayload`.
   */
  const resolveCalledParticipations = useCallback((): string[] => {
    if (targetType === "TUTTI") {
      return projectParticipations.map((participation) =>
        String(participation.id),
      );
    }

    if (targetType === "SECTIONAL") {
      return projectParticipations
        .filter((participation) => {
          const artist = artistMap.get(String(participation.artist));

          if (!artist?.voice_type) {
            return false;
          }

          return selectedSections.some((section) =>
            artist.voice_type.startsWith(section),
          );
        })
        .map((participation) => String(participation.id));
    }

    return customParticipants;
  }, [
    artistMap,
    customParticipants,
    projectParticipations,
    selectedSections,
    targetType,
  ]);

  /**
   * What lands in `invited_participations`. Tutti stores an EMPTY list rather
   * than today's roster: the backend reads "no one named" as "the whole
   * ensemble" and resolves it per request, so whoever accepts their invitation
   * next week is called to every tutti session already in the calendar.
   * Enumerating the cast here would freeze the guest list at booking time — and
   * would make a session unbookable before anyone is on the project at all.
   */
  const buildInvitedPayload = useCallback(
    (): string[] => (targetType === "TUTTI" ? [] : resolveCalledParticipations()),
    [resolveCalledParticipations, targetType],
  );

  // Recomputed with the selection so the form can state, before submitting, how
  // many people the chosen target actually reaches — the number the conductor
  // is really deciding on when they tick sections or names.
  const invitedCount = useMemo(
    () => resolveCalledParticipations().length,
    [resolveCalledParticipations],
  );

  const resetForm = useCallback(() => {
    setEditingRehearsalId(null);
    setFormData({
      date_time: "",
      end_time: "",
      timezone: project?.timezone || "Europe/Warsaw",
      location_id: "",
      focus: "",
      is_mandatory: true,
    });
    setTargetType("TUTTI");
    setSelectedSections([]);
    setCustomParticipants([]);
  }, [project?.timezone]);

  const handleEditClick = useCallback(
    (rehearsal: Rehearsal): void => {
      const locationId = getLocationId(rehearsal.location);
      const resolvedLocation = locationMap.get(locationId);
      const rehearsalTimezone =
        resolvedLocation?.timezone ||
        rehearsal.timezone ||
        project?.timezone ||
        "Europe/Warsaw";

      const startWallClock = toZonedInputString(
        rehearsal.date_time,
        rehearsalTimezone,
      );

      setEditingRehearsalId(String(rehearsal.id));
      setFormData({
        date_time: startWallClock,
        end_time: endTimeFromDuration(
          startWallClock,
          rehearsal.duration_minutes,
        ),
        timezone: rehearsalTimezone,
        location_id: locationId,
        focus: rehearsal.focus || "",
        is_mandatory: rehearsal.is_mandatory ?? true,
      });

      const invitedIds = rehearsal.invited_participations?.map(String) || [];

      // Two ways a session reads as tutti: it names nobody, or it names the
      // whole cast. The second is how sessions booked before tutti became a
      // standing rule look — reopening one and saving it converts the frozen
      // list into that rule, so it starts calling people who join later.
      if (
        invitedIds.length === 0 ||
        invitedIds.length === projectParticipations.length
      ) {
        setTargetType("TUTTI");
        setCustomParticipants([]);
        return;
      }

      setTargetType("CUSTOM");
      setCustomParticipants(invitedIds);
    },
    [locationMap, project?.timezone, projectParticipations.length],
  );

  const handleCancelEdit = useCallback((): void => {
    resetForm();
  }, [resetForm]);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (!formData.location_id) {
      toast.warning(
        t(
          "projects.rehearsals.toast.select_location",
          "Wybierz lokalizację próby przed zapisem.",
        ),
      );
      return;
    }

    // A sectional or a hand-picked call IS its list of names, so an empty one is
    // a slip worth stopping. Tutti names nobody by design — blocking it would
    // forbid planning the rehearsals of a concert before its cast exists.
    if (targetType !== "TUTTI" && invitedCount === 0) {
      toast.warning(
        t(
          "projects.rehearsals.toast.select_target",
          "Wybierz przynajmniej jedną osobę lub sekcję na próbę.",
        ),
      );
      return;
    }

    const invitedParticipants = buildInvitedPayload();

    const isEditing = editingRehearsalId !== null;

    try {
      const absoluteDateTime = fromZonedTime(
        formData.date_time,
        formData.timezone,
      ).toISOString();

      const payload = {
        date_time: absoluteDateTime,
        // Null clears an end that no longer holds; the API reads it as "not
        // timed" and every surface then says nothing rather than guessing.
        duration_minutes: formData.end_time
          ? durationFromEndTime(formData.date_time, formData.end_time)
          : null,
        timezone: formData.timezone,
        location_id: formData.location_id,
        focus: formData.focus,
        is_mandatory: formData.is_mandatory,
        invited_participations: invitedParticipants,
      };

      if (isEditing && editingRehearsalId) {
        await updateRehearsalMutation.mutateAsync({
          id: editingRehearsalId,
          data: payload,
        });
      } else {
        await createRehearsalMutation.mutateAsync({
          ...payload,
          project_id: projectId,
        });
      }

      resetForm();
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t(
          "projects.rehearsals.toast.save_error_desc",
          "Wystąpił problem z zapisem do bazy. Sprawdź formularz i połączenie.",
        ),
      });
    }
  };

  const handleDeleteClick = useCallback((id: string): void => {
    setRehearsalToDelete(id);
  }, []);

  const executeDelete = useCallback(async (): Promise<void> => {
    if (!rehearsalToDelete) {
      return;
    }

    try {
      await deleteRehearsalMutation.mutateAsync(rehearsalToDelete);

      if (editingRehearsalId === rehearsalToDelete) {
        resetForm();
      }
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t(
          "projects.rehearsals.toast.remove_error_desc",
          "Nie udało się usunąć próby. Serwer odrzucił żądanie.",
        ),
      });
    } finally {
      setRehearsalToDelete(null);
    }
  }, [
    deleteRehearsalMutation,
    editingRehearsalId,
    rehearsalToDelete,
    resetForm,
    t,
  ]);

  const toggleSection = useCallback((section: string): void => {
    setSelectedSections((previousSections) =>
      previousSections.includes(section)
        ? previousSections.filter((value) => value !== section)
        : [...previousSections, section],
    );
  }, []);

  const toggleCustomParticipant = useCallback((id: string): void => {
    setCustomParticipants((previousParticipants) =>
      previousParticipants.includes(id)
        ? previousParticipants.filter((value) => value !== id)
        : [...previousParticipants, id],
    );
  }, []);

  return {
    isSubmitting:
      createRehearsalMutation.isPending || updateRehearsalMutation.isPending,
    editingRehearsal:
      projectRehearsals.find(
        (rehearsal) => String(rehearsal.id) === editingRehearsalId,
      ) ?? null,
    rehearsalToDelete,
    setRehearsalToDelete,
    isDeleting: deleteRehearsalMutation.isPending,
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
  };
};
