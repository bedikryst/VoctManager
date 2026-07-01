/**
 * @file PieceFormBody.tsx
 * @description Presentational form sections shared by [ArchiveNewPiecePage]
 * and [ArchiveEditPiecePage]. Renders all editable Piece fields including
 * composer picker / inline-create and divisi requirements.
 *
 * State + submit logic stays in the parent pages — this component only
 * renders inputs against the [usePieceFormState] state object.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceFormBody
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";

import type { Composer, VoiceLineOption } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { getArchiveEpochOptions } from "../constants/archiveEpochs";
import {
  getArchiveLanguageOptions,
  getLanguageLabel,
} from "../constants/archiveLanguages";
import type { PieceFormState } from "../hooks/usePieceFormState";

/**
 * Voice lines that make sense for divisi (one Sx/Ax/Tx/Bx slot = "I need
 * N singers on this part"). Keeps rehearsal/recording-only entries
 * (TUTTI, BACKGROUND, ACCOMPANIMENT, PRONUNCIATION) out of the add row.
 */
const CHORAL_DIVISI_LINES: ReadonlySet<string> = new Set([
  "S1", "S2", "S3",
  "A1", "A2", "A3",
  "T1", "T2", "T3",
  "B1", "B2", "B3",
  "SOLO",
]);

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

  const availableLines = voiceLines.filter(
    (vl) =>
      CHORAL_DIVISI_LINES.has(String(vl.value)) &&
      !requirements.some((r) => r.voice_line === String(vl.value)),
  );

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
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <Eyebrow color="muted" size="caption">
                {t("archive.form.fields.composer", "Kompozytor")}
              </Eyebrow>
              <button
                type="button"
                onClick={() => setIsAddingComposer(!isAddingComposer)}
                disabled={isBusy}
                className="text-[10px] font-bold uppercase tracking-widest text-ethereal-gold hover:underline"
              >
                {isAddingComposer
                  ? t("archive.form.back_to_picker", "Wybierz z listy")
                  : t("archive.form.add_new_composer", "+ Dodaj nowego")}
              </button>
            </div>
            {isAddingComposer ? (
              <div className="space-y-2 rounded-xl border border-ethereal-incense/25 bg-ethereal-alabaster/50 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder={t("archive.form.composer_first", "Imię")}
                    value={composerDraft.first_name}
                    onChange={(e) =>
                      setComposerDraft({
                        ...composerDraft,
                        first_name: e.target.value,
                      })
                    }
                    disabled={isBusy}
                  />
                  <Input
                    placeholder={t("archive.form.composer_last", "Nazwisko *")}
                    value={composerDraft.last_name}
                    onChange={(e) =>
                      setComposerDraft({
                        ...composerDraft,
                        last_name: e.target.value,
                      })
                    }
                    disabled={isBusy}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder={t("archive.form.composer_birth", "Rok ur.")}
                    value={composerDraft.birth_year}
                    onChange={(e) =>
                      setComposerDraft({
                        ...composerDraft,
                        birth_year: e.target.value,
                      })
                    }
                    disabled={isBusy}
                  />
                  <Input
                    type="number"
                    placeholder={t("archive.form.composer_death", "Rok śm.")}
                    value={composerDraft.death_year}
                    onChange={(e) =>
                      setComposerDraft({
                        ...composerDraft,
                        death_year: e.target.value,
                      })
                    }
                    disabled={isBusy}
                  />
                </div>
              </div>
            ) : (
              <Select
                value={composerId}
                onChange={(e) => setComposerId(e.target.value)}
                disabled={isBusy}
              >
                <option value="">
                  {t("archive.form.composer_none", "— Tradycyjny / nieznany —")}
                </option>
                {composers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.last_name} {c.first_name || ""}
                    {c.birth_year
                      ? ` (${c.birth_year}${c.death_year ? `–${c.death_year}` : ""})`
                      : ""}
                  </option>
                ))}
              </Select>
            )}
          </div>
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
                className="inline-flex items-center gap-1 rounded-md border border-ethereal-incense/25 bg-ethereal-alabaster/70 px-3 py-1 text-[11px] font-medium text-ethereal-graphite transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-ink"
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
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-ethereal-incense/25 bg-ethereal-alabaster text-ethereal-graphite hover:text-ethereal-ink"
                        aria-label={t("archive.form.increment", "Zwiększ")}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRequirement(index)}
                        disabled={isBusy}
                        className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-ethereal-incense hover:text-ethereal-crimson"
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
