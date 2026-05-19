/**
 * @file DivisiEditor.tsx
 * @description Compact per-voice-line quantity editor. The conductor uses
 * this to declare how many singers are required per voice line for a piece
 * (e.g. "S×2, A×2, T×2, B×2" for SATB tutti, or "S×8 split into S1/S2" for
 * a divisi work). Drives downstream MicroCasting deficits.
 * @architecture Enterprise SaaS 2026
 * @module features/score-compiler/components/DivisiEditor
 */

import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react";

import type { VoiceLineOption } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Label, Text } from "@/shared/ui/primitives/typography";

import type { VoiceRequirementInput } from "../types/score-compiler.dto";

interface DivisiEditorProps {
  readonly voiceLines: readonly VoiceLineOption[];
  readonly value: readonly VoiceRequirementInput[];
  readonly onChange: (next: VoiceRequirementInput[]) => void;
}

export const DivisiEditor = ({
  voiceLines,
  value,
  onChange,
}: DivisiEditorProps): React.JSX.Element => {
  const { t } = useTranslation();

  const setQuantity = useCallback(
    (voiceLine: string, quantity: number): void => {
      const safe = Math.max(0, Math.floor(quantity));
      const others = value.filter((r) => r.voice_line !== voiceLine);
      if (safe === 0) {
        onChange(others);
        return;
      }
      onChange([...others, { voice_line: voiceLine, quantity: safe }]);
    },
    [onChange, value],
  );

  const lookup = new Map(value.map((r) => [r.voice_line, r.quantity]));
  const total = value.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <Label size="sm" weight="medium">
          {t(
            "score_compiler.divisi.label",
            "Wymagania głosowe (divisi)",
          )}
        </Label>
        <Caption color="muted">
          {t(
            "score_compiler.divisi.total",
            "Łącznie: {{count}}",
            { count: total },
          )}
        </Caption>
      </div>

      {voiceLines.length === 0 ? (
        <Text size="sm" color="muted">
          {t(
            "score_compiler.divisi.no_voice_lines",
            "Brak słownika linii głosowych. Sprawdź konfigurację /api/options/voice-lines/.",
          )}
        </Text>
      ) : (
        <ul role="list" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {voiceLines.map((line) => {
            const current = lookup.get(String(line.value)) ?? 0;
            return (
              <li
                key={String(line.value)}
                className="flex items-center gap-3 rounded-xl border border-ethereal-incense/15 bg-ethereal-marble/60 px-3 py-2"
              >
                <Text
                  size="sm"
                  weight={current > 0 ? "semibold" : "medium"}
                  className="flex-1 truncate"
                >
                  {line.label || String(line.value)}
                </Text>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="icon"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={t(
                      "score_compiler.divisi.decrement_aria",
                      "Zmniejsz {{name}}",
                      { name: line.label || String(line.value) },
                    )}
                    disabled={current === 0}
                    onClick={() =>
                      setQuantity(String(line.value), current - 1)
                    }
                  >
                    <Minus size={14} aria-hidden="true" />
                  </Button>
                  <span
                    className="w-7 text-center font-serif text-base tabular-nums text-ethereal-ink"
                    aria-live="polite"
                  >
                    {current}
                  </span>
                  <Button
                    type="button"
                    variant="icon"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={t(
                      "score_compiler.divisi.increment_aria",
                      "Zwiększ {{name}}",
                      { name: line.label || String(line.value) },
                    )}
                    onClick={() =>
                      setQuantity(String(line.value), current + 1)
                    }
                  >
                    <Plus size={14} aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
