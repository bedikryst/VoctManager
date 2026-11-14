/**
 * @file EditionFolioPreview.tsx
 * @description The edition preview where a manager reviews what the score book
 * does to the edition's own page numbers. Every page shows the detector's
 * covers (dashed, "auto"), the manager's covers in their paper tone, keeps,
 * and covers a keep cancels, so what prints is visible before a build. Edit
 * mode adds a cover or keep by drawing a rectangle once the pen is armed, and
 * a tap on a detected number keeps it on that page alone. Rules bind to the
 * edition file's hash; the server refuses a save against a changed file.
 */
import { useState, type PointerEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { coverFromDrag } from "@/features/annotations/lib/covers";
import { withPaperTone } from "@/features/annotations/lib/paperTone";
import type { CoverPayload, NormPoint } from "@/features/annotations/types/annotations.dto";
import api from "@/shared/api/api";
import { toastApiError } from "@/shared/api/errors";
import { cn } from "@/shared/lib/utils";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";
import type { PdfPageGeometry } from "@/shared/ui/composites/PdfViewer";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Text } from "@/shared/ui/primitives/typography";
import { projectKeys } from "../api/project.query-keys";
import {
  ProjectService,
  type EditionFolioDetection,
  type EditionFolioReview,
  type EditionFolioRule,
} from "../api/project.service";
import {
  formatPages,
  overlaps,
  ruleHits,
  rulePages,
  type PageRect,
  type SourceNumberingOff,
} from "../lib/sourceFolios";

type Parity = EditionFolioRule["parity"];

const point = (e: PointerEvent<HTMLElement>): NormPoint => {
  const bounds = e.currentTarget.getBoundingClientRect();
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [clamp((e.clientX - bounds.left) / bounds.width), clamp((e.clientY - bounds.top) / bounds.height)];
};

const boxStyle = (r: PageRect) => ({
  left: `${100 * r.x}%`,
  top: `${100 * r.y}%`,
  width: `${100 * r.w}%`,
  height: `${100 * r.h}%`,
});

/** A tag under a box, saying what the box is. */
function BoxTag({ children, cancelled = false }: { children: string; cancelled?: boolean }) {
  return (
    <Text
      as="span"
      size="xs"
      weight="medium"
      color={cancelled ? "muted" : "gold"}
      className={cn(
        "absolute left-0 top-full mt-0.5 whitespace-nowrap rounded-chip bg-ethereal-marble px-1 leading-tight",
        cancelled && "line-through",
      )}
    >
      {children}
    </Text>
  );
}

interface SurfaceProps {
  geometry: PdfPageGeometry;
  review: EditionFolioReview;
  editing: boolean;
  armed: boolean;
  pending: boolean;
  save: (rules: EditionFolioRule[]) => void;
  onDrawn: () => void;
}

function Surface({ geometry, review, editing, armed, pending, save, onDrawn }: SurfaceProps) {
  const { t } = useTranslation();
  const { pageNumber, width, height } = geometry;
  const [start, setStart] = useState<NormPoint | null>(null);
  const [box, setBox] = useState<CoverPayload | null>(null);
  const [picked, setPicked] = useState<EditionFolioDetection | null>(null);
  const [first, setFirst] = useState(String(pageNumber));
  const [last, setLast] = useState(String(pageNumber));
  const [parity, setParity] = useState<Parity>("all");

  const matches = review.rules.filter((rule) => ruleHits(rule, pageNumber));
  const keeps = matches.filter((rule) => rule.mode === "keep");
  const covers = matches.filter((rule) => rule.mode === "cover");
  const detected = (review.automatic ?? []).filter((found) => found.page === pageNumber);
  const isCancelled = (rect: PageRect) => keeps.some((keep) => overlaps(keep, rect));

  const firstPage = Number.parseInt(first, 10);
  const lastPage = Number.parseInt(last, 10);
  const valid = Number.isInteger(firstPage) && Number.isInteger(lastPage)
    && firstPage >= 1 && lastPage <= review.pages && firstPage <= pageNumber && lastPage >= pageNumber;
  const finish = (mode: EditionFolioRule["mode"]) => {
    if (box && valid) save([...review.rules, { ...box, first: firstPage, last: lastPage, parity, mode }]);
  };
  const keepDetected = (found: EditionFolioDetection) => save([...review.rules, {
    x: found.x, y: found.y, w: found.w, h: found.h,
    first: pageNumber, last: pageNumber, parity: "all", mode: "keep",
  }]);

  const parityItems = [
    { id: "all" as const, label: t("folioReview.all", "Wszystkie") },
    pageNumber % 2
      ? { id: "odd" as const, label: t("folioReview.odd", "Nieparzyste") }
      : { id: "even" as const, label: t("folioReview.even", "Parzyste") },
  ];
  const modeLabel = (rule: EditionFolioRule) => t(
    rule.mode === "keep" ? "folioReview.rule_keep" : "folioReview.rule_cover",
    rule.mode === "keep" ? "Wyjątek" : "Zakrycie",
  );

  // The bar sits beside whatever it is about: the new rectangle, the tapped
  // number, or the first rule on this page.
  const anchor: PageRect | undefined = box ?? picked ?? matches[0];
  const showBar = editing && !start && anchor !== undefined;

  return <>
    <div
      className={cn(
        "absolute inset-0",
        // Only an armed pen owns the page's touches; otherwise a phone scrolls
        // through the overlay and only the boxes themselves take a tap.
        armed ? "pointer-events-auto cursor-crosshair touch-none" : "pointer-events-none",
      )}
      onPointerDown={(e) => {
        if (!armed || !e.isPrimary || e.button !== 0 || pending) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setStart(point(e)); setBox(null); setPicked(null);
      }}
      onPointerMove={(e) => {
        if (start && e.isPrimary) setBox(coverFromDrag(start, point(e), width, height));
      }}
      onPointerCancel={() => { setStart(null); setBox(null); }}
      onPointerUp={(e) => {
        if (!start || !e.isPrimary) return;
        const rect = coverFromDrag(start, point(e), width, height);
        setBox(rect && withPaperTone(rect, geometry.readPixels, width, height));
        setFirst(String(pageNumber)); setLast(String(pageNumber)); setParity("all");
        setStart(null);
        if (rect) onDrawn();
      }}
    >
      {detected.map((found, i) => {
        const cancelled = isCancelled(found);
        return <button
          key={`auto-${i}`}
          type="button"
          disabled={!editing || armed}
          aria-label={t("folioReview.auto_box", "Numer zakrywany automatycznie")}
          onClick={() => { setPicked(found); setBox(null); }}
          className={cn(
            "absolute outline-dashed outline-1",
            cancelled ? "outline-ethereal-graphite/60" : "outline-ethereal-gold",
            editing && !armed ? "pointer-events-auto cursor-pointer" : "pointer-events-none",
          )}
          style={boxStyle(found)}
        >
          <BoxTag cancelled={cancelled}>{t("folioReview.auto_tag", "auto")}</BoxTag>
        </button>;
      })}
      {covers.map((rule, i) => {
        const cancelled = isCancelled(rule);
        return <div
          key={`cover-${i}`}
          className={cn(
            "pointer-events-none absolute outline outline-1",
            cancelled ? "outline-dashed outline-ethereal-graphite/60" : "outline-ethereal-gold",
          )}
          style={{ ...boxStyle(rule), backgroundColor: cancelled ? "transparent" : rule.tone ?? "white" }}
        >
          {cancelled && <BoxTag cancelled>{t("folioReview.cancelled_tag", "nie zakryje")}</BoxTag>}
        </div>;
      })}
      {keeps.map((rule, i) => <div
        key={`keep-${i}`}
        className="pointer-events-none absolute outline outline-2 outline-ethereal-sage"
        style={boxStyle(rule)}
      >
        <BoxTag>{t("folioReview.keep_tag", "wyjątek")}</BoxTag>
      </div>)}
      {box && <div
        className="pointer-events-none absolute outline outline-2 outline-ethereal-gold"
        style={{ ...boxStyle(box), backgroundColor: box.tone ?? "white" }}
      />}
    </div>
    {showBar && <div
      style={anchor.y < 0.5
        ? { top: `${100 * (anchor.y + anchor.h)}%` }
        : { bottom: `${100 * (1 - anchor.y)}%` }}
      className="pointer-events-auto absolute left-2 right-2 mt-4 flex flex-wrap items-center gap-2 rounded-control bg-ethereal-marble p-2 shadow-glass-solid">
      {box ? <>
        <Text size="sm">{t("folioReview.range", "Strony wydania")}</Text>
        <div className="w-20 shrink-0">
          <Input type="number" variant="glass" inputMode="numeric" min={1} max={pageNumber}
            aria-label={t("folioReview.first", "Od strony")}
            value={first} onChange={(e) => setFirst(e.target.value)} />
        </div>
        <Text as="span" color="muted" aria-hidden="true">–</Text>
        <div className="w-20 shrink-0">
          <Input type="number" variant="glass" inputMode="numeric" min={pageNumber} max={review.pages}
            aria-label={t("folioReview.last", "Do strony")}
            value={last} onChange={(e) => setLast(e.target.value)} />
        </div>
        <SegmentedTabs<Parity> items={parityItems} value={parity} onChange={setParity}
          ariaLabel={t("folioReview.parity", "Które strony")} />
        {valid && <Text size="sm" color="muted" className="basis-full">
          {t("folioReview.hits", "s. {{pages}}", {
            pages: formatPages(rulePages({ ...box, first: firstPage, last: lastPage, parity, mode: "cover" }, review.pages)),
          })}
        </Text>}
        <Button size="sm" disabled={!valid || pending} onClick={() => finish("cover")}>{t("folioReview.cover", "Zakryj")}</Button>
        <Button size="sm" variant="secondary" disabled={!valid || pending} onClick={() => finish("keep")}>{t("folioReview.keep", "Zachowaj ten numer")}</Button>
        <Button size="sm" variant="ghost" onClick={() => setBox(null)}>{t("folioReview.cancel", "Anuluj")}</Button>
      </> : picked ? <>
        <Text size="sm" className="basis-full">
          {isCancelled(picked)
            ? t("folioReview.auto_kept", "Ten numer zostaje: zakrycie automatu anuluje wyjątek.")
            : t("folioReview.auto_covered", "Automat zakryje ten numer w książce.")}
        </Text>
        {!isCancelled(picked) && <Button size="sm" disabled={pending} onClick={() => keepDetected(picked)}>
          {t("folioReview.keep", "Zachowaj ten numer")}
        </Button>}
        <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>{t("folioReview.cancel", "Anuluj")}</Button>
      </> : <>
        {matches.map((rule, i) => <Button key={i} size="sm" variant="secondary" disabled={pending}
          onClick={() => save(review.rules.filter((other) => other !== rule))}>
          {t("folioReview.remove_rule", "Cofnij: {{mode}} · s. {{pages}}", {
            mode: modeLabel(rule), pages: formatPages(rulePages(rule, review.pages)),
          })}
        </Button>)}
      </>}
    </div>}
  </>;
}

interface EditionFolioPreviewProps {
  edition: string;
  project: string;
  title: string;
  /** Opens with the editing tools out, as the row's "check page numbers" asks. */
  startEditing?: boolean;
  /** Why the book currently ignores this review, or null when it applies. */
  numberingOff?: SourceNumberingOff | null;
  close: () => void;
}

export function EditionFolioPreview({
  edition, project, title, startEditing = false, numberingOff = null, close,
}: EditionFolioPreviewProps) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [editing, setEditing] = useState(startEditing);
  const [armed, setArmed] = useState(false);
  const url = `/api/archive/editions/${edition}/folio-review/`;
  const key = projectKeys.editionFolioReview(edition);
  const review = useQuery({ queryKey: key, queryFn: async () => (await api.get<EditionFolioReview>(url)).data });
  const write = useMutation({
    mutationFn: async (rules: EditionFolioRule[]) => (await api.put<EditionFolioReview>(url, {
      sha256: review.data?.sha256, previous: review.data?.rules, rules,
    })).data,
    onSuccess: data => {
      cache.setQueryData(key, data);
      void cache.invalidateQueries({ queryKey: projectKeys.scorePackage.byProject(project) });
    },
    onError: error => { toastApiError(error); void review.refetch(); },
  });
  const data = review.data;
  const detectedCount = data?.automatic?.length ?? 0;
  // Opening the preview is what runs the detector; the row's summary reads
  // that result, so it is refreshed on the way out.
  const onClose = () => {
    void cache.invalidateQueries({ queryKey: projectKeys.scorePackage.byProject(project) });
    close();
  };
  return <PdfViewerModal isOpen title={title} onClose={onClose}
    subtitle={t("folioReview.subtitle", "Numery stron wydawcy")}
    // The bytes are the edition's; the review's hash is not part of their identity.
    docKey={`edition-${edition}`}
    fetchBlob={() => ProjectService.fetchScoreEditionBlob(edition)}
    toolbarSlot={<div className="pointer-events-auto flex max-w-xs flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={review.isLoading} onClick={() => {
          if (review.isError) { void review.refetch(); return; }
          setEditing(!editing); setArmed(false);
        }}>{t(review.isError ? "folioReview.retry" : editing ? "folioReview.done" : "folioReview.edit")}</Button>
        {editing && data && <Button size="sm" variant={armed ? "primary" : "secondary"}
          aria-pressed={armed} onClick={() => setArmed(!armed)}>
          {t(armed ? "folioReview.draw_armed" : "folioReview.draw", armed ? "Zaznacz na stronie…" : "Zaznacz prostokąt")}
        </Button>}
      </div>
      {numberingOff && <Text size="sm" color="crimson">
        {t(`folioReview.off.${numberingOff}`)}
      </Text>}
      {data && <Text size="sm" color="muted">
        {data.automatic === null
          ? t("folioReview.auto_unreadable", "Automat nie odczytał tego pliku — zakryj numery ręcznie.")
          : detectedCount > 0
            ? t("folioReview.auto_summary", "Automat zakrywa numery na s. {{pages}}. Dotknij ramki, by zachować numer.", {
              pages: formatPages(data.automatic.map((found) => found.page)),
            })
            : t("folioReview.auto_none", "Automat nie znalazł tu numerów stron.")}
      </Text>}
      {editing && <Text size="sm" color="muted">{t("folioReview.hint")}</Text>}
    </div>}
    renderPageOverlay={data ? geometry => <Surface
      key={`${geometry.pageNumber}-${review.dataUpdatedAt}`} geometry={geometry} review={data}
      editing={editing} armed={armed} pending={write.isPending}
      save={rules => write.mutate(rules)} onDrawn={() => setArmed(false)} /> : undefined}
  />;
}
