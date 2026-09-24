/**
 * @file DataTable.tsx
 * @description The panel's dense table: a typed column config, a header that
 * stays pinned while the rows scroll, and a whole row that opens one place.
 * Built for work surfaces where a person reads figures down a column, so every
 * cell runs on tabular digits and a numeric column aligns to its right edge.
 *
 * The row is a link in full. The first column carries the real `<Link>` — it is
 * what a keyboard focuses, what a screen reader announces and what a middle
 * click opens in a new tab — and a click anywhere else on the row is replayed
 * onto it, modifiers included, so Ctrl+click opens a tab from any cell. A click
 * on a control of its own inside a row (a secondary link, a button) is left to
 * that control. The row takes no keystrokes itself: keyboard activation belongs
 * to the link, so no key pressed inside a cell ever bubbles into navigation.
 *
 * Below `md` the table becomes a list of two-line rows: what the row is, a line
 * of facts under it, the figure that matters on the right, and an optional
 * action beside the link.
 *
 * Selection is optional and controlled: the caller owns which rows are
 * selected (they may be rows of other pages) and the table draws a checkbox
 * before each row and one in the header for the rows on screen. The checkbox
 * sits in a `<label>` that widens its target; both are controls of their own,
 * so a click on them never reaches the row's link, and the toggle listens to
 * the input's `change` alone — the click the label forwards to the input
 * changes it once.
 *
 * The table never sorts or filters by itself. Sort state is controlled — the
 * caller owns it, usually in the URL through `useSearchParamSort` — and
 * `sortRows` orders rows in memory for the lists that arrive whole; a paged
 * list marks its columns `sortable` and sends the same key to its server
 * instead. Deliberately absent: row virtualisation, column resizing, a column
 * picker.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DataTable
 */

import React, { useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Eyebrow } from "@/shared/ui/primitives/typography";

export type SortDirection = "asc" | "desc";

export interface DataTableSort {
  readonly key: string;
  readonly direction: SortDirection;
}

export interface DataTableColumn<T> {
  /** Also the sort key written to the URL. */
  readonly id: string;
  readonly header: string;
  /** The header is read by assistive tech only — for a column of row actions. */
  readonly headerHidden?: boolean;
  readonly cell: (row: T) => React.ReactNode;
  /** Figures: right-aligned and never wrapped. */
  readonly numeric?: boolean;
  /** Makes the header a sort control. `null` sorts last in either direction. */
  readonly sortValue?: (row: T) => string | number | null;
  /** Makes the header a sort control for a list its server sorts, with no `sortValue`. */
  readonly sortable?: boolean;
  /** What the first click on the header sorts by; figures usually start high. */
  readonly firstDirection?: SortDirection;
  /** Width and other layout for the column's cells, header included. */
  readonly className?: string;
}

export interface DataTableRowLink {
  readonly to: string;
  readonly state?: unknown;
}

export interface DataTableMobileRow<T> {
  readonly primary: (row: T) => React.ReactNode;
  readonly secondary?: (row: T) => React.ReactNode;
  readonly trailing?: (row: T) => React.ReactNode;
  /** A control of its own, placed beside the row's link rather than in it. */
  readonly action?: (row: T) => React.ReactNode;
}

export interface DataTableEmpty {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description?: string;
}

export interface DataTableSelection<T> {
  readonly isSelected: (row: T) => boolean;
  readonly onToggle: (row: T) => void;
  /** The header's checkbox: select every row on screen, or clear them all. */
  readonly onToggleRows: (rows: readonly T[], select: boolean) => void;
  /** Each row checkbox's accessible name. */
  readonly rowLabel: (row: T) => string;
  /** The header checkbox's accessible name. */
  readonly allLabel: string;
}

export interface DataTableProps<T> {
  /** The table's accessible name. */
  readonly label: string;
  readonly rows: readonly T[];
  readonly columns: readonly DataTableColumn<T>[];
  readonly rowKey: (row: T) => string;
  readonly rowLink: (row: T) => DataTableRowLink;
  readonly mobile: DataTableMobileRow<T>;
  readonly empty: DataTableEmpty;
  readonly sort?: DataTableSort | null;
  readonly onSortChange?: (sort: DataTableSort) => void;
  readonly selection?: DataTableSelection<T>;
  /** Below the rows: a count, a total, a pager. */
  readonly footer?: React.ReactNode;
  readonly className?: string;
}

/**
 * What inside a row answers a click for itself. The selection cell is in the
 * list whole: a click that misses its checkbox is a near miss, not a request
 * to leave the page.
 */
const OWN_CONTROL = "a, button, input, select, textarea, label, [role='button'], [data-row-select]";

const LINK_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40";

/** `-amount` → amount, descending; the `ordering` spelling a DRF list also takes. */
export const parseSort = (value: string | null): DataTableSort | null => {
  if (!value) return null;
  return value.startsWith("-")
    ? { key: value.slice(1), direction: "desc" }
    : { key: value, direction: "asc" };
};

export const formatSort = (sort: DataTableSort): string =>
  sort.direction === "desc" ? `-${sort.key}` : sort.key;

/**
 * Sort state in one search param, so a sorted table survives a reload and
 * another screen can deep-link into it. Writing replaces the history entry: a
 * header click is not a place to come back to.
 */
export const useSearchParamSort = (
  param = "ordering",
): [DataTableSort | null, (sort: DataTableSort) => void] => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = useMemo(() => parseSort(searchParams.get(param)), [searchParams, param]);
  const setSort = useCallback(
    (next: DataTableSort) =>
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          params.set(param, formatSort(next));
          return params;
        },
        { replace: true },
      ),
    [setSearchParams, param],
  );
  return [sort, setSort];
};

const collator = new Intl.Collator("pl", { sensitivity: "base", numeric: true });

/**
 * Rows in the order a sort names, stable for ties. An unknown key, or a column
 * that does not sort, leaves the rows as they came.
 */
export const sortRows = <T,>(
  rows: readonly T[],
  columns: readonly DataTableColumn<T>[],
  sort: DataTableSort | null | undefined,
): readonly T[] => {
  const value = sort ? columns.find((column) => column.id === sort.key)?.sortValue : undefined;
  if (!sort || !value) return rows;
  const sign = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, key: value(row) }))
    .sort((a, b) => {
      if (a.key === null || b.key === null) {
        if (a.key === b.key) return a.index - b.index;
        return a.key === null ? 1 : -1;
      }
      const order =
        typeof a.key === "number" && typeof b.key === "number"
          ? a.key - b.key
          : collator.compare(String(a.key), String(b.key));
      return order === 0 ? a.index - b.index : order * sign;
    })
    .map(({ row }) => row);
};

const nextSort = <T,>(column: DataTableColumn<T>, current: DataTableSort | null | undefined): DataTableSort => {
  if (current?.key === column.id) {
    return { key: column.id, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key: column.id, direction: column.firstDirection ?? "asc" };
};

function HeaderCell<T>({
  column,
  sort,
  onSortChange,
}: {
  readonly column: DataTableColumn<T>;
  readonly sort: DataTableSort | null | undefined;
  readonly onSortChange?: (sort: DataTableSort) => void;
}): React.JSX.Element {
  const active = sort?.key === column.id ? sort.direction : null;
  const sortable = Boolean((column.sortValue || column.sortable) && onSortChange);
  const label = (
    <Eyebrow
      as="span"
      size="overline-sm"
      color={active ? "graphite" : "muted"}
      className={column.headerHidden ? "sr-only" : undefined}
    >
      {column.header}
    </Eyebrow>
  );
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ChevronsUpDown;

  return (
    <th
      scope="col"
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : undefined}
      className={cn(
        "sticky top-0 z-10 border-b border-hairline bg-ethereal-alabaster px-3 py-2 font-normal first:pl-5 last:pr-5",
        column.numeric ? "text-right" : "text-left",
        column.className,
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSortChange?.(nextSort(column, sort))}
          className={cn(
            "inline-flex items-center gap-1 rounded-control transition-colors hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
            column.numeric && "flex-row-reverse",
          )}
        >
          {label}
          <Icon
            size={12}
            aria-hidden="true"
            className={active ? "text-ethereal-gold" : "text-ethereal-graphite/40"}
          />
        </button>
      ) : (
        label
      )}
    </th>
  );
}

/** A checkbox inside a label that widens its target past the 16px box. */
function SelectBox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly indeterminate?: boolean;
  readonly label: string;
  readonly onChange: () => void;
}): React.JSX.Element {
  return (
    <label className="-m-2 inline-flex cursor-pointer p-2">
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onChange={onChange}
        aria-label={label}
      />
    </label>
  );
}

function SelectAllCell<T>({
  rows,
  selection,
}: {
  readonly rows: readonly T[];
  readonly selection: DataTableSelection<T>;
}): React.JSX.Element {
  const count = rows.filter(selection.isSelected).length;
  const all = count > 0 && count === rows.length;
  return (
    <th
      scope="col"
      className="sticky top-0 z-10 w-10 border-b border-hairline bg-ethereal-alabaster py-2 pl-5 pr-1 text-left font-normal"
    >
      <SelectBox
        checked={all}
        indeterminate={count > 0 && !all}
        label={selection.allLabel}
        onChange={() => selection.onToggleRows(rows, !all)}
      />
    </th>
  );
}

function TableRow<T>({
  row,
  columns,
  link,
  selection,
}: {
  readonly row: T;
  readonly columns: readonly DataTableColumn<T>[];
  readonly link: DataTableRowLink;
  readonly selection?: DataTableSelection<T>;
}): React.JSX.Element {
  const selected = selection?.isSelected(row) ?? false;
  const replayOnLink = (event: React.MouseEvent<HTMLTableRowElement>): void => {
    const target = event.target as HTMLElement;
    if (target.closest(OWN_CONTROL)) return;
    // A drag that selected text is someone copying a figure, not opening the row.
    if (window.getSelection()?.toString()) return;
    const anchor = event.currentTarget.querySelector<HTMLAnchorElement>("[data-row-link]");
    anchor?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      }),
    );
  };

  return (
    <tr
      onClick={replayOnLink}
      className={cn(
        "cursor-pointer transition-colors",
        selected ? "bg-ethereal-gold/5" : "hover:bg-ethereal-ink/3",
      )}
    >
      {selection && (
        <td data-row-select="" className="w-10 cursor-default border-b border-hairline py-3 pl-5 pr-1 align-top">
          <SelectBox
            checked={selected}
            label={selection.rowLabel(row)}
            onChange={() => selection.onToggle(row)}
          />
        </td>
      )}
      {columns.map((column, index) => (
        <td
          key={column.id}
          className={cn(
            "border-b border-hairline px-3 py-3 align-top first:pl-5 last:pr-5",
            column.numeric && "whitespace-nowrap text-right",
            column.className,
          )}
        >
          {index === 0 ? (
            <Link
              to={link.to}
              state={link.state}
              data-row-link=""
              className={cn("-m-1 block rounded-control p-1", LINK_FOCUS)}
            >
              {column.cell(row)}
            </Link>
          ) : (
            column.cell(row)
          )}
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  label,
  rows,
  columns,
  rowKey,
  rowLink,
  mobile,
  empty,
  sort,
  onSortChange,
  selection,
  footer,
  className,
}: DataTableProps<T>): React.JSX.Element {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      {rows.length === 0 ? (
        <StatePanel
          variant="inline"
          className="px-5 py-10"
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
        />
      ) : (
        <>
          {/* The scroll region is what the header pins against: a card around
              the table clips overflow, so the page itself cannot. */}
          <div className="hidden max-h-[calc(100dvh-10rem)] overflow-auto md:block">
            <table aria-label={label} className="w-full border-separate border-spacing-0 tabular-nums">
              <thead>
                <tr>
                  {selection && <SelectAllCell rows={rows} selection={selection} />}
                  {columns.map((column) => (
                    <HeaderCell
                      key={column.id}
                      column={column}
                      sort={sort}
                      onSortChange={onSortChange}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    row={row}
                    columns={columns}
                    link={rowLink(row)}
                    selection={selection}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <ul aria-label={label} className="divide-y divide-hairline tabular-nums md:hidden">
            {rows.map((row) => {
              const link = rowLink(row);
              const selected = selection?.isSelected(row) ?? false;
              return (
                <li
                  key={rowKey(row)}
                  className={cn("flex items-center gap-2 pr-3", selected && "bg-ethereal-gold/5")}
                >
                  {selection && (
                    <span className="shrink-0 pl-5">
                      <SelectBox
                        checked={selected}
                        label={selection.rowLabel(row)}
                        onChange={() => selection.onToggle(row)}
                      />
                    </span>
                  )}
                  <Link
                    to={link.to}
                    state={link.state}
                    className={cn(
                      "flex min-w-0 flex-1 items-start gap-4 py-3 transition-colors hover:bg-ethereal-ink/3",
                      selection ? "pl-1" : "pl-5",
                      !mobile.action && "pr-2",
                      LINK_FOCUS,
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      {mobile.primary(row)}
                      {mobile.secondary?.(row)}
                    </span>
                    {mobile.trailing && (
                      <span className="flex shrink-0 flex-col items-end">{mobile.trailing(row)}</span>
                    )}
                  </Link>
                  {mobile.action?.(row)}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {footer && <div className="border-t border-hairline px-5 py-3">{footer}</div>}
    </div>
  );
}
