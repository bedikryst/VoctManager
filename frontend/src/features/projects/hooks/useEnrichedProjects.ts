/**
 * @file useEnrichedProjects.ts
 * @description Single source of truth for hydrated Project entities.
 * Resolves conductor (artist FK → object) and location (FK → object) references
 * against their dictionaries so every surface — dashboard list and project hub —
 * renders an identical, fully-resolved Project. Extracted from the dashboard hook
 * to guarantee the hub never re-derives this with subtly different logic.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/hooks/useEnrichedProjects
 */

import { useMemo } from "react";

import type { Artist, Project } from "@/shared/types";
import { useLocations } from "@/features/logistics/api/logistics.queries";
import type { LocationDto } from "@/features/logistics/types/logistics.dto";
import {
  useProject,
  useProjectArtistsMap,
  useProjects,
} from "../api/project.queries";

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

function extractData<T>(data: T[] | PaginatedResponse<T> | unknown): T[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data;
  }

  if (typeof data === "object" && data !== null && "results" in data) {
    const paginatedData = data as PaginatedResponse<T>;
    if (Array.isArray(paginatedData.results)) {
      return paginatedData.results;
    }
  }

  return [];
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isArtistReference = (value: Project["conductor"]): value is Artist =>
  typeof value === "object" &&
  value !== null &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.first_name) &&
  isNonEmptyString(value.last_name);

const isLocationReference = (
  value: Project["location"],
): value is NonNullable<Project["location"]> =>
  typeof value === "object" && value !== null && isNonEmptyString(value.id);

const buildArtistDisplayName = (
  artist: Artist | null | undefined,
): string | null => {
  if (!artist) {
    return null;
  }

  const displayName = `${artist.first_name} ${artist.last_name}`.trim();
  return displayName.length > 0 ? displayName : null;
};

const resolveProjectLocation = (
  project: Project,
  locationMap: Map<string, LocationDto>,
): Project["location"] => {
  if (!project.location) {
    return null;
  }

  if (!isLocationReference(project.location)) {
    return null;
  }

  return locationMap.get(project.location.id) ?? project.location;
};

const resolveProjectConductor = (
  project: Project,
  artistMap: Map<string, Artist>,
): Pick<Project, "conductor" | "conductor_name"> => {
  if (!project.conductor) {
    return {
      conductor: null,
      conductor_name: project.conductor_name ?? null,
    };
  }

  if (typeof project.conductor === "string") {
    const resolvedArtist = artistMap.get(project.conductor);

    return {
      conductor: resolvedArtist ?? project.conductor,
      conductor_name:
        project.conductor_name ?? buildArtistDisplayName(resolvedArtist),
    };
  }

  if (!isArtistReference(project.conductor)) {
    return {
      conductor: null,
      conductor_name: project.conductor_name ?? null,
    };
  }

  return {
    conductor: project.conductor,
    conductor_name:
      project.conductor_name ?? buildArtistDisplayName(project.conductor),
  };
};

/**
 * Returns every project with conductor + location references hydrated.
 * Backed by suspense queries, so callers must sit under a `<Suspense>` boundary.
 */
export const useEnrichedProjects = (): Project[] => {
  const { data: rawProjects } = useProjects();
  const { data: artistMap } = useProjectArtistsMap();
  const { data: locationsData } = useLocations();

  const locationMap = useMemo(() => {
    const validLocations = extractData<LocationDto>(locationsData);

    return new Map(
      validLocations.map((location) => [String(location.id), location]),
    );
  }, [locationsData]);

  return useMemo(() => {
    const validProjects = extractData<Project>(rawProjects);

    return validProjects.map((project) => {
      const location = resolveProjectLocation(project, locationMap);
      const conductor = resolveProjectConductor(project, artistMap);

      return {
        ...project,
        location,
        ...conductor,
      };
    });
  }, [artistMap, locationMap, rawProjects]);
};

/**
 * Returns one hydrated project by id, or `null` when it cannot be resolved.
 * Fetches the project through its own `GET /api/projects/:id/` query
 * ({@link useProject}) rather than scanning the list, so the hub deep-links
 * reliably regardless of list pagination. Runs the exact same conductor +
 * location resolution as {@link useEnrichedProjects}, so the object is
 * byte-identical to the one the dashboard renders.
 */
export const useEnrichedProject = (
  projectId: string | undefined,
): Project | null => {
  const { data: project } = useProject(projectId);
  const { data: artistMap } = useProjectArtistsMap();
  const { data: locationsData } = useLocations();

  const locationMap = useMemo(() => {
    const validLocations = extractData<LocationDto>(locationsData);

    return new Map(
      validLocations.map((location) => [String(location.id), location]),
    );
  }, [locationsData]);

  return useMemo(() => {
    if (!project) return null;

    const location = resolveProjectLocation(project, locationMap);
    const conductor = resolveProjectConductor(project, artistMap);

    return {
      ...project,
      location,
      ...conductor,
    };
  }, [project, artistMap, locationMap]);
};
