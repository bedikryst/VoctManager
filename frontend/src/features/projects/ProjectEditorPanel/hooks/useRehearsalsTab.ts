/**
 * @file useRehearsalsTab.ts
 * @description Encapsulates mutation logic and state management for rehearsal scheduling.
 * Uses explicit location relations and timezone-safe payload construction.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useRehearsalsTab
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
} from "@/shared/types";
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
import { compareProjectDateAsc } from "../../lib/projectPresentation";
import type { RehearsalFormData, RehearsalTargetType } from "../types";

export interface UseRehearsalsTabResult {
  isSubmitting: boolean;
  isEditing: boolean;
  rehearsalToDelete: string | null;
  setRehearsalToDelete: Dispatch<SetStateAction<string | null>>;
  isDeleting: boolean;
  formData: RehearsalFormData;
  setFormData: Dispatch<SetStateAction<RehearsalFormData>>;
  targetType: RehearsalTargetType;
  setTargetType: Dispatch<SetStateAction<RehearsalTargetType>>;
  selectedSections: string[];
  customParticipants: string[];
  projectRehearsals: Rehearsal[];
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

const getLocationId = (location: Rehearsal["location"]): string => {
  if (!location) {
    return "";
  }

  return typeof location === "string" ? location : location.id;
};

export const useRehearsalsTab = (projectId: string): UseRehearsalsTabResult => {
  const { t } = useTranslation();

  const { data: projects } = useProjects();
  const { data: artists } = useProjectArtistsDictionary();
  const { data: participations } = useProjectParticipations(projectId);
  const { data: rehearsals } = useProjectRehearsals(projectId);
  const { data: locationsData } = useLocations();

  const project =
    projects.find((candidate) => String(candidate.id) === String(projectId)) ??
    null;
  const locations = locationsData ?? [];

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

  const locationMap = useMemo(
    () => new Map(locations.map((location) => [String(location.id), location])),
    [locations],
  );

  const resolveInvitedParticipants = useCallback((): string[] => {
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

  const resetForm = useCallback(() => {
    setEditingRehearsalId(null);
    setFormData({
      date_time: "",
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

      setEditingRehearsalId(String(rehearsal.id));
      setFormData({
        date_time: toZonedInputString(rehearsal.date_time, rehearsalTimezone),
        timezone: rehearsalTimezone,
        location_id: locationId,
        focus: rehearsal.focus || "",
        is_mandatory: rehearsal.is_mandatory ?? true,
      });

      const invitedIds = rehearsal.invited_participations?.map(String) || [];

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
          "Wybierz lokalizacjÄ™ prĂłby przed zapisem.",
        ),
      );
      return;
    }

    const invitedParticipants = resolveInvitedParticipants();

    if (invitedParticipants.length === 0) {
      toast.warning(
        t(
          "projects.rehearsals.toast.select_target",
          "Wybierz przynajmniej jednÄ… osobÄ™ lub sekcjÄ™ na prĂłbÄ™.",
        ),
      );
      return;
    }

    const isEditing = editingRehearsalId !== null;
    const toastId = toast.loading(
      isEditing
        ? t("projects.rehearsals.toast.updating", "Aktualizowanie prĂłby...")
        : t(
            "projects.rehearsals.toast.saving",
            "Zapisywanie prĂłby w kalendarzu...",
          ),
    );

    try {
      const absoluteDateTime = fromZonedTime(
        formData.date_time,
        formData.timezone,
      ).toISOString();

      const payload = {
        project: projectId,
        date_time: absoluteDateTime,
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
        await createRehearsalMutation.mutateAsync(payload);
      }

      resetForm();

      toast.success(
        isEditing
          ? t(
              "projects.rehearsals.toast.update_success",
              "PrĂłba zaktualizowana pomyĹ›lnie",
            )
          : t(
              "projects.rehearsals.toast.save_success",
              "PrĂłba zapisana pomyĹ›lnie",
            ),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.errors.save_error", "BĹ‚Ä…d zapisu"), {
        id: toastId,
        description: t(
          "projects.rehearsals.toast.save_error_desc",
          "WystÄ…piĹ‚ problem z zapisem do bazy. SprawdĹş formularz i poĹ‚Ä…czenie.",
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

    const toastId = toast.loading(
      t("projects.rehearsals.toast.removing", "Usuwanie prĂłby..."),
    );

    try {
      await deleteRehearsalMutation.mutateAsync(rehearsalToDelete);

      if (editingRehearsalId === rehearsalToDelete) {
        resetForm();
      }

      toast.success(
        t("projects.rehearsals.toast.remove_success", "PrĂłba zostaĹ‚a usuniÄ™ta"),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.actions.delete_error", "BĹ‚Ä…d usuwania"), {
        id: toastId,
        description: t(
          "projects.rehearsals.toast.remove_error_desc",
          "Nie udaĹ‚o siÄ™ usunÄ…Ä‡ prĂłby. Serwer odrzuciĹ‚ ĹĽÄ…danie.",
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
    isEditing: editingRehearsalId !== null,
    rehearsalToDelete,
    setRehearsalToDelete,
    isDeleting: deleteRehearsalMutation.isPending,
    formData,
    setFormData,
    targetType,
    setTargetType,
    selectedSections,
    customParticipants,
    projectRehearsals,
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
