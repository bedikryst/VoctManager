/**
 * @file AnnotationMarksPanel.tsx
 * @description The "Uwagi" tab of the viewer's sheet (via
 * PdfViewer.sheetTabs). A map of the markup you can't see at a glance on a
 * long score: layer visibility toggles, what is new since the reader's last
 * visit, the pages that carry marks, and a searchable jump-to index of every
 * note and symbol. In conductor mode the layers are choir, leader and private;
 * in personal mode they are the conductor's shared markings, the cues he wrote
 * for whoever runs the evening, and the user's own pencil marks. Pages are
 * named as the viewer names them (`usePdfPageText`), so a mark in the book
 * says the printed page the bottom bar will show on arrival.
 *
 * Everything below the toggles obeys them. Hiding a layer is how a conductor
 * previews what the choir actually receives, so an index that went on listing
 * what he had just hidden would be arguing with the control above it. Only the
 * per-layer counts stay whole — that figure is the switch's own subject.
 *
 * Where marks are addressed to voices and the reader's seat names a section, a
 * second switch reads only their voice and tutti. The list handed in already
 * obeys it, counts included: the marks for other sections are a different
 * reading of the score, not a hidden layer of it.
 *
 * In conductor mode the panel ends in "Odłóż uwagi" for the edition in front
 * of the reader, whose count is whole for the same reason: it says what a set
 * would take, whatever is hidden or filtered.
 *
 * The panel root carries `ANNOTATION_DRAWER_ATTR`, so the stand's Escape can
 * tell the panel's search field from the page: Escape there leaves the field,
 * not the tool in hand and not the score.
 * @module features/annotations/components
 */

import React, { useCallback, useMemo, useState } from "react";
import { Eye, EyeOff, Lock, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { foldDiacritics } from "@/shared/lib/text";
import { cn } from "@/shared/lib/utils";
import { PdfSheetSection, usePdfPageText } from "@/shared/ui/composites/PdfViewer";
import { Text } from "@/shared/ui/primitives/typography";

import {
  isComment,
  isLink,
  isStamp,
  type AnnotationLayer,
  type ScoreAnnotation,
} from "../types/annotations.dto";
import { layerOf } from "../lib/layers";
import { getStampDef } from "../lib/stamps";
import type { LayerVisibility } from "../lib/useAnnotationTools";
import type { VoiceFilter } from "../lib/voices";
import type { ScoreAnnotatorMode } from "../useScoreAnnotator";
import { SetAsideSection } from "./SetAsideSection";

/** The attribute on the panel's root (see the header). */
export const ANNOTATION_DRAWER_ATTR = "data-annotation-drawer";

/** A note or a symbol, as the index and the "new" list name it. */
interface IndexEntry {
  mark: ScoreAnnotation;
  label: string;
  /** Normalized height on the edition's page, so a jump lands on it. */
  y: number;
}

/** One row of the "new" list: a named mark, or the strokes on one page. */
type NewEntry =
  | ({ kind: "mark" } & IndexEntry)
  | { kind: "strokes"; page: number; count: number };

/** The two readings of a score addressed to voices; everything first, as the default. */
const VOICE_FILTERS: ReadonlyArray<{ filter: VoiceFilter; labelKey: string; fallback: string }> = [
  { filter: "all", labelKey: "annotations.panel.voices_all", fallback: "Wszystkie" },
  { filter: "mine", labelKey: "annotations.panel.voices_mine", fallback: "Mój głos + tutti" },
];

/** Reading order: page, then down the page. */
const byPlace = (a: IndexEntry, b: IndexEntry): number =>
  a.mark.page_number - b.mark.page_number || a.y - b.y;

interface AnnotationMarksPanelProps {
  annotations: ScoreAnnotation[];
  /**
   * Marks new to this reader since their last visit, on visible layers only
   * (see `useIncomingMarks`).
   */
  newMarks: readonly ScoreAnnotation[];
  currentPage: number;
  /** `focusY` is the mark's own normalized y, so the jump lands ON it. */
  goToPage: (page: number, focusY?: number) => void;
  /**
   * A mark stores the page of its EDITION. In the concert binder that is not
   * the page the reader is looking at, so both the number shown and the page
   * jumped to come through here. Identity for a single edition.
   */
  displayPage?: (sourcePage: number) => number;
  /**
   * Where a jump link leads, the same way, or null when the document open does
   * not hold that page. Defaults to `displayPage`.
   */
  linkTargetPage?: (sourcePage: number) => number | null;
  /**
   * The same translation for a mark's height: in the binder the edition's page
   * sits inside a rectangle of the book page. Identity for a single edition.
   */
  displayFocusY?: (sourcePage: number, y: number) => number;
  visibleLayers: LayerVisibility;
  toggleLayerVisibility: (layer: AnnotationLayer) => void;
  /**
   * "Mój głos + tutti" or everything. Null hides the switch: the reader's seat
   * names no section, or no mark on the edition is addressed to one.
   * `annotations` already obeys it.
   */
  voiceFilter: VoiceFilter | null;
  onVoiceFilterChange: (filter: VoiceFilter) => void;
  /** Decides which layer rows make sense: choir/private vs conductor/mine. */
  mode: ScoreAnnotatorMode;
  /** A leader who writes back to the conductor on the `leader` layer. */
  writesLeader: boolean;
  onSelectMark: (id: string, page: number) => void;
  /**
   * The edition in front of the reader. With it, a manager's panel ends in
   * "Odłóż uwagi" for that edition (conductor mode only).
   */
  editionId?: string | null;
  /** What a set would take: every mark but the personal pencil, unfiltered. */
  setAsideCount?: number;
  /** An edition's marks were put aside or brought back (see `SetAsideSection`). */
  onMarksReplaced?: (editionId: string) => void;
}


export const AnnotationMarksPanel = ({
  annotations,
  newMarks,
  currentPage,
  goToPage,
  displayPage = (page) => page,
  linkTargetPage = displayPage,
  displayFocusY = (_page, y) => y,
  visibleLayers,
  toggleLayerVisibility,
  voiceFilter,
  onVoiceFilterChange,
  mode,
  writesLeader,
  onSelectMark,
  editionId = null,
  setAsideCount = 0,
  onMarksReplaced,
}: AnnotationMarksPanelProps): React.JSX.Element => {
  const { t } = useTranslation();
  const pageText = usePdfPageText();
  const [query, setQuery] = useState("");

  /**
   * The map describes what is ON THE PAGE, so it obeys the switches directly
   * above it. The whole point of hiding a layer is to preview what the choir
   * sees; an index that went on listing the private notes — and offering jumps
   * to pages where nothing is drawn any more — was contradicting the control
   * it sits under.
   */
  const visible = useMemo(
    () => annotations.filter((a) => visibleLayers[layerOf(a)]),
    [annotations, visibleLayers],
  );

  /**
   * Notes by their words, symbols by their names, jump links by where they
   * lead. Strokes have none of these.
   */
  const toEntry = useCallback(
    (mark: ScoreAnnotation): IndexEntry | null => {
      if (isComment(mark)) {
        return { mark, label: mark.payload.text, y: mark.payload.y };
      }
      if (isStamp(mark)) {
        const def = getStampDef(mark.payload.symbol);
        const label = def ? t(def.labelKey, def.fallback) : mark.payload.symbol;
        return { mark, label, y: mark.payload.y };
      }
      if (isLink(mark)) {
        const target = linkTargetPage(mark.payload.target_page);
        const label =
          target === null
            ? t("annotations.link.unbound", "Strony, na którą prowadzi ten skok, nie ma w książce")
            : t("annotations.link.entry", "Skok na {{page}}", { page: pageText(target) });
        return { mark, label, y: mark.payload.y };
      }
      return null;
    },
    [linkTargetPage, pageText, t],
  );

  const index = useMemo(
    () =>
      visible
        .map(toEntry)
        .filter((entry): entry is IndexEntry => entry !== null)
        .sort(byPlace),
    [toEntry, visible],
  );

  const needle = foldDiacritics(query.trim());
  const found = useMemo(
    () =>
      needle ? index.filter((entry) => foldDiacritics(entry.label).includes(needle)) : index,
    [index, needle],
  );

  /** Named marks by name; strokes, which say nothing in words, by page. */
  const fresh = useMemo<NewEntry[]>(() => {
    const named: NewEntry[] = newMarks
      .map(toEntry)
      .filter((entry): entry is IndexEntry => entry !== null)
      .sort(byPlace)
      .map((entry) => ({ kind: "mark", ...entry }));
    const strokesPerPage = new Map<number, number>();
    for (const mark of newMarks) {
      if (toEntry(mark)) continue;
      strokesPerPage.set(mark.page_number, (strokesPerPage.get(mark.page_number) ?? 0) + 1);
    }
    const strokes: NewEntry[] = [...strokesPerPage].map(([page, count]) => ({
      kind: "strokes",
      page,
      count,
    }));
    const pageOf = (entry: NewEntry): number =>
      entry.kind === "mark" ? entry.mark.page_number : entry.page;
    return [...named, ...strokes].sort((a, b) => pageOf(a) - pageOf(b));
  }, [newMarks, toEntry]);

  /**
   * Lands ON the mark, not just its page: on a fit that shows half a page at a
   * time, "go to page 7" can land a screen above the thing that was clicked. A
   * note is also selected, because its card is where its words can be read.
   */
  const jumpTo = ({ mark, y }: IndexEntry): void => {
    goToPage(displayPage(mark.page_number), displayFocusY(mark.page_number, y));
    if (isComment(mark)) onSelectMark(mark.id, mark.page_number);
  };

  const annotatedPages = useMemo(() => {
    const counts = new Map<number, number>();
    for (const a of visible) {
      const page = displayPage(a.page_number);
      counts.set(page, (counts.get(page) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible, displayPage]);

  // Counted over EVERYTHING: this figure is the switch's own subject, and a
  // hidden layer reporting zero would be a control that erases its own label.
  const layerCounts = useMemo(() => {
    const counts = { shared: 0, conductor: 0, leader: 0, personal: 0 };
    for (const a of annotations) counts[layerOf(a)] += 1;
    return counts;
  }, [annotations]);

  return (
    <div data-annotation-drawer>
              <PdfSheetSection title={t("annotations.panel.layers", "Widoczność warstw")}>
                <div className="flex flex-col gap-1">
                  {mode === "conductor" ? (
                    <>
                      <LayerToggle
                        label={t("annotations.layer.shared_short", "Chór")}
                        count={layerCounts.shared}
                        visible={visibleLayers.shared}
                        onToggle={() => toggleLayerVisibility("shared")}
                      />
                      <LayerToggle
                        label={t("annotations.layer.leader_short", "Prowadzący")}
                        count={layerCounts.leader}
                        visible={visibleLayers.leader}
                        onToggle={() => toggleLayerVisibility("leader")}
                      />
                      <LayerToggle
                        label={t("annotations.layer.private_short", "Prywatne")}
                        count={layerCounts.conductor}
                        visible={visibleLayers.conductor}
                        onToggle={() => toggleLayerVisibility("conductor")}
                        isPrivate
                      />
                    </>
                  ) : (
                    <>
                      {/* For a singer this layer IS the conductor's hand. For
                          a leader it also carries their own choir marks, so it
                          is named for its audience rather than its author. */}
                      <LayerToggle
                        label={
                          mode === "leader"
                            ? t("annotations.layer.shared_short", "Chór")
                            : t("annotations.layer.from_conductor_short", "Dyrygent")
                        }
                        count={layerCounts.shared}
                        visible={visibleLayers.shared}
                        onToggle={() => toggleLayerVisibility("shared")}
                      />
                      {/* Only whoever was handed the evening ever receives these
                          rows, so their presence IS the permission — offering the
                          switch to a singer who has none would name a layer that
                          means nothing to them. A leader who writes back on it
                          gets it from the start, named as the desk it is. */}
                      {(writesLeader || layerCounts.leader > 0) && (
                        <LayerToggle
                          label={
                            writesLeader
                              ? t("annotations.layer.with_conductor_short", "Z dyrygentem")
                              : t("annotations.layer.for_leader_short", "Dla prowadzącego")
                          }
                          count={layerCounts.leader}
                          visible={visibleLayers.leader}
                          onToggle={() => toggleLayerVisibility("leader")}
                        />
                      )}
                      <LayerToggle
                        label={t("annotations.layer.personal_short", "Moje")}
                        count={layerCounts.personal}
                        visible={visibleLayers.personal}
                        onToggle={() => toggleLayerVisibility("personal")}
                        isPrivate
                      />
                    </>
                  )}
                </div>
              </PdfSheetSection>

              {voiceFilter && (
                <PdfSheetSection title={t("annotations.panel.voices", "Głosy")}>
                  <div
                    className="grid grid-cols-2 gap-1"
                    role="group"
                    aria-label={t("annotations.panel.voices", "Głosy")}
                  >
                    {VOICE_FILTERS.map(({ filter, labelKey, fallback }) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => onVoiceFilterChange(filter)}
                        aria-pressed={voiceFilter === filter}
                        className={cn(
                          "h-10 rounded-chip px-2.5 text-sm transition-colors",
                          voiceFilter === filter
                            ? "bg-ink-on-inverse/20 text-ink-on-inverse"
                            : "text-ink-on-inverse/60 hover:bg-ink-on-inverse/10",
                        )}
                      >
                        {t(labelKey, fallback)}
                      </button>
                    ))}
                  </div>
                </PdfSheetSection>
              )}

              {fresh.length > 0 && (
                <PdfSheetSection title={t("annotations.panel.new", "Nowe")}>
                  <ul className="-mx-2 flex flex-col">
                    {fresh.map((entry) =>
                      entry.kind === "mark" ? (
                        <li key={entry.mark.id}>
                          <EntryButton
                            dot="bg-ethereal-gold"
                            label={entry.label}
                            pageLabel={pageText(displayPage(entry.mark.page_number))}
                            onClick={() => jumpTo(entry)}
                          />
                        </li>
                      ) : (
                        <li key={`strokes-${entry.page}`}>
                          <EntryButton
                            dot="bg-ethereal-gold"
                            label={t("annotations.panel.new_strokes", { count: entry.count })}
                            pageLabel={pageText(displayPage(entry.page))}
                            onClick={() => goToPage(displayPage(entry.page))}
                          />
                        </li>
                      ),
                    )}
                  </ul>
                </PdfSheetSection>
              )}

              {annotatedPages.length > 0 && (
                <PdfSheetSection title={t("annotations.panel.pages", "Oznaczone strony")}>
                  <div className="flex flex-wrap gap-1.5">
                    {annotatedPages.map(([page, count]) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToPage(page)}
                        title={t("annotations.panel.page_marks", { count })}
                        className={cn(
                          "flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-chip px-3 transition-colors",
                          page === currentPage
                            ? "bg-ethereal-gold/90 text-surface-inverse"
                            : "bg-ink-on-inverse/10 text-ink-on-inverse hover:bg-ink-on-inverse/20",
                        )}
                      >
                        <Text as="span" size="base" weight="medium" color="inherit" className="tabular-nums">
                          {pageText(page)}
                        </Text>
                        <Text as="span" size="sm" color="inherit" className="tabular-nums opacity-70">
                          {count}
                        </Text>
                      </button>
                    ))}
                  </div>
                </PdfSheetSection>
              )}

              <PdfSheetSection title={t("annotations.panel.notes", "Notatki i symbole")}>
                {index.length === 0 ? (
                  <Text as="p" size="base" color="ink-on-inverse-muted">
                    {t("annotations.panel.no_notes", "Brak notatek i symboli.")}
                  </Text>
                ) : (
                  <>
                    <label className="mb-2 flex items-center gap-2 rounded-lg bg-ink-on-inverse/10 px-2.5 focus-within:ring-1 focus-within:ring-ethereal-gold/60">
                      <Search
                        size={13}
                        aria-hidden="true"
                        className="shrink-0 text-ink-on-inverse/50"
                      />
                      {/* 16px on phones: anything smaller and iOS zooms the
                          whole score in on focus. */}
                      <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t("annotations.panel.search", "Szukaj w notatkach")}
                        aria-label={t("annotations.panel.search", "Szukaj w notatkach")}
                        className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink-on-inverse placeholder:text-ink-on-inverse/40 focus:outline-none sm:text-sm"
                      />
                    </label>
                    {found.length === 0 ? (
                      <Text as="p" size="base" color="ink-on-inverse-muted">
                        {t("annotations.panel.no_match", "Nic nie pasuje.")}
                      </Text>
                    ) : (
                      <ul className="-mx-2 flex flex-col">
                        {found.map((entry) => (
                          <li key={entry.mark.id}>
                            <EntryButton
                              color={entry.mark.color}
                              label={entry.label}
                              pageLabel={pageText(displayPage(entry.mark.page_number))}
                              isPrivate={layerOf(entry.mark) !== "shared"}
                              onClick={() => jumpTo(entry)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </PdfSheetSection>

              {mode === "conductor" && editionId && (
                <SetAsideSection
                  editionId={editionId}
                  count={setAsideCount}
                  onReplaced={onMarksReplaced}
                />
              )}
    </div>
  );
};

interface EntryButtonProps {
  label: string;
  /** The page as the viewer names it ("s. 14"). */
  pageLabel: string;
  onClick: () => void;
  /** The mark's own ink, for the dot. */
  color?: string;
  /** A class for the dot instead, where the row says "new" rather than "this ink". */
  dot?: string;
  isPrivate?: boolean;
}

const EntryButton = ({
  label,
  pageLabel,
  onClick,
  color,
  dot,
  isPrivate = false,
}: EntryButtonProps): React.JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-start gap-2.5 rounded-chip px-2 py-2 text-left transition-colors hover:bg-ink-on-inverse/10"
  >
    <span
      className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", dot)}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    />
    <span className="min-w-0 flex-1">
      <Text as="span" size="base" color="ink-on-inverse" className="block truncate">
        {label}
      </Text>
      <span className="mt-0.5 flex items-center gap-1 text-ink-on-inverse/50">
        <Text as="span" size="sm" color="inherit" className="tabular-nums">
          {pageLabel}
        </Text>
        {isPrivate && <Lock size={10} aria-hidden="true" />}
      </span>
    </span>
  </button>
);

interface LayerToggleProps {
  label: string;
  count: number;
  visible: boolean;
  onToggle: () => void;
  isPrivate?: boolean;
}

const LayerToggle = ({
  label,
  count,
  visible,
  onToggle,
  isPrivate = false,
}: LayerToggleProps): React.JSX.Element => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={visible}
    className={cn(
      "flex h-10 items-center justify-between rounded-chip px-3 transition-colors",
      visible
        ? "bg-ink-on-inverse/10 text-ink-on-inverse"
        : "text-ink-on-inverse/40 hover:bg-ink-on-inverse/5",
    )}
  >
    <span className="flex items-center gap-1.5">
      {isPrivate && <Lock size={12} aria-hidden="true" />}
      <Text as="span" size="base" color="inherit">
        {label}
      </Text>
    </span>
    <span className="flex items-center gap-2">
      <Text as="span" size="sm" color="inherit" className="tabular-nums opacity-60">
        {count}
      </Text>
      {visible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
    </span>
  </button>
);
