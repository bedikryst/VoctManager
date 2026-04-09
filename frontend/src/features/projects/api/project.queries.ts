/**
 * @file project.queries.ts
 * @description React Query hooks for Project domain server state.
 * Centralizes cache policies and invalidation rules for the entire module.
 * @architecture Enterprise SaaS 2026
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../../../shared/lib/queryKeys";
import { ProjectService } from "./project.service";
import type {
  AttendanceCreateDTO,
  AttendanceUpdateDTO,
  CrewAssignmentCreateDTO,
  CrewAssignmentUpdateDTO,
  ParticipationCreateDTO,
  ParticipationUpdateDTO,
  PieceCastingCreateDTO,
  PieceCastingUpdateDTO,
  ProgramItemCreateDTO,
  ProgramItemUpdateDTO,
  ProjectCreateDTO,
  ProjectUpdateDTO,
  RehearsalCreateDTO,
  RehearsalUpdateDTO,
} from "../types/project.dto";

const STATIC_DICTIONARY_STALE_TIME = 1000 * 60 * 60 * 24;
const PROJECT_RELATION_STALE_TIME = 1000 * 60 * 5;
const FAST_CHANGING_STALE_TIME = 1000 * 60;

export const useProjects = () =>
  useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: ProjectService.getAll,
    staleTime: PROJECT_RELATION_STALE_TIME,
  });

export const useProjectArtistsDictionary = () =>
  useQuery({
    queryKey: queryKeys.artists.all,
    queryFn: ProjectService.getArtistsDictionary,
    staleTime: STATIC_DICTIONARY_STALE_TIME,
  });

export const useProjectPiecesDictionary = () =>
  useQuery({
    queryKey: queryKeys.pieces.all,
    queryFn: ProjectService.getPiecesDictionary,
    staleTime: STATIC_DICTIONARY_STALE_TIME,
  });

export const useProjectCollaboratorsDictionary = () =>
  useQuery({
    queryKey: queryKeys.collaborators.all,
    queryFn: ProjectService.getCollaboratorsDictionary,
    staleTime: STATIC_DICTIONARY_STALE_TIME,
  });

export const useProjectVoiceLinesDictionary = () =>
  useQuery({
    queryKey: queryKeys.options.voiceLines,
    queryFn: ProjectService.getVoiceLinesDictionary,
    staleTime: STATIC_DICTIONARY_STALE_TIME,
  });

export const useProjectParticipations = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.participations.byProject(projectId ?? "pending"),
    queryFn: () =>
      ProjectService.getParticipationsByProject(projectId as string),
    staleTime: PROJECT_RELATION_STALE_TIME,
    enabled: !!projectId,
  });

export const useProjectRehearsals = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.rehearsals.byProject(projectId ?? "pending"),
    queryFn: () => ProjectService.getRehearsalsByProject(projectId as string),
    staleTime: PROJECT_RELATION_STALE_TIME,
    enabled: !!projectId,
  });

export const useProjectCrewAssignments = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.crewAssignments.byProject(projectId ?? "pending"),
    queryFn: () =>
      ProjectService.getCrewAssignmentsByProject(projectId as string),
    staleTime: PROJECT_RELATION_STALE_TIME,
    enabled: !!projectId,
  });

export const useProjectProgram = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.program.byProject(projectId ?? "pending"),
    queryFn: () => ProjectService.getProgramByProject(projectId as string),
    staleTime: FAST_CHANGING_STALE_TIME,
    enabled: !!projectId,
  });

export const useProjectPieceCastings = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.pieceCastings.byProject(projectId ?? "pending"),
    queryFn: () =>
      ProjectService.getPieceCastingsByProject(projectId as string),
    staleTime: FAST_CHANGING_STALE_TIME,
    enabled: !!projectId,
  });

export const useProjectAttendances = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.attendances.byProject(projectId ?? "pending"),
    queryFn: () => ProjectService.getAttendancesByProject(projectId as string),
    staleTime: FAST_CHANGING_STALE_TIME,
    enabled: !!projectId,
  });

// --- MUTATIONS ---

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProjectCreateDTO) => ProjectService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdateDTO }) =>
      ProjectService.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.details(variables.id),
      });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useUpdateProjectStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: ProjectUpdateDTO["status"];
    }) => ProjectService.update(id, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.details(variables.id),
      });
    },
  });
};

export const useCreateParticipation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ParticipationCreateDTO) =>
      ProjectService.createParticipation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.participations.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useUpdateParticipation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ParticipationUpdateDTO }) =>
      ProjectService.updateParticipation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.participations.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useDeleteParticipation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deleteParticipation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.participations.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useCreateCrewAssignment = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CrewAssignmentCreateDTO) =>
      ProjectService.createCrewAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.crewAssignments.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useUpdateCrewAssignment = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CrewAssignmentUpdateDTO }) =>
      ProjectService.updateCrewAssignment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.crewAssignments.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useDeleteCrewAssignment = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deleteCrewAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.crewAssignments.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useCreateRehearsal = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RehearsalCreateDTO) =>
      ProjectService.createRehearsal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.rehearsals.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useUpdateRehearsal = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RehearsalUpdateDTO }) =>
      ProjectService.updateRehearsal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.rehearsals.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useDeleteRehearsal = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deleteRehearsal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.rehearsals.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useCreateProgramItem = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProgramItemCreateDTO) =>
      ProjectService.createProgramItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.program.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.program.all });
    },
  });
};

export const useUpdateProgramItem = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProgramItemUpdateDTO }) =>
      ProjectService.updateProgramItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.program.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.program.all });
    },
  });
};

export const useDeleteProgramItem = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deleteProgramItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.program.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.program.all });
    },
  });
};

export const useCreatePieceCasting = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PieceCastingCreateDTO) =>
      ProjectService.createPieceCasting(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.pieceCastings.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.pieceCastings.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.program.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useUpdatePieceCasting = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PieceCastingUpdateDTO }) =>
      ProjectService.updatePieceCasting(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.pieceCastings.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.pieceCastings.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.program.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useDeletePieceCasting = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deletePieceCasting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.pieceCastings.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.pieceCastings.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.program.byProject(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export const useCreateAttendance = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AttendanceCreateDTO) =>
      ProjectService.createAttendance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendances.byProject(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.rehearsals.byProject(projectId),
      });
    },
  });
};

export const useUpdateAttendance = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AttendanceUpdateDTO }) =>
      ProjectService.updateAttendance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendances.byProject(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.rehearsals.byProject(projectId),
      });
    },
  });
};

export const useDeleteAttendance = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.deleteAttendance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendances.byProject(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.rehearsals.byProject(projectId),
      });
    },
  });
};
