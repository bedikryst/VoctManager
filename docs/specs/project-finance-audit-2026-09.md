# Project finance — audit of Stages 1–6

Status: **P0 and P1 fixed 2026-09-24 (uncommitted, see each finding). Q1–Q7 answered (§4). P2 and
P3 are next, in a fresh session. The prod deploy of `finance` is no longer blocked by this audit;
its runbook is §6.**

Scope: `f20507d4..9fa587c6`, the implementation of `project-finance-2026-09.md` (the "spec" below).
The commit messages in that range do not describe their content:

| commit | message says | holds |
|---|---|---|
| `60a59c19` | score stand concert plan | Stages 1 + 1b (ledger backend, documents) |
| `2cefe8dc` | user_email for representatives | board account e-mails in `finance/foundation.py` |
| `3facfbbc` | dashboard nav | Stages 2 + 3 (ledger frontend, global page, legacy removal) |
| `79ec3d58` | translations + nginx | Stage 4 (plan, expenses, budget states) |
| `b1258867` | funding translations | Stage 5 (funding) |
| `9fa587c6` | patron summary | Stage 6 (reports and exports) |

Method: tools once, then five read-only reviewers, each covering one kind of risk across the whole
range (money rules, access and privacy, the frontend/backend contract, legacy removal and data copy,
documents and reports). Every P0–P2 finding was re-read in the code before it was listed here.
Tags: **V** = verified in code during the audit; **A** = reported with evidence by a reviewer and not
re-read; **P** = plausible, depends on data or timing.

## 1. Baseline — all green

ruff and mypy clean on `finance`, `roster` and `core` (143 files). `makemigrations --check` shows no
changes. The backend tests for `finance roster core` pass: 1186, 3 skipped. `npm run build` (with
typecheck), `lint`, the literal-colour guard and vitest all pass (298 tests). Locale keys are at
parity across pl, en and fr, and every frontend finance file carries its `@file` header. Everything
below is invisible to the tools.

## 2. Findings

### P0 — live on prod today, independent of the finance deploy

- **A1 [V] Old contract ZIPs are public.** The removed roster task wrote
  `MEDIA_ROOT/exports/Contracts_Project_<title>.zip` (`f20507d4:backend/roster/tasks.py:105`). Those
  files stay on disk, and `location ^~ /media/` in `infra/nginx/prod.conf:428` (and in `local.conf:296`)
  serves them without authentication. Concert titles are public, so anyone can build the URL and get
  every contract of a project, with names and fees. Fix: delete the files on prod (manual, see the
  runbook in the hand-off) and make `/media/exports/` `internal` in both nginx configs, as was done
  for `/media/finance/`.
  **Fixed:** `internal` in `prod.conf` and `local.conf`. On 2026-09-24 prod held no file there. The
  old roster keeps writing such ZIPs until `finance` is deployed.

### P1 — before the first prod `make migrate` of `finance`, or before the feature is used

Prod has not received `finance` yet (it was not to be deployed between Stages 1 and 3). The data copy
therefore runs for the first time on real data at that deploy.

- **D1 [A] The creator's accidental 0 becomes a permanent volunteer.** The old project creation gave
  the creator's seat `fee=0` (`f20507d4:backend/roster/services.py:866`). `finance/data_copy.py:83-86`
  imports it as VOLUNTEER, and the standard rate skips VOLUNTEER (`services/ledger.py:69`). Spec 541
  (0 → VOLUNTEER) contradicts as-built 703–704. Depends on **Q2**.
  **Fixed:** a 0 on a seat created within 5 s of its project is the creator's seat and gets no
  item. A 0 on a seat cast later is still VOLUNTEER. Prod had 2 seats at 0 before the deploy.
- **D2 [A] Unpaid fees on cancelled projects become live debts** (`data_copy.py:147`,
  `services/budget.py:499-519`). The old workspace ignored cancelled projects. After the copy, they
  appear under "Do zapłaty" and in the outstanding totals on `/panel/finance`. Depends on **Q2**.
  **Fixed:** an unpaid fee on a `CANC` project is not copied, and a paid one is. Prod had 0.
- **D3 [A] An old artist merge is counted twice.** The legacy merge copied the duplicate's fee onto
  the survivor and soft-deleted the duplicate with its paid flag. The copy imports both: 300 paid on
  the removed seat and 300 unpaid on the survivor, i.e. a debt for money already paid
  (`data_copy.py:147`). Detect the pair on copy, or import only the paid one.
  **Fixed:** a pair is a paid, removed seat of a removed artist with exactly one live, unpaid seat
  on the same project, at the same fee, with the same name. The payment lands once, on the
  survivor's seat, and the IMPORTED event records `merged_from`. Anything less certain is copied as
  it stands. Prod had 0 paid removed seats, so this matters only if a merge runs before the deploy.
- **D4 [A] Every imported paid fee raises `PAID_WITHOUT_DOCUMENT` for good**
  (`services/budget.py:1030`). No Contract rows are imported, and the only way to clear the warning is
  to issue a contract today, with this year's number, for a past payment. Depends on **Q2**.
  **Fixed:** `CostItem.paid_before_ledger`. It is set by `finance/0005`
  (`data_copy.mark_payments_before_ledger`, which runs after `0002` because the column is newer),
  exempts the item from the warning and is cleared by `unpay`. Prod: 13 seats and 2 crew.
- **D5 [A] Rolling back loses data.** Reversing `roster/0062_drop_legacy_fees` re-adds empty columns
  (`is_paid=False` everywhere), reversing `finance/0002` does nothing, and re-applying 0062 drops what
  was entered in between. Make 0062 refuse to reverse (a reverse operation that raises with an
  explanation), unless a copy-back is really wanted.
  **Fixed:** the last operation of 0062 raises on reverse while any FEE item exists. An empty
  database reverses freely, and the copy tests need that.
- **D6 [A] The deploy window returns 500s.** The new code stops writing `is_paid`, but the column is
  NOT NULL with no DB default until 0062 runs. Between `make prod` and `make migrate`, adding a cast
  member, creating a project or assigning crew fails. Runbook only: migrate right after the new image
  is up, with no traffic in between.
  **Covered by** `make deploy`, which migrates right after `up`. Deploy at a quiet hour (§6).
- **M1 [V] A declined or removed singer with a fee item blocks closing forever.** `orphaned` is any
  unpaid item whose seat is not billable (`services/budget.py:670`), whatever its price. Closing
  refuses while `orphaned > 0` (`services/plan.py:230`). The only service that removes a fee item is
  `release_crew_assignment` (`services/ledger.py:476`). Nulling or zeroing the price leaves the orphan.
  The only ways out are paying it (which raises `PAID_FOR_DECLINED` and inflates the totals) or
  un-declining the singer. `fold_seat` (`ledger.py:537`) creates the same orphan on an artist merge.
  Fix direction: a "release fee" act for an unpaid, uncontracted orphan, with the same guard and
  soft-delete as the crew release. Depends on **Q1**.
  **Fixed:** `LedgerService.release_orphan`, `POST cost-items/{id}/release/` (manager), and "Usuń
  honorarium z rozliczenia" in the row menu (`canRelease`). It refuses a fee that still counts
  (`fee_not_orphaned`), a paid one and a contracted one. The seat link stays on the soft-deleted
  item.
- **R1 [V] The patron report prints one person's fee through the highlight.** `patron_report`
  (`services/reports.py:250-253`) always prints `covered`, and
  `templates/finance/report_patron.html:35` shows it even when `floored_cost_structure` returned
  nothing. The funding-by-kind table (`services/reports.py:199-216`) has no floor either. Example: a
  sponsor pays only the soloist's 400 zł, and the paper says "Pokryły koszty koncertu w kwocie 400,00
  zł". Spec §10.1: no person and no individual fee ever appears.
- **R2 [V] The patron report can be subtracted.** The floor runs separately on the whole report and on
  the highlight. Example: the whole report merges 3 singers (950) and one sound engineer (800) into
  PERSONNEL 1750, while the highlight keeps PERSONNEL_ARTISTIC 950. 1750 − 950 is the engineer's fee.
  REMAINDER vs VENUE leaks in the same way. Fix direction: the highlight's categories must be a
  coarsening of the whole report's final categories, and any highlight figure made of fewer than
  3 payees merges or disappears, `covered` included. Depends on **Q5**.
  **Fixed (R1 + R2):** one test applies to every printed figure. It passes when it holds no fee,
  the fees of at least 3 people, or some cost that is not pay (`_Part.floored`). A failing row
  merges and is never dropped (`_floor_figures`). The highlight uses the whole report's rows or
  coarser (`_cost_groups`), and each of its rows must pass for its own share and for what the whole
  row holds beyond it. `covered` must pass, and so must its complement to the total. Otherwise the
  highlight prints only "Pokryły część kosztów koncertu." The funding-by-kind table is floored the
  same way, and a failing kind merges into "Pozostałe źródła". Regression tests cover both audit
  examples and the lone soloist.
- **G1 [V] The GDPR data export gives crew fees to whoever holds the matching e-mail.**
  `finance/gdpr.py:24-25` matches crew items by `collaborator.email` alone. `process_email_change`
  (`core/services.py:423-438`) checks only the password and the uniqueness among Users. Crew members
  have no account, so their address is free to take. A chorister who sets a crew member's e-mail on
  their own account receives that person's fees, payment dates and contract numbers. The same happens
  when a manager types a collaborator e-mail that belongs to another user. Depends on **Q4**.
  **Fixed, wider than asked (Q3 + Q4):** the data export carries no finance at all, including the
  person's own fees. `finance/gdpr.py` is gone. The privacy pane says the board provides the
  records on request.

### P2 — correctness, before the first real settlement

- **M2 [V] A source's `kind` can change while it carries charges** (`services/funding.py:262-288`,
  with no `source_accepts` check). If a PUBLIC_GRANT that already carries 5 000 zł of fees is changed
  to VOLUNTEER_WORK, those 5 000 zł count as volunteer work, and `_task_totals` (`services/sources.py:210-221`)
  counts them twice, which hides `OWN_SHARE_BELOW`. Spec 789: a write that leaves a split on the wrong
  kind is refused.
- **M3 [V] The crew release checks before it locks** (`services/ledger.py:487-503`, lock at 502). A
  concurrent `pay()` can land in between, and the paid fee is then soft-deleted. Take the budget lock
  first, then read the items.
- **M4 [V] Repricing a ZLECENIE keeps the old employer contributions** (`services/ledger.py:183-187`).
  If 1000 + 200 is repriced to 2000, the cost becomes 2200, and `EMPLOYER_COST_MISSING` stays silent.
  Clear the contributions when the amount changes and they were not sent. Spec 150–151.
- **M5 [A] A fee's `incurred_on` goes stale when the concert moves** (`services/ledger.py:102-103`,
  refreshed only when the item is written, with no roster hook). If a concert moves across a grant's
  `eligible_to`, `OUTSIDE_ELIGIBILITY` stays silent and settlement marks the fees eligible. Refresh
  the unpaid items of the project on a `date_time` change.
- **E1 [V] An expense's `incurred_on` is set only at creation** (`services/expenses.py:59-61`;
  `update` at 76–115 never re-derives it). The client never sends it (`ExpenseSheet.tsx:110-159`).
  Take the case of an expense booked before its invoice. If the invoice comes dated after
  `eligible_to`, eligibility is still judged on the concert day. Re-derive the date from
  `document_date` on update when it was derived, or expose it in the sheet. Spec §5.4 line 301.
- **R3 [V] Downloads with Polish characters get a broken name.** `FILENAME_PATTERN` in
  `features/finance/api/finance.service.ts:46,68` does not decode RFC 5987 `filename*=utf-8''…`.
  "Łukasz Żółć" is saved as `utf-8Umowa-…%C5%81ukasz….pdf`, and so is every report for "Pochwała
  Stworzenia". Prefer `filename*`, `decodeURIComponent` it, and fall back to `filename`.
- **R4 [V] A document note for a ZLECENIE contradicts itself.** `document_amount` is
  `row.contract_amount` (`services/reports.py:584`), while the source share comes from `cost_amount`,
  which includes employer ZUS. The note then reads "Wydatek w kwocie 1 000,00 zł … sfinansowany w
  kwocie 1 200,00 zł". Cap the note at the document amount, and put the contributions in a note of
  their own (the ZUS declaration is a separate document). Spec §10.4.
- **F1 [V] The Honoraria tab ignores a CLOSED budget.** `ExpensesPage` and `FundingPage` gate on
  `isBudgetWritable`, but `FeesPage.tsx` gates only the funding act. In a closed budget, the rate
  field, the save bar, issue/sign/hours, the details and "Dodaj osobę" stay live, and each answers
  400 `budget_locked`.
- **F2 [V] "Koszt honorariów" shows fees plus expenses.** `ProjectFactsCard.tsx:54` reads
  `summary.committed`, and `summary.fees.committed` is meant.
- **P1 [V] The artist dossier still carries fee totals.** `roster/queries/dossier_queries.py:91-100`
  reads earnings from the ledger into a roster payload. `useArtistDossier`
  (`features/artists/api/artist.queries.ts:40-46`) persists it to the device, and no finance mutation
  invalidates it. The totals also travel as floats. This contradicts spec §7 lines 382–385. Depends on
  **Q3**.
  **Q3 decided:** the totals stay, for admins only, summed from the ledger by artist id and never
  stored on the artist. Still to do: confirm that the dossier endpoint and its query are
  manager-only, `persist: false`, invalidate it after finance writes, and send decimal strings.
- **A2 [P] Editing a crew assignment or a seat can move a settled fee to another person.**
  `CrewAssignmentSerializer` has `fields='__all__'` (`roster/serializers.py:990-1003`), and so do seat
  edits through `update_by_manager`. When `collaborator`/`artist`/`project` is PATCHed, the paid fee
  follows the row, and the next detail edit renames the payee. Refuse the change while the fee is paid
  or contracted (spec §6 374–376), or make those fields read-only on update.
- **F3 [P] A budget write can be overwritten by an older GET** (`finance.queries.ts:130-141`:
  `setQueryData` without `cancelQueries`). A focus refetch in flight lands after the save, and the rows
  show the old prices. Add `cancelQueries` before the write.

### P3 — low; batch them

Money and state:
- **M6** A settled source's figures and dates stay editable, despite the docstring
  (`funding.py:263-264`). Paid expenses under a settled source can still change category and
  `incurred_on` (`expenses.py:98-100`).
- **M7** Closing ignores `EMPLOYER_COST_MISSING` (`plan.py:230`).
- **M8** The SETTLED and kind checks read the source without a lock (`funding.py:101-104, 318-326`).
- **M9** `_pct` has `max_digits=9` and the plan-side own share is unbounded (`serializers.py:27`). A
  1 zł placeholder plan against a large grant makes the payload return 500.
- **M10** Derived amounts are not bounded to the storage width (`rules.py:190,198`).

Reports and documents:
- **R5** The board report's "own" (`committed − charged`, `infrastructure/reports.py:262-263`) and the
  patron's "own" (it adds OWN_FUNDS back) disagree for the same budget.
- **R6** The payee floor counts cost rows, not people (`services/reports.py:129-136`).
- **R7** `bill.html:50` "Źródło finansowania" is always blank. The drafts fill it with the grant note.
- **R8** Volunteer agreement §6 prints the live `in_kind_hourly_rate` (`infrastructure/documents.py:153`),
  and that field is not frozen after issuance (`_FROZEN_PRICING_FIELDS`, `ledger.py:62`).
- **R9** CSV text cells such as `12/2026` or `0012` are coerced by Excel (`ledger_csv.py:72,96`).
- **R10** `_clear_previous_exports` deletes another manager's in-flight ZIP (`tasks.py:73`).
- **R11** The patron report's total is always printed. For a concert whose whole cost is one or two
  fees and nothing else, the total is those fees. This is accepted in `_cost_groups`; decide whether
  such a report should exist at all.

Frontend:
- **F4** `crew_has_settled_fee` has no mapping in `financeErrors.ts`. Crew and participation mutations
  never invalidate `financeKeys.budget`.
- **F5** A keystroke in a standard-rate field drops every draft on that side, including INVOICE rows
  and edits typed after the rate (`useFeeLedger.ts:146-155`).
- **F6** `FeeDetailsSheet.tsx:170-175` resends the `contract_amount` from when the sheet opened, and
  its two-step save is not atomic.
- **F7** "Today" is the device's date, while the server uses Warsaw (`ActSheets.tsx:41`,
  `financePresentation.ts:458`, `ExpenseRow.tsx:89`).
- **F8** `warning_counts` counts codes, not subjects (`views.py:740-743`). 12 unpriced people show as
  "do zrobienia: 1".
- **F9** `FINANCE_STALE_TIME` is set per query (`finance.queries.ts:64`) instead of a `queryPolicy.ts`
  preset (spec §8.4).
- **F10** A new source's detail is stored with `setQueryData` without `persist: false`
  (`finance.queries.ts:304`).

Legacy leftovers:
- **L1** `reset_test_data.py:55` truncates `finance_contractsequence`, which reissues printed contract
  numbers on a live database, and leaves `media/finance/` behind.
- **L2** `notifications/message_content.py:288` still links the performer to `/panel/contracts`, which
  now redirects to a manager-only page. Nothing emits it today.
- **L3** `data_copy.py:50-52`: `paid_on` is taken in the project's timezone, not from `paid_at.date()`
  (spec 542), and `paid_marked_at` stays NULL.
- **L4** Dev database only: fee edits made between `60a59c19` and `3facfbbc` were dropped by 0062.

## 3. Test gaps worth closing with the fixes

- Money: OTHER form cost; repricing a ZLECENIE with stored contributions; the fee correction path
  (unpay, then change); a live contract freezing a one-off payee; a client-sent `cost_amount` being
  refused; the DB constraints hit by a direct save; closing with an orphan and clearing it.
- Access: CREW and anonymous against the finance endpoints; ARTIST against each finance write and
  export; a non-manager DELETE on a crew assignment; the data export with a borrowed e-mail; a PATCH
  of a settled crew assignment or seat; the dossier kept out of the persisted cache.
- Reports: the R1/R2 scenarios as regression tests of `patron_report`.

## 4. Questions for the developer

- **Q1 (M1)** How is an orphaned fee cleared? Recommendation: a "release" act on an unpaid,
  uncontracted orphan that soft-deletes it, as the crew release does. A paid one stays and keeps
  `PAID_FOR_DECLINED`.
- **Q2 (D1, D2, D4)** What happens to legacy data at the copy? Recommendation: import a 0 on the
  creator's seat as no item; skip unpaid fees on cancelled projects (paid ones stay); mark imported
  paid fees and exempt them from `PAID_WITHOUT_DOCUMENT`. Before deciding, count on prod how many rows
  each rule touches: a read-only query, see the hand-off.
- **Q3 (P1)** Should the fee totals stay in the dossier? The spec says finance data is never embedded
  in roster payloads. Recommendation: drop them. If they stay: `persist: false`, invalidate after
  finance writes, decimal strings.
- **Q4 (G1)** Crew members have no account. Recommendation: drop the e-mail match, and have the board
  answer a crew member's access request by hand from the ledger CSV. The alternative is to require
  e-mail verification on change, which touches every account.
- **Q5 (R1, R2)** Does a patron highlight that would fall below the floor print at all?
  Recommendation: it prints only the source's name and "pokryły część kosztów koncertu", without an
  amount.
- **Q6 (R5)** Which definition of "own" is canonical? Recommendation: the patron's (OWN_FUNDS charged
  + uncovered), with the board report's label changed to match.
- **Q7 (E1)** Should the expense date be editable in the sheet, or re-derived from `document_date`
  only? Recommendation: re-derive it while it was derived, and show it read-only.

**Answers, 2026-09-24:** the developer accepted every recommendation (Q1, Q2, Q4, Q5, Q6, Q7).
Q3 went further. No chorister sees any amount of money in the app, anyone's or their own, and only
admins do. The dossier may show admins a chorister's total, summed from the ledger by artist id.
This covers the data export as well, which is why G1 dropped the finance records entirely.

This rule does not remove anything from GDPR. The ledger rows are personal data of the person they
pay, wherever they are stored, and art. 15 covers them. The export leaves them out only because
the board answers an access request by hand, from the ledger CSV, within the month. That is lawful,
but only if somebody actually answers.

## 6. Prod deploy runbook for `finance` (first `make migrate` of the app)

All commands run on the prod server, over ssh, in `~/voctmanager`, in the form the developer
already uses (`docker compose exec web …`).

1. Before pulling, check what the copy will meet (read-only). The first line must still print 0.
   If it does not, a merge ran since 2026-09-24: read D3 before deploying.
   `docker compose exec web python manage.py shell -c "from datetime import timedelta; from roster.models import Participation as P; B=P._base_manager; print('paid on removed seats:', B.filter(is_deleted=True, is_paid=True).count()); [print(s.project.title, '|', s.artist.first_name, s.artist.last_name, '|', 'creator: no item' if abs(s.created_at - s.project.created_at) <= timedelta(seconds=5) else 'VOLUNTEER') for s in B.filter(fee=0).select_related('project', 'artist')]"`
2. Check for old ZIPs: `docker compose exec web ls -la /app/media/exports/`. If any file is there,
   remove it: `docker compose exec web sh -c 'rm -f /app/media/exports/*'`.
3. Take a database backup as `docs/backups.md` describes, and confirm that it finished.
4. At a quiet hour: `git pull`, then `make deploy`. It builds, brings the stack up and migrates
   immediately (D6). The migration runs `finance/0001–0005` and `roster/0062`.
5. Verify: `curl -sI https://voctensemble.com/media/exports/x.zip | head -1` prints 404. On
   `/panel/finance`, the imported paid fees raise no "Wypłacone bez umowy w panelu" warning.

## 5. Checked and clean (reviewer coverage)

- **Money:** no float anywhere, and rounding is half-up per line. `cost_for` matches §5.1 for every
  form. `cost_amount` is written by the server only. 0 ⇔ VOLUNTEER holds in the rules and in the DB.
  Freezes, budget-state guards on every write path, allocation fit, contract numbering under lock and
  PROTECT on every money FK all hold. The warnings match §5.4.
- **Access:** every finance view is `IsManager`, and board acts are `IsBoard`. Nested routes are
  scoped by project. Attachments are type-sniffed, capped, stored under random names and served
  `internal`. Erasure never cascades into finance, and the exemption is commented.
- **Contract:** the DTOs match the serializers field by field. `feeDraft.ts` agrees with
  `reconcile_pricing` in every case enumerated. Client money is in integer grosze. Every error code
  but one is mapped. All finance queries are non-persisted. No finance write can be queued offline.
- **Legacy:** the migration graph forces the copy before the drop, and historical models are used.
  The copy is idempotent. No dangling backend or frontend reference remains, and none of the 163
  removed locale keys is still used. The redirect is sufficient.
- **Documents:** the amount in words is correct for every tested agreement case. The CSV guards
  formula prefixes, with BOM, `;` and decimal comma. The foundation's identity has a single source.
  No `|safe` on user data. The templates match the drafts. The kosztorys totals are consistent.
