/**
 * @file PieceFactStrip.tsx
 * @description The piece's musical character — key, voicing, language, epoch,
 * composition year — as a dense line of label · value facts, editable in place.
 * It is the RESTING shape of the same five fields the review renders as a grid
 * of labelled boxes: five values of three to thirteen characters were spending
 * ~380px of the panel's only scrolling column, and a record spends one session
 * awaiting review and years published.
 *
 * Everything here writes to the page's ONE form — `setValue(…, shouldDirty)` for
 * the free-text facts, `Controller` for the two that are vocabularies — so the
 * footer stays the single save contract. A third contract on this screen (a per
 * field mutation of its own) is precisely the defect `usePieceDirty` was added
 * to repair, and it would arrive here first.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceFactStrip
 */

import React from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { Select } from "@/shared/ui/primitives/Select";
import { Eyebrow } from "@/shared/ui/primitives/typography";

import { getArchiveEpochOptions } from "../constants/archiveEpochs";
import { getArchiveLanguageChoices } from "../constants/archiveLanguages";
import type { PieceCardFormValues } from "./PieceMetadataForm";

/** One fact: its label, its provenance dot, and the control that edits it. */
const Fact = ({
  label,
  chip,
  children,
}: {
  label: string;
  chip?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element => (
  <div className="flex min-w-0 items-center gap-2">
    <Eyebrow color="muted" className="shrink-0">
      {label}
    </Eyebrow>
    {chip}
    <div className="min-w-0">{children}</div>
  </div>
);

interface PieceFactStripProps {
  readonly form: UseFormReturn<PieceCardFormValues>;
  /** Renders one field's provenance dot + its click-to-verify control. */
  readonly fieldChip: (field: string) => React.ReactNode;
}

export const PieceFactStrip = ({
  form,
  fieldChip,
}: PieceFactStripProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { control, setValue } = form;

  // Field-wise subscriptions: a keystroke in the lyrics textarea must not
  // re-render five controls that did not change.
  const musicalKey = useWatch({ control, name: "musical_key" });
  const voicing = useWatch({ control, name: "voicing" });
  const compositionYear = useWatch({ control, name: "composition_year" });
  const language = useWatch({ control, name: "language" });

  const epochOptions = getArchiveEpochOptions(t);
  const languageChoices = getArchiveLanguageChoices(language, t);

  const keyLabel = t("archive.piece_card.fields.key", "Tonacja");
  const voicingLabel = t("archive.piece_card.fields.voicing", "Obsada");
  const languageLabel = t("archive.piece_card.fields.language", "Język śpiewu");
  const epochLabel = t("archive.piece_card.fields.epoch", "Epoka");
  const yearLabel = t(
    "archive.piece_card.fields.composition_year",
    "Rok kompozycji",
  );

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <Fact label={keyLabel} chip={fieldChip("musical_key")}>
        <InlineEditable
          value={musicalKey}
          ariaLabel={keyLabel}
          onSave={(next) =>
            setValue("musical_key", next, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
      </Fact>

      <Fact label={voicingLabel} chip={fieldChip("voicing")}>
        <InlineEditable
          value={voicing}
          ariaLabel={voicingLabel}
          onSave={(next) =>
            setValue("voicing", next, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
      </Fact>

      {/* The two vocabularies keep a real listbox — a free-text cell would let
          an epoch be typed that the filters and the score book cannot read. The
          ghost shell is what lets a full field sit in a line of type: no fill
          and no hairline until it is hovered or open. */}
      <Fact label={languageLabel} chip={fieldChip("language")}>
        <div className="w-40">
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <Select
                ariaLabel={languageLabel}
                variant="ghost"
                size="sm"
                className="px-2"
                name={field.name}
                value={field.value ?? ""}
                onValueChange={field.onChange}
                placeholder={t("archive.piece_card.language_pick", "Wybierz")}
                clearLabel={t("archive.piece_card.language_pick", "Wybierz")}
                options={languageChoices}
              />
            )}
          />
        </div>
      </Fact>

      <Fact label={epochLabel} chip={fieldChip("epoch")}>
        <div className="w-40">
          <Controller
            control={control}
            name="epoch"
            render={({ field }) => (
              <Select
                ariaLabel={epochLabel}
                variant="ghost"
                size="sm"
                className="px-2"
                name={field.name}
                value={field.value ?? ""}
                onValueChange={field.onChange}
                placeholder={t("archive.piece_card.epoch_pick", "Wybierz")}
                clearLabel={t("archive.piece_card.epoch_pick", "Wybierz")}
                options={epochOptions}
              />
            )}
          />
        </div>
      </Fact>

      <Fact label={yearLabel} chip={fieldChip("composition_year")}>
        <InlineEditable
          value={compositionYear}
          type="number"
          ariaLabel={yearLabel}
          // The bounds are the schema's; stated here so a typo is refused at the
          // cell instead of failing the whole form on submit.
          validate={(next) => {
            if (next === "") return null;
            const parsed = Number(next);
            return Number.isInteger(parsed) && parsed >= 500 && parsed <= 2100
              ? null
              : t(
                  "archive.piece_card.year_invalid",
                  "Rok kompozycji: liczba całkowita od 500 do 2100.",
                );
          }}
          onSave={(next) =>
            setValue("composition_year", next === "" ? null : Number(next), {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
      </Fact>
    </div>
  );
};
