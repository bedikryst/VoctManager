/**
 * @file PieceEditions.tsx
 * @description The piece's editions as a file list. Each row gives the file's
 * name and facts, a status only when it is an exception (the analysis running
 * or failed, the edition waiting for review), and a menu: show it beside the
 * record (open the stand on a phone), re-run the analysis, delete. The row
 * itself opens the edition's settings below it: licence, copies, whole pages in
 * performance mode, and what the analysis cost.
 *
 * Files dropped on the page or picked through "Dodaj wydanie" wait at the end
 * of the list until their edition joins it. A Latin piece whose guide the
 * upload would write asks for the pronunciation there, because the choice
 * travels with the file.
 *
 * Edition writes join the piece's save queue, so a piece response cannot land
 * after them with the edition as it was before.
 * @module features/archive/piece-card/PieceEditions
 */

import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { getDateFnsLocale } from "@/shared/lib/time/dateFnsLocale";
import { cn } from "@/shared/lib/utils";
import {
  INGESTION_STATUS,
  isIngestionInProgress,
  type LatinPronunciationCode,
  type Piece,
  type ScoreEditionSummary,
  type ScoreLicenseType,
} from "@/shared/types";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { PropertyRow, PROPERTY_CONTROL_CLASS } from "@/shared/ui/composites/PropertyRow";
import { Button } from "@/shared/ui/primitives/Button";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Select } from "@/shared/ui/primitives/Select";
import { Label, Text } from "@/shared/ui/primitives/typography";

import {
  useDeleteEdition,
  useLiveIngestion,
  usePatchEdition,
  useReingestEdition,
} from "../api/archive.queries";
import { formatIngestionCost } from "../constants/ingestionCost";
import {
  isOverloadWait,
  liveAnalysisDetail,
  liveIngestionLabel,
} from "../constants/ingestionProgress";
import {
  DEFAULT_LATIN_PRONUNCIATION,
  LATIN_SAMPLE_WORDS,
  getLatinPronunciationOptions,
  isLatinPronunciationCode,
} from "../constants/latinPronunciation";
import {
  formatFileSize,
  type EditionUploads,
  type PendingUpload,
} from "../hooks/useEditionUploads";
import type { ScoreEditionPatchDTO } from "../types/archive.dto";
import { CommitText } from "./CommitText";
import type { PieceAutosave } from "./usePieceAutosave";

// By how common each status is for this mostly public-domain choir; the
// untriaged default last.
const LICENSE_ORDER: readonly ScoreLicenseType[] = ["PD", "LC", "PDG", "UNK"];

/** Where the record puts an edition on screen. */
export interface EditionDesk {
  /** The edition on the desk, or null when there is none. */
  readonly editionId: string | null;
  /** True beside the score; false on a phone, where showing opens the stand. */
  readonly isTwoPane: boolean;
  readonly show: (editionId: string, page?: number) => void;
}

/**
 * Whether an upload to this piece should ask for the Latin pronunciation. The
 * choice only reaches a guide the upload writes, and the analysis writes one
 * only where the piece has none.
 */
export const uploadAsksPronunciation = (piece: Pick<Piece, "language" | "lyrics_ipa">): boolean => {
  if (piece.lyrics_ipa?.trim()) return false;
  const language = piece.language?.trim() ?? "";
  return language === "" || language.split("+").includes("la");
};

const uploadedWhen = (iso: string | undefined, language: string): string => {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: getDateFnsLocale(language) });
  } catch {
    return "";
  }
};

const EditionStatus = ({ edition }: { edition: ScoreEditionSummary }) => {
  const { t } = useTranslation();
  const running = isIngestionInProgress(edition.ingestion_status);
  const live = useLiveIngestion(running ? edition.id : null);
  const status = live?.ingestion_status ?? edition.ingestion_status;

  if (isIngestionInProgress(status)) {
    const progress = live?.ingestion_progress ?? edition.ingestion_progress;
    const label = (!isOverloadWait(progress) && liveAnalysisDetail(t, live?.live_preview))
      || liveIngestionLabel(t, status, progress);
    return (
      <Text as="span" size="sm" color="graphite" className="mt-0.5 flex items-center gap-1.5">
        <Sparkles size={14} aria-hidden="true" className="shrink-0" />
        {label}
      </Text>
    );
  }
  if (status === INGESTION_STATUS.AWAITING) {
    return (
      <Text as="span" size="sm" color="amethyst" className="mt-0.5 flex items-center gap-1.5">
        <Sparkles size={14} aria-hidden="true" className="shrink-0" />
        {t("archive.piece_card.edition_awaiting")}
      </Text>
    );
  }
  if (status === INGESTION_STATUS.FAILED) {
    const reason = live?.ingestion_error || edition.ingestion_error;
    return (
      <Text as="span" size="sm" color="crimson" className="mt-0.5 block wrap-anywhere">
        {reason
          ? t("archive.piece_card.edition_failed_reason", { reason })
          : t("archive.piece_card.edition_failed")}
      </Text>
    );
  }
  return null;
};

const EditionSettings = ({ edition, autosave }: { edition: ScoreEditionSummary; autosave: PieceAutosave }) => {
  const { t } = useTranslation();
  const patch = usePatchEdition();
  const licenceLabel = t("archive.editions.license.label");
  const copiesLabel = t("archive.piece_card.edition_copies");
  const licence: ScoreLicenseType = edition.license_type ?? "UNK";
  const wholePage = edition.stand_whole_page ?? false;
  const suggested = !wholePage && edition.stand_whole_page_suggested === true;
  const cost = formatIngestionCost(edition.ingestion_cost_cents);
  const licenceNames: Record<ScoreLicenseType, string> = {
    PD: t("archive.editions.license.public_domain"),
    LC: t("archive.editions.license.licensed_copies"),
    PDG: t("archive.editions.license.publisher_digital"),
    UNK: t("archive.editions.license.unknown"),
  };

  const save = (dto: ScoreEditionPatchDTO): Promise<void> =>
    autosave.enqueue(() => patch.mutateAsync({ id: edition.id, dto })).then(() => undefined);

  return (
    <div className="pb-3">
      <PropertyRow label={licenceLabel}>
        {(id) => (
          <div>
            <Select
              id={id}
              value={licence}
              options={LICENSE_ORDER.map((value) => ({ value, label: licenceNames[value] }))}
              onValueChange={(next) => {
                const value = LICENSE_ORDER.find((option) => option === next);
                if (!value || value === licence) return;
                // Copies only mean something for licensed copies.
                void save(value === "LC" ? { license_type: value } : { license_type: value, copies_owned: null })
                  .catch(autosave.showSaveError);
              }}
              variant="property"
              className={cn(PROPERTY_CONTROL_CLASS, "w-fit max-w-full")}
            />
            <Text size="sm" color="muted" className="px-2">
              {licence === "PD"
                ? t("archive.editions.license.public_hint")
                : t("archive.editions.license.protected_hint")}
            </Text>
          </div>
        )}
      </PropertyRow>
      {licence === "LC" && (
        <PropertyRow label={copiesLabel}>
          {(id) => (
            <CommitText
              id={id}
              value={edition.copies_owned?.toString() ?? ""}
              inputMode="numeric"
              draftField={autosave.track("copies_owned", copiesLabel, edition.id)}
              onCommit={(next) => {
                if (!/^\d{0,5}$/.test(next)) return t("archive.piece_card.copies_invalid");
                return save({ copies_owned: next === "" ? null : Number(next) });
              }}
            />
          )}
        </PropertyRow>
      )}
      <PropertyRow label={t("archive.piece_card.edition_stand")}>
        {(id) => (
          <div className="px-2 py-1.5">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id={id}
                checked={wholePage}
                onChange={(event) => void save({ stand_whole_page: event.target.checked }).catch(autosave.showSaveError)}
              />
              <Text as="span">{t("archive.piece_card.edition_whole_page")}</Text>
            </label>
            <Text size="sm" color="muted" className="mt-1">
              {t("archive.editions.stand.whole_page_hint")}
            </Text>
            {suggested && (
              <Text size="sm" color="amethyst" className="mt-1 flex items-center gap-1.5">
                <Sparkles size={14} aria-hidden="true" className="shrink-0" />
                {t("archive.editions.stand.suggested")}
              </Text>
            )}
          </div>
        )}
      </PropertyRow>
      {cost && (
        <Text size="sm" color="muted" className="mt-1 tabular-nums" title={t("archive.editions.ai_cost_title")}>
          {t("archive.editions.ai_cost", { cost })}
        </Text>
      )}
    </div>
  );
};

interface EditionRowProps {
  readonly edition: ScoreEditionSummary;
  readonly autosave: PieceAutosave;
  readonly desk: EditionDesk;
  readonly showsDeskMark: boolean;
  readonly onReingest: (edition: ScoreEditionSummary) => void;
  readonly onDelete: (edition: ScoreEditionSummary) => void;
}

const EditionRow = ({ edition, autosave, desk, showsDeskMark, onReingest, onDelete }: EditionRowProps) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const detailId = useId();
  const pendingDialog = useRef<(() => void) | null>(null);
  const name = edition.original_filename || t("archive.editions.untitled");
  const facts = [
    edition.publisher,
    edition.edition_year ? String(edition.edition_year) : null,
    edition.page_count ? t("archive.piece_card.page_count", { count: edition.page_count }) : null,
    uploadedWhen(edition.created_at, i18n.language),
  ].filter(Boolean).join(" · ");
  const isOnDesk = desk.isTwoPane && desk.editionId === edition.id;
  const canShow = Boolean(edition.pdf_file) && !isOnDesk;
  // Re-running an approved edition takes back materials the choir already has,
  // and a running one is still in the pipeline.
  const canReingest = edition.ingestion_status === INGESTION_STATUS.AWAITING
    || edition.ingestion_status === INGESTION_STATUS.FAILED;
  // The confirmation opens once the menu has handed focus back to "⋯", so the
  // dialog takes focus from there and returns it there when it closes.
  const askFirst = (action: (edition: ScoreEditionSummary) => void) => () => {
    pendingDialog.current = () => action(edition);
  };

  return (
    <li className="border-t border-hairline">
      <div className="flex items-start gap-1 py-1.5">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={isOpen ? detailId : undefined}
          onClick={() => setIsOpen((open) => !open)}
          className="-ml-2 flex min-w-0 flex-1 items-start gap-2 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-ethereal-marble/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
        >
          <span className="min-w-0 flex-1">
            <Text as="span" className="block wrap-anywhere">{name}</Text>
            {facts && <Text as="span" size="sm" color="muted" className="block">{facts}</Text>}
            <EditionStatus edition={edition} />
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn("mt-1 shrink-0 text-ethereal-graphite transition-transform duration-200", isOpen && "rotate-180")}
          />
        </button>
        {showsDeskMark && isOnDesk && (
          <Text size="sm" color="graphite" className="shrink-0 pt-2.5">
            {t("archive.piece_card.edition_on_desk")}
          </Text>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="icon"
              size="icon"
              className="mt-0.5 h-9 w-9 shrink-0"
              aria-label={t("archive.piece_card.edition_actions", { name })}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            onCloseAutoFocus={() => {
              const open = pendingDialog.current;
              pendingDialog.current = null;
              open?.();
            }}
          >
            {canShow && (
              <DropdownMenuItem icon={<BookOpen size={16} />} onSelect={() => desk.show(edition.id)}>
                {desk.isTwoPane ? t("archive.piece_card.edition_show") : t("archive.piece_card.open_score")}
              </DropdownMenuItem>
            )}
            {canReingest && (
              <DropdownMenuItem
                icon={<RefreshCcw size={16} />}
                description={t("archive.editions.reingest_title")}
                onSelect={askFirst(onReingest)}
              >
                {t("archive.editions.reingest")}
              </DropdownMenuItem>
            )}
            {(canShow || canReingest) && <DropdownMenuSeparator />}
            <DropdownMenuItem destructive icon={<Trash2 size={16} />} onSelect={askFirst(onDelete)}>
              {t("archive.editions.delete_confirm")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isOpen && (
        <div id={detailId}>
          <EditionSettings edition={edition} autosave={autosave} />
        </div>
      )}
    </li>
  );
};

const UploadRow = ({ upload, uploads }: { upload: PendingUpload; uploads: EditionUploads }) => {
  const { t } = useTranslation();
  const pronunciationId = useId();
  const [system, setSystem] = useState<LatinPronunciationCode>(DEFAULT_LATIN_PRONUNCIATION);
  const options = getLatinPronunciationOptions(t);
  const sample = options.find((option) => option.value === system)?.sample;
  const { file, phase, progress, errorMessage } = upload;
  const removeLabel = t("archive.upload.row_remove_aria", { name: file.name });
  const rowRef = useRef<HTMLLIElement>(null);
  const hasAsked = useRef(false);

  // A file dropped on the desk waits at the end of the record, out of sight; it
  // comes into view with its question in focus, or the drop looks ignored.
  useEffect(() => {
    if (phase !== "held" || hasAsked.current) return;
    hasAsked.current = true;
    rowRef.current?.scrollIntoView({ block: "center" });
    document.getElementById(pronunciationId)?.focus({ preventScroll: true });
  }, [phase, pronunciationId]);

  const state = phase === "uploading" || phase === "queued"
    ? t("archive.piece_card.upload_sending", { progress })
    : phase === "succeeded"
      ? t("archive.piece_card.upload_sent")
      : phase === "failed"
        ? null
        : t("archive.piece_card.upload_held");

  return (
    <li ref={rowRef} className="border-t border-hairline py-2">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <Text className="wrap-anywhere">{file.name}</Text>
          <Text size="sm" color={phase === "failed" ? "crimson" : "muted"} className="wrap-anywhere">
            {[formatFileSize(file.size), state ?? errorMessage ?? t("archive.upload.row_failed")].join(" · ")}
          </Text>
        </div>
        {(phase === "held" || phase === "failed") && (
          <Button variant="icon" size="icon" className="h-9 w-9 shrink-0" aria-label={removeLabel} title={removeLabel}
            onClick={() => uploads.remove(upload.localId)}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
      {(phase === "uploading" || phase === "queued") && (
        <div
          role="progressbar"
          aria-label={file.name}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="mt-2 h-0.5 overflow-hidden bg-hairline-strong"
        >
          <div
            className="h-full origin-left bg-ethereal-gold transition-transform duration-200 ease-out"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
      )}
      {phase === "held" && (
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="min-w-48">
            <Label as="label" htmlFor={pronunciationId} color="graphite" className="block">
              {t("archive.upload.latin_system")}
            </Label>
            <Select
              id={pronunciationId}
              value={system}
              options={options.map(({ value, label }) => ({ value, label }))}
              onValueChange={(value) => {
                if (isLatinPronunciationCode(value)) setSystem(value);
              }}
              variant="property"
              className={cn(PROPERTY_CONTROL_CLASS, "-ml-2 w-fit max-w-full")}
            />
          </div>
          {sample && <Text size="sm" color="muted" className="pb-2">{`${LATIN_SAMPLE_WORDS} [${sample}]`}</Text>}
          <Button variant="outline" size="sm" casing="sentence" className="mb-0.5 ml-auto" onClick={() => void uploads.send(upload, system)}>
            {t("archive.piece_card.upload_send")}
          </Button>
          <Text size="sm" color="muted" className="basis-full">
            {t("archive.upload.latin_system_hint")}
          </Text>
        </div>
      )}
    </li>
  );
};

interface PieceEditionsProps {
  readonly piece: Piece;
  readonly autosave: PieceAutosave;
  readonly desk: EditionDesk;
  readonly uploads: EditionUploads;
  /** Opens the page's PDF picker. */
  readonly onAddEdition: () => void;
}

export const PieceEditions = ({ piece, autosave, desk, uploads, onAddEdition }: PieceEditionsProps) => {
  const { t } = useTranslation();
  const { mutateAsync: reingest } = useReingestEdition();
  const { mutateAsync: deleteEdition } = useDeleteEdition();
  const [toReingest, setToReingest] = useState<ScoreEditionSummary | null>(null);
  const [toDelete, setToDelete] = useState<ScoreEditionSummary | null>(null);
  // From the click to the settled request: a write can wait in the piece's
  // queue before its mutation starts, and a second click must not queue another.
  const [isReingesting, setIsReingesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const editions = [...(piece.editions ?? [])].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  const listed = new Set(editions.map((edition) => edition.id));
  const listedKey = editions.map((edition) => edition.id).join(" ");
  // A sent file hands over to its edition's row once the piece lists it.
  const pending = uploads.uploads.filter((upload) => !upload.editionId || !listed.has(upload.editionId));
  const showsDeskMark = editions.filter((edition) => edition.pdf_file).length > 1;

  // ...and leaves for good, or deleting that edition would bring the file back
  // as a row reading "sent" that nothing can remove.
  const { uploads: uploadEntries, remove: forgetUpload } = uploads;
  useEffect(() => {
    const listedNow = new Set(listedKey.split(" "));
    uploadEntries.forEach((upload) => {
      if (upload.editionId && listedNow.has(upload.editionId)) forgetUpload(upload.localId);
    });
  }, [listedKey, uploadEntries, forgetUpload]);

  const confirmReingest = (): void => {
    if (!toReingest || isReingesting) return;
    const target = toReingest;
    setIsReingesting(true);
    // Queued, so a piece write in flight cannot land its older edition status
    // over the restarted analysis.
    void autosave.enqueue(() => reingest({ id: target.id })).then(() => {
      setToReingest(null);
      toast.success(t("archive.editions.reingest_success"));
    }, (err: unknown) => {
      toastApiError(err, t, { fallbackDescription: t("archive.editions.reingest_error") });
    }).finally(() => setIsReingesting(false));
  };

  const confirmDelete = (): void => {
    if (!toDelete || isDeleting) return;
    const target = toDelete;
    setIsDeleting(true);
    void autosave.enqueue(() => deleteEdition(target.id)).then(() => {
      setToDelete(null);
      toast.success(t("archive.editions.delete_success"));
    }, (err: unknown) => {
      toastApiError(err, t, { fallbackDescription: t("archive.editions.delete_error") });
    }).finally(() => setIsDeleting(false));
  };

  return (
    <div className="space-y-1">
      {(editions.length > 0 || pending.length > 0) && (
        <ul className="border-b border-hairline">
          {editions.map((edition) => (
            <EditionRow
              key={edition.id}
              edition={edition}
              autosave={autosave}
              desk={desk}
              showsDeskMark={showsDeskMark}
              onReingest={setToReingest}
              onDelete={setToDelete}
            />
          ))}
          {pending.map((upload) => <UploadRow key={upload.localId} upload={upload} uploads={uploads} />)}
        </ul>
      )}
      <Button
        type="button"
        casing="sentence"
        size="sm"
        variant="ghost"
        leftIcon={<Plus size={16} aria-hidden="true" />}
        onClick={onAddEdition}
      >
        {t("archive.piece_card.add_edition")}
      </Button>

      <ConfirmModal
        isOpen={toReingest !== null}
        title={t("archive.editions.reingest_modal_title")}
        description={t("archive.editions.reingest_modal_desc")}
        confirmText={t("archive.editions.reingest_confirm")}
        cancelText={t("common.actions.cancel")}
        isLoading={isReingesting}
        onCancel={() => setToReingest(null)}
        onConfirm={confirmReingest}
      />
      <ConfirmModal
        isOpen={toDelete !== null}
        isDestructive
        title={t("archive.editions.delete_modal_title")}
        description={t("archive.editions.delete_modal_desc")}
        confirmText={t("archive.editions.delete_confirm")}
        cancelText={t("common.actions.cancel")}
        isLoading={isDeleting}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
