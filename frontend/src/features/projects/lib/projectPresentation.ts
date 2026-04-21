/**
 * @file projectPresentation.ts
 * @description Feature-local helpers for project time handling and relational labels.
 * Keeps presentation logic typed and reusable across dashboard surfaces.
 * @module features/projects/lib
 */

import { compareAsc, compareDesc, isAfter, isBefore, isValid, parseISO } from "date-fns";

import type { Artist, LocationSnippet, Project, Rehearsal } from "@/shared/types";

type ProjectLocationReference = Project["location"] | Rehearsal["location"];

const parseProjectDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsedDate = parseISO(value);
  return isValid(parsedDate) ? parsedDate : null;
};

export const compareProjectDateAsc = (
  left?: string | null,
  right?: string | null,
): number => {
  const leftDate = parseProjectDate(left);
  const rightDate = parseProjectDate(right);

  if (!leftDate && !rightDate) {
    return 0;
  }

  if (!leftDate) {
    return 1;
  }

  if (!rightDate) {
    return -1;
  }

  return compareAsc(leftDate, rightDate);
};

export const compareProjectDateDesc = (
  left?: string | null,
  right?: string | null,
): number => {
  const leftDate = parseProjectDate(left);
  const rightDate = parseProjectDate(right);

  if (!leftDate && !rightDate) {
    return 0;
  }

  if (!leftDate) {
    return 1;
  }

  if (!rightDate) {
    return -1;
  }

  return compareDesc(leftDate, rightDate);
};

export const isFutureProjectDate = (
  value?: string | null,
  referenceDate: Date = new Date(),
): boolean => {
  const parsedDate = parseProjectDate(value);
  return parsedDate ? isAfter(parsedDate, referenceDate) : false;
};

export const isPastProjectDate = (
  value?: string | null,
  referenceDate: Date = new Date(),
): boolean => {
  const parsedDate = parseProjectDate(value);
  return parsedDate ? isBefore(parsedDate, referenceDate) : false;
};

const isLocationSnippet = (
  location: ProjectLocationReference,
): location is LocationSnippet =>
  typeof location === "object" &&
  location !== null &&
  typeof location.id === "string" &&
  typeof location.name === "string";

export const getLocationLabel = (
  location: ProjectLocationReference,
): string | null => {
  if (!location) {
    return null;
  }

  if (typeof location === "string") {
    return location.trim().length > 0 ? location : null;
  }

  if (!isLocationSnippet(location)) {
    return null;
  }

  return location.name.trim().length > 0 ? location.name : null;
};

const isArtistReference = (artist: unknown): artist is Artist =>
  typeof artist === "object" &&
  artist !== null &&
  typeof (artist as Artist).first_name === "string" &&
  typeof (artist as Artist).last_name === "string";

export const getArtistDisplayName = (
  artist: Project["conductor"] | Artist | null | undefined,
  fallbackName?: string | null,
): string | null => {
  if (typeof fallbackName === "string" && fallbackName.trim().length > 0) {
    return fallbackName.trim();
  }

  if (!isArtistReference(artist)) {
    return null;
  }

  const fullName = `${artist.first_name} ${artist.last_name}`.trim();
  return fullName.length > 0 ? fullName : null;
};
