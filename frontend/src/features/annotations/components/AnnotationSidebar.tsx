/**
 * @file AnnotationSidebar.tsx
 * @description Collapsible right-edge drawer stacked over the whole viewer (via
 * PdfViewer.overlaySlot). A map of the markup you can't see at a glance on a
 * long score: layer visibility toggles, the pages that carry marks, and a
 * jump-to index of every note. In conductor mode the layers are choir/private;
 * in personal mode they are the conductor's shared markings vs the user's own
 * pencil marks.
 * @module features/annotations/components
 */

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  ListTree,
  Lock,
  PanelRightOpen,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";

import {
  isComment,
  type AnnotationLayer,
  type CommentPayload,
  type ScoreAnnotation,
} from "../types/annotations.dto";
import type { LayerVisibility } from "../lib/useAnnotationTools";

interface AnnotationSidebarProps {
  annotations: ScoreAnnotation[];
  currentPage: number;
  goToPage: (page: number) => void;
  visibleLayers: LayerVisibility;
  toggleLayerVisibility: (layer: AnnotationLayer) => void;
  /** Decides which layer rows make sense: choir/private vs conductor/mine. */
  mode: "conductor" | "personal";
  onSelectNote: (id: string, page: number) => void;
}

const layerOf = (a: ScoreAnnotation): AnnotationLayer =>
  a.layer_name === "conductor"
    ? "conductor"
    : a.layer_name === "personal"
      ? "personal"
      : "shared";

export const AnnotationSidebar = ({
  annotations,
  currentPage,
  goToPage,
  visibleLayers,
  toggleLayerVisibility,
  mode,
  onSelectNote,
}: AnnotationSidebarProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const notes = useMemo(
    () =>
      annotations
        .filter(isComment)
        .sort(
          (a, b) =>
            a.page_number - b.page_number ||
            (a.payload as CommentPayload).y - (b.payload as CommentPayload).y,
        ),
    [annotations],
  );

  const annotatedPages = useMemo(() => {
    const counts = new Map<number, number>();
    for (const a of annotations) {
      counts.set(a.page_number, (counts.get(a.page_number) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [annotations]);

  const layerCounts = useMemo(() => {
    const counts = { shared: 0, conductor: 0, personal: 0 };
    for (const a of annotations) counts[layerOf(a)] += 1;
    return counts;
  }, [annotations]);

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center">
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.aside
            key="panel"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto m-3 flex max-h-[calc(100%-7rem)] w-72 flex-col overflow-hidden rounded-3xl border border-white/10 bg-ethereal-ink/85 text-ethereal-marble shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ListTree size={15} aria-hidden="true" />
                {t("annotations.panel.title", "Adnotacje")}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.close_aria", "Zamknij")}
                className="rounded-full p-1 text-ethereal-marble/70 hover:bg-white/10 hover:text-white"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-3">
              <section className="mb-4">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-ethereal-marble/50">
                  {t("annotations.panel.layers", "Widoczność warstw")}
                </p>
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
                        label={t("annotations.layer.private_short", "Prywatne")}
                        count={layerCounts.conductor}
                        visible={visibleLayers.conductor}
                        onToggle={() => toggleLayerVisibility("conductor")}
                        isPrivate
                      />
                    </>
                  ) : (
                    <>
                      <LayerToggle
                        label={t("annotations.layer.from_conductor_short", "Dyrygent")}
                        count={layerCounts.shared}
                        visible={visibleLayers.shared}
                        onToggle={() => toggleLayerVisibility("shared")}
                      />
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

              {annotatedPages.length > 0 && (
                <section className="mb-4">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-ethereal-marble/50">
                    {t("annotations.panel.pages", "Oznaczone strony")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {annotatedPages.map(([page, count]) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToPage(page)}
                        title={t("annotations.panel.page_marks", "{{count}} oznaczeń", { count })}
                        className={cn(
                          "flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors",
                          page === currentPage
                            ? "bg-ethereal-gold/90 text-ethereal-ink"
                            : "bg-white/10 text-ethereal-marble hover:bg-white/20",
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
                <p className="mb-2 text-[11px] uppercase tracking-wide text-ethereal-marble/50">
                  {t("annotations.panel.notes", "Notatki")}
                </p>
                {notes.length === 0 ? (
                  <p className="text-xs text-ethereal-marble/50">
                    {t("annotations.panel.no_notes", "Brak notatek tekstowych.")}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {notes.map((note) => {
                      const payload = note.payload as CommentPayload;
                      return (
                        <li key={note.id}>
                          <button
                            type="button"
                            onClick={() => {
                              goToPage(note.page_number);
                              onSelectNote(note.id, note.page_number);
                            }}
                            className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/10"
                          >
                            <span
                              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: note.color }}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs text-ethereal-marble">
                                {payload.text}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1 text-[10px] text-ethereal-marble/50">
                                {t("annotations.panel.page", "s. {{page}}", {
                                  page: note.page_number,
                                })}
                                {layerOf(note) !== "shared" && (
                                  <Lock size={9} aria-hidden="true" />
                                )}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </motion.aside>
        ) : (
          <motion.button
            key="tab"
            type="button"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(true)}
            aria-label={t("annotations.panel.open", "Pokaż adnotacje")}
            className="pointer-events-auto flex flex-col items-center gap-1 rounded-l-2xl border border-r-0 border-white/10 bg-ethereal-ink/80 px-2 py-3 text-ethereal-marble shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl hover:bg-ethereal-ink"
          >
            <PanelRightOpen size={16} aria-hidden="true" />
            {annotations.length > 0 && (
              <span className="rounded-full bg-ethereal-gold/90 px-1.5 text-[10px] font-semibold text-ethereal-ink">
                {annotations.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
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
      visible ? "bg-white/10 text-ethereal-marble" : "text-ethereal-marble/40 hover:bg-white/5",
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
