/**
 * @file PieceMetadataForm.tsx
 * @description The Piece Card's scalar metadata editor: the fields the AI
 * extracts, each carrying its own provenance chip, grouped as identity /
 * musical character / text. Owns the form contract too — the zod schema and the
 * set of columns that are blank-not-null — because the two are read together on
 * every submit and drift apart the moment they live in different files.
 *
 * `title` is part of that contract but has no field here: it is the page's own
 * heading, edited in place there, and a second input restating the h1 two lines
 * below it was the record's identity written twice on one screen.
 *
 * The musical-character group has two shapes for the same five fields: the grid
 * of labelled boxes while an edition is under review, and `PieceFactStrip` — one
 * dense line, edited in place — for the years the record then spends published.
 *
 * The page keeps the form STATE (it also drives the title, composer, divisi and
 * duration controls outside this block) and passes it in, so this component
 * stays a rendering of one `useForm` instance rather than a second owner of it.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceMetadataForm
 */

import React from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Database, FileText } from "lucide-react";
import { z } from "zod";

import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Text } from "@/shared/ui/primitives/typography";

import { FieldGroup, LabeledField } from "./CockpitSection";
import { PieceFactStrip } from "./PieceFactStrip";
import { getArchiveEpochOptions } from "../constants/archiveEpochs";
import { getArchiveLanguageChoices } from "../constants/archiveLanguages";

export const pieceCardSchema = z.object({
  title: z.string().min(1, "Tytuł jest wymagany").max(200),
  arranger: z.string().max(150).default(""),
  opus_catalog: z.string().max(40).default(""),
  // The fact strip edits these two in cells that render no error slot of their
  // own, so their message can only ever be read in the submit toast — it has to
  // be a sentence, not zod's English default.
  musical_key: z.string().max(20, "Tonacja: maksymalnie 20 znaków").default(""),
  language: z.string().max(50).default(""),
  voicing: z.string().max(50, "Obsada: maksymalnie 50 znaków").default(""),
  text_source: z.string().max(200).default(""),
  // `null` is the API's "no year", the card's default for a piece that has none
  // and what the fact strip writes when the cell is cleared — so it has to parse
  // as a VALUE. A bare `.optional()` admits only absence: `null` would fall into
  // the coerced-number branch as 0, fail `min(500)`, and block every submit on a
  // yearless record.
  composition_year: z
    .union([z.coerce.number().int().min(500).max(2100), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  epoch: z.string().max(4).default(""),
  lyrics_original: z.string().default(""),
  lyrics_ipa: z.string().default(""),
  description: z.string().default(""),
  duration_mins: z
    .union([z.coerce.number().int().min(0).max(600), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? 0 : v)),
  duration_secs: z
    .union([z.coerce.number().int().min(0).max(59), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? 0 : v)),
});

export type PieceCardFormValues = z.infer<typeof pieceCardSchema>;

/** Text fields whose backend column is `blank=True, null=False`: clearing one
 *  sends "" (a valid blank), never null (which DRF would reject). */
export const TEXT_FIELD_KEYS: ReadonlySet<keyof PieceCardFormValues> = new Set([
  "title", "arranger", "opus_catalog", "musical_key", "language", "voicing",
  "text_source", "epoch", "lyrics_original", "lyrics_ipa", "description",
]);

interface PieceMetadataFormProps {
  readonly form: UseFormReturn<PieceCardFormValues>;
  readonly onSubmit: React.FormEventHandler<HTMLFormElement>;
  /** Renders one field's provenance dot + its click-to-verify control. */
  readonly fieldChip: (field: string) => React.ReactNode;
  /** An edition is awaiting approval — the page is a review, not a plain edit. */
  readonly isReviewing: boolean;
}

export const PieceMetadataForm = ({
  form,
  onSubmit,
  fieldChip,
  isReviewing,
}: PieceMetadataFormProps): React.JSX.Element => {
  const { t } = useTranslation();
  const {
    control,
    register,
    formState: { errors },
    watch,
  } = form;

  const epochOptions = getArchiveEpochOptions(t);
  // Localised language dropdown over the canonical ISO value; any non-plain
  // current value (e.g. the bilingual "pl+la") is kept selectable so it is never
  // silently dropped on edit.
  const languageChoices = getArchiveLanguageChoices(watch("language"), t);

  return (
    <>
      {isReviewing && (
        // Two kinds of checking, because the fields below do not all come from
        // the same place. "Sprawdź każde pole z podglądem PDF po lewej" was true
        // of the ones the model read off the page and false of the ones it
        // supplied from a catalogue or its own knowledge — which are exactly the
        // ones it invents. Each line takes the icon its source wears on the
        // provenance dots (page / catalogue).
        <div className="mb-4 space-y-1.5">
          <div className="flex items-start gap-2">
            <FileText
              size={12}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-ethereal-graphite/50"
            />
            <Text size="xs" color="graphite">
              {t(
                "archive.piece_card.fields_hint_score",
                "W partyturze obok sprawdzisz tytuł, aranżera, obsadę, tonację i tekst.",
              )}
            </Text>
          </div>
          <div className="flex items-start gap-2">
            <Database
              size={12}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-ethereal-graphite/50"
            />
            <Text size="xs" color="graphite">
              {t(
                "archive.piece_card.fields_hint_catalog",
                "Epoki, roku kompozycji i numeru opusu w nutach zwykle nie ma — AI wziął je z katalogu albo z własnej wiedzy i to one najczęściej bywają zmyślone.",
              )}
            </Text>
          </div>
        </div>
      )}
      <form id="piece-card-form" onSubmit={onSubmit} noValidate className="space-y-6">
        <FieldGroup
          title={t("archive.piece_card.group.identity", "Tożsamość")}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <LabeledField
            label={t(
              "archive.piece_card.fields.arranger",
              "Opracowanie / aranżacja",
            )}
            chip={fieldChip("arranger")}
          >
            <Input
              aria-label={t(
                "archive.piece_card.fields.arranger",
                "Opracowanie / aranżacja",
              )}
              placeholder={t("archive.piece_card.ph_arranger", "np. opr. T. Kuras")}
              error={errors.arranger?.message}
              {...register("arranger")}
            />
          </LabeledField>
          <LabeledField
            label={t("archive.piece_card.fields.opus", "Opus / Katalog")}
            chip={fieldChip("opus_catalog")}
          >
            <Input
              aria-label={t("archive.piece_card.fields.opus", "Opus / Katalog")}
              placeholder={t("archive.piece_card.ph_opus", "np. BWV 243")}
              error={errors.opus_catalog?.message}
              {...register("opus_catalog")}
            />
          </LabeledField>
        </FieldGroup>

        {/* Shape follows state. In a review each of the five is a labelled box
            beside the score, because that is the pass they are read in; at rest
            they are five short facts and take a line, editable in place. Both
            render the same form fields and save through the same footer. */}
        {isReviewing ? (
          <FieldGroup
            title={t(
              "archive.piece_card.group.musical",
              "Charakterystyka muzyczna",
            )}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
            <LabeledField
              label={t("archive.piece_card.fields.key", "Tonacja")}
              chip={fieldChip("musical_key")}
            >
              <Input
                aria-label={t("archive.piece_card.fields.key", "Tonacja")}
                placeholder={t("archive.piece_card.ph_key", "np. D-dur")}
                error={errors.musical_key?.message}
                {...register("musical_key")}
              />
            </LabeledField>
            <LabeledField
              label={t("archive.piece_card.fields.voicing", "Obsada")}
              chip={fieldChip("voicing")}
            >
              <Input
                aria-label={t("archive.piece_card.fields.voicing", "Obsada")}
                placeholder={t("archive.piece_card.ph_voicing", "np. SATB")}
                error={errors.voicing?.message}
                {...register("voicing")}
              />
            </LabeledField>
            <LabeledField
              label={t("archive.piece_card.fields.language", "Język śpiewu")}
              chip={fieldChip("language")}
            >
              <Controller
                control={control}
                name="language"
                render={({ field }) => (
                  <Select
                    ariaLabel={t(
                      "archive.piece_card.fields.language",
                      "Język śpiewu",
                    )}
                    name={field.name}
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    placeholder={t("archive.piece_card.language_pick", "Wybierz")}
                    clearLabel={t("archive.piece_card.language_pick", "Wybierz")}
                    options={languageChoices}
                  />
                )}
              />
            </LabeledField>
            <LabeledField
              label={t("archive.piece_card.fields.epoch", "Epoka")}
              chip={fieldChip("epoch")}
            >
              <Controller
                control={control}
                name="epoch"
                render={({ field }) => (
                  <Select
                    ariaLabel={t("archive.piece_card.fields.epoch", "Epoka")}
                    name={field.name}
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    placeholder={t("archive.piece_card.epoch_pick", "Wybierz")}
                    clearLabel={t("archive.piece_card.epoch_pick", "Wybierz")}
                    options={epochOptions}
                  />
                )}
              />
            </LabeledField>
            <LabeledField
              label={t(
                "archive.piece_card.fields.composition_year",
                "Rok kompozycji",
              )}
              chip={fieldChip("composition_year")}
            >
              <div className="max-w-36">
                <Input
                  aria-label={t(
                    "archive.piece_card.fields.composition_year",
                    "Rok kompozycji",
                  )}
                  type="number"
                  error={errors.composition_year?.message}
                  {...register("composition_year")}
                />
              </div>
            </LabeledField>
          </FieldGroup>
        ) : (
          <FieldGroup
            title={t(
              "archive.piece_card.group.musical",
              "Charakterystyka muzyczna",
            )}
          >
            <PieceFactStrip form={form} fieldChip={fieldChip} />
          </FieldGroup>
        )}

        <FieldGroup
          title={t("archive.piece_card.group.text", "Tekst")}
          className="space-y-4"
        >
          <LabeledField
            label={t("archive.piece_card.fields.text_source", "Źródło tekstu")}
            chip={fieldChip("text_source")}
          >
            <Input
              aria-label={t("archive.piece_card.fields.text_source", "Źródło tekstu")}
              placeholder={t(
                "archive.piece_card.ph_text_source",
                "np. Magnificat (Łk 1,46-55)",
              )}
              error={errors.text_source?.message}
              {...register("text_source")}
            />
          </LabeledField>
          <LabeledField
            label={t(
              "archive.piece_card.fields.lyrics_original",
              "Tekst oryginalny",
            )}
            chip={fieldChip("lyrics_original")}
          >
            <Textarea
              aria-label={t(
                "archive.piece_card.fields.lyrics_original",
                "Tekst oryginalny",
              )}
              rows={4}
              error={errors.lyrics_original?.message}
              {...register("lyrics_original")}
            />
          </LabeledField>
          <LabeledField
            label={t("archive.piece_card.fields.lyrics_ipa", "Transkrypcja IPA")}
            chip={fieldChip("lyrics_ipa")}
          >
            <Textarea
              aria-label={t(
                "archive.piece_card.fields.lyrics_ipa",
                "Transkrypcja IPA",
              )}
              rows={3}
              error={errors.lyrics_ipa?.message}
              {...register("lyrics_ipa")}
            />
          </LabeledField>
        </FieldGroup>
      </form>
    </>
  );
};
