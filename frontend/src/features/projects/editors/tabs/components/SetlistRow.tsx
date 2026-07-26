/**
 * @file SetlistRow.tsx
 * @description One piece in the running order: its position, what it is, how
 * long it runs, and — only where the ensemble has actually started work — how
 * far they have got with it.
 * The row sits in a flat divided list rather than on its own bordered card;
 * the surface, the gold edge and the shadow arrive when it is picked up, so
 * the only thing that looks liftable is the thing being lifted.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/SetlistRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { GripVertical, Star, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import type { ProjectReadinessSummaryEntry } from "../../../api/project.service";
import type { ProgramTabItem } from "../../types";
import { DurationCell } from "./DurationCell";

interface SetlistRowProps {
  readonly item: ProgramTabItem;
  readonly sortableId: string;
  readonly position: number;
  readonly meta: string | null;
  readonly durationSeconds?: number | null;
  readonly readiness?: ProjectReadinessSummaryEntry;
  readonly onToggleEncore: (item: ProgramTabItem) => void;
  readonly onDelete: (sortableId: string) => void;
}

/** Quiet until the pointer is on the row, then it takes its own colour. */
const ACTION_CLASS =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-chip transition-colors pointer-coarse:h-9 pointer-coarse:w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40";

/**
 * How much of the cast has reported "I know my part" (sage) against "still
 * practising" (gold), from the chorister self-reports in the Songbook.
 * It renders only once somebody has reported something: before that every row
 * would read `0/12 zna partię`, which is the resting state of a young
 * production stated in the loudest slot the row has, on every row at once.
 */
function ReadinessLine({
  readiness,
}: {
  readiness: ProjectReadinessSummaryEntry;
}): React.JSX.Element | null {
  const { t } = useTranslation();

  const started = readiness.ready + readiness.in_progress;
  if (readiness.total_cast === 0 || started === 0) return null;

  const readyPct = (readiness.ready / readiness.total_cast) * 100;
  const practisingPct = (readiness.in_progress / readiness.total_cast) * 100;

  return (
    <span
      className="mt-1 flex items-center gap-2"
      title={t(
        "projects.program.readiness.tooltip",
        "Gotowość zespołu — zna partię: {{ready}}, ćwiczy: {{practising}}, nie zaczęło: {{untouched}}",
        {
          ready: readiness.ready,
          practising: readiness.in_progress,
          untouched: readiness.not_started,
        },
      )}
    >
      <span className="flex h-1 w-20 overflow-hidden rounded-full bg-ethereal-ink/8">
        <span
          className="h-full bg-ethereal-sage"
          style={{ width: `${readyPct}%` }}
        />
        <span
          className="h-full bg-ethereal-gold/70"
          style={{ width: `${practisingPct}%` }}
        />
      </span>
      <Caption as="span" color="muted">
        {t(
          "projects.program.readiness.count",
          "{{ready}}/{{total}} zna partię",
          {
            ready: readiness.ready,
            total: readiness.total_cast,
          },
        )}
      </Caption>
    </span>
  );
}

export function SetlistRow({
  item,
  sortableId,
  position,
  meta,
  durationSeconds,
  readiness,
  onToggleEncore,
  onDelete,
}: SetlistRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const encoreLabel = item.is_encore
    ? t("projects.program.actions.remove_encore", "Usuń oznaczenie BIS")
    : t("projects.program.actions.add_encore", "Oznacz jako BIS");

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={cn("relative", isDragging && "z-10")}
    >
      {/* The lift lives on an inner surface, not on the <li>: the list's own
          `divide-y` writes border-top on every row through a higher-specificity
          selector, so a border declared here would come out gold on three sides
          and hairline on the fourth. */}
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-2.5 transition-colors",
          isDragging
            ? "rounded-control border border-ethereal-gold/45 bg-ethereal-marble shadow-glass-ethereal"
            : "hover:bg-ethereal-ink/3",
        )}
      >
        {/* The grip is the only drag surface, so a title stays selectable. It
          bleeds into the row's own padding on a fine pointer and grows to a
          thumb target on a coarse one, without changing the row height. */}
        <span
          {...attributes}
          {...listeners}
          className={cn(
            "-my-1 -ml-1.5 flex min-h-8 min-w-6 shrink-0 cursor-grab select-none items-center justify-center rounded-chip text-ethereal-graphite/30 transition-colors",
            "hover:bg-ethereal-gold/10 hover:text-ethereal-gold active:cursor-grabbing",
            "pointer-coarse:min-h-11 pointer-coarse:min-w-9",
          )}
          aria-label={t(
            "projects.program.actions.drag_aria",
            "Przeciągnij utwór {{title}}",
            { title: item.piece_title },
          )}
        >
          <GripVertical size={14} aria-hidden="true" />
        </span>

        <Text
          as="span"
          size="xs"
          weight="bold"
          className="w-5 shrink-0 tabular-nums text-ethereal-gold/70"
        >
          {String(position).padStart(2, "0")}
        </Text>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <Text as="span" size="sm" weight="medium" truncate>
              {item.piece_title}
            </Text>
            {item.is_encore && (
              <Badge variant="amethyst" className="shrink-0">
                {t("projects.program.badges.encore", "BIS")}
              </Badge>
            )}
          </span>
          {meta && (
            <Caption as="span" color="muted" className="truncate">
              {meta}
            </Caption>
          )}
          {readiness && <ReadinessLine readiness={readiness} />}
        </span>

        <DurationCell seconds={durationSeconds} />

        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onToggleEncore(item)}
            aria-pressed={item.is_encore}
            title={encoreLabel}
            aria-label={encoreLabel}
            className={cn(
              ACTION_CLASS,
              item.is_encore
                ? "bg-ethereal-amethyst/12 text-ethereal-amethyst"
                : "text-ethereal-graphite/35 hover:bg-ethereal-amethyst/10 hover:text-ethereal-amethyst",
            )}
          >
            <Star
              size={14}
              className={item.is_encore ? "fill-current" : undefined}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={() => onDelete(sortableId)}
            title={t(
              "projects.program.actions.remove_from_program",
              "Usuń z programu",
            )}
            aria-label={t(
              "projects.program.actions.remove_from_program",
              "Usuń z programu",
            )}
            className={cn(
              ACTION_CLASS,
              "text-ethereal-graphite/35 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson",
            )}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </span>
      </div>
    </li>
  );
}
