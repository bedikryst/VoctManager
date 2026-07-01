/**
 * @file ScorePackageItemRow.tsx
 * @description One expandable program-item row in the score-book build cockpit.
 * Surfaces readiness, lets the conductor pick the edition, trim the source page
 * range (with the AI-suggested music start), then hands off to a self-contained
 * "card designer" panel — always visible once the row is open — that tunes which
 * card elements print, pins the translation, labels the section/role and holds
 * the free-text overrides, all persisted optimistically. The row itself is the
 * only disclosure; a long programme stays scannable because rows collapse.
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

import type {
  CardElement,
  ItemReadinessOverall,
  ScorePackageItem,
  ScorePackageItemPatch,
} from "../api/project.service";
import { CardElementPills } from "./CardElementPills";
import { EditionThumbnailStrip } from "./EditionThumbnailStrip";

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

  // Whether the conductor has departed from the inherited defaults for this
  // item — drives the "dostosowane" badge on the card-designer panel.
  const hasOverrides =
    item.card_enabled !== null ||
    item.card_elements !== null ||
    item.explicit_translation_id !== null ||
    item.performers !== "" ||
    item.section_label !== "" ||
    item.role_prefix !== "" ||
    item.text_override !== "" ||
    item.note_override !== "";

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

  const cardEnableValue: CardEnableId =
    item.card_enabled === null ? "inherit" : item.card_enabled ? "on" : "off";
  const cardEnableItems: ReadonlyArray<SegmentedTabItem<CardEnableId>> = [
    { id: "inherit", label: t("projects.score_package.item.inherit", "Dziedzicz") },
    { id: "on", label: t("common.yes", "Tak") },
    { id: "off", label: t("common.no", "Nie") },
  ];

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

          {/* ── Card designer ─────────────────────────────────────────────────
              Promoted out of a second nested disclosure (its quiet Eyebrow
              trigger was routinely missed) into a self-contained, always-visible
              panel: what prints on the introductory card before this piece, plus
              the per-item content overrides. Configure → preview lives here. */}
          <section
            aria-label={t("projects.score_package.item.card", "Karta przed utworem")}
            className="flex flex-col gap-4 rounded-xl border border-ethereal-ink/8 bg-ethereal-parchment/40 p-3.5 shadow-glass-solid sm:p-4"
          >
            {/* Identity + the enable decision */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-ethereal-gold" aria-hidden="true">
                  <LayoutTemplate size={16} />
                </span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Text size="sm" weight="semibold" color="graphite">
                      {t("projects.score_package.item.card", "Karta przed utworem")}
                    </Text>
                    {hasOverrides && (
                      <Badge variant="neutral">
                        {t("projects.score_package.item.customized", "dostosowane")}
                      </Badge>
                    )}
                  </div>
                  <Caption color="muted" className="max-w-md">
                    {t(
                      "projects.score_package.item.card_hint",
                      "Strona wprowadzająca drukowana przed nutami — wybierz, co się na niej znajdzie.",
                    )}
                  </Caption>
                </div>
              </div>
              <div className="shrink-0">
                <SegmentedTabs<CardEnableId>
                  items={cardEnableItems}
                  value={cardEnableValue}
                  onChange={(id) =>
                    onPatch({ card_enabled: id === "inherit" ? null : id === "on" })
                  }
                  ariaLabel={t("projects.score_package.item.card", "Karta przed utworem")}
                />
              </div>
            </div>

            {/* Elements — what prints on the card */}
            <div className="flex flex-col gap-2.5 border-t border-ethereal-ink/6 pt-3.5">
              <div className="flex items-center justify-between gap-2">
                <Eyebrow color="muted">
                  {t("projects.score_package.item.card_elements_label", "Elementy karty")}
                </Eyebrow>
                {item.card_elements !== null && (
                  <button
                    type="button"
                    onClick={() => onPatch({ card_elements: null })}
                    className="flex items-center gap-1 text-[11px] font-medium text-ethereal-graphite/70 transition-colors hover:text-ethereal-ink"
                  >
                    <RotateCcw size={11} aria-hidden="true" />
                    {t("projects.score_package.item.reset_elements", "Domyślne")}
                  </button>
                )}
              </div>
              <CardElementPills
                elements={cardElements}
                selected={elementsSet}
                disabled={!cardsActive}
                onToggle={toggleElement}
                statusFor={(element) => item.readiness.elements[element]}
              />
            </div>

            {/* Content & labels — sources the card draws from + free-text overrides */}
            <div className="flex flex-col gap-3 border-t border-ethereal-ink/6 pt-3.5">
              <Eyebrow color="muted">
                {t("projects.score_package.item.card_content_label", "Treść i etykiety")}
              </Eyebrow>

              {/* Pinned translation + concert-specific cast line */}
              <div className="grid gap-3 sm:grid-cols-2">
                {item.translations.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Caption color="muted">
                      {t("projects.score_package.item.translation_pick", "Tłumaczenie na karcie")}
                    </Caption>
                    <Select
                      variant="solid"
                      value={item.explicit_translation_id ?? ""}
                      onChange={(e) => onPatch({ translation_id: e.target.value || null })}
                      aria-label={t("projects.score_package.item.translation_pick", "Tłumaczenie na karcie")}
                    >
                      <option value="">
                        {t("projects.score_package.item.translation_auto", "Automatycznie (język książki)")}
                      </option>
                      {item.translations.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.language.toUpperCase()}
                          {" · "}
                          {tr.is_singable
                            ? t("projects.score_package.item.translation_singable", "śpiewne")
                            : t("projects.score_package.item.translation_literal", "dosłowne")}
                          {tr.translator ? ` — ${tr.translator}` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
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

              {/* Section + role prefix */}
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

              {/* Free-text overrides */}
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

            {/* Panel footer — the designer's own configure→preview CTA */}
            <div className="flex justify-end border-t border-ethereal-ink/6 pt-3.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Eye size={14} aria-hidden="true" />}
                onClick={() => onPreviewCard(item)}
              >
                {t("projects.score_package.item.preview_card", "Podgląd karty")}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
