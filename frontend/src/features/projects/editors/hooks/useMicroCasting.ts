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
  VoiceType,
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
import { scopedRequirements } from "@/features/archive/constants/divisiScope";
import { voiceTypeRank } from "../../lib/voiceFamilies";

/**
 * One castable person on this project. The board used to read the artist
 * dictionary directly and skip whatever it could not resolve, which let the
 * unassigned counter promise four people and the list show two — holes the
 * conductor was told about but could not see. A participation always yields a
 * member here, falling back to the name the participation itself carries.
 */
export interface CastMember {
  readonly participationId: string;
  readonly displayName: string;
  readonly voiceType: VoiceType | null;
  /** Localised voice type ("Sopran"); empty when the roster record is gone. */
  readonly voiceLabel: string;
  readonly status: ParticipationStatus;
  /** No roster record behind this participation — identity is a fallback. */
  readonly isUnresolved: boolean;
}

/**
 * How far one piece is from being cast. `filled` counts covered SEATS, so
 * over-filling one line can never mask a hole in another, and a declined singer
 * never counts as cover.
 */
export interface PieceProgress {
  readonly required: number;
  readonly filled: number;
  readonly missing: number;
  readonly hasRequirements: boolean;
}

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
  /** Everyone on the project, in roster order (voice type, then name). */
  members: CastMember[];
  memberMap: Map<string, CastMember>;
  pieceProgress: Record<string, PieceProgress>;
  /**
   * The board cannot be drawn from a half-loaded cache: a programme without its
   * piece dictionary reads as "this piece declares no voice requirements", which
   * is a different screen entirely.
   */
  isLoading: boolean;
  isDirty: boolean;
  isSaving: boolean;
  pendingCounts: PendingCounts;
  pendingPieceSwitch: string | null;
  requestSelectPiece: (pieceId: string) => void;
  confirmPieceSwitch: () => void;
  cancelPieceSwitch: () => void;
  handleUpdateNote: (castingId: string, newNote: string) => void;
  handleTogglePitch: (castingId: string) => void;
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
  const isLoading =
    piecesQuery.isLoading ||
    programQuery.isLoading ||
    participationsQuery.isLoading ||
    pieceCastingsQuery.isLoading;

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

  const members = useMemo<CastMember[]>(() => {
    const unknownName = t(
      "projects.micro_cast.artist.unknown",
      "Nieznany uczestnik",
    );

    return projectParticipations
      .map((participation) => {
        const artist = artistDictionary.get(String(participation.artist));
        const voiceType = artist?.voice_type ?? null;

        return {
          participationId: String(participation.id),
          displayName: artist
            ? `${artist.first_name} ${artist.last_name}`.trim()
            : participation.artist_name?.trim() || unknownName,
          voiceType,
          voiceLabel: voiceType
            ? t(
                `dashboard.layout.roles.${voiceType}`,
                artist?.voice_type_display ?? voiceType,
              )
            : (participation.artist_voice_type_display ?? ""),
          status: participation.status,
          isUnresolved: !artist,
        };
      })
      .sort((left, right) => {
        const rankDelta =
          voiceTypeRank(left.voiceType) - voiceTypeRank(right.voiceType);
        if (rankDelta !== 0) return rankDelta;
        return left.displayName.localeCompare(right.displayName);
      });
  }, [artistDictionary, projectParticipations, t]);

  const memberMap = useMemo(
    () =>
      new Map(members.map((member) => [member.participationId, member])),
    [members],
  );

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

  // Fulfilment of every piece in the programme, so the rail can say which ones
  // are still short before any of them is opened. The selected piece is scored
  // against the user's draft, so the rail moves while the board is being built.
  const pieceProgress = useMemo<Record<string, PieceProgress>>(() => {
    const progress: Record<string, PieceProgress> = {};

    program.forEach((item) => {
      const pieceId = String(item.piece);
      const piece = pieces.find(
        (candidate) => String(candidate.id) === pieceId,
      );
      // Scored against the arrangement this concert binds, so a piece with a
      // unison edition is not reported short by the three-part edition's lines.
      const requirements: VoiceRequirement[] = scopedRequirements(
        piece,
        item.score_edition,
      );

      if (requirements.length === 0) {
        progress[pieceId] = {
          required: 0,
          filled: 0,
          missing: 0,
          hasRequirements: false,
        };
        return;
      }

      const effectiveCastings =
        pieceId === String(selectedPieceId)
          ? localCastings
          : pieceCastings.filter(
              (casting) => String(casting.piece) === pieceId,
            );

      let required = 0;
      let filled = 0;
      let missing = 0;

      requirements.forEach((requirement) => {
        // A declined singer left on a line does not fill it — the seat is a hole the
        // conductor has to see, so it keeps counting towards the deficit.
        const assigned = effectiveCastings.filter(
          (casting) =>
            casting.voice_line === requirement.voice_line &&
            memberMap.get(String(casting.participation))?.status !== "DEC",
        ).length;

        required += requirement.quantity;
        filled += Math.min(assigned, requirement.quantity);
        if (assigned < requirement.quantity) {
          missing += requirement.quantity - assigned;
        }
      });

      progress[pieceId] = { required, filled, missing, hasRequirements: true };
    });

    return progress;
  }, [pieceCastings, pieces, program, selectedPieceId, localCastings, memberMap]);

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

  // Who sounds the starting pitch for this piece. The flag is read by the call
  // sheet, the score package and the singer's own piece page; until now it could
  // only be set in the Django admin, which is why it was always false.
  const handleTogglePitch = useCallback((castingId: string): void => {
    setLocalCastings((previous) =>
      previous.map((casting) =>
        String(casting.id) === castingId
          ? { ...casting, gives_pitch: !casting.gives_pitch }
          : casting,
      ),
    );
  }, []);

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
    members,
    memberMap,
    pieceProgress,
    isLoading,
    isDirty,
    isSaving,
    pendingCounts,
    pendingPieceSwitch,
    requestSelectPiece,
    confirmPieceSwitch,
    cancelPieceSwitch,
    handleUpdateNote,
    handleTogglePitch,
    handleDragStart,
    handleDragEnd,
    saveChanges,
    discardChanges,
  };
};
