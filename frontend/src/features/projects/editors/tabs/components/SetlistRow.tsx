/**
 * @file SetlistRow.tsx
 * @description One piece in the running order: its position, what it is and how
 * long it runs. Where the event is an order of service the row
 * also carries its place in the rite: the label the singer reads, and the
 * picker that sets it. Where the piece exists in more than one edition it
 * carries the arrangement this concert sings from, for the same reason: both
 * are decisions about this one performance of the work.
 * The row sits in a flat divided list rather than on its own bordered card;
 * the surface, the gold edge and the shadow arrive when it is picked up, so
 * the only thing that looks liftable is the thing being lifted.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/SetlistRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, GripVertical, Star, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import type { ProgramTabItem } from "../../types";
import { DurationCell } from "./DurationCell";

interface SetlistRowProps {
  readonly item: ProgramTabItem;
  readonly sortableId: string;
  readonly position: number;
  readonly meta: string | null;
  readonly durationSeconds?: number | null;
  /**
   * The order of the rite, for an event that has one. Empty for a concert —
   * where a "place in the liturgy" column would be a column of blanks on every
   * row of the setlist.
   */
  readonly slotOptions?: readonly SelectOption[];
  readonly onChangeSlot?: (item: ProgramTabItem, slot: string) => void;
  /**
   * The arrangements this piece was published in — offered only where there is
   * a genuine choice, which is two editions or more. The pick governs the whole
   * production, not just the printed book: the divisi the casting board offers
   * and the practice tracks the singers get follow the bound edition.
   */
  readonly editionOptions?: readonly SelectOption[];
  /** What auto-selection binds today, named — so "automatically" still tells the
   *  producer which edition the concert is on. */
  readonly autoEditionLabel?: string;
  readonly onChangeEdition?: (item: ProgramTabItem, editionId: string) => void;
  readonly onToggleEncore: (item: ProgramTabItem) => void;
  readonly onDelete: (sortableId: string) => void;
}

/** Quiet until the pointer is on the row, then it takes its own colour. */
const ACTION_CLASS =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-chip transition-colors pointer-coarse:h-9 pointer-coarse:w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40";

export function SetlistRow({
  item,
  sortableId,
  position,
  meta,
  durationSeconds,
  slotOptions,
  onChangeSlot,
  editionOptions,
  autoEditionLabel,
  onChangeEdition,
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

  // Bare "automatically" would leave the producer guessing which score the
  // concert is on. The resting entry names the edition auto-selection lands on,
  // so choosing and not choosing are read in the same terms.
  const autoEditionEntry = autoEditionLabel
    ? t("projects.program.edition.auto", "Automatycznie: {{label}}", {
        label: autoEditionLabel,
      })
    : undefined;

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

        {/* A block, not a span: the slot picker below is a real field, and a
            field inside phrasing content is invalid nesting. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            {/* The slot as the singer will read it — numbered by the server
                against the rest of the programme, so it says "Na Komunię 2"
                where the picker below can only say "Na Komunię". */}
            {item.slot_label && (
              <Badge variant="incense" casing="natural" className="shrink-0">
                {item.slot_label}
              </Badge>
            )}
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
          {slotOptions && onChangeSlot && (
            <div className="mt-1.5 max-w-60">
              <Select
                size="sm"
                value={item.liturgical_slot}
                onValueChange={(slot) => onChangeSlot(item, slot)}
                options={slotOptions}
                ariaLabel={t(
                  "projects.program.liturgy.slot_aria",
                  "Miejsce w liturgii: {{title}}",
                  { title: item.piece_title },
                )}
                placeholder={t(
                  "projects.program.liturgy.slot_placeholder",
                  "Bez miejsca w liturgii",
                )}
                clearLabel={t(
                  "projects.program.liturgy.slot_clear",
                  "Bez miejsca w liturgii",
                )}
              />
            </div>
          )}
          {editionOptions && autoEditionEntry && onChangeEdition && (
            <div className="mt-1.5 max-w-72">
              <Select
                size="sm"
                leftIcon={<BookOpen aria-hidden="true" />}
                value={item.score_edition ?? ""}
                onValueChange={(editionId) => onChangeEdition(item, editionId)}
                options={editionOptions}
                ariaLabel={t(
                  "projects.program.edition.aria",
                  "Wydanie nut: {{title}}",
                  { title: item.piece_title },
                )}
                placeholder={autoEditionEntry}
                clearLabel={autoEditionEntry}
              />
            </div>
          )}
        </div>

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
