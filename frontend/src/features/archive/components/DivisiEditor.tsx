/**
 * @file DivisiEditor.tsx
 * @description Divisi (voice-requirements) editor: tap a choral voice line to
 * add it, then set how many singers that part needs. Shared by [PieceFormBody]
 * (create) and the Piece Card (edit).
 *
 * Purely controlled — the parent owns the requirements list and the mutators
 * (from [usePieceFormState] or an equivalent), so this component only renders.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/DivisiEditor
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";

import type { VoiceLine, VoiceLineOption } from "@/shared/types";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import type { VoiceRequirementDTO } from "../types/archive.dto";

/**
 * Voice lines that make sense for divisi (one Sx/Ax/Tx/Bx slot = "I need N
 * singers on this part"). Keeps rehearsal/recording-only entries (TUTTI,
 * BACKGROUND, ACCOMPANIMENT, PRONUNCIATION) out of the add row.
 */
export const CHORAL_DIVISI_LINES: ReadonlySet<string> = new Set([
  "S1", "S2", "S3",
  "A1", "A2", "A3",
  "T1", "T2", "T3",
  "B1", "B2", "B3",
  "SOLO",
]);

interface DivisiEditorProps {
  readonly voiceLines: VoiceLineOption[];
  readonly requirements: VoiceRequirementDTO[];
  readonly addRequirement: (voiceLine: VoiceLine) => void;
  readonly adjustRequirement: (index: number, delta: number) => void;
  readonly removeRequirement: (index: number) => void;
  readonly isBusy: boolean;
}

export const DivisiEditor = ({
  voiceLines,
  requirements,
  addRequirement,
  adjustRequirement,
  removeRequirement,
  isBusy,
}: DivisiEditorProps): React.JSX.Element => {
  const { t } = useTranslation();

  const availableLines = voiceLines.filter(
    (vl) =>
      CHORAL_DIVISI_LINES.has(String(vl.value)) &&
      !requirements.some((r) => r.voice_line === String(vl.value)),
  );

  return (
    <div>
      <Eyebrow color="muted" size="caption" className="mb-1 block">
        {t("archive.form.fields.divisi", "Divisi (opcjonalnie)")}
      </Eyebrow>
      <Caption color="muted" className="mb-3 block">
        {t(
          "archive.form.divisi_hint",
          "Kliknij głos, by dodać. Liczba mówi ilu śpiewaków potrzeba na tę partię.",
        )}
      </Caption>
      <div className="flex flex-wrap gap-2">
        {availableLines.map((vl) => (
          <button
            key={String(vl.value)}
            type="button"
            onClick={() => addRequirement(vl.value)}
            disabled={isBusy}
            className="inline-flex items-center gap-1 rounded-md border border-ethereal-incense/25 bg-ethereal-alabaster/70 px-3 py-1 text-[11px] font-medium text-ethereal-graphite transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-ink disabled:opacity-40"
          >
            <Plus size={11} aria-hidden="true" /> {vl.label}
          </button>
        ))}
      </div>
      {requirements.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {requirements.map((requirement, index) => {
            const display = voiceLines.find(
              (vl) => String(vl.value) === requirement.voice_line,
            )?.label;
            return (
              <div
                key={`${requirement.voice_line}-${index}`}
                className="flex items-center justify-between gap-3 rounded-md border border-ethereal-gold/25 bg-ethereal-gold/5 px-3 py-1.5"
              >
                <Eyebrow color="gold" size="caption">
                  {display || requirement.voice_line}
                </Eyebrow>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustRequirement(index, -1)}
                    disabled={requirement.quantity <= 1 || isBusy}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-ethereal-incense/25 bg-ethereal-alabaster text-ethereal-graphite hover:text-ethereal-ink disabled:opacity-30"
                    aria-label={t("archive.form.decrement", "Zmniejsz")}
                  >
                    −
                  </button>
                  <Text
                    size="xs"
                    weight="semibold"
                    className="w-6 text-center tabular-nums"
                  >
                    {requirement.quantity}
                  </Text>
                  <button
                    type="button"
                    onClick={() => adjustRequirement(index, 1)}
                    disabled={isBusy}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-ethereal-incense/25 bg-ethereal-alabaster text-ethereal-graphite hover:text-ethereal-ink disabled:opacity-30"
                    aria-label={t("archive.form.increment", "Zwiększ")}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRequirement(index)}
                    disabled={isBusy}
                    className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-ethereal-incense hover:text-ethereal-crimson disabled:opacity-40"
                    aria-label={t("archive.form.remove_divisi", "Usuń")}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
