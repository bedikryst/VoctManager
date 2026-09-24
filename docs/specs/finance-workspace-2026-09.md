# Finance workspace — `/panel/finance/*`

Status: **Stage 1 (skeleton) done 2026-09-24, not yet checked in the browser. Next: stage 2
(backend), then stage 3 (tables).** Update this line at the end of every stage.

Builds on `project-finance-2026-09.md` (the finance module) and its audit
`project-finance-audit-2026-09.md`. Frontend paths below are relative to `frontend/src/` unless they
start with `frontend/` or `backend/`.

## Context

The foundation finance page (`features/finance/overview/FinancePage.tsx`) is one centred `max-w-6xl`
page with three cards (Projekty, Do zapłaty, Źródła finansowania). All three are fed by a single
request, `GET /api/finance/overview/` (`useFinanceOverview`).

The person who will use it is a board member (`is_staff` → manager + `can_approve_finance`) who
opens Voct only to do finance.

Goal: a finance workspace with its own navigation (Przegląd · Do zapłaty · Źródła · Projekty ·
Eksporty), dense tables on desktop, and a clear way back to Voct. The project budget stays in the
hub, with links in both directions.

Scope: mostly a frontend rebuild. Light backend additions are allowed. There are three, and none of
them touches the model or the money rules.

Defects in today's page that the rebuild must not carry over:
- The Od/Do range sits directly above the payables list but only drives "Eksport dla biura". The
  list itself is never filtered by it.
- Payable rows hide `due_on`, `form` and `category`, although the DTO carries them. The server
  orders by due date, so without the date on screen the list looks unordered.
- The "Eksport dla biura" button is clipped at `xl`. Project titles are truncated. The first column
  header reads "PLN".
- Sources sit below 50+ payable rows, so in practice nobody sees them.
- `pl-PL` leaves amounts under 10 000 ungrouped, so `6750,00` and `12 500,00` misalign in a column.
- The workspace cannot mark a payment as paid. The person has to go to each project's hub for
  every payment.

## Decisions

1. **The workspace takes over the whole screen, following the copy desk.**
   - `/panel/finance` becomes a sibling route tree of `/panel`, like `/redakcja`
     (`App.tsx:470`), under `ProtectedRoute` → `ManagerRoute`.
   - The nested `finance` routes in `App.tsx:370-371` are removed. The `contracts` redirect stays.
2. **The shell** is `widgets/finance-shell/FinanceShell.tsx`, modelled on
   `widgets/copy-desk-shell/CopyDeskShell.tsx`.
   - Carried over from the copy desk: the `admin-mode` body class, `EtherealBackground`, Suspense
     inside the frame, and a data gate (loader, or an error panel with retry).
   - From `lg` up: a sticky left column. It holds "← Voct" (to `/panel`), the eyebrow "Fundacja",
     the title "Finanse", the section nav with counts, and a footer with the avatar (to
     `/panel/settings`) and logout.
   - Below `lg`: a sticky header with "← Voct" and a horizontal strip of the sections.
   - There is no nav dock, so the shell sets `--nav-dock-h: 0`. That keeps any `bottom-dock` bar
     honest.
   - The shell mounts `FeedbackDock`. Its route whitelist lives in two places; see memory
     `project_feedback_widget_2026-08`.
   - Deliberately left out: command palette, notification bell, notes.
3. **Data.** The shell owns the overview query, which covers projects, sources, the payables
   summary and the next few payables. It passes the result down through `<Outlet context>`, the
   same pattern as `ProjectBudgetPage` and `CopyDeskShell`. Do zapłaty has its own query against
   the new filtered endpoint. Every query uses `MONEY_QUERY_OPTIONS`.
4. **Section nav** is `shared/ui/composites/RouteTabs.tsx`, horizontal and vertical, extracted from
   the `ProjectTabs` recipe. The design system calls a private copy of the tab track a bug.
   `BudgetTabs` moves onto it in this work. `ProjectTabs` and `ArchiveTabs` move later.
5. **Dense tables** use `shared/ui/composites/DataTable.tsx`. It is domain-free and minimal:
   - a typed column config, a sticky header and a whole-row link (the clickable-row pattern);
   - `tabular-nums`, a footer slot, and an empty state via `StatePanel variant="inline"`;
   - below `md`, rows collapse into two-line list rows.
   - Row selection is added in stage 4, when Do zapłaty needs it.
   - It has no virtualisation, column resizing or column picker.
   - Sort and filter state lives in URL search params, so the hub can deep-link.
6. **Amounts in tables** get a formatter in `features/finance/lib/money.ts` with
   `useGrouping: "always"`. Other surfaces keep their current formatter.

## Backend additions (light; `backend/finance/`)

- **B1 — `GET finance/payables/`.** A filtered, ordered, paginated list of counted costs.
  - Parameters:
    - `status`: `unpaid` (default, `BudgetService.payables()`) or `paid`, which uses the same
      counted filters with `paid_on` set.
    - `project`, and `kind` (`fee` or `expense`).
    - `paid_from` / `paid_to`, for `paid` only.
    - `ordering`, from a whitelist: due date, amount, payee, project, and paid date for `paid`.
    - `limit` / `offset`, with default 50 and max 200.
  - Response: `{count, limit, offset, total_amount, results}`. `total_amount` is the sum of the
    whole filtered set, not just the page. Rows are `PayableSerializer` plus `paid_on`.
  - It does not rebuild project rollups. The overview does that; this list is paged on its own.
- **B2 — `POST finance/payables/pay/` with `{ids, paid_on}`.** Marks costs paid across projects.
  - It groups ids by project and kind and runs `LedgerService.pay`
    (`services/ledger.py:466`) for each group inside one outer `transaction.atomic()`.
  - It locks budgets in a deterministic order (by project id).
  - It validates every group first, so the `PaymentRefused` payload names every refused id across
    all projects.
  - Closed budgets are refused through the existing `assert_writable`.
  - Permission: `IsManager`, the same as today's per-project pay.
- **B3 — overview gains `payables_summary`:** `count`, `total`, `overdue_count`, `overdue_total`,
  `due_soon_count` and `due_soon_total`.
  - "Due soon" means within 14 days; "today" is `timezone.localdate()`.
  - These are DB aggregates over `BudgetService.payables()`.
  - The overview's existing `payables` page stays; the shell requests `limit=8`.
- Tests for all three go in `backend/finance/tests/`, run with the sqlite settings. Cover the
  refusals and a mixed-project pay that rolls back in full. `ruff` and `mypy` stay clean.
- Update `docs/specs/project-finance-2026-09.md` §8.3 and the endpoint table (around line 367) so
  they describe the new endpoints.

## Sections

### Przegląd — `/panel/finance` (index)

It answers "what do I have to do today", from B3 and the overview DTO. The derivations live in
`features/finance/lib/portfolio.ts`, with vitest tests.

- Figures: outstanding, overdue (count and sum, in gold; crimson stays for alarms), and due within
  14 days.
- "Najbliższe płatności": 8 rows, linking to Do zapłaty.
- "Terminy": sources whose `report_due_on` or `eligible_to` falls within 60 days.
- "Wymaga pracy": projects with `warning_counts` above 0, linking to the hub budget.
- No sums across grants: adding two grants' remaining balances means nothing.

### Do zapłaty — `payables`

- A `SegmentedTabs` switch: Do zapłaty / Zapłacone (`?status=`).
- Filters: project (`?project=`), kind (`?kind=`), and a paid-date range on Zapłacone. Sort comes
  from the column headers (`?ordering=`). All of it goes to B1, so paging stays honest.
- Columns: Termin · Odbiorca · Tytuł (role or description) · Projekt · Forma · Kwota. Zapłacone
  also shows the paid date.
- Footer: `{{visible}} z {{total}}`, `total_amount`, and the pager.
- Selection and bulk pay use B2. The paid date defaults to today and uses the hub's pay act sheet.
  Refusals go through `financeErrors`.
  - The selection bar is portalled to `document.body`.
  - The mutation invalidates the payables query, the overview, the budget of every affected
    project, and the artist dossiers, the same as `useBudgetWrite`.
- A row opens the hub at `budget/{people|costs}?focus=`, using the existing URL builder in
  `PayablesCard.tsx`.
- Reverting a payment stays in the hub. It is a board correction with a stated reason, and the
  friction is intended.

### Źródła — `sources`, `sources/:sourceId`

- Columns: Źródło (with the grantor) · Rodzaj · Status · Przyznano · Obciążono · Pozostało ·
  Raport do.
- "Nowe źródło" opens the existing `SourceSheet`.
- `FundingSourcePage.tsx` moves under the shell. Its back link goes to `/panel/finance/sources`, and
  its charged-costs list becomes a `DataTable`.

### Projekty — `projects`

- Columns: Projekt (full title, wrapping, with the date) · Status budżetu · Koszt · Zapłacone ·
  Do zapłaty · Do zrobienia.
- A toggle shows projects with no costs.
- A row opens `/panel/projects/:id/budget`. A secondary action opens `payables?project=:id`.

### Eksporty — `exports`

- "Księga dla biura": `OfficeExport`, extracted from `PayablesCard.tsx`.
- "Dokumenty projektu": a project picker (`?project=`) feeds `useBudget` into the existing
  `ReportsCard`, `GrantorCard` and `DocumentsCard`, which take `projectId` plus the budget.

## Links in both directions

- **Finance → hub:** rows pass `state={{ financeReturn: pathname + search }}`.
- **Hub → finance:** `BudgetTabs` gets a trailing link. It reads "← Finanse" and goes to
  `financeReturn` when present; otherwise it reads "Finanse fundacji" and goes to
  `/panel/finance/projects`.
- **Unchanged:** the rail's Finance item, the mobile nav, the `AdminQuickModules` tile and
  `FundingPage`'s "Strona źródła".
- **Login:** when there is no `from`, `pages/auth/LoginPage.tsx` sends the user to `/panel/finance`
  if finance was the last workspace visited. This is stored in localStorage and guarded by
  try/catch.

## Stages

Stage 0 is this spec. Every later stage runs in a fresh session, starts from this file, updates the
`Status:` line when it ends, and records any departure from the plan in an "As built" section at the
bottom.

| Stage | Scope | Model | Effort |
|---|---|---|---|
| 1. Skeleton | See below | Opus 5.5 | high |
| 2. Backend | B1, B2, B3 and their tests; update the spec in `project-finance-2026-09.md` | Opus 5.5 | high |
| 3. Tables | `DataTable`, the table money formatter, Projekty, Źródła, and the source page's charged costs; delete `ProjectRollups` and `SourcesCard` | Opus 5.5 | medium |
| 4. Do zapłaty | See below | Opus 5.5 | high |
| 5. Overview and links | See below | Sonnet 5 | medium |

Stage details:
- **Stage 1 — Skeleton:**
  - Build `FinanceShell`, the takeover routes, `RouteTabs` (including the `BudgetTabs` migration)
    and the Outlet context.
  - Move the existing cards into their sections unchanged.
  - Build Eksporty in full.
  - The index redirects to `payables` for now.
  - Remove `FinancePage.tsx` and update the preloaders.
- **Stage 4 — Do zapłaty:**
  - Build the table on B1: the status switch, filters and sorting in the URL, and the pager.
  - Add selection to `DataTable`, with bulk pay on B2.
  - Delete `PayablesCard`.
- **Stage 5 — Overview and links:**
  - Build `portfolio.ts` with its tests, and Przegląd on B3; drop the interim redirect.
  - Add the links in both directions and the login fallback.
  - Add `DataTable`, `RouteTabs` and the "workspace takeover" rule to `.ai/04_design_system.md`.

Fable is unavailable to the developer, so no stage is planned for it. Stage 2 can run in parallel
with stage 1, because it touches only `backend/`.

Every stage that adds strings adds them to all three locales,
`frontend/src/shared/config/locales/{pl,en,fr}/translation.json`, under `finance.workspace.*`. The
files are not sorted, so insert next to the related keys.

## Critical files

- `frontend/src/app/App.tsx`: routes at 356–377, lazy registrations at 121–125, preloaders at
  234–270.
- New frontend files:
  - `widgets/finance-shell/FinanceShell.tsx`
  - `shared/ui/composites/RouteTabs.tsx`
  - `shared/ui/composites/DataTable.tsx`
  - `features/finance/workspace/{Overview,Payables,Sources,Projects,Exports}Page.tsx`
  - `features/finance/lib/portfolio.ts` and `portfolio.test.ts`
- Changed frontend files:
  - `features/finance/api/finance.queries.ts` and `finance.service.ts` (the payables query, bulk
    pay, and the summary)
  - `features/finance/types/finance.dto.ts`
  - `features/finance/lib/money.ts`
  - `features/finance/overview/FundingSourcePage.tsx`
  - `features/finance/overview/components/PayablesCard.tsx` (extract `OfficeExport`, then delete)
  - `features/finance/budget/BudgetTabs.tsx`
  - `pages/auth/LoginPage.tsx`
- Backend files:
  - `backend/finance/views.py` (`FinanceOverviewView` at 737, plus the new views)
  - `backend/finance/urls.py`
  - `backend/finance/serializers.py` (`PayableSerializer` at 312)
  - `backend/finance/services/budget.py` (`payables()` at 501)
  - `backend/finance/tests/`
- Reused as they are: `SourceSheet`, `ReportsCard`, `GrantorCard`, `DocumentsCard`, the hub's pay
  act sheet, `SectionCard`, `PageHeader`, `StatePanel`, `SegmentedTabs`, `EtherealLoader` and
  `FeedbackDock`.

## Verification

Run the checks once, at the end of each stage.

- **Frontend stages** (in `frontend/`): `npm run typecheck`, `npm run lint`, `npm run test`,
  `npm run build`.
- **Stage 2**, from the repo root:
  - `& .venv\Scripts\python.exe backend\manage.py test finance --settings=config.test_settings_sqlite`
  - `ruff check backend\finance`
  - `mypy backend\finance`
  - No migrations.

The developer checks the UI in his own browser:
- **After stage 1:** the shell at 1920 px and on a phone, "← Voct", the source page, and both
  exports.
- **After stage 3:** table density, and row clicks landing in the hub.
- **After stage 4:** filters surviving a reload; a bulk pay across two projects; a refusal where
  one item is unpriced.
- **After stage 5:** the overview figures against the tables, the round trip finance → hub →
  "← Finanse", and the landing after logging in.

**Prod:** nothing new to migrate. It deploys together with the first `finance` deploy (§6 of the
audit).

## As built

### Stage 1

- **The nav has no Przegląd entry yet.** The index only redirects to `payables`, so the entry would
  never be active. Stage 5 adds it along with the page.
- **Only Do zapłaty and Źródła show counts.** Projekty hides the projects that have no money on
  them, so a count of the rollups would not match the rows on screen. Stage 3's toggle settles what
  that count should mean.
- **Dock clearance** is set on `document.documentElement` while the shell is mounted. That covers
  `--nav-dock-h` and also `--bottom-dock-gap` and `--floating-dock-gap`, because those two are
  computed on `:root` and would otherwise keep the dock height. Portalled bars inherit from
  `<html>`, not from the shell.
- **The FeedbackDock has no route whitelist.** The whitelist kept in two places covers the client
  context fields (`collectClientContext.ts` and `_CONTEXT_SPEC`); the route is sent as a free
  `pathname`. The nginx and service-worker allowlists already cover `/panel/*`. Nothing changed
  there.
- **Where things live:**
  - `FinanceOutletContext` and `useFinanceOutlet` are in `features/finance/workspace/financeOutlet.ts`,
    not in the widget, because features may not import widgets.
  - `OfficeExport` is in `features/finance/workspace/components/`.
- **Do zapłaty paging** runs `useFinanceOverview(offset)` inside the section. At offset 0 it shares
  the shell's cache entry, and a later page that fails falls back to the shell's first page. Stage 4
  replaces all of this with B1.
- **The source page's back button** reads "Źródła" (`finance.workspace.nav.sources`) and leads to
  `/panel/finance/sources`, as does deleting a source. `finance.source_page.back` is gone.
- **Preloaders:** the shell and every section chunk are preloaded for manager sessions from the
  panel shell. The copy desk's chunks are not preloaded, but every manager's rail and dashboard lead
  into finance.
- `RouteTabs` takes `orientation`, `count` and `end`. `ProjectTabs` and `ArchiveTabs` still carry
  private copies of the track (planned).
