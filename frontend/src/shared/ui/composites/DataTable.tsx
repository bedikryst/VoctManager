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
 * The table never sorts or filters by itself. Sort state is controlled — the
 * caller owns it, usually in the URL through `useSearchParamSort` — and
 * `sortRows` orders rows in memory for the lists that arrive whole; a paged
 * list sends the same key to its server instead. Deliberately absent: row
 * virtualisation, column resizing, a column picker.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DataTable
 */

import React, { useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
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
  /** Below the rows: a count, a total, a pager. */
  readonly footer?: React.ReactNode;
  readonly className?: string;
}

/** What inside a row answers a click for itself. */
const OWN_CONTROL = "a, button, input, select, textarea, label, [role='button']";

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
  const sortable = Boolean(column.sortValue && onSortChange);
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

function TableRow<T>({
  row,
  columns,
  link,
}: {
  readonly row: T;
  readonly columns: readonly DataTableColumn<T>[];
  readonly link: DataTableRowLink;
}): React.JSX.Element {
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
      className="cursor-pointer transition-colors hover:bg-ethereal-ink/3"
    >
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
                  <TableRow key={rowKey(row)} row={row} columns={columns} link={rowLink(row)} />
                ))}
              </tbody>
            </table>
          </div>

          <ul aria-label={label} className="divide-y divide-hairline tabular-nums md:hidden">
            {rows.map((row) => {
              const link = rowLink(row);
              return (
                <li key={rowKey(row)} className="flex items-center gap-2 pr-3">
                  <Link
                    to={link.to}
                    state={link.state}
                    className={cn(
                      "flex min-w-0 flex-1 items-start gap-4 py-3 pl-5 transition-colors hover:bg-ethereal-ink/3",
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
