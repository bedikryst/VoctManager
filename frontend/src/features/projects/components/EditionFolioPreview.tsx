/**
 * @file EditionFolioPreview.tsx
 * @description Manager review of source folios against the edition's visible PDF pages.
 */
import { useState, type PointerEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { coverFromDrag } from "@/features/annotations/lib/covers";
import { withPaperTone } from "@/features/annotations/lib/paperTone";
import type { CoverPayload, NormPoint } from "@/features/annotations/types/annotations.dto";
import api from "@/shared/api/api";
import { toastApiError } from "@/shared/api/errors";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";
import type { PdfPageGeometry } from "@/shared/ui/composites/PdfViewer";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { projectKeys } from "../api/project.query-keys";
import { ProjectService } from "../api/project.service";

type Parity = "all" | "odd" | "even";
interface Rule extends CoverPayload {
  first: number;
  last: number;
  parity: Parity;
  mode: "cover" | "keep";
}
interface Review { sha256: string; pages: number; rules: Rule[] }

const point = (e: PointerEvent<HTMLElement>): NormPoint => {
  const bounds = e.currentTarget.getBoundingClientRect();
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [clamp((e.clientX - bounds.left) / bounds.width), clamp((e.clientY - bounds.top) / bounds.height)];
};

function Surface({ geometry, review, save, pending }: {
  geometry: PdfPageGeometry; review: Review; save: (rules: Rule[]) => void; pending: boolean;
}) {
  const { t } = useTranslation();
  const { pageNumber, width, height } = geometry;
  const [start, setStart] = useState<NormPoint | null>(null);
  const [box, setBox] = useState<CoverPayload | null>(null);
  const [first, setFirst] = useState(pageNumber);
  const [last, setLast] = useState(pageNumber);
  const [parity, setParity] = useState<Parity>("all");
  const applies = (rule: Rule) => rule.first <= pageNumber && pageNumber <= rule.last
    && (rule.parity === "all" || rule.parity === (pageNumber % 2 ? "odd" : "even"));
  const matches = review.rules.filter(applies);
  const valid = Number.isInteger(first) && Number.isInteger(last) && first >= 1 && last <= review.pages
    && first <= pageNumber && last >= pageNumber;
  const finish = (mode: Rule["mode"]) => {
    if (box && valid) save([...review.rules, { ...box, first, last, parity, mode }]);
  };
  return <>
    <div className="pointer-events-auto absolute inset-0 cursor-crosshair touch-none"
      onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0 || pending) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setStart(point(e)); setBox(null);
      }}
      onPointerMove={e => {
        if (start && e.isPrimary) setBox(coverFromDrag(start, point(e), width, height));
      }}
      onPointerCancel={() => { setStart(null); setBox(null); }}
      onPointerUp={e => {
        if (!start || !e.isPrimary) return;
        const rect = coverFromDrag(start, point(e), width, height);
        setBox(rect && withPaperTone(rect, geometry.readPixels, width, height));
        setStart(null);
      }}
    >
      {[...matches, ...(box ? [box] : [])].map((r, i) => <div key={i}
        className="pointer-events-none absolute outline outline-ethereal-gold"
        style={{ left: `${100*r.x}%`, top: `${100*r.y}%`, width: `${100*r.w}%`, height: `${100*r.h}%`,
          backgroundColor: "mode" in r && r.mode === "keep" ? "transparent" : r.tone ?? "white" }} />)}
    </div>
    {!start && (box || matches.length > 0) && <div
      style={(box ?? matches[0]).y < 0.5
        ? { top: `${100 * ((box ?? matches[0]).y + (box ?? matches[0]).h)}%` }
        : { bottom: `${100 * (1 - (box ?? matches[0]).y)}%` }}
      className="pointer-events-auto absolute left-2 right-2 flex flex-wrap items-center gap-2 rounded-control bg-ethereal-marble p-2 shadow-glass-solid">
      {box && <>
        <Text>{t("folioReview.range")}</Text>
        <input className="w-14 rounded-control border border-hairline-strong bg-ethereal-alabaster p-1 text-ethereal-ink" aria-label={t("folioReview.first")} type="number" min={1} max={pageNumber} value={first || ""} onChange={e => setFirst(Number(e.target.value))} />
        <input className="w-14 rounded-control border border-hairline-strong bg-ethereal-alabaster p-1 text-ethereal-ink" aria-label={t("folioReview.last")} type="number" min={pageNumber} max={review.pages} value={last || ""} onChange={e => setLast(Number(e.target.value))} />
        <select className="rounded-control border border-hairline-strong bg-ethereal-alabaster p-1 text-ethereal-ink" aria-label={t("folioReview.range")} value={parity} onChange={e => setParity(e.target.value as Parity)}>
          <option value="all">{t("folioReview.all")}</option>
          {pageNumber % 2 ? <option value="odd">{t("folioReview.odd")}</option> : <option value="even">{t("folioReview.even")}</option>}
        </select>
        <Button disabled={!valid || pending} onClick={() => finish("cover")}>{t("folioReview.cover")}</Button>
        <Button disabled={!valid || pending} onClick={() => finish("keep")}>{t("folioReview.keep")}</Button>
        <Button onClick={() => setBox(null)}>{t("folioReview.cancel")}</Button>
      </>}
      {!box && matches.map((r, i) => <Button key={i} disabled={pending} onClick={() => save(review.rules.filter(rule => rule !== r))}>
        {t("folioReview.remove")} {i+1} · {r.first}–{r.last} · {t(`folioReview.${r.parity}`)}
      </Button>)}
      <Text size="sm" className="basis-full">{t("folioReview.hint")}</Text>
    </div>}
  </>;
}

export function EditionFolioPreview({ edition, project, title, close }: {
  edition: string; project: string; title: string; close: () => void;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [editing, setEditing] = useState(false);
  const url = `/api/archive/editions/${edition}/folio-review/`;
  const key = ["edition-folio-review", edition];
  const review = useQuery({ queryKey: key, queryFn: async () => (await api.get<Review>(url)).data });
  const write = useMutation({
    mutationFn: async (rules: Rule[]) => (await api.put<Review>(url, {
      sha256: review.data?.sha256, previous: review.data?.rules, rules,
    })).data,
    onSuccess: data => {
      cache.setQueryData(key, data);
      void cache.invalidateQueries({ queryKey: projectKeys.scorePackage.byProject(project) });
    },
    onError: error => { toastApiError(error); void review.refetch(); },
  });
  return <PdfViewerModal isOpen title={title} onClose={close} docKey={`edition-${edition}-${review.data?.sha256 ?? ""}`}
    fetchBlob={() => ProjectService.fetchScoreEditionBlob(edition)}
    toolbarSlot={<div className="flex max-w-xs flex-col gap-2"><Button className="pointer-events-auto" disabled={review.isLoading} onClick={() => {
      if (review.isError) { void review.refetch(); return; }
      setEditing(!editing);
    }}>{t(review.isError ? "folioReview.retry" : editing ? "folioReview.done" : "folioReview.edit")}</Button>
    </div>}
    renderPageOverlay={editing && review.data ? geometry => <Surface
      key={`${geometry.pageNumber}-${review.dataUpdatedAt}`} geometry={geometry} review={review.data!}
      pending={write.isPending} save={rules => write.mutate(rules)} /> : undefined}
  />;
}
