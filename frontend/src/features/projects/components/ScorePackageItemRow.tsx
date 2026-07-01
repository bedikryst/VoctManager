/**
 * @file ScorePackageItemRow.tsx
 * @description One expandable program-item row in the score-book build cockpit.
 * Surfaces readiness, lets the conductor pick the edition, trim the source page
 * range (with the AI-suggested music start), tune which card elements print,
 * label the section/role, and hand-write text/note overrides — all persisted
 * optimistically. Collapsed by default to keep a long programme scannable.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/ScorePackageItemRow
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  Eye,
  FileWarning,
  PencilLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import type {
  CardElement,
  ElementStatus,
  ItemReadinessOverall,
  ScorePackageItem,
  ScorePackageItemPatch,
} from "../api/project.service";
import { EditionThumbnailStrip } from "./EditionThumbnailStrip";

interface ScorePackageItemRowProps {
  projectId: string;
  item: ScorePackageItem;
  cardElements: CardElement[];
  onPatch: (patch: Partial<ScorePackageItemPatch>) => void;
  onPreviewCard: (item: ScorePackageItem) => void;
  onPreviewEdition: (item: ScorePackageItem) => void;
}

// Item roll-up as a calm dot + label rather than a loud bordered badge — the
// readiness signal is meant to inform ("warn, never block"), not alarm.
const OVERALL_META: Record<
  ItemReadinessOverall,
  { dot: string; key: string; fallback: string }
> = {
  ready: { dot: "bg-ethereal-sage", key: "projects.score_package.readiness_state.ready", fallback: "Gotowe" },
  low: { dot: "bg-ethereal-gold", key: "projects.score_package.readiness_state.low", fallback: "Niska pewność" },
  incomplete: { dot: "bg-ethereal-ink/25", key: "projects.score_package.readiness_state.incomplete", fallback: "Niekompletna" },
  no_edition: { dot: "bg-ethereal-crimson", key: "projects.score_package.readiness_state.no_edition", fallback: "Brak nut" },
};

const STATUS_DOT: Record<ElementStatus, string> = {
  ready: "bg-ethereal-sage",
  low: "bg-ethereal-gold",
  missing: "bg-ethereal-ink/20",
};

// Screen-reader equivalent of the coloured status dot (which is aria-hidden),
// so non-sighted users learn each element's data state, not just the row badge.
const STATUS_SR: Record<ElementStatus, { key: string; fallback: string }> = {
  ready: { key: "projects.score_package.element_status.ready", fallback: "dane gotowe" },
  low: { key: "projects.score_package.element_status.low", fallback: "niska pewność danych" },
  missing: { key: "projects.score_package.element_status.missing", fallback: "brak danych" },
};

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

  // The card config + free-text overrides are the advanced 20% — nest them so a
  // long programme stays scannable. Open by default only when this item already
  // carries an override, so existing customisation is never hidden.
  const hasOverrides =
    item.card_enabled !== null ||
    item.card_elements !== null ||
    item.section_label !== "" ||
    item.role_prefix !== "" ||
    item.text_override !== "" ||
    item.note_override !== "";
  const [advancedOpen, setAdvancedOpen] = useState(() => hasOverrides);

  // Local drafts for free-text/number fields — committed on blur so we don't
  // PATCH on every keystroke. Re-synced whenever the server value changes.
  const [draft, setDraft] = useState({
    start: item.pdf_page_start?.toString() ?? "",
    end: item.pdf_page_end?.toString() ?? "",
    section: item.section_label,
    role: item.role_prefix,
    text: item.text_override,
    note: item.note_override,
  });
  useEffect(() => {
    setDraft({
      start: item.pdf_page_start?.toString() ?? "",
      end: item.pdf_page_end?.toString() ?? "",
      section: item.section_label,
      role: item.role_prefix,
      text: item.text_override,
      note: item.note_override,
    });
  }, [
    item.pdf_page_start,
    item.pdf_page_end,
    item.section_label,
    item.role_prefix,
    item.text_override,
    item.note_override,
  ]);

  const overall = OVERALL_META[item.readiness.overall];
  // Low-confidence / incomplete card data is fixable at its source — the archive
  // review screen for this piece. (A missing edition is an upload problem, not a
  // data one, so it doesn't get this link.)
  const needsAttention =
    item.readiness.overall === "low" || item.readiness.overall === "incomplete";

  const commitNumber = (field: "pdf_page_start" | "pdf_page_end", raw: string): void => {
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Math.max(1, Number.parseInt(trimmed, 10) || 1);
    const current = field === "pdf_page_start" ? item.pdf_page_start : item.pdf_page_end;
    if (value !== current) onPatch({ [field]: value });
  };

  const commitText = (
    field: "section_label" | "role_prefix" | "text_override" | "note_override",
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
    if (!item.has_pdf) return t("projects.score_package.item.no_pdf_short", "brak nut");
    const start = item.pdf_page_start;
    const end = item.pdf_page_end;
    if (start == null && end == null) {
      return t("projects.score_package.item.full_range", "całość");
    }
    const from = start ?? 1;
    const to = end ?? item.edition_page_count ?? "";
    return t("projects.score_package.item.range", "s. {{from}}–{{to}}", { from, to });
  })();

  const cardEnabledValue = item.card_enabled === null ? "" : item.card_enabled ? "on" : "off";

  return (
    <div className="rounded-2xl border border-ethereal-ink/8 bg-ethereal-alabaster/40">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-ethereal-incense/5"
      >
        <Text
          as="span"
          weight="bold"
          color="graphite"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ethereal-ink/5 text-[11px]"
        >
          {item.order}
        </Text>
        <span className="min-w-0 flex-1">
          <Text as="span" size="sm" weight="semibold" className="block truncate">
            {item.role_prefix ? `${item.role_prefix} ` : ""}
            {item.title}
          </Text>
          {item.composer && (
            <Caption color="muted" className="block truncate">
              {item.composer}
            </Caption>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", overall.dot)} aria-hidden="true" />
          <Caption color="muted" className="hidden sm:inline">
            {t(overall.key, overall.fallback)}
          </Caption>
        </span>
        <Caption color="muted" className="hidden shrink-0 md:block">
          {rangeLabel}
        </Caption>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-ethereal-graphite/60 transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Body */}
      {open && (
        <div className="flex flex-col gap-4 border-t border-ethereal-ink/8 px-3 py-4">
          {!item.has_pdf && (
            <Caption color="muted" className="flex items-center gap-1.5 italic">
              <FileWarning size={13} aria-hidden="true" />
              {t(
                "projects.score_package.item.no_pdf",
                "Brak dołączonych nut — w partyturze pojawi się strona-zastępka.",
              )}
            </Caption>
          )}

          {needsAttention && (
            <Link
              to={`/panel/archive-management/${item.piece_id}/review`}
              className="flex min-h-11 items-center gap-1.5 self-start rounded-lg px-2 text-[11px] font-medium text-ethereal-gold transition-colors hover:bg-ethereal-gold/10 hover:underline"
            >
              <PencilLine size={12} aria-hidden="true" />
              {t(
                "projects.score_package.item.fix_in_archive",
                "Część danych ma niską pewność — popraw w archiwum",
              )}
            </Link>
          )}

          {/* Edition + page range */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Caption color="muted">
                {t("projects.score_package.item.edition", "Wydanie")}
              </Caption>
              {item.editions.length > 0 ? (
                <Select
                  variant="solid"
                  value={item.explicit_edition_id ?? ""}
                  onChange={(e) =>
                    onPatch({ score_edition_id: e.target.value || null })
                  }
                  aria-label={t("projects.score_package.item.edition", "Wydanie")}
                >
                  <option value="">
                    {t("projects.score_package.item.edition_auto", "Domyślne (automatycznie)")}
                  </option>
                  {item.editions.map((edition) => (
                    <option key={edition.id} value={edition.id}>
                      {edition.label}
                      {edition.is_default ? " ★" : ""}
                    </option>
                  ))}
                </Select>
              ) : (
                <Text size="sm" color="muted" className="italic">
                  {t("projects.score_package.item.no_editions", "Ten utwór nie ma jeszcze nut.")}
                </Text>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Caption color="muted">
                {t("projects.score_package.item.page_range", "Zakres stron")}
              </Caption>
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
              {item.suggested_start != null && item.pdf_page_start !== item.suggested_start && (
                <button
                  type="button"
                  onClick={() => onPatch({ pdf_page_start: item.suggested_start })}
                  className="-ml-2 flex min-h-11 items-center gap-1 self-start rounded-lg px-2 text-[11px] font-medium text-ethereal-gold transition-colors hover:bg-ethereal-gold/10 hover:underline"
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

          {/* Visual page-range trimmer — tap a page to start the music there. Sits
              below the manual inputs so both edit the same fields; degrades to
              nothing when the host has no rasteriser. */}
          {item.has_pdf && item.selected_edition_id && (
            <EditionThumbnailStrip
              projectId={projectId}
              item={item}
              enabled={open}
              onPatch={onPatch}
            />
          )}

          {item.has_pdf && item.selected_edition_id && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              leftIcon={<BookOpen size={14} aria-hidden="true" />}
              onClick={() => onPreviewEdition(item)}
            >
              {t("projects.score_package.item.show_edition", "Pokaż wydanie")}
            </Button>
          )}

          {/* Advanced: per-item card config + free-text overrides. Collapsed by
              default — the common case inherits the package-level settings. */}
          <div className="border-t border-ethereal-ink/5 pt-3">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              className="flex w-full items-center gap-2 text-left"
            >
              <Eyebrow color="muted">
                {t("projects.score_package.item.advanced", "Karta i nadpisania")}
              </Eyebrow>
              {hasOverrides && (
                <Badge variant="neutral">
                  {t("projects.score_package.item.customized", "dostosowane")}
                </Badge>
              )}
              <span className="flex-1" />
              <ChevronDown
                size={15}
                aria-hidden="true"
                className={cn(
                  "text-ethereal-graphite/60 transition-transform duration-300",
                  advancedOpen && "rotate-180",
                )}
              />
            </button>

            {advancedOpen && (
              <div className="mt-3 flex flex-col gap-4">
                {/* Card content */}
                <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow color="muted">
                {t("projects.score_package.item.card", "Karta przed utworem")}
              </Eyebrow>
              <Select
                variant="ghost"
                className="w-auto py-1.5"
                value={cardEnabledValue}
                onChange={(e) =>
                  onPatch({
                    card_enabled:
                      e.target.value === "" ? null : e.target.value === "on",
                  })
                }
                aria-label={t("projects.score_package.item.card", "Karta przed utworem")}
              >
                <option value="">{t("projects.score_package.item.inherit", "Dziedzicz")}</option>
                <option value="on">{t("common.yes", "Tak")}</option>
                <option value="off">{t("common.no", "Nie")}</option>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {cardElements.map((element) => {
                const on = elementsSet.has(element);
                return (
                  <button
                    key={element}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={!cardsActive}
                    onClick={() => toggleElement(element)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                      !cardsActive && "cursor-not-allowed opacity-40",
                      on
                        ? "border-ethereal-gold/45 bg-ethereal-gold/12 text-ethereal-ink"
                        : "border-ethereal-ink/12 bg-transparent text-ethereal-graphite/70 hover:border-ethereal-gold/35 hover:text-ethereal-ink",
                    )}
                  >
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[item.readiness.elements[element]])}
                      aria-hidden="true"
                    />
                    {t(`projects.score_package.elements.${element}`, element)}
                    <span className="sr-only">
                      {t(
                        STATUS_SR[item.readiness.elements[element]].key,
                        STATUS_SR[item.readiness.elements[element]].fallback,
                      )}
                    </span>
                  </button>
                );
              })}
              {item.card_elements !== null && (
                <button
                  type="button"
                  onClick={() => onPatch({ card_elements: null })}
                  className="flex items-center gap-1 text-[11px] font-medium text-ethereal-graphite/70 hover:text-ethereal-ink"
                >
                  <RotateCcw size={11} aria-hidden="true" />
                  {t("projects.score_package.item.reset_elements", "Domyślne")}
                </button>
              )}
            </div>
          </div>

          {/* Labels */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t("projects.score_package.item.section_label", "Sekcja")}
              variant="glass"
              placeholder={t("projects.score_package.item.section_ph", "np. Liturgia eucharystyczna")}
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

          {/* Overrides */}
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

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            leftIcon={<Eye size={14} aria-hidden="true" />}
            onClick={() => onPreviewCard(item)}
          >
            {t("projects.score_package.item.preview_card", "Podgląd karty")}
          </Button>
        </div>
      )}
    </div>
  );
}
