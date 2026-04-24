/**
 * @file useMaterialsData.ts
 * @description Transforms the pre-aggregated server response into view-ready groups.
 * All client-side work is limited to: sorting, track prioritisation, and search filtering.
 * No joins, no N+1 enrichment — that is now owned by the backend CQRS query.
 */

import { useMemo } from "react";
import { compareAsc, parseISO } from "date-fns";
import { useArtistMaterialsDashboard } from "../api/materials.queries";
import type {
  MaterialsDashboardGroup,
  MaterialsProgramItem,
} from "../types/materials.dto";

const prioritiseMyTrack = (item: MaterialsProgramItem): MaterialsProgramItem => {
  const { piece } = item;
  if (!piece.my_casting) return item;

  const myVoicePart = piece.my_casting.voice_line;
  const sortedTracks = [...piece.tracks].sort((a, b) => {
    const aIsMe = a.voice_part === myVoicePart;
    const bIsMe = b.voice_part === myVoicePart;
    return aIsMe === bIsMe ? 0 : aIsMe ? -1 : 1;
  });

  return { ...item, piece: { ...piece, tracks: sortedTracks } };
};

export const useMaterialsData = (searchQuery = "", enabled = true) => {
  const { data, isLoading, isError } = useArtistMaterialsDashboard(enabled);

  const groupedMaterials = useMemo<MaterialsDashboardGroup[]>(() => {
    if (!data?.length) return [];

    return data
      .filter(
        (item) =>
          item.participation_status !== "DEC" &&
          item.project.status !== "CANC",
      )
      .map((item) => ({
        project: item.project,
        participationId: item.participation_id,
        participationStatus: item.participation_status,
        fee: item.fee,
        program: item.program.map(prioritiseMyTrack),
      }))
      .sort((a, b) => {
        if (a.project.status !== "DONE" && b.project.status === "DONE")
          return -1;
        if (a.project.status === "DONE" && b.project.status !== "DONE")
          return 1;
        return compareAsc(
          parseISO(a.project.date_time),
          parseISO(b.project.date_time),
        );
      });
  }, [data]);

  const filteredGroups = useMemo<MaterialsDashboardGroup[]>(() => {
    if (!searchQuery) return groupedMaterials;

    const term = searchQuery.toLowerCase();

    return groupedMaterials
      .map((group) => ({
        ...group,
        program: group.program.filter(
          (item) =>
            item.piece.title.toLowerCase().includes(term) ||
            (item.piece.composer?.last_name ?? "").toLowerCase().includes(term),
        ),
      }))
      .filter((group) => group.program.length > 0);
  }, [groupedMaterials, searchQuery]);

  return { isLoading, isError, filteredGroups };
};
