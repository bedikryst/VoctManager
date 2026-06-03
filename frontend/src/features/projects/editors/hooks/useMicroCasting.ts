/**
 * @file useMicroCasting.ts
 * @description State controller for the Micro-Casting Kanban board.
 * Holds an in-memory draft (`localCastings`) decoupled from server state. All drag &
 * drop and note edits stay local until the user explicitly commits via `saveChanges`.
 * The committed snapshot (`originalCastings`) is the diff baseline; switching pieces
 * while dirty is gated through `requestSelectPiece` so the UI can render a guard.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/hooks/useMicroCasting
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { toast } from "sonner";

import type {
  Artist,
  Participation,
  ParticipationStatus,
  Piece,
  PieceCasting,
  ProgramItem,
  VoiceLineOption,
  VoiceRequirement,
} from "@/shared/types";
import {
  projectKeys,
  useCreatePieceCasting,
  useDeletePieceCasting,
  useProjectArtistsDictionary,
  useProjectParticipations,
  useProjectPieceCastings,
  useProjectPiecesDictionary,
  useProjectProgram,
  useProjectVoiceLinesDictionary,
  useUpdatePieceCasting,
} from "../../api/project.queries";

export type PieceCastingStatus = "FREE" | "OK" | "DEFICIT";

export interface PendingCounts {
  creates: number;
  updates: number;
  deletes: number;
  total: number;
}

export interface UseMicroCastingResult {
  program: ProgramItem[];
  voiceLines: VoiceLineOption[];
  pieces: Piece[];
  selectedPieceId: string | null;
  localCastings: PieceCasting[];
  activeDragId: string | null;
  artistMap: Map<string, Artist>;
  participationStatusMap: Map<string, ParticipationStatus>;
  pieceStatuses: Record<string, PieceCastingStatus>;
  projectParticipations: Participation[];
  isDirty: boolean;
  isSaving: boolean;
  pendingCounts: PendingCounts;
  pendingPieceSwitch: string | null;
  requestSelectPiece: (pieceId: string) => void;
  confirmPieceSwitch: () => void;
  cancelPieceSwitch: () => void;
  handleUpdateNote: (castingId: string, newNote: string) => void;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  saveChanges: () => Promise<void>;
  discardChanges: () => void;
}

const TEMP_PREFIX = "temp-";
const EMPTY_ARTISTS: Artist[] = [];
const EMPTY_PARTICIPATIONS: Participation[] = [];
const EMPTY_PIECE_CASTINGS: PieceCasting[] = [];
const EMPTY_PIECES: Piece[] = [];
const EMPTY_PROGRAM: ProgramItem[] = [];
const EMPTY_VOICE_LINES: VoiceLineOption[] = [];

const isTempId = (id: PieceCasting["id"]): boolean =>
  String(id).startsWith(TEMP_PREFIX);

const isCastingDifferent = (a: PieceCasting, b: PieceCasting): boolean =>
  a.voice_line !== b.voice_line ||
  (a.notes ?? "") !== (b.notes ?? "") ||
  Boolean(a.gives_pitch) !== Boolean(b.gives_pitch);

export const useMicroCasting = (projectId: string): UseMicroCastingResult => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const artistsQuery = useProjectArtistsDictionary();
  const piecesQuery = useProjectPiecesDictionary();
  const participationsQuery = useProjectParticipations(projectId);
  const voiceLinesQuery = useProjectVoiceLinesDictionary();
  const programQuery = useProjectProgram(projectId);
  const pieceCastingsQuery = useProjectPieceCastings(projectId);
  const artists = artistsQuery.data ?? EMPTY_ARTISTS;
  const pieces = piecesQuery.data ?? EMPTY_PIECES;
  const participations = participationsQuery.data ?? EMPTY_PARTICIPATIONS;
  const voiceLines = voiceLinesQuery.data ?? EMPTY_VOICE_LINES;
  const program = programQuery.data ?? EMPTY_PROGRAM;
  const pieceCastings = pieceCastingsQuery.data ?? EMPTY_PIECE_CASTINGS;

  const createMutation = useCreatePieceCasting(projectId);
  const updateMutation = useUpdatePieceCasting(projectId);
  const deleteMutation = useDeletePieceCasting(projectId);

  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [originalCastings, setOriginalCastings] = useState<PieceCasting[]>([]);
  const [localCastings, setLocalCastings] = useState<PieceCasting[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pendingPieceSwitch, setPendingPieceSwitch] = useState<string | null>(
    null,
  );

  const artistDictionary = useMemo(
    () => new Map(artists.map((artist) => [String(artist.id), artist])),
    [artists],
  );

  const projectParticipations = useMemo(
    () =>
      participations.filter(
        (participation) => String(participation.project) === String(projectId),
      ),
    [participations, projectId],
  );

  const artistMap = useMemo(() => {
    const map = new Map<string, Artist>();
    projectParticipations.forEach((participation) => {
      const artist = artistDictionary.get(String(participation.artist));
      if (artist) {
        map.set(String(participation.id), artist);
      }
    });
    return map;
  }, [artistDictionary, projectParticipations]);

  const participationStatusMap = useMemo(() => {
    const map = new Map<string, ParticipationStatus>();
    projectParticipations.forEach((participation) => {
      map.set(String(participation.id), participation.status);
    });
    return map;
  }, [projectParticipations]);

  // Auto-select first program piece when none is chosen yet.
  useEffect(() => {
    if (program.length > 0 && !selectedPieceId) {
      setSelectedPieceId(String(program[0].piece));
    }
  }, [program, selectedPieceId]);

  // Server-side castings filtered down to the selected piece.
  const serverCastingsForPiece = useMemo(() => {
    if (!selectedPieceId) return [];
    return pieceCastings.filter(
      (casting) =>
        String(casting.piece) === String(selectedPieceId) &&
        projectParticipations.some(
          (participation) =>
            String(participation.id) === String(casting.participation),
        ),
    );
  }, [pieceCastings, projectParticipations, selectedPieceId]);

  // Adopt server state as both baseline and draft whenever the piece changes.
  useEffect(() => {
    setOriginalCastings(serverCastingsForPiece);
    setLocalCastings(serverCastingsForPiece);
    // We re-baseline only on piece change. Server refetches while editing the
    // same piece must not clobber the user's draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPieceId]);

  // First load: when castings arrive after the piece was already selected,
  // only adopt them while the draft is still pristine.
  useEffect(() => {
    if (originalCastings.length === 0 && localCastings.length === 0) {
      if (serverCastingsForPiece.length > 0) {
        setOriginalCastings(serverCastingsForPiece);
        setLocalCastings(serverCastingsForPiece);
      }
    }
  }, [serverCastingsForPiece, originalCastings.length, localCastings.length]);

  const { isDirty, pendingCounts } = useMemo<{
    isDirty: boolean;
    pendingCounts: PendingCounts;
  }>(() => {
    const originalById = new Map(
      originalCastings.map((casting) => [String(casting.id), casting]),
    );
    const localIds = new Set(
      localCastings.map((casting) => String(casting.id)),
    );

    let creates = 0;
    let updates = 0;
    let deletes = 0;

    for (const casting of localCastings) {
      if (isTempId(casting.id)) {
        creates += 1;
        continue;
      }
      const original = originalById.get(String(casting.id));
      if (original && isCastingDifferent(original, casting)) {
        updates += 1;
      }
    }

    for (const casting of originalCastings) {
      if (!localIds.has(String(casting.id))) {
        deletes += 1;
      }
    }

    const total = creates + updates + deletes;
    return {
      isDirty: total > 0,
      pendingCounts: { creates, updates, deletes, total },
    };
  }, [localCastings, originalCastings]);

  // Status indicator for each piece in the program dropdown.
  // For the currently selected piece, factor the user's draft (so deficits
  // reflect the still-unsaved roster).
  const pieceStatuses = useMemo<Record<string, PieceCastingStatus>>(() => {
    const statuses: Record<string, PieceCastingStatus> = {};

    program.forEach((item) => {
      const pieceId = String(item.piece);
      const piece = pieces.find(
        (candidate) => String(candidate.id) === pieceId,
      );
      const requirements: VoiceRequirement[] =
        piece?.voice_requirements_read ?? [];

      if (requirements.length === 0) {
        statuses[pieceId] = "FREE";
        return;
      }

      const effectiveCastings =
        pieceId === String(selectedPieceId)
          ? localCastings
          : pieceCastings.filter(
              (casting) => String(casting.piece) === pieceId,
            );

      let missing = 0;
      requirements.forEach((requirement) => {
        const assigned = effectiveCastings.filter(
          (casting) => casting.voice_line === requirement.voice_line,
        ).length;
        if (assigned < requirement.quantity) {
          missing += requirement.quantity - assigned;
        }
      });

      statuses[pieceId] = missing > 0 ? "DEFICIT" : "OK";
    });

    return statuses;
  }, [pieceCastings, pieces, program, selectedPieceId, localCastings]);

  const handleUpdateNote = useCallback(
    (castingId: string, newNote: string): void => {
      setLocalCastings((previous) =>
        previous.map((casting) =>
          String(casting.id) === castingId
            ? { ...casting, notes: newNote }
            : casting,
        ),
      );
    },
    [],
  );

  const handleDragStart = useCallback((event: DragStartEvent): void => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      setActiveDragId(null);

      const { active, over } = event;
      if (!over || !selectedPieceId || isSaving) return;

      const participationId = String(active.id);
      const draggedParticipation = projectParticipations.find(
        (participation) => String(participation.id) === participationId,
      );
      if (draggedParticipation && draggedParticipation.status !== "CON") {
        return;
      }

      const targetVoiceLineId = String(over.id);

      setLocalCastings((previous) => {
        const existing = previous.find(
          (casting) => String(casting.participation) === participationId,
        );

        if (targetVoiceLineId === "UNASSIGNED") {
          if (!existing) return previous;
          return previous.filter(
            (casting) => String(casting.participation) !== participationId,
          );
        }

        const targetVoiceLine =
          targetVoiceLineId as PieceCasting["voice_line"];

        if (existing && existing.voice_line === targetVoiceLine) {
          return previous;
        }

        if (existing) {
          return previous.map((casting) =>
            String(casting.participation) === participationId
              ? { ...casting, voice_line: targetVoiceLine }
              : casting,
          );
        }

        const optimistic: PieceCasting = {
          id: `${TEMP_PREFIX}${Date.now()}-${participationId}`,
          participation: participationId,
          piece: selectedPieceId,
          voice_line: targetVoiceLine,
          gives_pitch: false,
        };
        return [...previous, optimistic];
      });
    },
    [isSaving, projectParticipations, selectedPieceId],
  );

  const discardChanges = useCallback((): void => {
    setLocalCastings(originalCastings);
  }, [originalCastings]);

  const saveChanges = useCallback(async (): Promise<void> => {
    if (!isDirty || isSaving || !selectedPieceId) return;
    setIsSaving(true);

    const originalById = new Map(
      originalCastings.map((casting) => [String(casting.id), casting]),
    );
    const localIds = new Set(
      localCastings.map((casting) => String(casting.id)),
    );

    type Operation =
      | { kind: "create"; casting: PieceCasting }
      | { kind: "update"; id: string; casting: PieceCasting }
      | { kind: "delete"; id: string };

    const operations: Operation[] = [];

    for (const casting of localCastings) {
      if (isTempId(casting.id)) {
        operations.push({ kind: "create", casting });
        continue;
      }
      const original = originalById.get(String(casting.id));
      if (original && isCastingDifferent(original, casting)) {
        operations.push({ kind: "update", id: String(casting.id), casting });
      }
    }
    for (const casting of originalCastings) {
      if (!localIds.has(String(casting.id))) {
        operations.push({ kind: "delete", id: String(casting.id) });
      }
    }

    const runOperation = async (operation: Operation): Promise<void> => {
      switch (operation.kind) {
        case "create":
          await createMutation.mutateAsync({
            participation: String(operation.casting.participation),
            piece: String(operation.casting.piece),
            voice_line: operation.casting.voice_line,
            gives_pitch: operation.casting.gives_pitch ?? false,
            notes: operation.casting.notes ?? undefined,
          });
          return;
        case "update":
          await updateMutation.mutateAsync({
            id: operation.id,
            data: {
              voice_line: operation.casting.voice_line,
              notes: operation.casting.notes ?? "",
              gives_pitch: operation.casting.gives_pitch ?? false,
            },
          });
          return;
        case "delete":
          await deleteMutation.mutateAsync(operation.id);
          return;
      }
    };

    try {
      // Order matters: deletes first to free slots that creates may target,
      // then updates, then creates. Within each phase we run in parallel.
      const deletes = operations.filter((operation) => operation.kind === "delete");
      const updates = operations.filter((operation) => operation.kind === "update");
      const creates = operations.filter((operation) => operation.kind === "create");

      if (deletes.length > 0) await Promise.all(deletes.map(runOperation));
      if (updates.length > 0) await Promise.all(updates.map(runOperation));
      if (creates.length > 0) await Promise.all(creates.map(runOperation));

      // Re-baseline from the freshest cache snapshot. Mutations have already
      // swapped temp IDs for real ones via their onSuccess handlers.
      const refreshed =
        queryClient.getQueryData<PieceCasting[]>(
          projectKeys.pieceCastings.byProject(projectId),
        ) ?? [];
      const refreshedForPiece = refreshed.filter(
        (casting) =>
          String(casting.piece) === String(selectedPieceId) &&
          projectParticipations.some(
            (participation) =>
              String(participation.id) === String(casting.participation),
          ),
      );
      setOriginalCastings(refreshedForPiece);
      setLocalCastings(refreshedForPiece);

      toast.success(
        t("projects.micro_cast.toast.save_success", "Casting zapisany"),
        {
          description: t(
            "projects.micro_cast.toast.save_success_desc",
            "Wszystkie zmiany zostały zsynchronizowane.",
          ),
        },
      );
    } catch {
      // Mutation hooks already toast on error and revert their slice of cache.
      // Local state stays dirty so the user can review and retry.
    } finally {
      setIsSaving(false);
    }
  }, [
    createMutation,
    deleteMutation,
    isDirty,
    isSaving,
    localCastings,
    originalCastings,
    projectId,
    projectParticipations,
    queryClient,
    selectedPieceId,
    t,
    updateMutation,
  ]);

  const requestSelectPiece = useCallback(
    (pieceId: string): void => {
      if (pieceId === selectedPieceId) return;
      if (isDirty) {
        setPendingPieceSwitch(pieceId);
        return;
      }
      setSelectedPieceId(pieceId);
    },
    [isDirty, selectedPieceId],
  );

  const confirmPieceSwitch = useCallback((): void => {
    if (!pendingPieceSwitch) return;
    setLocalCastings(originalCastings);
    setSelectedPieceId(pendingPieceSwitch);
    setPendingPieceSwitch(null);
  }, [originalCastings, pendingPieceSwitch]);

  const cancelPieceSwitch = useCallback((): void => {
    setPendingPieceSwitch(null);
  }, []);

  return {
    program,
    voiceLines,
    pieces,
    selectedPieceId,
    localCastings,
    activeDragId,
    artistMap,
    participationStatusMap,
    pieceStatuses,
    projectParticipations,
    isDirty,
    isSaving,
    pendingCounts,
    pendingPieceSwitch,
    requestSelectPiece,
    confirmPieceSwitch,
    cancelPieceSwitch,
    handleUpdateNote,
    handleDragStart,
    handleDragEnd,
    saveChanges,
    discardChanges,
  };
};
