/**
 * @file useMicroCasting.ts
 * @description State controller for the Micro-Casting Kanban board.
 * Holds an in-memory draft (`localCastings`) decoupled from server state. All drag &
 * drop and note edits stay local until the user explicitly commits via `saveChanges`,
 * which sends the board for the selected piece as one declarative write.
 * The committed snapshot (`originalCastings`) is the diff baseline behind the pending
 * counts; switching pieces while dirty is gated through `requestSelectPiece` so the UI
 * can render a guard.
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
  useProjectArtistsDictionary,
  useProjectParticipations,
  useProjectPieceCastings,
  useProjectPiecesDictionary,
  useProjectProgram,
  useProjectVoiceLinesDictionary,
  useSavePieceCastingBoard,
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

  const saveMutation = useSavePieceCastingBoard(projectId);
  const isSaving = saveMutation.isPending;

  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [originalCastings, setOriginalCastings] = useState<PieceCasting[]>([]);
  const [localCastings, setLocalCastings] = useState<PieceCasting[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
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
        // A declined singer left on a line does not fill it — the seat is a hole the
        // conductor has to see, so it keeps counting towards the deficit.
        const assigned = effectiveCastings.filter(
          (casting) =>
            casting.voice_line === requirement.voice_line &&
            participationStatusMap.get(String(casting.participation)) !== "DEC",
        ).length;
        if (assigned < requirement.quantity) {
          missing += requirement.quantity - assigned;
        }
      });

      statuses[pieceId] = missing > 0 ? "DEFICIT" : "OK";
    });

    return statuses;
  }, [
    pieceCastings,
    pieces,
    program,
    selectedPieceId,
    localCastings,
    participationStatusMap,
  ]);

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
      // Casting states an intention, not consent: a singer who has not answered yet
      // (every singer, on an unpublished project) can still be placed on a voice
      // line. Only a decline is refused — that seat is known to be empty.
      if (draggedParticipation && draggedParticipation.status === "DEC") {
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

    try {
      // The whole board goes up, not the diff: the server reconciles it in one
      // transaction, so a save can no longer half-succeed — and each affected
      // singer hears about it once instead of once per drag.
      const board = await saveMutation.mutateAsync({
        project: projectId,
        piece: selectedPieceId,
        castings: localCastings.map((casting) => ({
          participation: String(casting.participation),
          voice_line: casting.voice_line,
          gives_pitch: casting.gives_pitch ?? false,
          notes: casting.notes ?? "",
        })),
      });

      // What came back is what was persisted — real ids in place of the local
      // draft's temporary ones. It is the only honest baseline.
      setOriginalCastings(board);
      setLocalCastings(board);

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
      // The mutation already toasted the reason. The draft stays dirty so the
      // user can review and retry rather than lose the board they built.
    }
  }, [
    isDirty,
    isSaving,
    localCastings,
    projectId,
    saveMutation,
    selectedPieceId,
    t,
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
