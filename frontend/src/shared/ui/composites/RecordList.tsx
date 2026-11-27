/**
 * @file RecordList.tsx
 * @description The panel's list of records, where a whole row opens one
 * record: a route (the row's body is a `<Link>`) or an overlay or map focus (a
 * `<button>`). Rows sit between hairlines with no tile, fill, radius or shadow,
 * the way the piece card sets its own lists; a tone shows only on hover, on a
 * selected row and on the record the rest of the screen is showing. The
 * hairlines stop on the column's edge, like the tabs, the search field and the
 * buttons above them; in a flush list only the tone reaches a little past it,
 * so a toned row does not crowd the titles that start on that edge.
 *
 * One row, three columns: an optional select box, the open element, and at
 * most one icon action plus one menu. Nothing interactive lives inside the
 * open element, so a row never replays clicks and never holds an inline
 * editor; editing happens in the record it opens.
 *
 * The title takes the width. It is the title line alone; flags wrap under it
 * before they narrow it. Under it, the facts read as a catalogue byline,
 * joined by commas ("Arvo Pärt, 1990"). Figures about the record (`meta`) fill
 * the cells the list declares (`columns`): one width per column for every row,
 * so a voicing stands under a voicing and a length under a length, and an
 * empty cell keeps its width. Below `md` the name needs the width: the columns
 * a list marks `stack` stand one per line in a single right column, and the
 * rest are left to the record. A ledger's figure (`figure`) keeps its right
 * column at every width: it is what a reader scans down the list. The title's
 * voice is a prop, not a class, so a row cannot break the settled rule: serif
 * for a titled work, sans for a person or a place.
 *
 * Selection comes in two scopes. A standing selection (`box`, a ledger's) puts
 * a box beside a row that still opens its record. A selection mode a toolbar
 * switches on (`row`) makes the whole row one toggle: the body becomes a
 * pressed-state button and the actions step aside, so a tap while selecting
 * never leaves the page and drops the selection.
 *
 * `SelectBox` lives here because both this list and `DataTable` draw it.
 * @module shared/ui/composites/RecordList
 */

import React, { Children, createContext, useContext, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/shared/lib/utils";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Heading, Text } from "@/shared/ui/primitives/typography";

/** `work`: a titled work, in Cormorant. `name`: a person, a place, a payee, in sans. */
export type RecordVoice = "work" | "name";

export type RecordListEdge = "flush" | "inset";

/** A meta cell's width: 3, 4, 5, 6 or 8 rem, the same in every row of the list. */
export type RecordColumnWidth = "xs" | "sm" | "md" | "lg" | "xl";

export interface RecordColumn {
  readonly width: RecordColumnWidth;
  /** `end` (default) for a figure, so the digits line up; `start` for a label such as a voicing. */
  readonly align?: "start" | "end";
  /**
   * Below `md`: `stack` keeps the cell, one per line in the row's right
   * column, the way `figure` stands; `drop` (default) leaves it to the record.
   */
  readonly compact?: "stack" | "drop";
}

export type RecordRowOpen =
  | { readonly to: string; readonly state?: unknown }
  | { readonly onOpen: () => void };

export interface RecordRowSelect {
  readonly checked: boolean;
  /** The checkbox's accessible name, and the row's while the row is the toggle. */
  readonly label: string;
  readonly onChange: () => void;
  /**
   * `box` (default): a standing selection, the box beside a row that opens its
   * record. `row`: the list is in a selection mode, and the whole row toggles.
   */
  readonly scope?: "box" | "row";
}

export interface RecordRowProps {
  /**
   * What the row opens. Omitted for an entry that is not a record yet (an
   * upload the AI has not attached to a piece): the body is static and the
   * actions are the row's only controls.
   */
  readonly open?: RecordRowOpen;
  readonly title: string;
  readonly voice: RecordVoice;
  /** An avatar or a category icon. Omitted rather than filled with a placeholder glyph. */
  readonly leading?: ReactNode;
  /** Exceptions only, in sentence case: `Badge casing="natural"` or a crimson `Caption`. */
  readonly flags?: ReactNode;
  /** One muted line under the title, a byline joined by commas, cut at its end. */
  readonly facts?: readonly ReactNode[];
  /**
   * Figures about the record, one per column the list declares, by position:
   * a null keeps its cell empty. A list with columns gives every row the same
   * actions, or the cells of a row without them stand further right.
   */
  readonly meta?: readonly ReactNode[];
  /** A ledger's figure, its lines stacked: a right column at every width. */
  readonly figure?: ReactNode;
  /** At most one icon button and one `DropdownMenu`, visible at rest. Size icons with `recordActionClass`. */
  readonly actions?: ReactNode;
  readonly select?: RecordRowSelect;
  /** The record the rest of the screen is showing (a map's focus): a gold edge and `aria-current`. */
  readonly current?: boolean;
  /** The row's anchor, for the scroll back from the record it opened. */
  readonly id?: string;
}

export interface RecordListEmpty {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
}

export interface RecordListProps {
  /** The list's accessible name. */
  readonly label: string;
  readonly children: ReactNode;
  /**
   * `flush`: the rows' text starts on the column's edge and the list is ruled
   * above and below, for a list on the page itself. `inset`: rows padded for a
   * list inside a card, ruled between rows only, so the card's own edges and
   * footer close it.
   */
  readonly edge?: RecordListEdge;
  /** The cells the rows' `meta` fill, left to right; a row's figures render only here. */
  readonly columns?: readonly RecordColumn[];
  /** Shown in place of the list when it has no rows. */
  readonly empty?: RecordListEmpty;
  readonly className?: string;
}

/**
 * A row action's size: 36 px on touch, 28 px under a mouse, the dense-list
 * rule. Graphite at rest, never hidden until hover.
 */
export const recordActionClass =
  "h-9 w-9 shrink-0 text-ethereal-graphite fine-pointer:h-7 fine-pointer:w-7";

const OPEN_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40";

interface RowEdge {
  /** The row's padding: none in a flush list, whose text starts on the column's edge. */
  readonly row: string;
  /** The tone's horizontal extent (the row's `::before`). */
  readonly band: string;
  /** The current record's gold edge (the row's `::after`). */
  readonly current: string;
  /**
   * The open element reaches out to the band on a side where no select box or
   * action stands, and pads its content back, so its focus ring and its click
   * target are the whole band.
   */
  readonly open: string;
}

/**
 * Where a row's band ends, per list edge. The hairline is the row's own
 * border, so it keeps the row's width: the column in a flush list, the card in
 * an inset one. The tone is a pseudo-element behind the content, free to reach
 * past that width while the hairline stays put.
 */
const ROW_EDGE: Readonly<Record<RecordListEdge, RowEdge>> = {
  flush: {
    row: "",
    band: "before:-inset-x-2",
    current: "after:-left-2",
    open: "first:-ml-2 first:pl-2 last:-mr-2 last:pr-2",
  },
  inset: {
    row: "px-5",
    band: "before:inset-x-0",
    current: "after:left-0",
    open: "first:-ml-5 first:pl-5 last:-mr-5 last:pr-5",
  },
};

const COLUMN_WIDTH: Readonly<Record<RecordColumnWidth, string>> = {
  xs: "w-12",
  sm: "w-16",
  md: "w-20",
  lg: "w-24",
  xl: "w-32",
};

interface RecordListContextValue {
  readonly edge: RecordListEdge;
  readonly columns: readonly RecordColumn[];
}

const NO_COLUMNS: readonly RecordColumn[] = [];

const RecordListContext = createContext<RecordListContextValue>({ edge: "flush", columns: NO_COLUMNS });

/**
 * A checkbox inside a label that widens its target past the 16 px box.
 * `mirror`: a second pointer target for a control that already carries the
 * state (a row in selection mode), kept out of the tab order and the
 * accessibility tree so a keyboard or a screen reader meets the row once.
 */
export function SelectBox({
  checked,
  indeterminate = false,
  label,
  onChange,
  mirror = false,
}: {
  readonly checked: boolean;
  readonly indeterminate?: boolean;
  readonly label: string;
  readonly onChange: () => void;
  readonly mirror?: boolean;
}): React.JSX.Element {
  return (
    <label className="-m-2 inline-flex cursor-pointer p-2">
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onChange={onChange}
        aria-label={mirror ? undefined : label}
        aria-hidden={mirror || undefined}
        tabIndex={mirror ? -1 : undefined}
      />
    </label>
  );
}

const isPresent = (node: ReactNode): boolean =>
  node !== null && node !== undefined && node !== false && node !== "";

/** The items joined by a comma, catalogue style, with keys, skipping the empty ones. */
const joinFacts = (items: readonly ReactNode[]): ReactNode[] =>
  items.filter(isPresent).flatMap((item, index) =>
    index === 0
      ? [<React.Fragment key={index}>{item}</React.Fragment>]
      : [", ", <React.Fragment key={index}>{item}</React.Fragment>],
  );

function RecordTitle({ title, voice }: { readonly title: string; readonly voice: RecordVoice }): React.JSX.Element {
  return voice === "work" ? (
    <Heading as="span" size="lg" className="min-w-0 max-w-full wrap-break-word leading-snug">
      {title}
    </Heading>
  ) : (
    <Text as="span" size="base" weight="medium" className="min-w-0 max-w-full wrap-break-word leading-snug">
      {title}
    </Text>
  );
}

export function RecordRow({
  open,
  title,
  voice,
  leading,
  flags,
  facts = [],
  meta = [],
  figure,
  actions,
  select,
  current = false,
  id,
}: RecordRowProps): React.JSX.Element {
  const { edge: edgeName, columns } = useContext(RecordListContext);
  const edge = ROW_EDGE[edgeName];
  const shownFacts = facts.filter(isPresent);
  const stacked = columns.flatMap((column, index) =>
    column.compact === "stack" && isPresent(meta[index]) ? [{ index, cell: meta[index] }] : [],
  );

  const body = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <RecordTitle title={title} voice={voice} />
          {isPresent(flags) && (
            <span className="flex max-w-full flex-wrap items-center gap-1">{flags}</span>
          )}
        </span>
        {shownFacts.length > 0 && (
          <Text as="span" size="sm" color="muted" className="block truncate">
            {joinFacts(shownFacts)}
          </Text>
        )}
      </span>
      {columns.length > 0 && (
        <span className="hidden shrink-0 items-center gap-4 md:flex">
          {columns.map((column, index) => (
            <Text
              key={index}
              as="span"
              size="sm"
              color="graphite"
              className={cn(
                "truncate tabular-nums",
                COLUMN_WIDTH[column.width],
                column.align === "start" ? "text-left" : "text-right",
              )}
            >
              {isPresent(meta[index]) ? meta[index] : null}
            </Text>
          ))}
        </span>
      )}
      {stacked.length > 0 && (
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right md:hidden">
          {stacked.map(({ index, cell }) => (
            <Text key={index} as="span" size="sm" color="graphite" className="whitespace-nowrap tabular-nums">
              {cell}
            </Text>
          ))}
        </span>
      )}
      {isPresent(figure) && (
        <span className="flex shrink-0 flex-col items-end text-right tabular-nums">{figure}</span>
      )}
    </>
  );

  const openClass = cn("flex min-w-0 flex-1 items-center gap-3 py-3", edge.open, OPEN_FOCUS);
  const rowToggles = select?.scope === "row";
  const ariaCurrent = current ? "true" : undefined;

  const openElement = rowToggles ? (
    <button
      type="button"
      onClick={select.onChange}
      aria-pressed={select.checked}
      aria-label={select.label}
      className={cn(openClass, "text-left")}
    >
      {body}
    </button>
  ) : open === undefined ? (
    <div className={cn(openClass, "cursor-default")}>{body}</div>
  ) : "to" in open ? (
    <Link to={open.to} state={open.state} aria-current={ariaCurrent} className={openClass}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      onClick={open.onOpen}
      aria-current={ariaCurrent}
      className={cn(openClass, "text-left")}
    >
      {body}
    </button>
  );

  // `isolate` keeps the tone's negative z-index inside the row: it paints
  // behind the row's content and above whatever the list stands on.
  return (
    <li
      id={id}
      className={cn(
        "relative isolate before:pointer-events-none before:absolute before:inset-y-0 before:-z-10 before:transition-colors",
        edge.row,
        edge.band,
        select?.checked
          ? "before:bg-ethereal-gold/5"
          : (open !== undefined || rowToggles) && "hover:before:bg-ethereal-ink/3",
        current &&
          cn(
            "after:pointer-events-none after:absolute after:inset-y-2 after:w-0.5 after:rounded-full after:bg-ethereal-gold",
            edge.current,
          ),
      )}
    >
      <div className="flex items-center gap-2">
        {select && (
          <span className="flex shrink-0 items-center">
            <SelectBox
              checked={select.checked}
              label={select.label}
              onChange={select.onChange}
              mirror={rowToggles}
            />
          </span>
        )}
        {openElement}
        {!rowToggles && isPresent(actions) && (
          <span className="flex shrink-0 items-center gap-1">{actions}</span>
        )}
      </div>
    </li>
  );
}

export function RecordList({
  label,
  children,
  edge = "flush",
  columns = NO_COLUMNS,
  empty,
  className,
}: RecordListProps): React.JSX.Element {
  const context = useMemo<RecordListContextValue>(() => ({ edge, columns }), [edge, columns]);

  if (empty && Children.toArray(children).length === 0) {
    return (
      <StatePanel
        variant="inline"
        className="px-5 py-10"
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
      />
    );
  }

  // A flush list rules its rows, not itself, at the column's width.
  return (
    <RecordListContext.Provider value={context}>
      <ul
        aria-label={label}
        className={cn(
          edge === "flush"
            ? "[&>li]:border-t [&>li]:border-hairline [&>li:last-child]:border-b"
            : "divide-y divide-hairline",
          className,
        )}
      >
        {children}
      </ul>
    </RecordListContext.Provider>
  );
}
