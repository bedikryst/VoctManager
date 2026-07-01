/**
 * @file ScorePackagePanel.tsx
 * @description Conductor build cockpit for the auto-assembled concert score book.
 * Reorganised from a flat settings form into a focused tool: a status hero that
 * carries the book state + the primary action, a two-tier settings disclosure
 * (content choices up front, set-once structure de-emphasised) built from one
 * pill/segmented control language, then the per-item build list with a live card
 * + edition preview and the whole-book preview. Flags a stale/distributed output
 * and offers the gated download. Empty state until the programme has pieces.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/ScorePackagePanel
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Download,
  FileText,
  Users,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import type { SegmentedTabItem } from "@/shared/ui/composites/SegmentedTabs";
import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

import { projectKeys } from "../api/project.query-keys";
import { ProjectService } from "../api/project.service";
import type {
  ScorePackageConfig,
  ScorePackageItem,
} from "../api/project.service";
import {
  useGenerateScorePackage,
  useScorePackageState,
  useUpdateScorePackageConfig,
  useUpdateScorePackageItem,
} from "../api/project.score-package";
import { ScorePackageItemRow } from "./ScorePackageItemRow";
import { TogglePill } from "./TogglePill";

interface ScorePackagePanelProps {
  projectId: string;
  projectTitle?: string;
}

type DensityId = ScorePackageConfig["density_mode"];
type LangId = (typeof TRANSLATION_LANGUAGES)[number];

const TRANSLATION_LANGUAGES = ["pl", "en", "fr"] as const;

// Mirrors the per-element dots in ScorePackageItemRow, so the legend explains
// exactly what the conductor sees against each card element.
const READINESS_LEGEND = [
  { dot: "bg-ethereal-sage", key: "projects.score_package.element_status.ready", fallback: "Dane gotowe" },
  { dot: "bg-ethereal-gold", key: "projects.score_package.element_status.low", fallback: "Niska pewność" },
  { dot: "bg-ethereal-ink/20", key: "projects.score_package.element_status.missing", fallback: "Brak danych" },
] as const;

type StatusTone = "sage" | "gold" | "graphite" | "crimson";

interface PreviewTarget {
  item: ScorePackageItem;
  mode: "card" | "edition";
}

const formatTimestamp = (iso: string | null, locale: string): string => {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
};

const sanitizeFilename = (title: string): string =>
  title
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .replace(/\s+/g, "_") || "partytura";

export function ScorePackagePanel({
  projectId,
  projectTitle,
}: ScorePackagePanelProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: state, isLoading } = useScorePackageState(projectId);
  const generate = useGenerateScorePackage(projectId);
  const updateItem = useUpdateScorePackageItem(projectId);
  const updateConfig = useUpdateScorePackageConfig(projectId);

  // The saved config is the single source of truth — each toggle persists
  // immediately (optimistically), so readiness + the stale flag react at once.
  const config = state?.config ?? null;
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [bookPreviewOpen, setBookPreviewOpen] = useState(false);

  // Set-once layout settings collapse for a returning conductor (a book already
  // exists) and open on first setup, but stay user-togglable either way.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsInitialised = useRef(false);
  useEffect(() => {
    if (state && !settingsInitialised.current) {
      settingsInitialised.current = true;
      setSettingsOpen(!state.has_pdf);
    }
  }, [state]);

  const setField = <K extends keyof ScorePackageConfig>(
    key: K,
    value: ScorePackageConfig[K],
  ): void => updateConfig.mutate({ [key]: value } as Partial<ScorePackageConfig>);

  // When the async build flips to READY, refresh the project so the freshly
  // stored score_pdf surfaces across the hub (e.g. the Materials card).
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      prevStatus.current &&
      prevStatus.current !== "RDY" &&
      state?.status === "RDY"
    ) {
      queryClient.invalidateQueries({
        queryKey: projectKeys.projects.details(projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
    }
    prevStatus.current = state?.status;
  }, [state?.status, projectId, queryClient]);

  const isBuilding = state?.status === "QUED" || state?.status === "BLDG";
  const busy = isBuilding || generate.isPending;
  const nothingToBind = state ? state.bindable_pieces === 0 : true;
  const hasProgram = (state?.total_pieces ?? 0) > 0;

  // CTA escalation: once a current book exists, rebuilding is optional, so quiet
  // it and let Download carry the gold. Rebuild escalates back to primary only
  // when there is no book yet, the inputs drifted (stale), or a build is running.
  const rebuildIsPrimary = !state?.has_pdf || !!state?.is_stale || busy;

  // Elapsed seconds while a build runs, so "Składanie…" reads as live progress.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  const handleDownload = async (): Promise<void> => {
    const blob = await ProjectService.fetchScorePdfBlob(projectId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeFilename(projectTitle ?? "partytura")}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const densityItems: ReadonlyArray<SegmentedTabItem<DensityId>> = [
    { id: "CONCERT", label: t("projects.score_package.density.concert", "Koncert") },
    { id: "MASS", label: t("projects.score_package.density.mass", "Msza") },
  ];
  const languageItems: ReadonlyArray<SegmentedTabItem<LangId>> =
    TRANSLATION_LANGUAGES.map((lang) => ({ id: lang, label: lang.toUpperCase() }));

  const previewFetcher =
    preview === null
      ? null
      : preview.mode === "card"
        ? () => ProjectService.fetchScorePackageCardPreviewBlob(projectId, preview.item.id)
        : () => ProjectService.fetchScoreEditionBlob(preview.item.selected_edition_id ?? "");

  const buildStatusLabel =
    state?.status === "QUED"
      ? t("projects.score_package.queued", "W kolejce…")
      : t("projects.score_package.building", "Składanie…");

  // Book state resolved to one headline word + tone for the hero.
  const status: { word: string; tone: StatusTone } = (() => {
    if (busy) return { word: buildStatusLabel, tone: "gold" };
    if (state?.status === "FAIL") return { word: t("projects.score_package.failed", "Błąd składania"), tone: "crimson" };
    if (state?.status === "RDY" && state.has_pdf) {
      if (state.is_manual_upload) return { word: t("projects.score_package.manual.badge", "Wgrana ręcznie"), tone: "graphite" };
      if (state.is_stale) return { word: t("projects.score_package.stale", "Program zmieniony"), tone: "gold" };
      return { word: t("projects.score_package.ready", "Gotowa"), tone: "sage" };
    }
    return { word: t("projects.score_package.bridge.none", "Nie złożona"), tone: "graphite" };
  })();

  const generatedLabel = formatTimestamp(state?.generated_at ?? null, i18n.language);
  const statusSub = (() => {
    if (!state || state.status !== "RDY" || !state.has_pdf) return null;
    if (state.is_manual_upload) return generatedLabel;
    const parts = [
      t("projects.score_package.bridge.version", "Wersja {{v}}", { v: state.build_version }),
      t("projects.score_package.pages", "{{n}} stron", { n: state.page_count ?? 0 }),
      generatedLabel,
    ].filter(Boolean);
    return parts.join(" · ");
  })();

  return (
    <WidgetCard
      title={t("projects.score_package.title", "Partytura koncertowa")}
      icon={<FileText size={15} aria-hidden="true" />}
      bodyClassName="flex flex-col gap-5"
    >
      {/* Empty programme — nothing to assemble yet */}
      {state && !hasProgram && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ethereal-ink/10 px-4 py-10 text-center">
          <FileText size={22} aria-hidden="true" className="text-ethereal-graphite/40" />
          <Text size="sm" color="muted">
            {t(
              "projects.score_package.empty",
              "Dodaj utwory do programu powyżej, aby złożyć partyturę.",
            )}
          </Text>
        </div>
      )}

      {hasProgram && (
        <>
          {/* ── Status hero: state + the primary action, in view ───────────── */}
          <div className="flex flex-col gap-4 rounded-2xl border border-ethereal-ink/8 bg-ethereal-marble/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Heading as="p" size="lg" weight="medium" color={status.tone}>
                    {status.word}
                  </Heading>
                  {state?.is_distributed && (
                    <Badge variant="neutral" icon={<Users size={11} aria-hidden="true" />}>
                      {t("projects.score_package.distributed", "Udostępniona")}
                    </Badge>
                  )}
                </div>
                {statusSub && <Caption color="muted">{statusSub}</Caption>}
                <div className="flex flex-wrap items-center gap-2">
                  <Text size="sm" color="graphite">
                    {t(
                      "projects.score_package.readiness",
                      "{{bindable}} z {{total}} utworów ma dołączone nuty",
                      {
                        bindable: state?.bindable_pieces ?? 0,
                        total: state?.total_pieces ?? 0,
                      },
                    )}
                  </Text>
                  {state && state.pieces_without_pdf.length > 0 && (
                    <Badge variant="warning" icon={<AlertTriangle size={11} aria-hidden="true" />}>
                      {t("projects.score_package.missing_count", "{{n}} bez nut", {
                        n: state.pieces_without_pdf.length,
                      })}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  variant={rebuildIsPrimary ? "primary" : "secondary"}
                  size="sm"
                  isLoading={busy}
                  disabled={busy || nothingToBind}
                  onClick={() => generate.mutate(undefined)}
                >
                  {busy
                    ? buildStatusLabel
                    : state?.has_pdf
                      ? t("projects.score_package.regenerate", "Wygeneruj ponownie")
                      : t("projects.score_package.generate", "Złóż partyturę")}
                </Button>

                {state?.status === "RDY" && state.has_pdf && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<BookOpen size={14} aria-hidden="true" />}
                    onClick={() => setBookPreviewOpen(true)}
                  >
                    {t("projects.score_package.preview_book", "Podgląd")}
                  </Button>
                )}

                {state?.status === "RDY" && state.has_pdf && (
                  <Button
                    variant={state.is_stale ? "outline" : "primary"}
                    size="sm"
                    leftIcon={<Download size={14} aria-hidden="true" />}
                    onClick={() => {
                      void handleDownload();
                    }}
                  >
                    {state.is_stale
                      ? t("projects.score_package.download_stale", "Pobierz mimo to")
                      : t("projects.score_package.download", "Pobierz")}
                  </Button>
                )}
              </div>
            </div>

            {busy && (
              <Caption color="muted">
                {elapsed >= 1
                  ? t("projects.score_package.building_elapsed", "{{label}} ({{s}}s)", {
                      label: buildStatusLabel,
                      s: elapsed,
                    })
                  : buildStatusLabel}
                {" · "}
                {t(
                  "projects.score_package.build_hint",
                  "Przy dużym programie składanie może potrwać kilkadziesiąt sekund.",
                )}
              </Caption>
            )}

            {state?.status === "RDY" && state.has_pdf && state.is_stale && (
              <Caption color="gold" className="flex items-start gap-1.5">
                <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                {t(
                  "projects.score_package.stale_hint",
                  "Ta partytura nie zawiera ostatnich zmian. Złóż ją ponownie, aby je uwzględnić.",
                )}
              </Caption>
            )}

            {state?.is_distributed && !busy && (
              <Caption color="muted" className="flex items-start gap-1.5">
                <Users size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                {t(
                  "projects.score_package.distributed_hint",
                  "Tę wersję pobrali już śpiewacy. Ponowne złożenie ją zastąpi — w ich egzemplarzach mogą zmienić się numery stron.",
                )}
              </Caption>
            )}

            {state?.status === "FAIL" && state.error && (
              <Caption color="crimson">{state.error}</Caption>
            )}
          </div>

          {/* ── Settings: two-tier, one pill/segmented control language ─────── */}
          {config && (
            <div className="rounded-2xl border border-ethereal-ink/8">
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                aria-expanded={settingsOpen}
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
              >
                <Eyebrow color="muted">
                  {t("projects.score_package.settings", "Ustawienia")}
                </Eyebrow>
                <span className="flex-1" />
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className={cn(
                    "text-ethereal-graphite/60 transition-transform duration-300",
                    settingsOpen && "rotate-180",
                  )}
                />
              </button>

              {settingsOpen && (
                <div className="flex flex-col gap-5 border-t border-ethereal-ink/6 px-4 py-4">
                  {/* Tier 1 — content choices */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Caption color="muted">
                        {t("projects.score_package.density.label", "Układ")}
                      </Caption>
                      <SegmentedTabs<DensityId>
                        items={densityItems}
                        value={config.density_mode}
                        onChange={(id) => setField("density_mode", id)}
                        ariaLabel={t("projects.score_package.density.label", "Układ")}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Caption color="muted">
                        {t("projects.score_package.language.label", "Język tłumaczeń")}
                      </Caption>
                      <SegmentedTabs<LangId>
                        items={languageItems}
                        value={config.translation_language as LangId}
                        onChange={(id) => setField("translation_language", id)}
                        ariaLabel={t("projects.score_package.language.label", "Język tłumaczeń")}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <TogglePill
                        label={t("projects.score_package.cards.master", "Karty utworów (tekst)")}
                        active={config.include_cards}
                        onChange={(v) => setField("include_cards", v)}
                      />
                      <span className="mx-1 h-4 w-px bg-ethereal-ink/10" aria-hidden="true" />
                      <TogglePill
                        label={t("projects.score_package.cards.text", "Tekst oryginalny")}
                        active={config.card_include_text}
                        disabled={!config.include_cards}
                        onChange={(v) => setField("card_include_text", v)}
                      />
                      <TogglePill
                        label={t("projects.score_package.cards.translation", "Tłumaczenie")}
                        active={config.card_include_translation}
                        disabled={!config.include_cards}
                        onChange={(v) => setField("card_include_translation", v)}
                      />
                      <TogglePill
                        label={t("projects.score_package.cards.note", "Nota")}
                        active={config.card_include_program_note}
                        disabled={!config.include_cards}
                        onChange={(v) => setField("card_include_program_note", v)}
                      />
                    </div>
                  </div>

                  {/* Tier 2 — set-once structure, de-emphasised */}
                  <div className="flex flex-col gap-2 border-t border-ethereal-ink/6 pt-4">
                    <Caption color="muted">
                      {t("projects.score_package.structure.label", "Struktura książki")}
                    </Caption>
                    <div className="flex flex-wrap gap-1.5">
                      <TogglePill
                        subtle
                        label={t("projects.score_package.structure.title", "Strona tytułowa")}
                        active={config.include_title_page}
                        onChange={(v) => setField("include_title_page", v)}
                      />
                      <TogglePill
                        subtle
                        label={t("projects.score_package.structure.toc", "Spis treści")}
                        active={config.include_toc}
                        onChange={(v) => setField("include_toc", v)}
                      />
                      <TogglePill
                        subtle
                        label={t("projects.score_package.structure.numbers", "Numeracja stron")}
                        active={config.include_page_numbers}
                        onChange={(v) => setField("include_page_numbers", v)}
                      />
                      <TogglePill
                        subtle
                        label={t("projects.score_package.structure.bookmarks", "Zakładki PDF")}
                        active={config.include_bookmarks}
                        onChange={(v) => setField("include_bookmarks", v)}
                      />
                      <TogglePill
                        subtle
                        label={t("projects.score_package.structure.a4", "Normalizuj do A4")}
                        active={config.normalize_to_a4}
                        onChange={(v) => setField("normalize_to_a4", v)}
                      />
                      <TogglePill
                        subtle
                        label={t("projects.score_package.structure.duplex", "Druk dwustronny")}
                        active={config.duplex_mode}
                        onChange={(v) => setField("duplex_mode", v)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Build cockpit — per-item list ──────────────────────────────── */}
          {state && state.items.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <Eyebrow color="muted">
                  {t("projects.score_package.items_heading", "Utwory w programie")}
                </Eyebrow>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {READINESS_LEGEND.map(({ dot, key, fallback }) => (
                    <span key={key} className="flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden="true" />
                      <Caption color="muted">{t(key, fallback)}</Caption>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {state.items.map((item) => (
                  <ScorePackageItemRow
                    key={item.id}
                    projectId={projectId}
                    item={item}
                    cardElements={state.card_elements}
                    onPatch={(patch) => updateItem.mutate({ itemId: item.id, patch })}
                    onPreviewCard={(target) => setPreview({ item: target, mode: "card" })}
                    onPreviewEdition={(target) => setPreview({ item: target, mode: "edition" })}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {isLoading && !state && (
        <Caption color="muted">{t("common.loading", "Ładowanie…")}</Caption>
      )}

      <PdfViewerModal
        isOpen={preview !== null}
        title={preview?.item.title ?? ""}
        subtitle={
          preview?.mode === "card"
            ? t("projects.score_package.item.preview_card", "Podgląd karty")
            : t("projects.score_package.item.show_edition", "Pokaż wydanie")
        }
        fetchBlob={previewFetcher}
        docKey={
          preview
            ? `${preview.mode}-${preview.item.id}-${preview.item.selected_edition_id ?? ""}`
            : undefined
        }
        onClose={() => setPreview(null)}
      />

      <PdfViewerModal
        isOpen={bookPreviewOpen}
        title={projectTitle ?? t("projects.score_package.title", "Partytura koncertowa")}
        subtitle={t("projects.score_package.preview_book_full", "Podgląd partytury")}
        fetchBlob={
          bookPreviewOpen ? () => ProjectService.fetchScorePdfBlob(projectId) : null
        }
        docKey={`book-${projectId}-${state?.generated_at ?? ""}`}
        onClose={() => setBookPreviewOpen(false)}
      />
    </WidgetCard>
  );
}
