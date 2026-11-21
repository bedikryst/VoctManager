/**
 * @file pieceFieldSchema.ts
 * @description The limits the piece card checks before it saves a typed
 * property: the title, the short text columns and the composition year. Each
 * row validates its own value through `pieceFieldSchema.shape[field]`; the
 * server keeps the same limits, so a value refused here would be refused there.
 * @module features/archive/piece-card/pieceFieldSchema
 */

import { z } from "zod";

export const pieceFieldSchema = z.object({
  title: z.string().min(1).max(200),
  arranger: z.string().max(150),
  opus_catalog: z.string().max(40),
  musical_key: z.string().max(20),
  voicing: z.string().max(50),
  text_source: z.string().max(200),
  // `null` is the API's "no year" and what a cleared row commits, so it has to
  // parse as a value; a bare `.optional()` would coerce it to 0 and refuse it.
  composition_year: z
    .union([z.coerce.number().int().min(500).max(2100), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value == null ? null : value)),
});
