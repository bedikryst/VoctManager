/**
 * @file archiveDomain.ts
 * @description Centralized domain constants for the Archive module.
 * @module panel/archive/constants
 */

export const ARCHIVE_TABS = {
    DETAILS: 'DETAILS',
    TRACKS: 'TRACKS'
} as const;

export type ArchiveTabId = keyof typeof ARCHIVE_TABS;