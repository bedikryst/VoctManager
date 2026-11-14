/**
 * @file ScorePackagePanel.tsx
 * @description Conductor build cockpit for the concert score book, ranked by the
 * order the questions are asked: is the book current, what is it made of, which
 * piece still needs a hand. The hero states the book's condition ONCE — a word, a
 * stamp, and the figures that decide whether to press build — instead of the four
 * stacked sentences that used to say "stale" four ways. Settings summarise
 * themselves while collapsed; the hand-upload alternative rides the footer rather
 * than a second card of equal weight.
 *
 * Preview and Download hand out one copy, chosen once above both by who it is
 * for: the choir's (exactly what singers download now), the clean book, the
 * conductor's desk copy, the rehearsal leader's. Choosing a copy never changes
 * what singers receive; the choir-marks switch beside it does, from the next
 * download on.
 * @module features/projects/components/ScorePackagePanel
 */

import React, { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
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
  Music,
  PencilLine,
  Users,
} from "lucide-react";

import { NotifyChoirButton } from "@/features/annotations";
import { toastApiError } from "@/shared/api/errors";
import { cn } from "@/shared/lib/utils";
import { AUDIENCE_LANGUAGES, type AudienceLanguage } from "@/shared/types";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";
import { GlossaryTerm } from "@/shared/ui/composites/glossary/GlossaryTerm";
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
  ScorePackageBookMarks,
  ScorePackageConfig,
  ScoreMarkLayer,
  ScorePackageItem,
  ScorePackageState,
} from "../api/project.service";
import {
  useGenerateScorePackage,
  useScorePackageState,
  useUpdateScorePackageConfig,
  useUpdateScorePackageItem,
} from "../api/project.score-package";
import {
  bookCopyAudiences,
  bookCopyFileName,
  bookCopyKeySuffix,
  bookCopyLayers,
  type BookCopyAudience,
} from "../api/project.score-marks";
import { sourceNumberingOff } from "../lib/sourceFolios";
import { CardElementPills } from "./CardElementPills";
import { EditionFolioPreview } from "./EditionFolioPreview";
import { ScoreManualUploadRail } from "./ScoreManualUploadRail";
import { ScorePackageItemRow } from "./ScorePackageItemRow";
import { TogglePill } from "./TogglePill";

interface ScorePackagePanelProps {
  projectId: string;
  projectTitle?: string;
  /** False once the project is over or called off: there is no cast to tell. */
  canNotifyChoir?: boolean;
}

type DensityId = ScorePackageConfig["density_mode"];
type StatusTone = "sage" | "gold" | "graphite" | "crimson";
type FigureTone = "default" | "gold";

interface Figure {
  key: string;
  value: string;
  label: string;
  tone: FigureTone;
}

interface PreviewTarget {
  item: ScorePackageItem;
  mode: "card" | "edition";
  /** The edition preview opens with its folio tools out. */
  review?: boolean;
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

/** A cockpit read from before the census existed, or a package with no book. */
const NO_BOOK_MARKS: ScorePackageBookMarks = {
  map_available: false,
  legacy_ink: false,
  layers: {},
};

/** A piece the conductor has to look at before the book is trustworthy: no bound
 *  edition, more singers than licensed copies, or card data the AI is unsure of. */
const needsAttention = (item: ScorePackageItem): boolean =>
  !item.has_pdf ||
  item.copies_shortfall !== null ||
  item.readiness.overall === "low";

export function ScorePackagePanel({
  projectId,
  projectTitle,
  canNotifyChoir = true,
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

  // A build the server has written off is NOT busy: leaving it "busy" would keep
  // the only control that can rescue it disabled forever.
  const isStalled = state?.build_stalled ?? false;
  const isBuilding = (state?.status === "QUED" || state?.status === "BLDG") && !isStalled;
  const busy = isBuilding || generate.isPending;
  const nothingToBind = state ? state.bindable_pieces === 0 : true;
  const hasProgram = (state?.total_pieces ?? 0) > 0;
  const hasBook = state?.status === "RDY" && state.has_pdf;

  // The one copy Preview and Download both hand out, its file name included.
  const bookMarks = state?.book_marks ?? NO_BOOK_MARKS;
  const includeMarkings = config?.include_markings ?? false;
  const audiences = bookCopyAudiences(bookMarks);
  const [chosenAudience, setChosenAudience] = useState<BookCopyAudience>("choir");
  // A choice the current book no longer offers (its desk layer was erased, a
  // rebuild baked nothing) falls back to the choir's copy.
  const audience = audiences.includes(chosenAudience) ? chosenAudience : "choir";
  const copyLayers = bookCopyLayers(audience, includeMarkings, bookMarks);
  const fileStem = sanitizeFilename(projectTitle ?? "partytura");
  const copyFileName = bookCopyFileName(fileStem, copyLayers, t);
  const sharedOnBook = bookMarks.layers.shared?.marks ?? 0;
  const sharedSheets = bookMarks.layers.shared?.sheets ?? 0;
  const pendingMarks = (state?.items ?? []).reduce(
    (sum, item) => sum + item.markings.pending_rebuild,
    0,
  );
  // Set when the server could not place every mark on the asked-for copy. The
  // clean book is then offered as its own action, never substituted.
  const [renderFailed, setRenderFailed] = useState(false);
  useEffect(() => setRenderFailed(false), [audience, state?.generated_at]);

  // CTA escalation: once a current book exists, rebuilding is optional, so quiet
  // it and let Download carry the gold. Rebuild escalates back to primary only
  // when there is no book yet, the inputs drifted (stale), or a build is running.
  const rebuildIsPrimary = !state?.has_pdf || !!state?.is_stale || busy || isStalled;

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

  // The gated fetch can legitimately refuse (a closed project, a renderer that
  // cannot stamp a protected book). Unhandled, that reads as a dead button.
  const handleDownload = async (
    marks: readonly ScoreMarkLayer[] = copyLayers,
  ): Promise<void> => {
    try {
      const blob = await ProjectService.fetchScorePdfBlob(projectId, marks);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = bookCopyFileName(fileStem, marks, t);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setRenderFailed(true);
        return;
      }
      toastApiError(error);
    }
  };

  const audienceLabels: Record<BookCopyAudience, string> = {
    choir: t("projects.score_copy.audience.choir", "Dla chóru"),
    clean: t("projects.score_copy.audience.clean", "Czysty"),
    conductor: t("projects.score_copy.audience.conductor", "Dyrygencki"),
    leader: t("projects.score_copy.audience.leader", "Dla prowadzącego"),
  };
  const audienceItems: ReadonlyArray<SegmentedTabItem<BookCopyAudience>> =
    audiences.map((id) => ({ id, label: audienceLabels[id] }));

  // What the chosen copy carries, said in terms of who gets it. The counts ride
  // in parentheses, never in a declined slot (see the item row).
  const copyDescription = ((): string => {
    if (!bookMarks.map_available) {
      return t(
        "projects.score_copy.describe.manual",
        "Plik wgrany ręcznie, dokładnie taki, jak go wgrano. Oznaczeń z aplikacji nie da się na nim umieścić, bo nie ma mapy stron.",
      );
    }
    switch (audience) {
      case "choir":
        if (bookMarks.legacy_ink) {
          return t(
            "projects.score_copy.describe.choir_legacy",
            "Tak pobierają śpiewacy: z oznaczeniami wpisanymi na stałe przy składaniu.",
          );
        }
        return copyLayers.includes("shared")
          ? t(
              "projects.score_copy.describe.choir_marked",
              "Tak pobierają śpiewacy: z oznaczeniami dla chóru ({{n}}).",
              { n: sharedOnBook },
            )
          : t(
              "projects.score_copy.describe.choir_clean",
              "Tak pobierają śpiewacy: same nuty, bez oznaczeń.",
            );
      case "clean":
        return t(
          "projects.score_copy.describe.clean",
          "Same nuty, bez żadnych oznaczeń. Śpiewacy dostają go tylko wtedy, gdy oznaczenia dla chóru są wyłączone.",
        );
      case "conductor":
        return t(
          "projects.score_copy.describe.conductor",
          "Na pulpit dyrygenta: oznaczenia dla chóru i Twoje prywatne ({{n}}). Nikt inny go nie dostaje.",
          { n: bookMarks.layers.conductor?.marks ?? 0 },
        );
      case "leader":
        return t(
          "projects.score_copy.describe.leader",
          "Dla osoby prowadzącej próbę: oznaczenia dla chóru i dla prowadzącego ({{n}}).",
          { n: bookMarks.layers.leader?.marks ?? 0 },
        );
    }
  })();

  const densityItems: ReadonlyArray<SegmentedTabItem<DensityId>> = [
    { id: "CONCERT", label: t("projects.score_package.density.concert", "Koncert") },
    { id: "MASS", label: t("projects.score_package.density.mass", "Msza") },
  ];
  const languageItems: ReadonlyArray<SegmentedTabItem<AudienceLanguage>> =
    AUDIENCE_LANGUAGES.map((lang) => ({ id: lang, label: lang.toUpperCase() }));

  const buildStatusLabel =
    state?.status === "QUED"
      ? t("projects.score_package.queued", "W kolejce…")
      : t("projects.score_package.building", "Składanie…");

  // Book state resolved to one headline word + tone for the hero.
  const status: { word: string; tone: StatusTone } = (() => {
    if (busy) return { word: buildStatusLabel, tone: "gold" };
    // A named problem, so it carries the alarm colour — and, unlike "stale", it
    // cannot be waited out.
    if (isStalled) return { word: t("projects.score_package.stalled", "Składanie przerwane"), tone: "crimson" };
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
      title={t("projects.score_package.title", "Książka nutowa")}
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
            "Partytura składa się z utworów programu — najpierw ułóż program.",
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
              </div>
            </div>

            {/* ── The copy: one choice above both actions ── */}
            {hasBook && (
              <div className="flex flex-col gap-2.5 border-t border-hairline pt-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Eyebrow size="overline-sm" color="muted">
                      {t("projects.score_copy.heading", "Egzemplarz")}
                    </Eyebrow>
                    {audienceItems.length > 1 ? (
                      <SegmentedTabs<BookCopyAudience>
                        items={audienceItems}
                        value={audience}
                        onChange={setChosenAudience}
                        ariaLabel={t("projects.score_copy.heading", "Egzemplarz")}
                      />
                    ) : (
                      <Text as="span" size="sm" weight="medium">
                        {audienceLabels[audience]}
                      </Text>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                  </div>
                </div>
                <Caption color="muted">{copyDescription}</Caption>

                {renderFailed && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Caption color="crimson" className="flex items-start gap-1.5">
                      <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                      {t(
                        "projects.score_copy.render_failed",
                        "Nie udało się umieścić oznaczeń w tym egzemplarzu, więc nic nie zostało pobrane. Złóż książkę ponownie albo pobierz czysty egzemplarz.",
                      )}
                    </Caption>
                    {audiences.includes("clean") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Download size={14} aria-hidden="true" />}
                        onClick={() => {
                          setChosenAudience("clean");
                          void handleDownload([]);
                        }}
                      >
                        {t("projects.score_copy.download_clean", "Pobierz czysty egzemplarz")}
                      </Button>
                    )}
                  </div>
                )}

                {/* What singers receive: the one switch that changes it. */}
                {bookMarks.map_available && !bookMarks.legacy_ink && sharedOnBook > 0 && config && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <TogglePill
                        label={t(
                          "projects.score_copy.choir_switch",
                          "Oznaczenia dla chóru w pobraniach śpiewaków",
                        )}
                        active={config.include_markings}
                        onChange={(v) => setField("include_markings", v)}
                      />
                      <Caption color={config.include_markings ? "muted" : "gold"}>
                        {config.include_markings
                          ? t(
                              "projects.score_copy.choir_switch_on",
                              "Każde pobranie zawiera oznaczenia dla chóru ({{n}}) na {{s}} str.",
                              { n: sharedOnBook, s: sharedSheets },
                            )
                          : t(
                              "projects.score_copy.choir_switch_off",
                              "Śpiewacy pobierają książkę bez oznaczeń dla chóru ({{n}}).",
                              { n: sharedOnBook },
                            )}
                      </Caption>
                    </div>
                    <Caption color="muted">
                      {t(
                        "projects.score_copy.choir_switch_hint",
                        "Zmiana działa od następnego pobrania. Kto pobrał książkę wcześniej, musi pobrać ją ponownie.",
                      )}
                    </Caption>
                  </div>
                )}

                {bookMarks.legacy_ink && (
                  <Caption color="gold" className="flex items-start gap-1.5">
                    <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                    {t(
                      "projects.score_copy.legacy_ink",
                      "Ta książka ma oznaczenia dla chóru wpisane na stałe przy składaniu, w stanie z tamtej chwili. Nie ma czystego egzemplarza, a nowsze oznaczenia nie trafią do pobrań. Złóż ją ponownie.",
                    )}
                  </Caption>
                )}

                {pendingMarks > 0 && (
                  <Caption color="gold" className="flex items-start gap-1.5">
                    <PencilLine size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                    {t(
                      "projects.score_copy.pending",
                      "Oznaczenia dla chóru ({{n}}) są na stronach, których ta książka jeszcze nie ma. Trafią do egzemplarzy po ponownym złożeniu. Utwory, których to dotyczy, mają ołówek na liście niżej.",
                      { n: pendingMarks },
                    )}
                  </Caption>
                )}
              </div>
            )}

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

            {/* The marks travel with the editions, not with this file, so the
                choir hears of them here whether or not the book is rebuilt. */}
            {canNotifyChoir && (
              <div className="border-t border-hairline pt-4">
                <NotifyChoirButton projectId={projectId} surface="page" />
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

            {isStalled && (
              <Caption color="crimson" className="flex items-start gap-1.5">
                <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                {t(
                  "projects.score_package.stalled_hint",
                  "Poprzednie składanie nie dobiegło końca — serwer je przerwał. Uruchom je ponownie; nic nie zostało utracone.",
                )}
              </Caption>
            )}

            {state.status === "FAIL" && state.error && (
              <Caption color="crimson">{state.error}</Caption>
            )}

            {/* The withheld hint is the stale hint with a consequence attached,
                so the two never stack: a book the choir cannot open is stale
                by definition. */}
            {hasBook && state.book_withheld_from_choir && (
              <Caption color="gold" className="flex items-start gap-1.5">
                <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                {t(
                  "projects.score_package.withheld_hint",
                  "Ta książka zawiera jeszcze strony utworu, który stał się instrumentalny. Śpiewacy nie otworzą jej, dopóki nie złożysz jej ponownie.",
                )}
              </Caption>
            )}

            {hasBook && state.is_stale && !state.book_withheld_from_choir && (
              <Caption color="gold" className="flex items-start gap-1.5">
                <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                {t(
                  "projects.score_package.stale_hint",
                  "Ta partytura nie zawiera ostatnich zmian. Złóż ją ponownie, aby je uwzględnić.",
                )}
              </Caption>
            )}

            {state.instrumental_pieces.length > 0 && (
              <Caption color="muted" className="flex items-start gap-1.5">
                <Music size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                {t(
                  "projects.score_package.instrumental_hint",
                  "Poza książką, bo grają tylko instrumentaliści: {{titles}}",
                  { titles: state.instrumental_pieces.join(", ") },
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
                        <GlossaryTerm term="density">
                          {t("projects.score_package.density.label", "Układ")}
                        </GlossaryTerm>
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
                      <SegmentedTabs<AudienceLanguage>
                        items={languageItems}
                        value={config.translation_language as AudienceLanguage}
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
                      {/* Covering the publisher's folio only makes sense while the
                          book prints one of its own — the server enforces that, so
                          the pill states the same effective value rather than a
                          setting the book will ignore. */}
                      <TogglePill
                        subtle
                        label={t(
                          "projects.score_package.structure.hide_source_numbers",
                          "Ukryj numery stron wydawcy",
                        )}
                        active={
                          config.hide_source_page_numbers && config.include_page_numbers
                        }
                        disabled={!config.include_page_numbers}
                        title={
                          config.include_page_numbers
                            ? undefined
                            : t(
                                "projects.score_package.structure.hide_source_numbers_locked",
                                "Wymaga własnej numeracji książki.",
                              )
                        }
                        onChange={(v) => setField("hide_source_page_numbers", v)}
                      />
                    </div>
                    <Caption color="muted">
                      {config.include_page_numbers
                        ? t(
                            "projects.score_package.structure.hide_source_numbers_hint",
                            "Zakrywa numerację, którą wydania drukują same, żeby w książce została tylko jej własna. Automat czyta warstwę tekstową; numer na skanie zakryjesz ręcznie w podglądzie wydania.",
                          )
                        : t(
                            "projects.score_package.structure.hide_source_numbers_locked_hint",
                            "Bez własnej numeracji książka zostawia numery wydawcy — inaczej wydruk nie miałby żadnych.",
                          )}
                    </Caption>
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
                    onPreviewEdition={(target, review) =>
                      setPreview({ item: target, mode: "edition", review })
                    }
                    numberingOff={config ? sourceNumberingOff(item, config) : null}
                    concertCards={config?.density_mode !== "MASS"}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {preview?.mode === "edition" && preview.item.selected_edition_id && <EditionFolioPreview
        key={preview.item.selected_edition_id} edition={preview.item.selected_edition_id}
        project={projectId} title={preview.item.title} startEditing={preview.review}
        numberingOff={config ? sourceNumberingOff(preview.item, config) : null}
        close={() => setPreview(null)} />}
      <PdfViewerModal
        isOpen={preview?.mode === "card"}
        title={preview?.item.title ?? ""}
        subtitle={t("projects.score_package.item.preview_card", "Podgląd karty")}
        fetchBlob={preview?.mode === "card"
          ? () => ProjectService.fetchScorePackageCardPreviewBlob(projectId, preview.item.id) : null}
        docKey={preview?.mode === "card" ? `card-${preview.item.id}` : undefined}
        volatile
        onClose={() => setPreview(null)}
      />

      {/* The preview is the chosen copy, byte for byte what Download hands
          out, with the same file name — and is re-fetched on every open,
          because the marks composed into it are often minutes old. The doc
          key carries the build stamp and the selection as well. */}
      <PdfViewerModal
        isOpen={bookPreviewOpen}
        title={projectTitle ?? t("projects.score_package.title", "Książka nutowa")}
        subtitle={`${t("projects.score_package.preview_book_full", "Podgląd partytury")} · ${audienceLabels[audience]}`}
        fileName={copyFileName}
        fetchBlob={
          bookPreviewOpen
            ? async () => {
                try {
                  return await ProjectService.fetchScorePdfBlob(projectId, copyLayers);
                } catch (error) {
                  // The preview's own error state says it failed; the cockpit
                  // says why and offers the clean copy beside the choice.
                  if (isAxiosError(error) && error.response?.status === 409) {
                    setRenderFailed(true);
                  }
                  throw error;
                }
              }
            : null
        }
        docKey={`book-${projectId}-${state?.build_version ?? 0}-${state?.generated_at ?? ""}${bookCopyKeySuffix(copyLayers)}`}
        volatile
        onClose={() => setBookPreviewOpen(false)}
      />
    </SectionCard>
  );
}
