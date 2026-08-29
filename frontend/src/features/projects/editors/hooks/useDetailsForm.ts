/**
 * @file useDetailsForm.ts
 * @description Encapsulates dirty-state tracking, payload construction,
 * and optimistic form mutations for the Project Details tab.
 * Implements the Baseline State Pattern to prevent Stale Dirty State loops.
 * The run sheet is held chronologically, but only ever re-sorted on an explicit
 * commit — the day is a list the user types into, and reordering it under an
 * active cursor is the one thing it must not do.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/hooks/useDetailsForm
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { fromZonedTime } from "date-fns-tz";

import { toastApiError } from "@/shared/api/errors";
import type { Project, RunSheetItem } from "@/shared/types";
import {
  useCreateProject,
  useProjects,
  useUpdateProject,
} from "../../api/project.queries";
import { PROJECT_EVENT_KIND } from "../../constants/projectDomain";
import {
  compareRunSheetTimes,
  suggestRunSheetTime,
  toWallClockInput,
} from "../../lib/dayTimeline";
import type {
  ProjectCreateDTO,
  ProjectUpdateDTO,
} from "../../types/project.dto";
import type { ProjectFormData } from "../types";

export interface UseDetailsFormResult {
  formData: ProjectFormData;
  setFormData: Dispatch<SetStateAction<ProjectFormData>>;
  /**
   * Chronological, but only as of the last commit — see
   * `handleCommitRunSheetOrder`.
   */
  runSheet: RunSheetItem[];
  isDirty: boolean;
  isSubmitting: boolean;
  handleAddRunSheetItem: () => void;
  handleUpdateRunSheetItem: (
    id: string,
    field: keyof RunSheetItem,
    value: string,
  ) => void;
  /**
   * Re-sorts the day. Bound to the time field's blur, never to its change: a
   * half-typed hour is a valid time (typing 19 passes through 01), so sorting
   * per keystroke threw the row being edited across the list under the cursor.
   */
  handleCommitRunSheetOrder: () => void;
  handleRemoveRunSheetItem: (id: string) => void;
  handleSubmit: (event: FormEvent) => Promise<void>;
}

const normalizeRunSheetItem = (
  item: RunSheetItem,
  fallbackId: string,
): RunSheetItem => ({
  ...item,
  id: item.id ? String(item.id) : fallbackId,
  time: typeof item.time === "string" ? item.time : "",
  title: typeof item.title === "string" ? item.title : "",
  description: typeof item.description === "string" ? item.description : "",
  // Empty means the event's own venue, so the cleared picker stores "" rather
  // than dropping the key — the two have to look the same to the dirty check.
  location_id: typeof item.location_id === "string" ? item.location_id : "",
});

const sortRunSheetByTime = (items: readonly RunSheetItem[]): RunSheetItem[] =>
  [...items].sort((left, right) =>
    compareRunSheetTimes(left.time || "", right.time || ""),
  );

const toComparableRunSheet = (
  items: readonly RunSheetItem[] | null | undefined,
): string =>
  JSON.stringify(
    sortRunSheetByTime(items ?? []).map((item) => ({
      time: item.time || "",
      title: item.title || "",
      description: item.description || "",
      location_id: item.location_id || "",
    })),
  );

const normalizeRunSheet = (
  items: readonly RunSheetItem[] | null | undefined,
): RunSheetItem[] => {
  const stamp = Date.now();

  return sortRunSheetByTime(
    (items ?? []).map((item, index) =>
      normalizeRunSheetItem(item, `runsheet-init-${index}-${stamp}`),
    ),
  );
};

/**
 * The API answers a wall-clock `HH:MM:SS`; the control edits `HH:MM`. Trimming
 * on the way in is what keeps the dirty comparison from firing on the seconds
 * the server appended to a value nobody touched.
 */
const toClockInput = (value?: string | null): string =>
  value ? value.slice(0, 5) : "";

/** Empty is a real answer here — it clears the window rather than leaving one. */
const toClockPayload = (value: string): string | null => value.trim() || null;

const getProjectLocationId = (
  project: Project | null | undefined,
): string | null => {
  if (!project?.location) {
    return null;
  }

  return project.location.id;
};

const getProjectConductorId = (
  project: Project | null | undefined,
): string | null => {
  if (!project?.conductor) {
    return null;
  }

  return typeof project.conductor === "string"
    ? project.conductor
    : project.conductor.id;
};

const EMPTY_PROJECTS: Project[] = [];

/**
 * The single mapping from a stored project onto the editable form — used to
 * seed it, to reset it after a save, and to derive the baseline it is compared
 * against. One function rather than three copies, so a field added to the form
 * cannot be edited without ever making the save bar appear.
 */
const toFormData = (source: Project | null | undefined): ProjectFormData => ({
  title: source?.title || "",
  event_kind: source?.event_kind || PROJECT_EVENT_KIND.CONCERT,
  timezone: source?.timezone || "Europe/Warsaw",
  date_time: toWallClockInput(source?.date_time, source?.timezone),
  call_time: toWallClockInput(source?.call_time, source?.timezone),
  location_id: getProjectLocationId(source),
  conductor: getProjectConductorId(source),
  dress_code_male: source?.dress_code_male || "",
  dress_code_female: source?.dress_code_female || "",
  spotify_playlist_url: source?.spotify_playlist_url || "",
  description: source?.description || "",
  entrance_note: source?.entrance_note || "",
  parking_note: source?.parking_note || "",
  dressing_room_note: source?.dressing_room_note || "",
  warmup_start: toClockInput(source?.warmup_start),
  warmup_end: toClockInput(source?.warmup_end),
  soundcheck_start: toClockInput(source?.soundcheck_start),
  soundcheck_end: toClockInput(source?.soundcheck_end),
  onsite_contact_name: source?.onsite_contact_name || "",
  onsite_contact_phone: source?.onsite_contact_phone || "",
});

export const useDetailsForm = (
  projectId: string | undefined,
  onSuccess: (updatedProject?: Project) => void,
  onDirtyStateChange?: (isDirty: boolean) => void,
): UseDetailsFormResult => {
  const { t } = useTranslation();

  const projectsQuery = useProjects(Boolean(projectId));
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;

  const project = useMemo(
    () =>
      projectId
        ? projects.find((candidate) => String(candidate.id) === String(projectId)) ??
          null
        : null,
    [projectId, projects],
  );

  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();

  const [baseline, setBaseline] = useState<Project | null>(project);

  const [formData, setFormData] = useState<ProjectFormData>(() =>
    toFormData(project),
  );

  const [runSheet, setRunSheet] = useState<RunSheetItem[]>(() =>
    normalizeRunSheet(project?.run_sheet),
  );

  const resetFormToProject = useCallback((source: Project) => {
    setBaseline(source);
    setFormData(toFormData(source));
    setRunSheet(normalizeRunSheet(source.run_sheet));
  }, []);

  useEffect(() => {
    if (project && String(project.id) !== String(baseline?.id)) {
      resetFormToProject(project);
    }
  }, [baseline?.id, project, resetFormToProject]);

  const isDirty = useMemo(() => {
    if (!baseline) {
      return (
        formData.title.trim() !== "" ||
        formData.date_time !== "" ||
        runSheet.length > 0
      );
    }

    // Compared against the same projection the form was seeded from, field by
    // field in one shot: an enumerated comparison silently stops covering every
    // field the moment one is added to the form and not to the list.
    const basicFieldsChanged =
      JSON.stringify(formData) !== JSON.stringify(toFormData(baseline));

    // Compared chronologically on both sides: the form keeps the day sorted and
    // the server does not promise to, so a purely positional diff would open
    // the save bar on load for any project stored out of order.
    const runSheetChanged =
      toComparableRunSheet(runSheet) !== toComparableRunSheet(baseline.run_sheet);

    return basicFieldsChanged || runSheetChanged;
  }, [baseline, formData, runSheet]);

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  const handleAddRunSheetItem = useCallback((): void => {
    setRunSheet((previous) =>
      sortRunSheetByTime([
        ...previous,
        {
          id: `temp-${Date.now()}`,
          time: suggestRunSheetTime({
            runSheet: previous,
            callTime: formData.call_time,
            concertTime: formData.date_time,
          }),
          title: "",
          description: "",
          location_id: "",
        },
      ]),
    );
  }, [formData.call_time, formData.date_time]);

  const handleCommitRunSheetOrder = useCallback((): void => {
    setRunSheet((previous) => sortRunSheetByTime(previous));
  }, []);

  const handleUpdateRunSheetItem = useCallback(
    (id: string, field: keyof RunSheetItem, value: string): void => {
      setRunSheet((previous) =>
        previous.map((item) =>
          String(item.id) === id
            ? normalizeRunSheetItem({ ...item, [field]: value }, String(item.id))
            : item,
        ),
      );
    },
    [],
  );

  const handleRemoveRunSheetItem = useCallback((id: string): void => {
    setRunSheet((previous) =>
      previous.filter((item) => String(item.id) !== id),
    );
  }, []);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    if (!isDirty) {
      return;
    }

    // A window that closes before it opens would print on the day card as a
    // fact. Caught here rather than left to the API, whose rejection would
    // arrive as a field-level message about a control the producer may have
    // scrolled past — and would take the whole save down with it.
    const invertedWindow = (
      [
        ["warmup_start", "warmup_end"],
        ["soundcheck_start", "soundcheck_end"],
      ] as const
    ).some(([start, end]) => {
      const from = formData[start].trim();
      const until = formData[end].trim();
      return Boolean(until) && (!from || until <= from);
    });

    if (invertedWindow) {
      toast.error(
        t(
          "projects.details.toast.invalid_window",
          "Koniec okna musi wypadać po jego początku.",
        ),
      );
      return;
    }

    const toastId = toast.loading(
      t("projects.details.toast.saving", "Zapisywanie szczegółów projektu..."),
    );

    try {
      // Rebuilt key by key rather than spread: the row also carries a client-side
      // id the stored JSON has no use for. Anything a row is meant to keep has to
      // be listed HERE or it is dropped on save without a word.
      const sanitizedRunSheet = sortRunSheetByTime(runSheet).map((item) => ({
        time: item.time || "",
        title: item.title || "",
        description: item.description || "",
        location_id: item.location_id || "",
      }));

      const safeDateTimeStr =
        formData.date_time.length === 16
          ? `${formData.date_time}:00`
          : formData.date_time;

      const safeCallTimeStr =
        formData.call_time?.length === 16
          ? `${formData.call_time}:00`
          : formData.call_time;

      const absoluteDateTime = fromZonedTime(
        safeDateTimeStr,
        formData.timezone,
      ).toISOString();

      const absoluteCallTime = safeCallTimeStr
        ? fromZonedTime(safeCallTimeStr, formData.timezone).toISOString()
        : null;

      const payload = {
        title: formData.title,
        event_kind: formData.event_kind,
        timezone: formData.timezone,
        date_time: absoluteDateTime,
        call_time: absoluteCallTime,
        location_id: formData.location_id,
        conductor: formData.conductor,
        dress_code_male: formData.dress_code_male || "",
        dress_code_female: formData.dress_code_female || "",
        spotify_playlist_url: formData.spotify_playlist_url || "",
        description: formData.description || "",
        run_sheet: sanitizedRunSheet,
        entrance_note: formData.entrance_note || "",
        parking_note: formData.parking_note || "",
        dressing_room_note: formData.dressing_room_note || "",
        // Both halves of a window always travel together: the API refuses a
        // closing hour it cannot check against a start it was not sent.
        warmup_start: toClockPayload(formData.warmup_start),
        warmup_end: toClockPayload(formData.warmup_end),
        soundcheck_start: toClockPayload(formData.soundcheck_start),
        soundcheck_end: toClockPayload(formData.soundcheck_end),
        onsite_contact_name: formData.onsite_contact_name || "",
        onsite_contact_phone: formData.onsite_contact_phone || "",
      };

      let savedProject: Project;

      if (baseline?.id) {
        const updatePayload: ProjectUpdateDTO = payload;
        savedProject = await updateProjectMutation.mutateAsync({
          id: String(baseline.id),
          data: updatePayload,
        });

        toast.success(
          t(
            "projects.details.toast.update_success",
            "Zaktualizowano projekt i harmonogram",
          ),
          { id: toastId },
        );
      } else {
        const createPayload: ProjectCreateDTO = payload;
        savedProject = await createProjectMutation.mutateAsync(createPayload);

        toast.success(
          t(
            "projects.details.toast.create_success",
            "Utworzono nowy projekt z harmonogramem",
          ),
          { id: toastId },
        );
      }

      resetFormToProject(savedProject);
      onSuccess(savedProject);
    } catch (error: unknown) {
      toastApiError(error, t, { id: toastId });
    }
  };

  return {
    formData,
    setFormData,
    runSheet,
    isDirty,
    isSubmitting:
      createProjectMutation.isPending || updateProjectMutation.isPending,
    handleAddRunSheetItem,
    handleUpdateRunSheetItem,
    handleCommitRunSheetOrder,
    handleRemoveRunSheetItem,
    handleSubmit,
  };
};
