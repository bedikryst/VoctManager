/**
 * @file ComposerPicker.tsx
 * @description Composer FK selector with an inline "add new composer" draft
 * escape hatch. Shared by [PieceFormBody] (create) and the Piece Card (edit) so
 * the picker + inline-create flow reads identically in both surfaces.
 *
 * Purely controlled — the parent owns the selected id, the "adding" toggle and
 * the draft, and resolves the draft into a real Composer on submit.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ComposerPicker
 */

import React from "react";
import { useTranslation } from "react-i18next";

import type { Composer } from "@/shared/types";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Eyebrow } from "@/shared/ui/primitives/typography";

import type { InlineComposerDraft } from "../hooks/usePieceFormState";

interface ComposerPickerProps {
  readonly composers: Composer[];
  readonly composerId: string;
  readonly setComposerId: (id: string) => void;
  readonly isAddingComposer: boolean;
  readonly setIsAddingComposer: (value: boolean) => void;
  readonly composerDraft: InlineComposerDraft;
  readonly setComposerDraft: (value: InlineComposerDraft) => void;
  readonly isBusy: boolean;
  /** Optional label override — defaults to "Kompozytor". */
  readonly label?: string;
}

export const ComposerPicker = ({
  composers,
  composerId,
  setComposerId,
  isAddingComposer,
  setIsAddingComposer,
  composerDraft,
  setComposerDraft,
  isBusy,
  label,
}: ComposerPickerProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <Eyebrow color="muted" size="caption">
          {label ?? t("archive.form.fields.composer", "Kompozytor")}
        </Eyebrow>
        <button
          type="button"
          onClick={() => setIsAddingComposer(!isAddingComposer)}
          disabled={isBusy}
          className="text-[10px] font-bold uppercase tracking-widest text-ethereal-gold hover:underline disabled:opacity-40"
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
                setComposerDraft({ ...composerDraft, first_name: e.target.value })
              }
              disabled={isBusy}
            />
            <Input
              placeholder={t("archive.form.composer_last", "Nazwisko *")}
              value={composerDraft.last_name}
              onChange={(e) =>
                setComposerDraft({ ...composerDraft, last_name: e.target.value })
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
                setComposerDraft({ ...composerDraft, birth_year: e.target.value })
              }
              disabled={isBusy}
            />
            <Input
              type="number"
              placeholder={t("archive.form.composer_death", "Rok śm.")}
              value={composerDraft.death_year}
              onChange={(e) =>
                setComposerDraft({ ...composerDraft, death_year: e.target.value })
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
  );
};
