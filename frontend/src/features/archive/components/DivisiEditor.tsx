/**
 * @file DivisiEditor.tsx
 * @description Divisi (voice-requirements) editor for ONE arrangement layer:
 * tap a voice line to add it, then set how many singers that part needs.
 * [DivisiSection] stacks one of these per layer; [PieceFormBody] (create) and
 * the Piece Card (edit) both go through that.
 *
 * Purely controlled — the parent owns the requirements list and the mutators
 * (from [usePieceFormState] or an equivalent), so this component only renders.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/DivisiEditor
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Minus, Plus, X } from "lucide-react";

import type { VoiceLine, VoiceLineOption } from "@/shared/types";
import { collapseVoiceLabels } from "@/shared/lib/voiceLabels";
import { GlossaryTerm } from "@/shared/ui/composites/glossary/GlossaryTerm";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import type { VoiceRequirementDTO } from "../types/archive.dto";

/**
 * Voice lines a divisi can ask for (one slot = "I need N singers on this
 * part"). Beyond the choral families this covers TUTTI — a unison setting is a
 * real requirement, not the absence of one — and V1…V4, the untyped parts a
 * canon divides into. Rehearsal/recording-only entries (BACKGROUND,
 * ACCOMPANIMENT, PRONUNCIATION) stay out: nobody is cast on them.
 */
export const CHORAL_DIVISI_LINES: ReadonlySet<string> = new Set([
  "S1", "S2", "S3",
  "A1", "A2", "A3",
  "T1", "T2", "T3",
  "B1", "B2", "B3",
  "V1", "V2", "V3", "V4",
  "TUTTI",
  "SOLO",
]);

interface DivisiEditorProps {
  readonly voiceLines: VoiceLineOption[];
  /** The full list across every layer — this editor slices its own out. */
  readonly requirements: VoiceRequirementDTO[];
  /** Arrangement this editor writes to; `null` = the piece-wide layer. */
  readonly editionId?: string | null;
  /** Hidden when [DivisiSection] already labelled the layer above. */
  readonly showHeading?: boolean;
  readonly addRequirement: (
    voiceLine: VoiceLine,
    editionId?: string | null,
  ) => void;
  readonly adjustRequirement: (index: number, delta: number) => void;
  readonly removeRequirement: (index: number) => void;
  readonly isBusy: boolean;
}

export const DivisiEditor = ({
  voiceLines,
  requirements,
  editionId = null,
  showHeading = true,
  addRequirement,
  adjustRequirement,
  removeRequirement,
  isBusy,
}: DivisiEditorProps): React.JSX.Element => {
  const { t } = useTranslation();

  // Indices stay those of the FULL list: the mutators address the array the
  // parent owns, not this layer's slice.
  const layer = requirements
    .map((requirement, index) => ({ requirement, index }))
    .filter(({ requirement }) => (requirement.edition ?? null) === editionId);

  const availableLines = voiceLines.filter(
    (vl) =>
      CHORAL_DIVISI_LINES.has(String(vl.value)) &&
      !layer.some(({ requirement }) => requirement.voice_line === String(vl.value)),
  );

  // Named inside this layer, so an undivided family loses its index the moment
  // it is the only one here — the same reading the singer will get.
  const labels = collapseVoiceLabels(
    layer.map(({ requirement }) => String(requirement.voice_line)),
    voiceLines,
    t,
  );

  return (
    <div>
      {showHeading && (
        <>
          <Eyebrow color="muted" className="mb-1 block">
            <GlossaryTerm term="divisi">
              {t("archive.form.fields.divisi", "Divisi (opcjonalnie)")}
            </GlossaryTerm>
          </Eyebrow>
          <Caption color="muted" className="mb-3 block">
            {t(
              "archive.form.divisi_hint",
              "Kliknij głos, by dodać. Liczba mówi ilu śpiewaków potrzeba na tę partię.",
            )}
          </Caption>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {availableLines.map((vl) => (
          <button
            key={String(vl.value)}
            type="button"
            onClick={() => addRequirement(vl.value, editionId)}
            disabled={isBusy}
            className="inline-flex items-center gap-1 rounded-control border border-hairline-strong bg-ethereal-alabaster/70 px-3 py-1 text-xs font-medium text-ethereal-graphite transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-ink disabled:opacity-40"
          >
            <Plus size={11} aria-hidden="true" /> {vl.label}
          </button>
        ))}
      </div>
      {layer.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {layer.map(({ requirement, index }) => {
            const display =
              labels[String(requirement.voice_line)] ||
              voiceLines.find(
                (vl) => String(vl.value) === requirement.voice_line,
              )?.label;
            return (
              <div
                key={`${requirement.voice_line}-${index}`}
                className="flex items-center justify-between gap-3 rounded-control border border-ethereal-gold/25 bg-ethereal-gold/5 px-3 py-1.5"
              >
                <Eyebrow color="gold">
                  {display || requirement.voice_line}
                </Eyebrow>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustRequirement(index, -1)}
                    disabled={requirement.quantity <= 1 || isBusy}
                    className="flex h-6 w-6 items-center justify-center rounded-control border border-hairline-strong bg-ethereal-alabaster text-ethereal-graphite hover:text-ethereal-ink disabled:opacity-30"
                    aria-label={t("archive.form.decrement", "Zmniejsz")}
                  >
                    <Minus size={12} aria-hidden="true" />
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
                    className="flex h-6 w-6 items-center justify-center rounded-control border border-hairline-strong bg-ethereal-alabaster text-ethereal-graphite hover:text-ethereal-ink disabled:opacity-30"
                    aria-label={t("archive.form.increment", "Zwiększ")}
                  >
                    <Plus size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRequirement(index)}
                    disabled={isBusy}
                    className="ml-1 flex h-6 w-6 items-center justify-center rounded-control text-ethereal-incense hover:text-ethereal-crimson disabled:opacity-40"
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
