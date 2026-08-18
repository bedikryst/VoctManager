/**
 * @file DivisiSection.tsx
 * @description The divisi block of the Piece form, in as many layers as the
 * piece actually has.
 *
 * One piece can be published in arrangements that do not share a voicing — the
 * same motet in unison and in three parts — so a divisi belongs to an edition,
 * not only to the work. A piece with fewer than two editions has no such
 * ambiguity and gets exactly the single editor it always had; the layered form
 * appears only where there is something to tell apart, and an edition left
 * empty simply inherits the piece-wide lines rather than declaring none.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/DivisiSection
 */

import React from "react";
import { useTranslation } from "react-i18next";

import type { Piece, VoiceLine, VoiceLineOption } from "@/shared/types";
import { GlossaryTerm } from "@/shared/ui/composites/glossary/GlossaryTerm";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";

import { getPiecePdfLinks } from "../constants/piecePdfs";
import type { VoiceRequirementDTO } from "../types/archive.dto";
import { DivisiEditor } from "./DivisiEditor";

interface DivisiSectionProps {
  readonly voiceLines: VoiceLineOption[];
  readonly requirements: VoiceRequirementDTO[];
  /** Absent on the create form — a piece with no editions yet. */
  readonly piece?: Pick<Piece, "editions"> | null;
  readonly addRequirement: (
    voiceLine: VoiceLine,
    editionId?: string | null,
  ) => void;
  readonly adjustRequirement: (index: number, delta: number) => void;
  readonly removeRequirement: (index: number) => void;
  readonly isBusy: boolean;
}

export const DivisiSection = ({
  voiceLines,
  requirements,
  piece,
  addRequirement,
  adjustRequirement,
  removeRequirement,
  isBusy,
}: DivisiSectionProps): React.JSX.Element => {
  const { t } = useTranslation();
  const editions = piece ? getPiecePdfLinks(piece) : [];

  const editorProps = {
    voiceLines,
    requirements,
    addRequirement,
    adjustRequirement,
    removeRequirement,
    isBusy,
  };

  if (editions.length < 2) {
    return <DivisiEditor {...editorProps} editionId={null} />;
  }

  return (
    <div>
      <Eyebrow color="muted" className="mb-1 block">
        <GlossaryTerm term="divisi">
          {t("archive.form.fields.divisi", "Divisi (opcjonalnie)")}
        </GlossaryTerm>
      </Eyebrow>
      <Caption color="muted" className="mb-4 block">
        {t(
          "archive.form.divisi_hint_editions",
          "Kliknij głos, by dodać. Wydanie z własnym podziałem zastępuje wspólny — zostaw puste, żeby odziedziczyło wspólne głosy.",
        )}
      </Caption>

      <div className="flex flex-col gap-4">
        <div className="rounded-nested border border-hairline bg-ethereal-alabaster/40 p-3">
          <Eyebrow color="muted" className="mb-2 block">
            {t("archive.form.divisi_layer_shared", "Wspólne dla wydań")}
          </Eyebrow>
          <DivisiEditor {...editorProps} editionId={null} showHeading={false} />
        </div>

        {editions.map((edition) => (
          <div
            key={edition.id}
            className="rounded-nested border border-hairline bg-ethereal-alabaster/40 p-3"
          >
            <Eyebrow color="muted" className="mb-2 block">
              {edition.label}
            </Eyebrow>
            <DivisiEditor
              {...editorProps}
              editionId={edition.id}
              showHeading={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
