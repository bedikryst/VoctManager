/**
 * @file ComposerRecordDialog.tsx
 * @description One composer's record, over the composers list: the six
 * properties a manager corrects, each saving itself as it does on the piece
 * card; the catalogues the record is tied to and the refresh from them; the
 * pieces the library holds by this composer, each opening its card. A composer
 * with no pieces can be deleted from here.
 *
 * The stored biography is the English Wikipedia extract, so it is shown only
 * in the English interface, the rule the piece card's composer popover follows.
 * Nationality is shown as stored: MusicBrainz, Wikidata and the seed each wrote
 * it in their own form, which is why the list leaves it out.
 * @module features/archive/components/ComposerRecordDialog
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, RefreshCcw, Trash2, X } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { BodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { cn } from "@/shared/lib/utils";
import type { Composer, Piece } from "@/shared/types";
import { AutosaveStatus } from "@/shared/ui/composites/AutosaveStatus";
import { PropertyRow, PROPERTY_CONTROL_CLASS } from "@/shared/ui/composites/PropertyRow";
import { RecordList, RecordRow } from "@/shared/ui/composites/RecordList";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Text } from "@/shared/ui/primitives/typography";

import { usePieces, useRefreshComposerFromMb, useUpdateComposer } from "../api/archive.queries";
import type { ComposerRefreshResult } from "../api/archive.service";
import { getArchiveEpochLabel, getArchiveEpochOptions } from "../constants/archiveEpochs";
import { pieceCardPath } from "../constants/libraryScope";
import { CommitText } from "../piece-card/CommitText";
import type { DraftField } from "../piece-card/usePieceAutosave";
import { composerFullName } from "./ComposerRow";

type ComposerField = "last_name" | "first_name" | "birth_year" | "death_year" | "nationality" | "period";
type ComposerPatch = Partial<Record<ComposerField, string>>;

/**
 * The fields a refresh can fill, named for the reader. The portrait's licence
 * arrives with the portrait and is not named on its own.
 */
const FILLED_FIELDS = [
  "birth_year", "death_year", "nationality", "period", "bio", "portrait_url", "aliases", "mbid", "wikidata_qid",
] as const;
type FilledField = (typeof FILLED_FIELDS)[number];
const isFilledField = (field: string): field is FilledField =>
  (FILLED_FIELDS as readonly string[]).includes(field);

/**
 * The record keeps no ledger of drafts: each field holds its own draft and
 * its own error until its write succeeds, and nothing in the dialog waits on
 * them.
 */
const reportNoDraft: DraftField["setDraft"] = () => undefined;

interface ComposerRecordDialogProps {
  readonly composer: Composer;
  readonly onClose: () => void;
  /** Asks for the deletion, which the list confirms once the record has closed. */
  readonly onDelete: (composer: Composer) => void;
}

export const ComposerRecordDialog = ({
  composer,
  onClose,
  onDelete,
}: ComposerRecordDialogProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const { mutateAsync: updateComposer } = useUpdateComposer();
  const refresh = useRefreshComposerFromMb();
  const { data: allPieces = [] } = usePieces();
  const [pendingWrites, setPendingWrites] = useState(0);
  const [writeFailed, setWriteFailed] = useState(false);
  const [refreshMode, setRefreshMode] = useState<"fill" | "force" | null>(null);
  const [outcome, setOutcome] = useState<ComposerRefreshResult | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const composerId = String(composer.id);
  const name = composerFullName(composer);
  const pieces = allPieces
    .filter((piece: Piece) => piece.composer && String(piece.composer.id) === composerId)
    .sort((a, b) => a.title.localeCompare(b.title));
  const isOrphan = composer.is_orphan ?? (composer.pieces_count ?? 0) === 0;
  const bio = (i18n.resolvedLanguage ?? i18n.language).startsWith("en") ? composer.bio : "";

  const save = async (field: ComposerField, value: string): Promise<void> => {
    const data: ComposerPatch = {};
    data[field] = value;
    setPendingWrites((count) => count + 1);
    try {
      await updateComposer({ id: composerId, data });
      setWriteFailed(false);
    } catch (error) {
      setWriteFailed(true);
      throw error;
    } finally {
      setPendingWrites((count) => count - 1);
    }
  };

  const field = (key: ComposerField, label: string): DraftField => ({
    key: `${composerId}:${key}`,
    label,
    setDraft: reportNoDraft,
  });

  const textRow = (key: Exclude<ComposerField, "period">, label: string, required = false) => (
    <PropertyRow label={label}>
      {(id) => (
        <CommitText
          id={id}
          value={composer[key] ?? ""}
          draftField={field(key, label)}
          onCommit={(next) =>
            required && !next
              ? t("archive.composer_record.last_name_required", "Nazwisko jest wymagane.")
              : save(key, next)
          }
        />
      )}
    </PropertyRow>
  );

  const periodLabel = t("archive.composer_record.fields.period", "Epoka");
  const periodOptions = getArchiveEpochOptions(t);
  const period = composer.period ?? "";
  const periodChoices =
    period && !periodOptions.some((option) => option.value === period)
      ? [{ value: period, label: getArchiveEpochLabel(period, t) }, ...periodOptions]
      : periodOptions;

  const runRefresh = (force: boolean) => {
    setOutcome(null);
    setRefreshFailed(false);
    setRefreshMode(force ? "force" : "fill");
    refresh.mutate(
      { id: composerId, force },
      {
        onSuccess: setOutcome,
        onError: () => setRefreshFailed(true),
        onSettled: () => setRefreshMode(null),
      },
    );
  };

  const filledNames = outcome
    ? [...new Set(
        outcome.fields_filled
          .map((name) => (name === "portrait_license" ? "portrait_url" : name))
          .filter(isFilledField),
      )].map((name) => t(`archive.composer_record.filled.${name}`))
    : [];
  const outcomeText = refreshFailed
    ? t("archive.composer_record.refresh_error", "Nie udało się pobrać danych. Spróbuj ponownie za chwilę.")
    : outcome?.status === "no_match"
      ? t(
          "archive.composer_record.refresh_no_match",
          "MusicBrainz ani Wikidata nie znają tego kompozytora. Sprawdź pisownię imienia i nazwiska.",
        )
      : outcome && filledNames.length > 0
        ? t("archive.composer_record.refresh_filled", "Uzupełniono: {{fields}}.", {
            fields: filledNames.join(", "),
          })
        : outcome
          ? t("archive.composer_record.refresh_nothing", "Nie było czego uzupełnić.")
          : null;

  const links = [
    composer.mbid && { href: `https://musicbrainz.org/artist/${composer.mbid}`, label: "MusicBrainz" },
    composer.wikidata_qid && { href: `https://www.wikidata.org/wiki/${composer.wikidata_qid}`, label: "Wikidata" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  const piecesHeading = t("archive.composer_record.pieces", "Utwory w bibliotece");

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-focus-trap bg-surface-inverse/70" />
        {/* Anchored near the top rather than centred, so the record does not
            move while the refresh or a save changes its height. Its tallest
            stops short of the phone's nav dock under the scrim. */}
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-4 top-1/12 z-focus-trap mx-auto max-h-4/5 max-w-2xl overflow-y-auto rounded-nested border border-hairline-strong bg-ethereal-alabaster p-5 shadow-glass-solid md:p-6"
        >
          <BodyScrollLock />
          <div className="flex items-start gap-3">
            {composer.portrait_url && (
              <img
                src={composer.portrait_url}
                alt={t("archive.composer_record.portrait_alt", "Portret: {{name}}", { name })}
                className="size-12 shrink-0 rounded-full border border-hairline-strong object-cover"
                loading="lazy"
              />
            )}
            <Dialog.Title asChild>
              <Text as="h2" size="lg" weight="semibold" className="min-w-0 flex-1 self-center wrap-break-word">
                {name || composer.last_name}
              </Text>
            </Dialog.Title>
            <AutosaveStatus isSaving={pendingWrites > 0} saveFailed={writeFailed} placement="inline" className="self-center" />
            <Dialog.Close asChild>
              <Button
                variant="icon"
                size="icon"
                className="-mr-2 -mt-1 shrink-0"
                aria-label={t("common.actions.close", "Zamknij")}
              >
                <X size={18} aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-4">
            {textRow("last_name", t("archive.composer_record.fields.last_name", "Nazwisko"), true)}
            {textRow("first_name", t("archive.composer_record.fields.first_name", "Imię"))}
            {textRow("birth_year", t("archive.composer_record.fields.birth_year", "Rok urodzenia"))}
            {textRow("death_year", t("archive.composer_record.fields.death_year", "Rok śmierci"))}
            {textRow("nationality", t("archive.composer_record.fields.nationality", "Narodowość"))}
            <PropertyRow label={periodLabel}>
              {(id) => (
                <Select
                  id={id}
                  value={period}
                  options={periodChoices}
                  onValueChange={(next) => {
                    void save("period", next).catch((error: unknown) =>
                      toastApiError(error, t, {
                        fallbackDescription: t("archive.piece_card.autosave_failed"),
                      }),
                    );
                  }}
                  placeholder="—"
                  clearLabel={t("archive.piece_card.clear_field")}
                  variant="property"
                  className={cn(PROPERTY_CONTROL_CLASS, "w-fit max-w-full")}
                />
              )}
            </PropertyRow>
          </div>

          {bio && (
            <Text as="p" size="sm" color="graphite" className="mt-4 whitespace-pre-wrap leading-relaxed">
              {bio}
            </Text>
          )}

          <section className="mt-8" aria-labelledby={`composer-sources-${composerId}`}>
            <Text as="h3" id={`composer-sources-${composerId}`} size="base" weight="semibold">
              {t("archive.composer_record.sources", "Źródła")}
            </Text>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              {links.length > 0 ? (
                links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-fit items-center gap-1 rounded-control text-sm text-ethereal-ink underline underline-offset-4 focus-visible:outline-ethereal-gold"
                  >
                    {link.label}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                ))
              ) : (
                <Text as="p" size="sm" color="graphite">
                  {t("archive.composer_record.no_sources", "Kompozytor nie jest jeszcze powiązany z MusicBrainz ani Wikidata.")}
                </Text>
              )}
              {composer.portrait_license && (
                <Text as="span" size="sm" color="muted">
                  {t("archive.composer_record.portrait_license", "Licencja portretu: {{license}}", {
                    license: composer.portrait_license,
                  })}
                </Text>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                casing="sentence"
                onClick={() => runRefresh(false)}
                disabled={refresh.isPending}
                isLoading={refreshMode === "fill"}
                leftIcon={refreshMode === "fill" ? undefined : <RefreshCcw size={16} aria-hidden="true" />}
              >
                {t("archive.composer_record.refresh", "Odśwież z MusicBrainz")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                casing="sentence"
                onClick={() => runRefresh(true)}
                disabled={refresh.isPending}
                isLoading={refreshMode === "force"}
                title={t(
                  "archive.composer_record.refresh_force_hint",
                  "Pobiera dane jeszcze raz i zastępuje to, co przyszło z MusicBrainz i Wikidata. Twoje poprawki zostają.",
                )}
              >
                {t("archive.composer_record.refresh_force", "Pobierz ponownie")}
              </Button>
            </div>
            {/* Always in the tree, so the outcome is announced when it lands. */}
            <Text
              as="p"
              role="status"
              size="sm"
              color={refreshFailed ? "crimson" : "graphite"}
              className={cn(outcomeText && "mt-2")}
            >
              {outcomeText}
            </Text>
          </section>

          <section className="mt-8" aria-labelledby={`composer-pieces-${composerId}`}>
            <Text as="h3" id={`composer-pieces-${composerId}`} size="base" weight="semibold" className="mb-2">
              {piecesHeading}
            </Text>
            {pieces.length > 0 ? (
              <RecordList label={piecesHeading}>
                {pieces.map((piece) => (
                  <RecordRow
                    key={piece.id}
                    open={{ to: pieceCardPath(piece.id, null) }}
                    title={piece.title}
                    voice="work"
                    facts={[
                      piece.composition_year ? String(piece.composition_year) : null,
                      piece.voicing || null,
                    ]}
                  />
                ))}
              </RecordList>
            ) : (
              <Text as="p" size="sm" color="graphite">
                {t("archive.composer_record.no_pieces", "Żaden utwór w bibliotece nie jest przypisany do tego kompozytora.")}
              </Text>
            )}
          </section>

          {isOrphan && (
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                casing="sentence"
                onClick={() => onDelete(composer)}
                leftIcon={<Trash2 size={16} aria-hidden="true" />}
                className="text-ethereal-crimson hover:text-ethereal-crimson"
              >
                {t("archive.composer_record.delete", "Usuń kompozytora")}
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
