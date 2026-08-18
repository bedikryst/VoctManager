/**
 * @file useCastTab.ts
 * @description State and mutation controller for the vocal casting tab.
 * The cast is derived from the PARTICIPATIONS, not from the roster dictionary:
 * a participation whose artist record has since been archived still belongs to
 * this project, and resolving the list through the dictionary silently dropped
 * those rows while the header kept counting them — the same defect the divisi
 * board carried until the Divisi pass rooted it out.
 * The pool is the other half: active roster members without a participation.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/hooks/useCastTab
 */

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import { toastApiError } from "@/shared/api/errors";
import { foldDiacritics } from "@/shared/lib/text";
import type {
  Artist,
  Participation,
  ParticipationStatus,
  VoiceLine,
  VoiceType,
} from "@/shared/types";
import type { SelectOption } from "@/shared/ui/primitives/Select";
import {
  useCreateParticipation,
  useDeleteParticipation,
  useProjectArtistsDictionary,
  useProjectParticipations,
  useProjectVoiceLinesDictionary,
  useUpdateParticipation,
} from "../../api/project.queries";
import { LINE_UP_SEATS } from "../../lib/autoCast";
import { VOICE_TYPE_ORDER, voiceTypeRank } from "../../lib/voiceFamilies";
import type { CastTabMobileView } from "../types";

/** What both columns show about a singer, wherever the record came from. */
interface RosterFacts {
  readonly displayName: string;
  readonly voiceType: VoiceType | null;
  /** Localised voice type ("Sopran"); empty when the roster record is gone. */
  readonly voiceLabel: string;
  /** "A2–G4", or null when no range is recorded. */
  readonly rangeLabel: string | null;
  readonly sightReading: number | null;
}

export interface PoolEntry extends RosterFacts {
  readonly artistId: string;
}

export interface CastEntry extends RosterFacts {
  readonly participationId: string;
  readonly artistId: string;
  readonly status: ParticipationStatus;
  /**
   * Their seat in this concert's line-up; `""` = none, which the automatic fill
   * reads as "derive it from their voice type".
   */
  readonly seat: VoiceLine | "";
  /** No roster record behind this participation — identity is a fallback. */
  readonly isUnresolved: boolean;
}

export interface VoiceSection<TEntry> {
  readonly key: string;
  readonly label: string;
  readonly entries: readonly TEntry[];
}

/**
 * One voice type's standing on this project. `castCount` excludes declines —
 * a singer who said no is not cover, the rule the divisi buckets already use.
 * `poolCount` is what makes a zero actionable rather than a verdict: nobody
 * cast AND candidates available is a hole; nobody cast and nobody available is
 * simply an ensemble without that voice.
 */
export interface CastBalanceEntry {
  readonly voiceType: VoiceType;
  readonly label: string;
  readonly castCount: number;
  readonly poolCount: number;
}

export interface UseCastTabResult {
  /**
   * The roster and the participations are still in flight. Until both land the
   * tab must not draw its empty state: "nobody is cast" is a statement about
   * the concert, and a cold cache would make it before anything was known.
   */
  isLoading: boolean;
  castSections: readonly VoiceSection<CastEntry>[];
  poolSections: readonly VoiceSection<PoolEntry>[];
  castCount: number;
  poolCount: number;
  castBalance: readonly CastBalanceEntry[];
  /** The line-up's vocabulary, in score order, for the per-singer seat picker. */
  seatOptions: readonly SelectOption[];
  setSeat: (participationId: string, seat: string) => Promise<void>;
  /** Any write is in flight — what the autosave pill reports. */
  isSaving: boolean;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  processingId: string | null;
  mobileView: CastTabMobileView;
  setMobileView: Dispatch<SetStateAction<CastTabMobileView>>;
  addToCast: (artistId: string) => Promise<void>;
  removeFromCast: (artistId: string, participationId: string) => Promise<void>;
}

const EMPTY_ARTISTS: Artist[] = [];
const EMPTY_PARTICIPATIONS: Participation[] = [];

const rangeOf = (artist?: Artist): string | null => {
  if (!artist?.vocal_range_bottom && !artist?.vocal_range_top) return null;
  return `${artist?.vocal_range_bottom || "?"}–${artist?.vocal_range_top || "?"}`;
};

/** Score order (soprano down to bass), then surname — how a roster is read. */
const byVoiceThenName = <TEntry extends RosterFacts>(
  left: TEntry,
  right: TEntry,
): number => {
  const rankDelta =
    voiceTypeRank(left.voiceType) - voiceTypeRank(right.voiceType);
  if (rankDelta !== 0) return rankDelta;
  return left.displayName.localeCompare(right.displayName, "pl");
};

/** Buckets an already-ordered list into voice sections, keeping that order. */
const sectionize = <TEntry extends RosterFacts>(
  entries: readonly TEntry[],
  unknownLabel: string,
): VoiceSection<TEntry>[] => {
  const buckets = new Map<string, TEntry[]>();

  for (const entry of entries) {
    const key = entry.voiceType ?? "?";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  return [...buckets.entries()].map(([key, bucketEntries]) => ({
    key,
    // The "?" bucket is everyone the roster has no voice type for, so it takes
    // the unknown label outright — an archived participation can still carry a
    // stale display voice, and letting the first one name the group would title
    // the no-voice section "Sopran".
    label:
      key === "?" ? unknownLabel : bucketEntries[0].voiceLabel || unknownLabel,
    entries: bucketEntries,
  }));
};

export const useCastTab = (projectId: string): UseCastTabResult => {
  const { t } = useTranslation();

  const artistsQuery = useProjectArtistsDictionary();
  const participationsQuery = useProjectParticipations(projectId);
  const voiceLinesQuery = useProjectVoiceLinesDictionary();
  const artists = artistsQuery.data ?? EMPTY_ARTISTS;
  const participations = participationsQuery.data ?? EMPTY_PARTICIPATIONS;

  const createParticipationMutation = useCreateParticipation(projectId);
  const updateParticipationMutation = useUpdateParticipation(projectId);
  const deleteParticipationMutation = useDeleteParticipation(projectId);

  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  // The work product first, as on desktop, where it holds the left column.
  const [mobileView, setMobileView] = useState<CastTabMobileView>("ASSIGNED");

  const artistById = useMemo(
    () => new Map(artists.map((artist) => [String(artist.id), artist])),
    [artists],
  );

  const assignedIds = useMemo(
    () =>
      new Set(
        participations.map((participation) => String(participation.artist)),
      ),
    [participations],
  );

  const castEntries = useMemo<CastEntry[]>(() => {
    const unknownName = t("projects.cast.card.unknown", "Nieznany uczestnik");

    return participations
      .map((participation) => {
        const artist = artistById.get(String(participation.artist));
        const voiceType = artist?.voice_type ?? null;

        return {
          participationId: String(participation.id),
          artistId: String(participation.artist),
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
          rangeLabel: rangeOf(artist),
          sightReading: artist?.sight_reading_skill ?? null,
          status: participation.status,
          seat: participation.default_voice_line ?? "",
          isUnresolved: !artist,
        };
      })
      .sort(byVoiceThenName);
  }, [artistById, participations, t]);

  /** Everyone castable and not yet cast — the search is scoped to this list. */
  const poolEntries = useMemo<PoolEntry[]>(
    () =>
      artists
        .filter(
          (artist) =>
            artist.is_active !== false && !assignedIds.has(String(artist.id)),
        )
        .map((artist) => ({
          artistId: String(artist.id),
          displayName: `${artist.first_name} ${artist.last_name}`.trim(),
          voiceType: artist.voice_type,
          voiceLabel: t(
            `dashboard.layout.roles.${artist.voice_type}`,
            artist.voice_type_display ?? artist.voice_type,
          ),
          rangeLabel: rangeOf(artist),
          sightReading: artist.sight_reading_skill ?? null,
        }))
        .sort(byVoiceThenName),
    [artists, assignedIds, t],
  );

  // Searching answers "who can I add?", so it filters the pool alone. Filtering
  // the cast with the same field hid people who ARE cast and left the two
  // column counters counting different universes while a query was live.
  const filteredPool = useMemo(() => {
    const query = foldDiacritics(searchQuery.trim());
    if (!query) return poolEntries;

    return poolEntries.filter((entry) =>
      foldDiacritics(`${entry.displayName} ${entry.voiceLabel}`).includes(
        query,
      ),
    );
  }, [poolEntries, searchQuery]);

  const unknownVoiceLabel = t("projects.cast.voice_unknown", "Bez głosu");

  const castSections = useMemo(
    () => sectionize(castEntries, unknownVoiceLabel),
    [castEntries, unknownVoiceLabel],
  );

  const poolSections = useMemo(
    () => sectionize(filteredPool, unknownVoiceLabel),
    [filteredPool, unknownVoiceLabel],
  );

  const castBalance = useMemo<CastBalanceEntry[]>(() => {
    const countBy = (
      entries: readonly RosterFacts[],
      voiceType: VoiceType,
    ): number =>
      entries.filter((entry) => entry.voiceType === voiceType).length;

    const engaged = castEntries.filter((entry) => entry.status !== "DEC");

    return (
      VOICE_TYPE_ORDER
        // The conductor is not part of the vocal cast on this tab; a "Dyrygent 0"
        // in the balance rail would be a warning about a role nobody casts here.
        .filter((voiceType) => voiceType !== "DIR")
        .map((voiceType) => ({
          voiceType,
          label: t(`dashboard.layout.roles.${voiceType}`, voiceType),
          castCount: countBy(engaged, voiceType),
          poolCount: countBy(poolEntries, voiceType),
        }))
        .filter((entry) => entry.castCount > 0 || entry.poolCount > 0)
    );
  }, [castEntries, poolEntries, t]);

  /**
   * The picker names the vocabulary a seat is chosen FROM, so its entries keep
   * their index ("Sopran 1") even when the concert ends up using one line of
   * that family. Collapsing belongs where a part is being READ — on the board,
   * in the songbook — not where it is being picked.
   */
  const seatOptions = useMemo<SelectOption[]>(() => {
    const byCode = new Map(
      voiceLinesQuery.data.map((line) => [String(line.value), line.label]),
    );
    return LINE_UP_SEATS.flatMap((code) => {
      const label = byCode.get(code);
      return label ? [{ value: code, label }] : [];
    });
  }, [voiceLinesQuery.data]);

  const setSeat = async (
    participationId: string,
    seat: string,
  ): Promise<void> => {
    try {
      await updateParticipationMutation.mutateAsync({
        id: participationId,
        data: { default_voice_line: seat as VoiceLine | "" },
      });
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t(
          "common.errors.database_error",
          "Wystąpił problem z połączeniem z bazą danych.",
        ),
      });
    }
  };

  const addToCast = async (artistId: string): Promise<void> => {
    setProcessingId(artistId);

    try {
      const existingDeclined = participations.find(
        (participation) =>
          String(participation.artist) === artistId &&
          participation.status === "DEC",
      );

      if (existingDeclined) {
        // Re-adding someone who declined asks them again — it does not answer
        // for them. Confirming on their behalf would also skip them at
        // publication, which only addresses people still awaiting an answer.
        await updateParticipationMutation.mutateAsync({
          id: String(existingDeclined.id),
          data: { status: "INV" },
        });
      } else {
        await createParticipationMutation.mutateAsync({
          artist: artistId,
          project: projectId,
          status: "INV",
        });
      }
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t(
          "common.errors.database_error",
          "Wystąpił problem z połączeniem z bazą danych.",
        ),
      });
    } finally {
      setProcessingId(null);
    }
  };

  const removeFromCast = async (
    artistId: string,
    participationId: string,
  ): Promise<void> => {
    setProcessingId(artistId);

    try {
      await deleteParticipationMutation.mutateAsync(participationId);
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t(
          "common.errors.database_error",
          "Wystąpił problem z połączeniem z bazą danych.",
        ),
      });
    } finally {
      setProcessingId(null);
    }
  };

  return {
    isLoading: artistsQuery.isLoading || participationsQuery.isLoading,
    castSections,
    poolSections,
    castCount: castEntries.length,
    poolCount: filteredPool.length,
    castBalance,
    seatOptions,
    setSeat,
    isSaving: processingId !== null || updateParticipationMutation.isPending,
    searchQuery,
    setSearchQuery,
    processingId,
    mobileView,
    setMobileView,
    addToCast,
    removeFromCast,
  };
};
