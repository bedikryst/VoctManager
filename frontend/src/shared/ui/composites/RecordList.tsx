/**
 * @file RecordList.tsx
 * @description The panel's list of records, where a whole row opens one
 * record: a route (the row's body is a `<Link>`) or an overlay or map focus (a
 * `<button>`). Rows sit between hairlines with no tile, fill, radius or shadow,
 * the way the piece card sets its own lists; a tone shows only on hover, on a
 * selected row and on the record the rest of the screen is showing. The tone
 * fills the band between two hairlines exactly, square, and in a flush list
 * both reach a little past the column so the titles keep the column's edge.
 *
 * One row, three columns: an optional select box, the open element, and at
 * most one icon action plus one menu. Nothing interactive lives inside the
 * open element, so a row never replays clicks and never holds an inline
 * editor; editing happens in the record it opens.
 *
 * The title takes the width. It is the title line alone; flags wrap under it
 * before they narrow it, and below `md` the figures join the facts line rather
 * than take a column from the name. A ledger's figure (`figure`) is the
 * exception: it is what a reader scans down the list, so it keeps its right
 * column at every width. The title's voice is a prop, not a class, so a row
 * cannot break the settled rule: serif for a titled work, sans for a person or
 * a place.
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

import React, { Children, createContext, useContext, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/shared/lib/utils";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Heading, Text } from "@/shared/ui/primitives/typography";

/** `work`: a titled work, in Cormorant. `name`: a person, a place, a payee, in sans. */
export type RecordVoice = "work" | "name";

export type RecordListEdge = "flush" | "inset";

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
  /** One muted line under the title, joined by " · ", cut at its end. */
  readonly facts?: readonly ReactNode[];
  /** Figures about the record: a right column from `md`, appended to the facts below it. */
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

/**
 * Where a row's band ends, per list edge. The row (`li`) carries the reach and
 * the hairline with it; its padding puts the content back on the text edge.
 * The open element reaches back out by the same padding on a side where no
 * select box or action stands, so its focus ring outlines the whole band.
 */
const ROW_EDGE: Readonly<Record<RecordListEdge, { readonly row: string; readonly open: string }>> = {
  flush: {
    row: "-mx-2 px-2",
    open: "first:-ml-2 first:pl-2 last:-mr-2 last:pr-2",
  },
  inset: {
    row: "px-5",
    open: "first:-ml-5 first:pl-5 last:-mr-5 last:pr-5",
  },
};

const RecordEdgeContext = createContext<RecordListEdge>("flush");

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

/** The items joined by a middle dot, with keys, skipping the empty ones. */
const joinFacts = (items: readonly ReactNode[]): ReactNode[] =>
  items.filter(isPresent).flatMap((item, index) =>
    index === 0
      ? [<React.Fragment key={index}>{item}</React.Fragment>]
      : [" · ", <React.Fragment key={index}>{item}</React.Fragment>],
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
  const edge = ROW_EDGE[useContext(RecordEdgeContext)];
  const shownFacts = facts.filter(isPresent);
  const shownMeta = meta.filter(isPresent);
  const hasFactsLine = shownFacts.length > 0 || shownMeta.length > 0;

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
        {hasFactsLine && (
          <Text
            as="span"
            size="sm"
            color="muted"
            className={cn("block truncate", shownFacts.length === 0 && "md:hidden")}
          >
            {joinFacts(shownFacts)}
            {shownMeta.length > 0 && (
              <span className="md:hidden">
                {shownFacts.length > 0 && " · "}
                {joinFacts(shownMeta)}
              </span>
            )}
          </Text>
        )}
      </span>
      {shownMeta.length > 0 && (
        <Text
          as="span"
          size="sm"
          color="graphite"
          className="hidden shrink-0 whitespace-nowrap text-right tabular-nums md:block"
        >
          {joinFacts(shownMeta)}
        </Text>
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

  return (
    <li
      id={id}
      className={cn(
        "relative transition-colors",
        edge.row,
        select?.checked
          ? "bg-ethereal-gold/5"
          : (open !== undefined || rowToggles) && "hover:bg-ethereal-ink/3",
        current &&
          "before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-ethereal-gold",
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
  empty,
  className,
}: RecordListProps): React.JSX.Element {
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

  // A flush list rules its rows, not itself: the hairlines reach with the rows.
  return (
    <RecordEdgeContext.Provider value={edge}>
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
    </RecordEdgeContext.Provider>
  );
}
