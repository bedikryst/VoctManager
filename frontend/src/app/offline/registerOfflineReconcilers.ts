/**
 * @file registerOfflineReconcilers.ts
 * @description Hands the offline queue each feature's answer to "one of my
 * queued writes just left the queue — what must be re-read?". `shared/offline`
 * knows no feature; the app, which knows them all, wires them in once at boot,
 * before the shell's first flush can replay a write left over from a session
 * that ended offline.
 *
 * Feedback reports have no reconciler: nothing on the device shows them back.
 * @module app/offline/registerOfflineReconcilers
 */

import { reconcileQueuedMarks } from "@/features/annotations/api/annotations.queries";
import { reconcileQueuedReadiness } from "@/features/materials/api/materials.queries";
import { reconcileQueuedNotes } from "@/features/notes/api/notes.queries";
import { reconcileQueuedAttendance } from "@/features/schedule/api/schedule.queries";
import { registerOfflineReconciler } from "@/shared/offline/offlineClient";

export const registerOfflineReconcilers = (): void => {
  registerOfflineReconciler("annotation", reconcileQueuedMarks);
  registerOfflineReconciler("readiness", reconcileQueuedReadiness);
  registerOfflineReconciler("attendance", reconcileQueuedAttendance);
  registerOfflineReconciler("note", reconcileQueuedNotes);
};
