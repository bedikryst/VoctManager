/**
 * @file ArchiveNewPiecePage.tsx
 * @description Dedicated route for manually creating a Piece (folk songs,
 * hand-outs, anything without a PDF). Uses the shared [PieceFormBody]
 * component + [usePieceFormState] hook — same form structure as the edit
 * page, different submit handler.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/ArchiveNewPiecePage
 */

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading } from "@/shared/ui/primitives/typography";
import { useVoiceLines } from "@/shared/api/options.queries";
import type { Epoch } from "@/shared/types";

import {
  useComposers,
  useCreateComposer,
  useCreatePiece,
} from "./api/archive.queries";
import type { PieceWriteDTO } from "./types/archive.dto";
import { PieceFormBody } from "./components/PieceFormBody";
import { usePieceFormState } from "./hooks/usePieceFormState";

export default function ArchiveNewPiecePage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: composers = [] } = useComposers();
  const { data: voiceLines = [] } = useVoiceLines();
  const createComposer = useCreateComposer();
  const createPiece = useCreatePiece();

  const state = usePieceFormState();
  const { form, composerId, isAddingComposer, composerDraft, requirements } =
    state;

  const isBusy = createPiece.isPending || createComposer.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    const toastId = toast.loading(
      t("archive.new_piece.toast_creating", "Dodawanie utworu…"),
    );
    try {
      let resolvedComposerId: string | null = composerId || null;
      if (isAddingComposer) {
        const draft = {
          first_name: composerDraft.first_name.trim() || undefined,
          last_name: composerDraft.last_name.trim(),
          birth_year: composerDraft.birth_year.trim() || undefined,
          death_year: composerDraft.death_year.trim() || undefined,
        };
        if (!draft.last_name) {
          toast.error(
            t(
              "archive.new_piece.composer_required",
              "Nazwisko kompozytora jest wymagane.",
            ),
            { id: toastId },
          );
          return;
        }
        const created = await createComposer.mutateAsync(draft);
        resolvedComposerId = created.id;
      }

      const durationSeconds =
        Number(values.duration_mins ?? 0) * 60 +
        Number(values.duration_secs ?? 0);

      const payload: PieceWriteDTO = {
        title: values.title,
        composer_id: resolvedComposerId,
        arranger: values.arranger || "",
        language: values.language || "",
        estimated_duration: durationSeconds > 0 ? durationSeconds : null,
        voicing: values.voicing || "",
        description: values.description || "",
        lyrics_original: values.lyrics_original || "",
        composition_year: values.composition_year,
        epoch: (values.epoch || "") as Epoch | "",
        voice_requirements: requirements.length > 0 ? requirements : undefined,
      };

      const created = await createPiece.mutateAsync(payload);
      toast.success(
        t("archive.new_piece.toast_success", "Utwór dodany."),
        { id: toastId },
      );
      navigate(`/panel/archive-management?highlight=${created.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t(
              "archive.new_piece.toast_error",
              "Nie udało się dodać utworu.",
            ),
        { id: toastId },
      );
    }
  });

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl pb-24 pt-6">
        <header className="mb-5 flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
          >
            <Link to="/panel/archive-management">
              {t("archive.new_piece.back", "Biblioteka")}
            </Link>
          </Button>
          <ChevronRight
            size={14}
            aria-hidden="true"
            className="text-ethereal-graphite/40"
          />
          <Heading as="h1" size="2xl" weight="medium" className="font-serif">
            {t("archive.new_piece.title", "Dodaj nowy utwór")}
          </Heading>
        </header>

        <form onSubmit={onSubmit} className="space-y-5">
          <PieceFormBody
            state={state}
            composers={composers}
            voiceLines={voiceLines}
            isBusy={isBusy}
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild type="button" variant="ghost" disabled={isBusy}>
              <Link to="/panel/archive-management">
                {t("common.actions.cancel", "Anuluj")}
              </Link>
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isBusy}
              isLoading={isBusy}
            >
              {t("archive.new_piece.submit", "Dodaj do archiwum")}
            </Button>
          </div>
        </form>
      </div>
    </PageTransition>
  );
}
