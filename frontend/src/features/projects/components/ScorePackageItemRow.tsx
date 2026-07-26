/**
 * @file ScorePackageItemRow.tsx
 * @description One program item in the score-book build cockpit, collapsed to the
 * two facts that decide the book — what binds, and how many pages of it — and
 * opening onto the work in the order it is actually done: fix the binding, then
 * the card that prints before it, then (rarely) the per-concert text overrides.
 * The row language is the Overview setlist's: gold ordinal, gaps in gold, a quiet
 * tick when there is nothing to do. Every override persists optimistically.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/ScorePackageItemRow
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Eye,
  FileWarning,
  LayoutTemplate,
  PencilLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import type { SegmentedTabItem } from "@/shared/ui/composites/SegmentedTabs";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { useScorePackageThumbnails } from "../api/project.score-package";
import type {
  CardElement,
  ScorePackageItem,
  ScorePackageItemPatch,
} from "../api/project.service";
import { CardElementLegend, CardElementPills } from "./CardElementPills";
import {
  EditionThumbnailSkeleton,
  EditionThumbnailStrip,
} from "./EditionThumbnailStrip";

interface ScorePackageItemRowProps {
  projectId: string;
  item: ScorePackageItem;
  cardElements: CardElement[];
  onPatch: (patch: Partial<ScorePackageItemPatch>) => void;
  onPreviewCard: (item: ScorePackageItem) => void;
  onPreviewEdition: (item: ScorePackageItem) => void;
}

// Three-state per-item card switch mapped to card_enabled (null = inherit the
// package default). Rendered as SegmentedTabs so it shares the package-level
// control language instead of reading as a stray form <select>.
type CardEnableId = "inherit" | "on" | "off";

/** Free-text / pinned-selection overrides — the exceptions, counted for the
 *  disclosure that holds them so a set override is never hidden silently. */
const countOverrides = (item: ScorePackageItem): number =>
  [
    item.explicit_translation_id,
    item.performers,
    item.section_label,
    item.role_prefix,
    item.text_override,
    item.note_override,
  ].filter((value) => Boolean(value)).length;

export function ScorePackageItemRow({
  projectId,
  item,
  cardElements,
  onPatch,
  onPreviewCard,
  onPreviewEdition,
}: ScorePackageItemRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // The row owns the trim-strip manifest: whether pages can be rasterised at all
  // decides whether the strip renders or the numeric fallback carries the AI hint.
  const { data: thumbnails, isLoading: thumbnailsLoading } =
    useScorePackageThumbnails(
      projectId,
      item.id,
      item.selected_edition_id,
      open && item.has_pdf && Boolean(item.selected_edition_id),
    );
  const stripPages = thumbnails?.available ? thumbnails.thumbnails : [];
  const hasStrip = stripPages.length > 0;

  const overrideCount = countOverrides(item);
  // Opens on an item that already carries overrides, so nothing set is invisible;
  // stays user-togglable from there.
  const [overridesOpen, setOverridesOpen] = useState(() => overrideCount > 0);

  // Local drafts for free-text/number fields — committed on blur so we don't
  // PATCH on every keystroke. Re-synced whenever the server value changes.
  const [draft, setDraft] = useState({
    start: item.pdf_page_start?.toString() ?? "",
    end: item.pdf_page_end?.toString() ?? "",
    performers: item.performers,
    section: item.section_label,
    role: item.role_prefix,
    text: item.text_override,
    note: item.note_override,
  });
  useEffect(() => {
    setDraft({
      start: item.pdf_page_start?.toString() ?? "",
      end: item.pdf_page_end?.toString() ?? "",
      performers: item.performers,
      section: item.section_label,
      role: item.role_prefix,
      text: item.text_override,
      note: item.note_override,
    });
  }, [
    item.pdf_page_start,
    item.pdf_page_end,
    item.performers,
    item.section_label,
    item.role_prefix,
    item.text_override,
    item.note_override,
  ]);

  // Low-confidence card data is fixable at its source — the archive review screen
  // for this piece. (A missing edition is an upload problem, not a data one, so
  // it doesn't get this link.)
  const needsArchiveFix = item.readiness.overall === "low";

  const commitNumber = (field: "pdf_page_start" | "pdf_page_end", raw: string): void => {
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Math.max(1, Number.parseInt(trimmed, 10) || 1);
    const current = field === "pdf_page_start" ? item.pdf_page_start : item.pdf_page_end;
    if (value !== current) onPatch({ [field]: value });
  };

  const commitText = (
    field: "performers" | "section_label" | "role_prefix" | "text_override" | "note_override",
    value: string,
  ): void => {
    const current = item[field];
    if (value !== current) onPatch({ [field]: value });
  };

  const cardsActive = item.card_enabled_effective;
  const elementsSet = new Set(item.card_elements_effective);

  const toggleElement = (element: CardElement): void => {
    const base = item.card_elements ?? item.card_elements_effective;
    const next = new Set(base);
    if (next.has(element)) next.delete(element);
    else next.add(element);
    onPatch({ card_elements: cardElements.filter((e) => next.has(e)) });
  };

  const rangeLabel = ((): string => {
    const start = item.pdf_page_start;
    const end = item.pdf_page_end;
    if (start == null && end == null) {
      return t("projects.score_package.item.full_range", "całość");
    }
    const from = start ?? 1;
    const to = end ?? item.edition_page_count ?? "";
    return t("projects.score_package.item.range", "s. {{from}}–{{to}}", { from, to });
  })();

  const cardEnableValue: CardEnableId =
    item.card_enabled === null ? "inherit" : item.card_enabled ? "on" : "off";
  const cardEnableItems: ReadonlyArray<SegmentedTabItem<CardEnableId>> = [
    { id: "inherit", label: t("projects.score_package.item.inherit", "Dziedzicz") },
    { id: "on", label: t("common.yes", "Tak") },
    { id: "off", label: t("common.no", "Nie") },
  ];

  const lowLabel = t("projects.score_package.readiness_state.low", "Niska pewność");
  const readyLabel = t("projects.score_package.readiness_state.ready", "Gotowe");
  const overCopiesLabel = t(
    "projects.score_package.item.over_copies_short",
    "za mało egzemplarzy",
  );

  return (
    <div className="rounded-nested border border-hairline-strong bg-ethereal-alabaster/40">
      {/* Header — what binds, then how confident the card data is. Nothing else:
          "incomplete" is the resting state of un-enriched repertoire and a label
          on every row would bury the one piece that actually needs the eye. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-nested px-3.5 py-3 text-left transition-colors hover:bg-ethereal-incense/5"
      >
        <Text
          as="span"
          size="xs"
          weight="bold"
          className="w-5 shrink-0 tabular-nums text-ethereal-gold/70"
        >
          {String(item.order).padStart(2, "0")}
        </Text>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <Text
              as="span"
              size="sm"
              weight="semibold"
              truncate
              color={item.is_encore ? "amethyst" : "default"}
              className={cn("min-w-0", item.is_encore && "italic")}
            >
              {item.role_prefix ? `${item.role_prefix} ` : ""}
              {item.title}
            </Text>
            {item.is_encore && (
              <Badge variant="amethyst" className="shrink-0">
                {t("projects.program.badges.encore", "BIS")}
              </Badge>
            )}
          </span>
          {item.composer && (
            <Caption color="muted" className="block truncate">
              {item.composer}
            </Caption>
          )}
        </span>

        {item.copies_shortfall && (
          <span
            className="hidden shrink-0 text-ethereal-gold md:block"
            title={overCopiesLabel}
          >
            <AlertTriangle size={13} aria-hidden="true" />
            <span className="sr-only">{overCopiesLabel}</span>
          </span>
        )}

        {item.has_pdf ? (
          <Caption color="muted" className="hidden shrink-0 tabular-nums md:block">
            {rangeLabel}
          </Caption>
        ) : (
          <Text as="span" size="sm" weight="medium" color="gold" className="shrink-0">
            {t("projects.score_package.item.no_pdf_short", "brak nut")}
          </Text>
        )}

        {item.readiness.overall === "low" && (
          <span className="flex shrink-0 items-center gap-1.5 text-ethereal-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-ethereal-gold" aria-hidden="true" />
            <Caption color="inherit" className="hidden sm:inline">
              {lowLabel}
            </Caption>
            <span className="sr-only sm:hidden">{lowLabel}</span>
          </span>
        )}
        {item.readiness.overall === "ready" && (
          <span className="shrink-0 text-ethereal-sage" title={readyLabel}>
            <Check size={14} aria-hidden="true" />
            <span className="sr-only">{readyLabel}</span>
          </span>
        )}

        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-ethereal-graphite/60 transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Body — one flat stack divided by hairlines. A bordered panel per group
          turned the open row into three cards inside a card. */}
      {open && (
        <div className="flex flex-col divide-y divide-hairline border-t border-hairline-strong">
          {(!item.has_pdf || item.copies_shortfall || needsArchiveFix) && (
            <div className="flex flex-col gap-2 px-3.5 py-3">
              {!item.has_pdf && (
                <Caption color="muted" className="flex items-start gap-1.5">
                  <FileWarning size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                  {t(
                    "projects.score_package.item.no_pdf",
                    "Brak dołączonych nut — w partyturze pojawi się strona-zastępka.",
                  )}
                </Caption>
              )}

              {item.copies_shortfall && (
                <Caption color="muted" className="flex items-start gap-1.5">
                  <AlertTriangle
                    size={13}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-ethereal-gold"
                  />
                  {t(
                    "projects.score_package.item.over_copies",
                    "Obsada ({{cast}}) przewyższa liczbę posiadanych egzemplarzy licencji ({{copies}}). Upewnij się, że masz dość kopii lub dodatkową licencję.",
                    {
                      cast: item.copies_shortfall.cast_size,
                      copies: item.copies_shortfall.copies_owned,
                    },
                  )}
                </Caption>
              )}

              {needsArchiveFix && (
                <Link
                  to={`/panel/archive-management/${item.piece_id}`}
                  className="-ml-2 flex min-h-11 items-center gap-1.5 self-start rounded-chip px-2 text-[11px] font-medium text-ethereal-gold transition-colors hover:bg-ethereal-gold/10 hover:underline"
                >
                  <PencilLine size={12} aria-hidden="true" />
                  {t(
                    "projects.score_package.item.fix_in_archive",
                    "Część danych ma niską pewność — popraw w archiwum",
                  )}
                </Link>
              )}
            </div>
          )}

          {/* ── Binding: which edition, which of its pages ─────────────────── */}
          <div className="flex flex-col gap-3 px-3.5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow color="muted">
                {t("projects.score_package.item.binding", "Oprawa")}
              </Eyebrow>
              {item.has_pdf && item.selected_edition_id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<BookOpen size={14} aria-hidden="true" />}
                  onClick={() => onPreviewEdition(item)}
                >
                  {t("projects.score_package.item.show_edition", "Pokaż wydanie")}
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {item.editions.length > 0 ? (
                <Select
                  variant="solid"
                  label={t("projects.score_package.item.edition", "Wydanie")}
                  value={item.explicit_edition_id ?? ""}
                  onValueChange={(editionId) =>
                    onPatch({ score_edition_id: editionId || null })
                  }
                  placeholder={t(
                    "projects.score_package.item.edition_auto",
                    "Domyślne (automatycznie)",
                  )}
                  clearLabel={t(
                    "projects.score_package.item.edition_auto",
                    "Domyślne (automatycznie)",
                  )}
                  options={item.editions.map((edition) => ({
                    value: String(edition.id),
                    label: `${edition.label}${edition.is_default ? " ★" : ""}`,
                  }))}
                />
              ) : (
                <div className="flex w-full flex-col gap-1.5">
                  <Eyebrow as="span" color="muted" className="ml-1">
                    {t("projects.score_package.item.edition", "Wydanie")}
                  </Eyebrow>
                  <Text size="sm" color="muted" className="italic">
                    {t(
                      "projects.score_package.item.no_editions",
                      "Ten utwór nie ma jeszcze nut.",
                    )}
                  </Text>
                </div>
              )}

              {/* Same label recipe as the field beside it — a `Caption` here and an
                  `Eyebrow` there is what made one form read as two. */}
              <div className="flex w-full flex-col gap-1.5">
                <Eyebrow as="span" color="muted" className="ml-1">
                  {t("projects.score_package.item.page_range", "Zakres stron")}
                </Eyebrow>
                <div className="flex items-center gap-2">
                  {/* The Input primitive wraps in a w-full container, so constrain the
                      width here or the two small fields spread across the column. */}
                  <div className="w-20 shrink-0">
                    <Input
                      type="number"
                      min={1}
                      variant="glass"
                      disabled={!item.has_pdf}
                      placeholder="1"
                      value={draft.start}
                      onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
                      onBlur={(e) => commitNumber("pdf_page_start", e.target.value)}
                      aria-label={t("projects.score_package.item.page_start", "Strona początkowa")}
                    />
                  </div>
                  <Text as="span" color="muted" aria-hidden="true">
                    –
                  </Text>
                  <div className="w-20 shrink-0">
                    <Input
                      type="number"
                      min={1}
                      variant="glass"
                      disabled={!item.has_pdf}
                      placeholder={
                        item.edition_page_count
                          ? String(item.edition_page_count)
                          : t("projects.score_package.item.last", "ost.")
                      }
                      value={draft.end}
                      onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
                      onBlur={(e) => commitNumber("pdf_page_end", e.target.value)}
                      aria-label={t("projects.score_package.item.page_end", "Strona końcowa")}
                    />
                  </div>
                </div>
                {/* One-click apply for the AI-suggested start — but only where the
                    strip cannot show it, otherwise the same suggestion is a badge
                    on a page, a hint line and a button all at once. */}
                {!hasStrip &&
                  item.suggested_start != null &&
                  item.pdf_page_start !== item.suggested_start && (
                    <button
                      type="button"
                      onClick={() => onPatch({ pdf_page_start: item.suggested_start })}
                      className="-ml-2 flex min-h-11 items-center gap-1 self-start rounded-chip px-2 text-[11px] font-medium text-ethereal-gold transition-colors hover:bg-ethereal-gold/10 hover:underline"
                    >
                      <Sparkles size={11} aria-hidden="true" />
                      {t(
                        "projects.score_package.item.suggested_start",
                        "Nuty od s. {{n}} — przytnij opis wydawcy",
                        { n: item.suggested_start },
                      )}
                    </button>
                  )}
              </div>
            </div>

            {item.has_pdf && item.selected_edition_id && thumbnailsLoading && (
              <EditionThumbnailSkeleton />
            )}
            {hasStrip && (
              <EditionThumbnailStrip
                item={item}
                thumbnails={stripPages}
                onPatch={onPatch}
              />
            )}
          </div>

          {/* ── The card that prints before this piece ─────────────────────── */}
          <div className="flex flex-col gap-3 px-3.5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-ethereal-gold/70" aria-hidden="true">
                  <LayoutTemplate size={14} />
                </span>
                <Eyebrow color="muted">
                  {t("projects.score_package.item.card", "Karta przed utworem")}
                </Eyebrow>
              </div>
              <SegmentedTabs<CardEnableId>
                items={cardEnableItems}
                value={cardEnableValue}
                onChange={(id) =>
                  onPatch({ card_enabled: id === "inherit" ? null : id === "on" })
                }
                ariaLabel={t("projects.score_package.item.card", "Karta przed utworem")}
              />
            </div>

            <Caption color="muted">
              {t(
                "projects.score_package.item.card_hint",
                "Strona wprowadzająca drukowana przed nutami — wybierz, co się na niej znajdzie.",
              )}
            </Caption>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <Eyebrow size="overline-sm" color="muted">
                {t("projects.score_package.item.card_elements_label", "Elementy karty")}
              </Eyebrow>
              <div className="flex items-center gap-1">
                {item.card_elements !== null && (
                  <button
                    type="button"
                    onClick={() => onPatch({ card_elements: null })}
                    className="flex min-h-11 items-center gap-1 rounded-chip px-2 text-[11px] font-medium text-ethereal-graphite/70 transition-colors hover:text-ethereal-ink"
                  >
                    <RotateCcw size={11} aria-hidden="true" />
                    {t("projects.score_package.item.reset_elements", "Domyślne")}
                  </button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!cardsActive}
                  leftIcon={<Eye size={14} aria-hidden="true" />}
                  onClick={() => onPreviewCard(item)}
                >
                  {t("projects.score_package.item.preview_card", "Podgląd karty")}
                </Button>
              </div>
            </div>

            <CardElementPills
              elements={cardElements}
              selected={elementsSet}
              disabled={!cardsActive}
              onToggle={toggleElement}
              statusFor={(element) => item.readiness.elements[element]}
            />
            <CardElementLegend />

            {/* The overrides are the exception, not the job: six free-text fields
                open on every row is what made this cockpit read as a form. They
                collapse — and the trigger states how many are set. */}
            <div className="rounded-control border border-hairline">
              <button
                type="button"
                onClick={() => setOverridesOpen((v) => !v)}
                aria-expanded={overridesOpen}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-ethereal-incense/5"
              >
                <Eyebrow size="overline-sm" color="muted">
                  {t("projects.score_package.item.card_content_label", "Treść i etykiety")}
                </Eyebrow>
                {overrideCount > 0 && (
                  <Badge variant="neutral">
                    {t("projects.score_package.item.override_count", "Nadpisania: {{count}}", {
                      count: overrideCount,
                    })}
                  </Badge>
                )}
                <span className="flex-1" />
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-ethereal-graphite/60 transition-transform duration-300",
                    overridesOpen && "rotate-180",
                  )}
                />
              </button>

              {overridesOpen && (
                <div className="flex flex-col gap-3 border-t border-hairline px-3 py-3.5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {item.translations.length > 0 && (
                      <Select
                        variant="solid"
                        label={t(
                          "projects.score_package.item.translation_pick",
                          "Tłumaczenie na karcie",
                        )}
                        value={item.explicit_translation_id ?? ""}
                        onValueChange={(translationId) =>
                          onPatch({ translation_id: translationId || null })
                        }
                        placeholder={t(
                          "projects.score_package.item.translation_auto",
                          "Automatycznie (język książki)",
                        )}
                        clearLabel={t(
                          "projects.score_package.item.translation_auto",
                          "Automatycznie (język książki)",
                        )}
                        options={item.translations.map((tr) => ({
                          value: String(tr.id),
                          label: `${tr.language.toUpperCase()} · ${
                            tr.is_singable
                              ? t("projects.score_package.item.translation_singable", "śpiewne")
                              : t("projects.score_package.item.translation_literal", "dosłowne")
                          }${tr.translator ? ` — ${tr.translator}` : ""}`,
                        }))}
                      />
                    )}
                    <Input
                      label={t("projects.score_package.item.performers", "Wykonawcy / obsada")}
                      variant="glass"
                      placeholder={t(
                        "projects.score_package.item.performers_ph",
                        "np. Sopran solo: J. Kowalska · organy: A. Nowak",
                      )}
                      value={draft.performers}
                      onChange={(e) => setDraft((d) => ({ ...d, performers: e.target.value }))}
                      onBlur={(e) => commitText("performers", e.target.value)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label={t("projects.score_package.item.section_label", "Sekcja")}
                      variant="glass"
                      placeholder={t(
                        "projects.score_package.item.section_ph",
                        "np. Liturgia eucharystyczna",
                      )}
                      value={draft.section}
                      onChange={(e) => setDraft((d) => ({ ...d, section: e.target.value }))}
                      onBlur={(e) => commitText("section_label", e.target.value)}
                    />
                    <Input
                      label={t("projects.score_package.item.role_prefix", "Rola / funkcja")}
                      variant="glass"
                      placeholder={t("projects.score_package.item.role_ph", "np. Ofiarowanie:")}
                      value={draft.role}
                      onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                      onBlur={(e) => commitText("role_prefix", e.target.value)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Textarea
                      label={t("projects.score_package.item.text_override", "Tekst (nadpisanie)")}
                      variant="glass"
                      rows={3}
                      placeholder={t(
                        "projects.score_package.item.text_override_ph",
                        "Zostaw puste, aby użyć tekstu z bazy.",
                      )}
                      value={draft.text}
                      onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                      onBlur={(e) => commitText("text_override", e.target.value)}
                    />
                    <Textarea
                      label={t("projects.score_package.item.note_override", "Nota (nadpisanie)")}
                      variant="glass"
                      rows={3}
                      placeholder={t(
                        "projects.score_package.item.note_override_ph",
                        "Zostaw puste, aby użyć noty z bazy.",
                      )}
                      value={draft.note}
                      onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                      onBlur={(e) => commitText("note_override", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
