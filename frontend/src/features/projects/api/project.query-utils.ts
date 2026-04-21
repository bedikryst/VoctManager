/**
 * @file project.query-utils.ts
 * @description Shared cache policies and optimistic list helpers for project queries.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

export const STATIC_DICTIONARY_STALE_TIME = 1000 * 60 * 60 * 24;
export const PROJECT_RELATION_STALE_TIME = 1000 * 60 * 5;
export const FAST_CHANGING_STALE_TIME = 1000 * 60;

const OPTIMISTIC_ID_PREFIX = "optimistic";

const buildUniqueToken = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getRequiredProjectId = (
  projectId: string | undefined,
): string => {
  if (!projectId) {
    throw new Error("Project ID is required for project relation queries.");
  }

  return projectId;
};

export const buildOptimisticId = (entity: string): string =>
  `${OPTIMISTIC_ID_PREFIX}-${entity}-${buildUniqueToken()}`;

export const replaceEntityById = <T extends { id: string | number }>(
  entities: T[] | undefined,
  targetId: string,
  nextEntity: T,
): T[] | undefined =>
  entities?.map((entity) =>
    String(entity.id) === targetId ? nextEntity : entity,
  );

export const removeEntityById = <T extends { id: string | number }>(
  entities: T[] | undefined,
  targetId: string,
): T[] | undefined =>
  entities?.filter((entity) => String(entity.id) !== targetId);

export const upsertEntityById = <T extends { id: string | number }>(
  entities: T[] | undefined,
  nextEntity: T,
): T[] => {
  const currentEntities = entities ?? [];
  const targetId = String(nextEntity.id);
  const hasExistingEntity = currentEntities.some(
    (entity) => String(entity.id) === targetId,
  );

  if (!hasExistingEntity) {
    return [...currentEntities, nextEntity];
  }

  return currentEntities.map((entity) =>
    String(entity.id) === targetId ? nextEntity : entity,
  );
};

export const replaceOptimisticEntity = <T extends { id: string | number }>(
  entities: T[] | undefined,
  optimisticId: string | null | undefined,
  nextEntity: T,
): T[] => {
  const currentEntities = entities ?? [];

  if (
    optimisticId &&
    currentEntities.some((entity) => String(entity.id) === optimisticId)
  ) {
    return currentEntities.map((entity) =>
      String(entity.id) === optimisticId ? nextEntity : entity,
    );
  }

  return upsertEntityById(currentEntities, nextEntity);
};
