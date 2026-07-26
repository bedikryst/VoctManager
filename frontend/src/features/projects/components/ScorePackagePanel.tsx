/**
 * @file ScorePackagePanel.tsx
 * @description Conductor build cockpit for the concert score book, ranked by the
 * order the questions are asked: is the book current, what is it made of, which
 * piece still needs a hand. The hero states the book's condition ONCE — a word, a
 * stamp, and the figures that decide whether to press build — instead of the four
 * stacked sentences that used to say "stale" four ways. Settings summarise
 * themselves while collapsed; the hand-upload alternative rides the footer rather
 * than a second card of equal weight.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/ScorePackagePanel
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Download,
  FileText,
  ListOrdered,
  Users,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import type { SegmentedTabItem } from "@/shared/ui/composites/SegmentedTabs";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Heading, Metric, Text } from "@/shared/ui/primitives/typography";

import { projectKeys } from "../api/project.query-keys";
import { ProjectService } from "../api/project.service";
import type {
  CardElement,
  ScorePackageConfig,
  ScorePackageItem,
  ScorePackageState,
} from "../api/project.service";
import {
  useGenerateScorePackage,
  useScorePackageState,
  useUpdateScorePackageConfig,
  useUpdateScorePackageItem,
} from "../api/project.score-package";
import { CardElementPills } from "./CardElementPills";
import { ScoreManualUploadRail } from "./ScoreManualUploadRail";
import { ScorePackageItemRow } from "./ScorePackageItemRow";
import { TogglePill } from "./TogglePill";

interface ScorePackagePanelProps {
  projectId: string;
  projectTitle?: string;
}

type DensityId = ScorePackageConfig["density_mode"];
type LangId = (typeof TRANSLATION_LANGUAGES)[number];
type StatusTone = "sage" | "gold" | "graphite" | "crimson";
type FigureTone = "default" | "gold";

const TRANSLATION_LANGUAGES = ["pl", "en", "fr"] as const;

interface Figure {
  key: string;
  value: string;
  label: string;
  tone: FigureTone;
}

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

/** A piece the conductor has to look at before the book is trustworthy: no bound
 *  edition, more singers than licensed copies, or card data the AI is unsure of. */
const needsAttention = (item: ScorePackageItem): boolean =>
  !item.has_pdf ||
  item.copies_shortfall !== null ||
  item.readiness.overall === "low";

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

  // Book-wide default card elements, edited with the very same pill control the
  // per-item designer uses (global default, per-item override). Toggling rebuilds
  // the list in canonical print order off the server's element vocabulary.
  const cardElements = state?.card_elements ?? [];
  const cardDefaultSet = new Set(config?.card_default_elements ?? []);
  const toggleDefaultElement = (element: CardElement): void => {
    const next = new Set(cardDefaultSet);
    if (next.has(element)) next.delete(element);
    else next.add(element);
    setField("card_default_elements", cardElements.filter((e) => next.has(e)));
  };

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
  const hasBook = state?.status === "RDY" && state.has_pdf;

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
    if (hasBook && state) {
      if (state.is_manual_upload) return { word: t("projects.score_package.manual.badge", "Wgrana ręcznie"), tone: "graphite" };
      if (state.is_stale) return { word: t("projects.score_package.stale", "Program zmieniony"), tone: "gold" };
      return { word: t("projects.score_package.ready", "Gotowa"), tone: "sage" };
    }
    return { word: t("projects.score_package.bridge.none", "Nie złożona"), tone: "graphite" };
  })();

  // The stamp under the headline: which build this is and when it was made. The
  // counter starts at zero and only a completed build raises it, so version 0 is
  // "no build behind this file" and saying so would be noise.
  const statusStamp = (() => {
    if (!hasBook || !state) return null;
    const generatedLabel = formatTimestamp(state.generated_at, i18n.language);
    const parts = [
      !state.is_manual_upload && state.build_version > 0
        ? t("projects.score_package.bridge.version", "Wersja {{v}}", {
            v: state.build_version,
          })
        : "",
      generatedLabel,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  })();

  // The hero's figures: the ratio that decides whether the book is worth building,
  // plus the two facts that only exist when they exist. A zero is never a tile —
  // "0 bez nut" states the resting case in the loudest slot on the screen.
  const figures = ((current: ScorePackageState | undefined): Figure[] => {
    if (!current) return [];
    const list: Figure[] = [
      {
        key: "bound",
        value: `${current.bindable_pieces}/${current.total_pieces}`,
        label: t("projects.score_package.figures.bound", "Utwory z nutami"),
        tone: current.bindable_pieces < current.total_pieces ? "gold" : "default",
      },
    ];
    if (hasBook && !current.is_manual_upload && current.page_count) {
      list.push({
        key: "pages",
        value: String(current.page_count),
        label: t("projects.score_package.figures.pages", "Stron w książce"),
        tone: "default",
      });
    }
    if (current.pieces_over_copies.length > 0) {
      list.push({
        key: "copies",
        value: String(current.pieces_over_copies.length),
        label: t("projects.score_package.figures.over_copies", "Bez egzemplarzy"),
        tone: "gold",
      });
    }
    return list;
  })(state);

  const attentionCount = state ? state.items.filter(needsAttention).length : 0;

  const settingsSummary = config
    ? [
        config.density_mode === "CONCERT"
          ? t("projects.score_package.density.concert", "Koncert")
          : t("projects.score_package.density.mass", "Msza"),
        config.translation_language.toUpperCase(),
        config.include_cards
          ? t("projects.score_package.cards.summary", "Karty: {{count}}", {
              count: config.card_default_elements.length,
            })
          : t("projects.score_package.cards.summary_off", "Bez kart"),
      ].join(" · ")
    : "";

  return (
    <SectionCard
      as="h2"
      title={t("projects.score_package.title", "Partytura koncertowa")}
      icon={<FileText size={15} aria-hidden="true" />}
      bodyClassName="flex flex-col gap-5"
      footer={
        <ScoreManualUploadRail
          projectId={projectId}
          hasScorePdf={state?.has_pdf ?? false}
          isManual={state?.is_manual_upload ?? false}
        />
      }
    >
      {isLoading && !state && <EtherealLoader fullHeight={false} />}

      {state && !hasProgram && (
        <StatePanel
          variant="inline"
          className="py-10"
          icon={<ListOrdered size={24} aria-hidden="true" />}
          title={t("projects.score_package.empty_title", "Program jest pusty")}
          description={t(
            "projects.score_package.empty",
            "Partytura składa się z utworów programu — najpierw ułóż program koncertu.",
          )}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="../program">
                {t("projects.score_package.empty_action", "Otwórz program")}
              </Link>
            </Button>
          }
        />
      )}

      {state && hasProgram && (
        <>
          {/* ── Status hero: the book's condition, its figures, one advisory ── */}
          <div className="flex flex-col gap-4 rounded-nested border border-hairline-strong bg-ethereal-marble/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Heading as="p" size="lg" weight="medium" color={status.tone}>
                    {status.word}
                  </Heading>
                  {state.is_distributed && (
                    <Badge variant="neutral" icon={<Users size={11} aria-hidden="true" />}>
                      {t("projects.score_package.distributed", "Udostępniona")}
                    </Badge>
                  )}
                </div>
                {statusStamp && <Caption color="muted">{statusStamp}</Caption>}
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
                    : state.has_pdf
                      ? t("projects.score_package.regenerate", "Wygeneruj ponownie")
                      : t("projects.score_package.generate", "Złóż partyturę")}
                </Button>

                {hasBook && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<BookOpen size={14} aria-hidden="true" />}
                      onClick={() => setBookPreviewOpen(true)}
                    >
                      {t("projects.score_package.preview_book", "Podgląd")}
                    </Button>
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
                  </>
                )}
              </div>
            </div>

            {figures.length > 0 && (
              <div className="flex flex-wrap gap-x-10 gap-y-4 border-t border-hairline pt-4">
                {figures.map((figure) => (
                  <div key={figure.key} className="flex flex-col gap-1.5">
                    <Eyebrow size="overline-sm" color="muted">
                      {figure.label}
                    </Eyebrow>
                    <Metric
                      as="span"
                      color={figure.tone}
                      className="text-2xl leading-none"
                    >
                      {figure.value}
                    </Metric>
                  </div>
                ))}
              </div>
            )}

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

            {state.status === "FAIL" && state.error && (
              <Caption color="crimson">{state.error}</Caption>
            )}

            {hasBook && state.is_stale && (
              <Caption color="gold" className="flex items-start gap-1.5">
                <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                {t(
                  "projects.score_package.stale_hint",
                  "Ta partytura nie zawiera ostatnich zmian. Złóż ją ponownie, aby je uwzględnić.",
                )}
              </Caption>
            )}

            {state.is_distributed && !busy && (
              <Caption color="muted" className="flex items-start gap-1.5">
                <Users size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                {t(
                  "projects.score_package.distributed_hint",
                  "Tę wersję pobrali już śpiewacy. Ponowne złożenie ją zastąpi — w ich egzemplarzach mogą zmienić się numery stron.",
                )}
              </Caption>
            )}
          </div>

          {/* ── Settings: two-tier, and legible while shut ──────────────────── */}
          {config && (
            <div className="rounded-nested border border-hairline-strong">
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                aria-expanded={settingsOpen}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ethereal-incense/5"
              >
                <Eyebrow color="muted">
                  {t("projects.score_package.settings", "Ustawienia")}
                </Eyebrow>
                <span className="flex-1" />
                {!settingsOpen && (
                  <Caption color="muted" className="min-w-0 truncate">
                    {settingsSummary}
                  </Caption>
                )}
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-ethereal-graphite/60 transition-transform duration-300",
                    settingsOpen && "rotate-180",
                  )}
                />
              </button>

              {settingsOpen && (
                <div className="flex flex-col gap-5 border-t border-hairline px-4 py-4">
                  {/* Tier 1 — content choices */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Eyebrow as="span" color="muted" className="ml-1">
                        {t("projects.score_package.density.label", "Układ")}
                      </Eyebrow>
                      <SegmentedTabs<DensityId>
                        items={densityItems}
                        value={config.density_mode}
                        onChange={(id) => setField("density_mode", id)}
                        ariaLabel={t("projects.score_package.density.label", "Układ")}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Eyebrow as="span" color="muted" className="ml-1">
                        {t("projects.score_package.language.label", "Język tłumaczeń")}
                      </Eyebrow>
                      <SegmentedTabs<LangId>
                        items={languageItems}
                        value={config.translation_language as LangId}
                        onChange={(id) => setField("translation_language", id)}
                        ariaLabel={t("projects.score_package.language.label", "Język tłumaczeń")}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <TogglePill
                        label={t("projects.score_package.cards.master", "Karty utworów")}
                        active={config.include_cards}
                        onChange={(v) => setField("include_cards", v)}
                      />
                      <Caption color="muted">
                        {t(
                          "projects.score_package.cards.default_hint",
                          "Zaznacz, co pojawia się na każdej karcie — w utworze dostosujesz wyjątki.",
                        )}
                      </Caption>
                    </div>
                    <CardElementPills
                      elements={cardElements}
                      selected={cardDefaultSet}
                      disabled={!config.include_cards}
                      onToggle={toggleDefaultElement}
                    />
                  </div>

                  {/* Tier 2 — set-once structure, de-emphasised */}
                  <div className="flex flex-col gap-2 border-t border-hairline pt-4">
                    <Eyebrow size="overline-sm" color="muted">
                      {t("projects.score_package.structure.label", "Struktura książki")}
                    </Eyebrow>
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
          {state.items.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <Eyebrow color="muted">
                  {t("projects.score_package.items_heading", "Utwory w programie")}
                </Eyebrow>
                {attentionCount > 0 && (
                  <Text
                    as="span"
                    size="sm"
                    weight="medium"
                    color="gold"
                    className="tabular-nums"
                  >
                    {t("projects.score_package.attention_count", "Wymaga uwagi: {{count}}", {
                      count: attentionCount,
                    })}
                  </Text>
                )}
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
        // An edition is a stored file and its id is its version. A card is
        // rendered from the item's override fields on every request, so editing
        // the copy and previewing again has to show the new card.
        volatile={preview?.mode === "card"}
        onClose={() => setPreview(null)}
      />

      {/* The doc key carries the build stamp: the viewer caches a fetched blob
          for the session, so a key that ignored the rebuild would show the old
          book after pressing "Wygeneruj ponownie". */}
      <PdfViewerModal
        isOpen={bookPreviewOpen}
        title={projectTitle ?? t("projects.score_package.title", "Partytura koncertowa")}
        subtitle={t("projects.score_package.preview_book_full", "Podgląd partytury")}
        fileName={`${sanitizeFilename(projectTitle ?? "partytura")}.pdf`}
        fetchBlob={
          bookPreviewOpen ? () => ProjectService.fetchScorePdfBlob(projectId) : null
        }
        docKey={`book-${projectId}-${state?.build_version ?? 0}-${state?.generated_at ?? ""}`}
        onClose={() => setBookPreviewOpen(false)}
      />
    </SectionCard>
  );
}
