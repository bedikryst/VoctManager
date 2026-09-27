/**
 * @file usePitchNotation.ts
 * @description The notation the signed-in reader sees pitch names in: their
 * own choice from Settings → Profile when they made one, otherwise their UI
 * language's. The choice belongs to the reader, never to the artist on screen,
 * so a manager previewing a singer's view still reads their own notation.
 *
 * Every surface that names a pitch reads it here, so one setting holds across
 * the roster, the editor, the cast and the singer's own screen at once.
 * @module features/artists/hooks/usePitchNotation
 */

import { useTranslation } from "react-i18next";

import { useAuth } from "@/app/providers/AuthProvider";
import {
  resolveNotation,
  type PitchNotation,
} from "@/shared/lib/music/pitchNotation";

export const usePitchNotation = (): PitchNotation => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  return resolveNotation(user?.profile?.pitch_notation, i18n.language);
};
