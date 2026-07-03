/**
 * @file PieceFormBody.tsx
 * @description Presentational form sections for [ArchiveNewPiecePage] (manual
 * create). Renders all editable Piece fields; the composer picker and divisi
 * editor are delegated to [ComposerPicker] / [DivisiEditor], which the Piece
 * Card reuses too.
 *
 * State + submit logic stays in the parent page — this component only
 * renders inputs against the [usePieceFormState] state object.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceFormBody
 */

import React from "react";
import { useTranslation } from "react-i18next";

import type { Composer, VoiceLineOption } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { getArchiveEpochOptions } from "../constants/archiveEpochs";
import {
  getArchiveLanguageOptions,
  getLanguageLabel,
} from "../constants/archiveLanguages";
import type { PieceFormState } from "../hooks/usePieceFormState";
import { ComposerPicker } from "./ComposerPicker";
import { DivisiEditor } from "./DivisiEditor";

interface PieceFormBodyProps {
  readonly state: PieceFormState;
  readonly composers: Composer[];
  readonly voiceLines: VoiceLineOption[];
  readonly isBusy: boolean;
}

export const PieceFormBody = ({
  state,
  composers,
  voiceLines,
  isBusy,
}: PieceFormBodyProps): React.JSX.Element => {
  const { t } = useTranslation();
  const epochOptions = getArchiveEpochOptions(t);

  const {
    form,
    composerId,
    setComposerId,
    isAddingComposer,
    setIsAddingComposer,
    composerDraft,
    setComposerDraft,
    requirements,
    adjustRequirement,
    removeRequirement,
    addRequirement,
  } = state;

  const {
    register,
    formState: { errors },
  } = form;

  // Language is stored as a canonical ISO code (or "pl+la" for a bilingual
  // score). Offer a localised dropdown, but keep any current value that is not a
  // plain single-language option (e.g. the bilingual form) selectable so editing
  // never silently drops it.
  const languageOptions = getArchiveLanguageOptions(t);
  const languageValue = form.watch("language");
  const languageChoices =
    languageValue && !languageOptions.some((o) => o.value === languageValue)
      ? [
          { value: languageValue, label: getLanguageLabel(languageValue, t) },
          ...languageOptions,
        ]
      : languageOptions;

  return (
    <>
      {/* ── Identity ───────────────────────────────────────────────────── */}
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <Eyebrow color="muted" size="caption" className="mb-2 block">
          {t("archive.form.fields.title", "Tytuł utworu *")}
        </Eyebrow>
        <Input
          placeholder={t("archive.form.title_placeholder", "np. Lacrimosa")}
          error={errors.title?.message}
          {...register("title")}
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Composer picker / inline create */}
          <ComposerPicker
            composers={composers}
            composerId={composerId}
            setComposerId={setComposerId}
            isAddingComposer={isAddingComposer}
            setIsAddingComposer={setIsAddingComposer}
            composerDraft={composerDraft}
            setComposerDraft={setComposerDraft}
            isBusy={isBusy}
          />
          <Input
            label={t("archive.form.fields.arranger", "Aranżer")}
            placeholder={t("archive.form.arranger_placeholder", "np. John Rutter")}
            error={errors.arranger?.message}
            {...register("arranger")}
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Eyebrow color="muted" size="caption" className="mb-1 block">
              {t("archive.form.fields.epoch", "Epoka")}
            </Eyebrow>
            <Select disabled={isBusy} {...register("epoch")}>
              <option value="">
                {t("archive.form.epoch_pick", "— wybierz —")}
              </option>
              {epochOptions.map((epoch) => (
                <option key={epoch.value} value={epoch.value}>
                  {epoch.label}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label={t("archive.form.fields.year", "Rok powstania")}
            type="number"
            placeholder="np. 1741"
            error={errors.composition_year?.message}
            {...register("composition_year")}
          />
          <div>
            <Eyebrow color="muted" size="caption" className="mb-1 block">
              {t("archive.form.fields.language", "Język śpiewu")}
            </Eyebrow>
            <Select disabled={isBusy} {...register("language")}>
              <option value="">
                {t("archive.form.language_pick", "— wybierz —")}
              </option>
              {languageChoices.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* ── Performance requirements ──────────────────────────────────── */}
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <SectionHeader
          title={t(
            "archive.form.section.performance",
            "Wymagania wykonawcze",
          )}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={t("archive.form.fields.voicing", "Obsada (notacja)")}
            placeholder="np. SATB, SSAATTBB"
            error={errors.voicing?.message}
            {...register("voicing")}
          />
          <div>
            <Eyebrow color="muted" size="caption" className="mb-1 block">
              {t("archive.form.fields.duration", "Czas trwania")}
            </Eyebrow>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={600}
                placeholder="min"
                aria-label={t("archive.form.duration_mins", "Minuty")}
                error={errors.duration_mins?.message}
                {...register("duration_mins")}
              />
              <Text
                as="span"
                aria-hidden="true"
                className="text-ethereal-graphite/60"
              >
                :
              </Text>
              <Input
                type="number"
                min={0}
                max={59}
                placeholder="sek"
                aria-label={t("archive.form.duration_secs", "Sekundy")}
                error={errors.duration_secs?.message}
                {...register("duration_secs")}
              />
            </div>
          </div>
        </div>

        {/* Divisi */}
        <div className="mt-5">
          <DivisiEditor
            voiceLines={voiceLines}
            requirements={requirements}
            addRequirement={addRequirement}
            adjustRequirement={adjustRequirement}
            removeRequirement={removeRequirement}
            isBusy={isBusy}
          />
        </div>
      </GlassCard>

      {/* ── Lyrics + notes ────────────────────────────────────────────── */}
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <SectionHeader
          title={t("archive.form.section.lyrics", "Tekst i notatki")}
        />
        <Textarea
          label={t("archive.form.fields.lyrics", "Tekst oryginalny")}
          rows={5}
          placeholder={t(
            "archive.form.lyrics_placeholder",
            "Wklej tekst utworu — IPA i tłumaczenia uzupełni AI po wgraniu PDF-u w trybie weryfikacji.",
          )}
          error={errors.lyrics_original?.message}
          {...register("lyrics_original")}
        />
        <Textarea
          label={t(
            "archive.form.fields.description",
            "Notatki dyrygenta (wewnętrzne)",
          )}
          rows={3}
          placeholder={t(
            "archive.form.description_placeholder",
            "Cokolwiek warto pamiętać o tym utworze.",
          )}
          error={errors.description?.message}
          className="mt-4"
          {...register("description")}
        />
      </GlassCard>
    </>
  );
};
