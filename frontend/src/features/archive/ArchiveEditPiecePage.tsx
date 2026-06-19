/**
 * @file ArchiveEditPiecePage.tsx
 * @description Full-page editor for ALL Piece metadata fields. Reachable
 * from PieceRowExpanded "Pełna edycja" CTA. Uses the same [PieceFormBody]
 * + [usePieceFormState] as the create page — only the submit handler and
 * initial values differ.
 *
 * The conductor lands here when inline pencil + click-to-expand aren't
 * enough — typically to fix a composer FK, change epoch, edit divisi
 * structure, or update internal notes. AI verification stays on
 * `/panel/archive-management/:id/review`.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/ArchiveEditPiecePage
 */

import React, { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";

import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Heading, Text } from "@/shared/ui/primitives/typography";
import { useVoiceLines } from "@/shared/api/options.queries";
import type { Epoch } from "@/shared/types";

import {
  useComposers,
  useCreateComposer,
  usePiece,
  useUpdatePiece,
} from "./api/archive.queries";
import type {
  PieceWriteDTO,
  VoiceRequirementDTO,
} from "./types/archive.dto";
import { PieceFormBody } from "./components/PieceFormBody";
import {
  EMPTY_FORM_DEFAULTS,
  usePieceFormState,
  type PieceFormValues,
} from "./hooks/usePieceFormState";

export default function ArchiveEditPiecePage(): React.JSX.Element {
  const { id = "" } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: piece, isLoading, isError, error } = usePiece(id);
  const { data: composers = [] } = useComposers();
  const { data: voiceLines = [] } = useVoiceLines();
  const updatePiece = useUpdatePiece();
  const createComposer = useCreateComposer();

  const initialValues = useMemo<Partial<PieceFormValues>>(() => {
    if (!piece) return EMPTY_FORM_DEFAULTS;
    const totalSeconds = piece.estimated_duration ?? 0;
    return {
      title: piece.title ?? "",
      arranger: piece.arranger ?? "",
      language: piece.language ?? "",
      voicing: piece.voicing ?? "",
      description: piece.description ?? "",
      duration_mins: totalSeconds > 0 ? Math.floor(totalSeconds / 60) : 0,
      duration_secs: totalSeconds > 0 ? totalSeconds % 60 : 0,
      composition_year: piece.composition_year ?? null,
      epoch: piece.epoch ?? "",
      lyrics_original: piece.lyrics_original ?? "",
    };
  }, [piece]);

  const initialRequirements = useMemo<VoiceRequirementDTO[]>(
    () =>
      (piece?.voice_requirements_read ?? []).map((r) => ({
        voice_line: r.voice_line,
        quantity: r.quantity,
      })),
    [piece],
  );

  const state = usePieceFormState({
    values: initialValues,
    composerId: piece?.composer?.id ?? "",
    requirements: initialRequirements,
  });

  const {
    form,
    composerId,
    setComposerId,
    isAddingComposer,
    composerDraft,
    requirements,
    setRequirements,
  } = state;

  // Sync server-side updates into the form when clean — guards against
  // background refetches (e.g. polling) overwriting in-progress edits.
  const lastSyncedUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    if (!piece) return;
    const seen = lastSyncedUpdatedAt.current;
    const next = piece.updated_at ?? null;
    const firstLoad = seen === null;
    const serverAdvanced = seen !== null && seen !== next;
    if (firstLoad || (serverAdvanced && !form.formState.isDirty)) {
      form.reset({ ...EMPTY_FORM_DEFAULTS, ...initialValues });
      setComposerId(piece.composer?.id ?? "");
      setRequirements(initialRequirements);
      lastSyncedUpdatedAt.current = next;
    } else if (serverAdvanced) {
      lastSyncedUpdatedAt.current = next;
    }
  }, [
    piece,
    form,
    initialValues,
    initialRequirements,
    setComposerId,
    setRequirements,
  ]);

  const isBusy = updatePiece.isPending || createComposer.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    if (!piece) return;
    const toastId = toast.loading(
      t("archive.edit_piece.toast_saving", "Zapisywanie zmian…"),
    );
    try {
      // Resolve composer FK (inline-create flow mirrors the new page).
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
              "archive.edit_piece.composer_required",
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
        voice_requirements: requirements,
      };

      await updatePiece.mutateAsync({ id: String(piece.id), data: payload });
      toast.success(
        t("archive.edit_piece.toast_success", "Zmiany zapisane."),
        { id: toastId },
      );
      form.reset(values, { keepValues: true });
      navigate("/panel/archive-management");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t(
              "archive.edit_piece.toast_error",
              "Nie udało się zapisać zmian.",
            ),
        { id: toastId },
      );
    }
  });

  if (isLoading || !piece) {
    if (isError) {
      return (
        <div className="mx-auto max-w-md py-16 text-center">
          <Text color="crimson">
            {t(
              "archive.edit_piece.fetch_error",
              "Nie udało się pobrać szczegółów utworu:",
            )}{" "}
            {error instanceof Error
              ? error.message
              : t("archive.edit_piece.fetch_unknown", "nieznany błąd")}
          </Text>
          <Button asChild variant="outline" size="sm" className="mt-6">
            <Link to="/panel/archive-management">
              {t("archive.edit_piece.back", "Wróć do biblioteki")}
            </Link>
          </Button>
        </div>
      );
    }
    return <EtherealLoader />;
  }

  const composerName = piece.composer
    ? `${piece.composer.first_name ?? ""} ${piece.composer.last_name}`.trim()
    : t("archive.edit_piece.no_composer", "Brak kompozytora");

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl pb-24 pt-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
            >
              <Link to="/panel/archive-management">
                {t("archive.edit_piece.back", "Biblioteka")}
              </Link>
            </Button>
            <ChevronRight
              size={14}
              aria-hidden="true"
              className="text-ethereal-graphite/40"
            />
            <div className="min-w-0">
              <Heading
                as="h1"
                size="2xl"
                weight="medium"
                className="truncate font-serif"
              >
                {t("archive.edit_piece.title", "Edycja: {{title}}", {
                  title: piece.title,
                })}
              </Heading>
              <Caption color="muted" className="block truncate">
                {composerName}
              </Caption>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            leftIcon={<Sparkles size={13} aria-hidden="true" />}
          >
            <Link to={`/panel/archive-management/${piece.id}/review`}>
              {t("archive.edit_piece.go_to_review", "Tryb weryfikacji AI")}
            </Link>
          </Button>
        </header>

        <form onSubmit={onSubmit} className="space-y-5">
          <PieceFormBody
            state={state}
            composers={composers}
            voiceLines={voiceLines}
            isBusy={isBusy}
          />

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-ethereal-incense/20 bg-ethereal-parchment/95 px-4 py-3 backdrop-blur-md">
            {form.formState.isDirty && (
              <Caption color="gold" className="mr-auto">
                {t("archive.edit_piece.dirty_hint", "Masz niezapisane zmiany")}
              </Caption>
            )}
            <Button asChild type="button" variant="ghost" disabled={isBusy}>
              <Link to="/panel/archive-management">
                {t("common.actions.cancel", "Anuluj")}
              </Link>
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isBusy || !form.formState.isDirty}
              isLoading={isBusy}
            >
              {t("archive.edit_piece.submit", "Zapisz zmiany")}
            </Button>
          </div>
        </form>
      </div>
    </PageTransition>
  );
}
