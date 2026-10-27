/**
 * @file AnnotationSidebar.tsx
 * @description Collapsible right-edge drawer stacked over the whole viewer (via
 * PdfViewer.overlaySlot). A map of the markup you can't see at a glance on a
 * long score: layer visibility toggles, what is new since the reader's last
 * visit, the pages that carry marks, and a searchable jump-to index of every
 * note and symbol. In conductor mode the layers are choir, leader and private;
 * in personal mode they are the conductor's shared markings, the cues he wrote
 * for whoever runs the evening, and the user's own pencil marks.
 *
 * Everything below the toggles obeys them. Hiding a layer is how a conductor
 * previews what the choir actually receives, so an index that went on listing
 * what he had just hidden would be arguing with the control above it. Only the
 * per-layer counts stay whole — that figure is the switch's own subject.
 *
 * In conductor mode the drawer ends in "Odłóż uwagi" for the edition in front
 * of the reader, whose count is whole for the same reason: it says what a set
 * would take, whatever is hidden.
 *
 * The drawer root carries `ANNOTATION_DRAWER_ATTR`, so the stand's Escape can
 * tell the drawer's search field from the page: Escape there leaves the field,
 * not the tool in hand and not the score.
 * @module features/annotations/components
 */

import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  ListTree,
  Lock,
  PanelRightOpen,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { foldDiacritics } from "@/shared/lib/text";
import { cn } from "@/shared/lib/utils";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import {
  isComment,
  isStamp,
  type AnnotationLayer,
  type ScoreAnnotation,
} from "../types/annotations.dto";
import { layerOf } from "../lib/layers";
import { getStampDef } from "../lib/stamps";
import type { LayerVisibility } from "../lib/useAnnotationTools";
import type { ScoreAnnotatorMode } from "../useScoreAnnotator";
import { SetAsideSection } from "./SetAsideSection";

/** The attribute on the drawer's root (see the header). */
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

/** Reading order: page, then down the page. */
const byPlace = (a: IndexEntry, b: IndexEntry): number =>
  a.mark.page_number - b.mark.page_number || a.y - b.y;

interface AnnotationSidebarProps {
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
   * The same translation for a mark's height: in the binder the edition's page
   * sits inside a rectangle of the book page. Identity for a single edition.
   */
  displayFocusY?: (sourcePage: number, y: number) => number;
  visibleLayers: LayerVisibility;
  toggleLayerVisibility: (layer: AnnotationLayer) => void;
  /** Decides which layer rows make sense: choir/private vs conductor/mine. */
  mode: ScoreAnnotatorMode;
  onSelectMark: (id: string, page: number) => void;
  /**
   * The edition in front of the reader. With it, a manager's drawer ends in
   * "Odłóż uwagi" for that edition (conductor mode only).
   */
  editionId?: string | null;
  /** An edition's marks were put aside or brought back (see `SetAsideSection`). */
  onMarksReplaced?: (editionId: string) => void;
}


export const AnnotationSidebar = ({
  annotations,
  newMarks,
  currentPage,
  goToPage,
  displayPage = (page) => page,
  displayFocusY = (_page, y) => y,
  visibleLayers,
  toggleLayerVisibility,
  mode,
  onSelectMark,
  editionId = null,
  onMarksReplaced,
}: AnnotationSidebarProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
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

  /** Notes by their words, symbols by their names. Strokes have neither. */
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
      return null;
    },
    [t],
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
  // What a set would take: every layer but the personal pencil, hidden or not.
  const setAsideCount = layerCounts.shared + layerCounts.conductor + layerCounts.leader;

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center">
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.aside
            key="panel"
            data-annotation-drawer
            initial={{ transform: "translateX(40px)", opacity: 0 }}
            animate={{ transform: "translateX(0px)", opacity: 1 }}
            exit={{ transform: "translateX(40px)", opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto m-3 flex max-h-[calc(100%-7rem)] w-72 flex-col overflow-hidden rounded-3xl border border-line-on-inverse bg-surface-inverse/85 text-ink-on-inverse shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <header className="flex items-center justify-between border-b border-line-on-inverse px-4 py-3">
              <Text as="span" weight="semibold" className="flex items-center gap-2">
                <ListTree size={15} aria-hidden="true" />
                {t("annotations.panel.title", "Adnotacje")}
              </Text>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.close_aria", "Zamknij")}
                className="rounded-full p-1 text-ink-on-inverse/70 hover:bg-ink-on-inverse/10 hover:text-ink-on-inverse"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-3">
              <section className="mb-4">
                <Eyebrow as="p" color="ink-on-inverse-muted" className="mb-2">
                  {t("annotations.panel.layers", "Widoczność warstw")}
                </Eyebrow>
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
                          means nothing to them. */}
                      {layerCounts.leader > 0 && (
                        <LayerToggle
                          label={t(
                            "annotations.layer.for_leader_short",
                            "Dla prowadzącego",
                          )}
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
              </section>

              {fresh.length > 0 && (
                <section className="mb-4">
                  <Eyebrow as="p" className="mb-2 text-ethereal-gold">
                    {t("annotations.panel.new", "Nowe")}
                  </Eyebrow>
                  <ul className="flex flex-col gap-1">
                    {fresh.map((entry) =>
                      entry.kind === "mark" ? (
                        <li key={entry.mark.id}>
                          <EntryButton
                            dot="bg-ethereal-gold"
                            label={entry.label}
                            page={displayPage(entry.mark.page_number)}
                            onClick={() => jumpTo(entry)}
                          />
                        </li>
                      ) : (
                        <li key={`strokes-${entry.page}`}>
                          <EntryButton
                            dot="bg-ethereal-gold"
                            label={t("annotations.panel.new_strokes", { count: entry.count })}
                            page={displayPage(entry.page)}
                            onClick={() => goToPage(displayPage(entry.page))}
                          />
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              )}

              {annotatedPages.length > 0 && (
                <section className="mb-4">
                  <Eyebrow as="p" color="ink-on-inverse-muted" className="mb-2">
                    {t("annotations.panel.pages", "Oznaczone strony")}
                  </Eyebrow>
                  <div className="flex flex-wrap gap-1.5">
                    {annotatedPages.map(([page, count]) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToPage(page)}
                        title={t("annotations.panel.page_marks", { count })}
                        className={cn(
                          "flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors",
                          page === currentPage
                            ? "bg-ethereal-gold/90 text-surface-inverse"
                            : "bg-ink-on-inverse/10 text-ink-on-inverse hover:bg-ink-on-inverse/20",
                        )}
                      >
                        {page}
                        <span className="text-[10px] opacity-70">·{count}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <Eyebrow as="p" color="ink-on-inverse-muted" className="mb-2">
                  {t("annotations.panel.notes", "Notatki i symbole")}
                </Eyebrow>
                {index.length === 0 ? (
                  <p className="text-xs text-ink-on-inverse/50">
                    {t("annotations.panel.no_notes", "Brak notatek i symboli.")}
                  </p>
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
                        className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-ink-on-inverse placeholder:text-ink-on-inverse/40 focus:outline-none sm:text-xs"
                      />
                    </label>
                    {found.length === 0 ? (
                      <p className="text-xs text-ink-on-inverse/50">
                        {t("annotations.panel.no_match", "Nic nie pasuje.")}
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {found.map((entry) => (
                          <li key={entry.mark.id}>
                            <EntryButton
                              color={entry.mark.color}
                              label={entry.label}
                              page={displayPage(entry.mark.page_number)}
                              isPrivate={layerOf(entry.mark) !== "shared"}
                              onClick={() => jumpTo(entry)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>

              {mode === "conductor" && editionId && (
                <SetAsideSection
                  editionId={editionId}
                  count={setAsideCount}
                  onReplaced={onMarksReplaced}
                />
              )}
            </div>
          </motion.aside>
        ) : (
          <motion.button
            key="tab"
            type="button"
            initial={{ transform: "translateX(20px)", opacity: 0 }}
            animate={{ transform: "translateX(0px)", opacity: 1 }}
            exit={{ transform: "translateX(20px)", opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(true)}
            aria-label={t("annotations.panel.open", "Pokaż adnotacje")}
            className="pointer-events-auto flex flex-col items-center gap-1 rounded-l-2xl border border-r-0 border-line-on-inverse bg-surface-inverse/80 px-2 py-3 text-ink-on-inverse shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl hover:bg-surface-inverse"
          >
            <PanelRightOpen size={16} aria-hidden="true" />
            {/* Counts what is drawn, like the index inside — a badge over a
                hidden layer promises rows the panel would then not show. */}
            {visible.length > 0 && (
              <span className="rounded-full bg-ethereal-gold/90 px-1.5 text-[10px] font-semibold text-surface-inverse">
                {visible.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

interface EntryButtonProps {
  label: string;
  page: number;
  onClick: () => void;
  /** The mark's own ink, for the dot. */
  color?: string;
  /** A class for the dot instead, where the row says "new" rather than "this ink". */
  dot?: string;
  isPrivate?: boolean;
}

const EntryButton = ({
  label,
  page,
  onClick,
  color,
  dot,
  isPrivate = false,
}: EntryButtonProps): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-ink-on-inverse/10"
    >
      <span
        className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", dot)}
        style={color ? { backgroundColor: color } : undefined}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-ink-on-inverse">{label}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-on-inverse/50">
          {t("annotations.panel.page", "s. {{page}}", { page })}
          {isPrivate && <Lock size={9} aria-hidden="true" />}
        </span>
      </span>
    </button>
  );
};

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
      "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors",
      visible
        ? "bg-ink-on-inverse/10 text-ink-on-inverse"
        : "text-ink-on-inverse/40 hover:bg-ink-on-inverse/5",
    )}
  >
    <span className="flex items-center gap-1.5">
      {isPrivate && <Lock size={11} aria-hidden="true" />}
      {label}
    </span>
    <span className="flex items-center gap-1.5">
      <span className="text-[10px] opacity-60">{count}</span>
      {visible ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
    </span>
  </button>
);
