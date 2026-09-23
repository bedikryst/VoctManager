# Project finance — budget, settlement and reporting

Status: **Spec written 2026-09-23; the developer answered Q1–Q6 the same day (§2, §4). Stages 1,
1b, 2 and 3 — release R1 — built 2026-09-23 (see "As built" under each in §11). Stages 1 and 1b are
committed; Stage 2 was reviewed in the browser; Stages 2 and 3 are uncommitted. R1 is not deployed
and goes to prod as one release. The printed copies of Stage 1b await the developer's check; Stage 4
is next. Contract wording is drafted in
`project-finance-contract-drafts-2026-09.md` and awaits legal and accounting review. That review
gates the first real use of the new templates, not their build.**
Written from the developer's brief of 2026-09-23 ("as ambitious as possible — this concert is the
first one we settle; the amounts should be what the foundation pays; we will probably settle against
a kosztorys and we are learning, so the app should help; one day a nice PDF for patrons").

The foundation was registered on 2026-04-15. Nobody on the board has settled a grant before, so the
app does not only record the money: its structure (plan lines, funding sources, allocations,
eligibility periods, document notes) mirrors how a Polish grant is settled, and teaches by doing.

---

## 1. What is wrong today (the audit this spec answers)

Fees live on `Participation.fee / is_paid / paid_at` and `CrewAssignment.fee / is_paid / paid_at`
(`backend/roster/models.py`). Three surfaces compute over them, each with its own rules:

| Question | Hub tab `BudgetTab` | `features/contracts` (Centrum Rozliczeń) | `ProjectFactsCard` |
|---|---|---|---|
| Is 0 zł priced? | yes (`money.ts::hasNoFee`) | **no** — `isFeeMissing` treats `<= 0` as unpriced, so a volunteer sits in payables forever and can never be marked settled | n/a |
| Can a paid fee be edited? | no | **yes** (`ContractRow.tsx` input disabled only while saving) | n/a |
| Declined singer counted? | no | no | **yes** — sums every participation |
| Amount field | `type="text"` + sanitiser | **`type="number"`** — `400,50` from a Polish keyboard arrives empty | n/a |
| Write path | generic `PATCH /participations/{id}/` | `PATCH …/fee/` (a bypass for a DRF bug fixed 2026-08-18) | n/a |

And, underneath:

- **Nothing is atomic.** The tab saves as one bulk call plus N parallel PATCHes; "mark all paid" is N
  parallel calls under `allSettled`. A failure mid-way leaves a half-priced or half-paid project.
- **Payment history is deletable.** `CrewAssignment` is a plain `models.Model` (no soft delete), so
  unassigning a crew member hard-deletes their fee and paid state. Nobody is recorded as having
  changed an amount or marked a payment.
- **The server does not guard its own rules.** `_fee_action` has no `is_paid` check; the contract PDF
  renders `fee or 0`, so an unpriced record yields a contract for 0 zł.
- **Money is summed in JS floats**, on the client, over every participation and crew assignment of
  every project (`useContractsData` loads all of them).
- **"Budget" is only personnel fees.** Venue, travel, printing, rights, and every source of money
  (grant, donations, tickets) have no home.
- **One contract for everyone**: `templates/contracts/contract_pdf.html` is an *umowa o dzieło with
  transfer of copyright and 50% KUP*, issued to crew too — a sound engineer, or a company that would
  normally invoice. The model cannot even record that a person settles differently.
- **The contract prints placeholder foundation data**: `ul. Przykładowa 12/3, 00-000 Kraków`,
  `KRS: 0000000000`, `NIP: 000-000-00-00`, "Reprezentowana przez: Zarząd". Every contract generated
  so far names a party that does not exist. It is dated with the generation date rather than the
  signing date. Its GDPR line refers to an information clause that was never attached.

## 2. Decisions taken (2026-09-23)

1. **Scope is B + C**: one money ledger per project (replacing both current surfaces) *and* a real
   budget — plan lines, actual costs beyond fees, funding sources, plan-versus-actual, reports.
2. **Every amount the panel sums is the foundation's cost** — the total that leaves the foundation for
   that item. Not the net the person receives.
3. **Transfers are made by the accounting office.** The panel records that something was paid (and
   when); it does not execute or export bank transfers in this spec (§12, later).
4. **No PESEL, no bank account numbers** — no decision on holding them exists. Consequence below (§9).
5. **0 zł is a conscious, legitimate value** — it means volunteer work.
6. **A payee from outside the panel** (one concert, no roster record) must be addable.
7. **A patron-facing settlement PDF** is wanted.
8. **Grants: the first grantor is not known yet.** Each grant gets its own page. That page is a
   funding source's page (§8.3); the model stays generic until a grantor's form is known.
9. **Contract forms: the agent decides the defaults** (§5.2 table); they are revisable later.
10. **Contract wording is drafted by the agent**
    (`project-finance-contract-drafts-2026-09.md`), then corrected by the lawyer and the office.
11. **The foundation is not a VAT payer.** The first answer ("we are a payer") meant payer in the
    PIT/ZUS sense: the foundation withholds tax and pays contributions. The Ministry of Finance VAT
    white list returns no record for NIP 6762718992 (checked 2026-09-23). An invoice's gross is
    therefore the foundation's cost, and no VAT is modelled (§3).
12. **Approving, reopening and closing a budget is for any board member, and only the board holds
    admin in the app** — so these acts are gated on Django staff (`is_staff`). The same precedent
    exists in `copydesk/permissions.py::user_is_copy_reviewer`.
13. **Contracts are printed; PESEL, address and bank account are handwritten; the paper is signed.**
    Where signed copies are kept is undecided: paper only, Google Workspace or the app. Until it is
    decided, the app records *that* a contract is signed and *where* the copy is, never the scan.

## 3. Decisions against (do not reopen without a new reason)

- **Keeping fees on `Participation`/`CrewAssignment`** and building the budget beside them — a
  one-off payee, a contract form and a document have no home there, and the budget's personnel line
  would be a fourth copy of the same sum.
- **Computing ZUS or PIT in the panel.** The accounting office owns tax arithmetic. Where the
  foundation's cost differs from the contract amount (umowa zlecenie), the office's figure is entered.
- **Per-person figures in any external report.** A patron report is aggregates only (§10.1).
- **Offline writes for finance.** Money needs a server confirmation; finance mutations never go
  through the offline write queue.
- **Categories as an editable model.** A fixed, translated enum; grantor-specific wording lives in
  plan-line names.
- **Auto-creating cost items via signals when someone joins the cast.** Unpriced rows are computed
  from the roster at read time; an item exists once someone prices it.
- **XLSX export.** CSV (UTF-8 with BOM, `;`, decimal comma) opens in Excel and adds no dependency.
  Revisit only if the office asks for real spreadsheets.
- **Storing scans of signed contracts or bills in the app** — they carry a handwritten PESEL. The
  question is open (§4 Q6b), and the resting answer is no.
- **Computing the "net to pay" on a bill.** The bill prints the gross and leaves the tax rows to the
  office — the same line as the ZUS/PIT decision above.
- **Net / VAT / deductibility fields.** The foundation is not registered for VAT (§2.11), so every
  document's gross is its cost, and two extra amounts per row would only give a learner two numbers
  to get wrong. They get added the day the foundation registers. Watch for the trigger: ticket sales
  or sponsorship invoices (a sponsor's logo in return is a taxable service) passing the subjective
  exemption limit, or voluntary registration. The limit is 240 000 zł of taxable sales a year from
  2026 (VAT Act art. 113 ust. 1), counted net of VAT and proportional in the first year of taxable
  sales. Donations and grants do not count towards it.

## 4. Questions — answered and still open

Answered 2026-09-23 (the decisions are in §2):

- **Q1:** the first grantor is unknown; each grant gets its own page.
- **Q2 and Q3:** delegated to the agent; the drafts go to the lawyer and the office.
- **Q4:** the foundation is not a VAT payer (§2.11).
- **Q5:** approval is for any board member, which in the app means `is_staff`.
- **Q6:** contracts are paper, and PESEL is handwritten.
- **Q7:** the representative printed on documents is Florentyn de Bazelaire de Boucheporn, Prezes
  Zarządu; his other given names are omitted. The KRS board, checked 2026-09-23 and in office since
  2026-04-27: Florentyn Józef Maria Eliasz De Bazelaire De Boucheporn (Prezes), Anna Elżbieta
  Marcisz (Wiceprezes), Krystian Kamil Bugalski (Wiceprezes). Under statute §13.2 each of the three
  signs alone (§5.5).
- **Q8:** the GDPR contact is `rodo@voctfoundation.com`. The domain's MX is Google Workspace; the
  mailbox or alias has to exist and be read, which is a board task. `privacy_contact` stays
  mandatory: a template refuses to render without it.

Still open:

| # | Question | Who answers | Gates |
|---|---|---|---|
| Q1 | Which grant programme comes first? | board | The kosztorys export's column set (Stage 6). The model does not wait. |
| Q6b | Where signed copies live: paper only, Google Workspace or the app. | board (RODO) | Fee attachments stay off. `Contract.signed_copy_location` (free text) covers paper and Drive. The app option would reopen §3. |
| — | Legal and accounting review of the contract drafts, including their "Do weryfikacji" questions (qualification of dzieło for choristers, 50% KUP, non-resident performers, minors, RUD, volunteer insurance). | lawyer, office | **Real use** of the new templates, not their build. |

---

## 5. Domain model — new backend app `finance`

`payments` stays what it is (the online donation gateway). All models below inherit
`core.models.EnterpriseBaseModel` (UUID pk, `created_at`, `updated_at`, soft delete) unless stated.
Amounts are `DecimalField(max_digits=10, decimal_places=2)`, PLN only.

### 5.1 Money rules — the single source of truth, enforced server-side

- **Priced** = `contract_amount` is not null. Null is "no decision yet"; 0 is a decision.
- **0 ⇔ volunteer.** `form == VOLUNTEER` ⇔ `contract_amount == 0`, enforced both ways by the service
  (typing 0 sets the form; choosing VOLUNTEER sets 0). There is no ambiguous "zero but a contract".
- **Cost** (`cost_amount`, stored, maintained by the service, never written by a client):
  - `DZIELO`, `INVOICE`, `OTHER` → `cost_amount = contract_amount` (for an invoice, its gross)
  - `ZLECENIE` → `contract_amount + employer_contributions`; while the office has not supplied
    contributions the item counts at `contract_amount` and raises `EMPLOYER_COST_MISSING`
  - `VOLUNTEER` → 0. `in_kind_hours × in_kind_hourly_rate` = `in_kind_value`, the valuation of the
    work for a grant's "wkład osobowy". It is never a cost.
  - EXPENSE → `cost_amount` is the document's gross, entered directly. The foundation cannot recover
    VAT (§2.11), so VAT is part of the cost, and grant kosztorys figures are gross.
- **Billable** = a cast seat that is not `DECLINED` and not soft-deleted; any crew assignment; any
  one-off item. An unpaid item whose seat stops being billable is **orphaned**: excluded from totals,
  listed as work. A **paid** item stays counted whatever happens to the seat.
- **A paid item is immutable.** Amount, form and payee reject writes (400). Correction = `unpay` with a
  reason, then edit.
- **An issued contract freezes its amount and payee.** Change = annul (reason) and issue a new one.
- **Every sum is computed on the server in `Decimal`.** The client sums only the live draft preview,
  and does it in integer grosze (§8.4).

### 5.2 Models

**`ProjectBudget`** — one per project, created lazily by `BudgetService.get_or_create(project)`.
- `project` (OneToOne, `PROTECT`)
- `status`: `PLANNING → APPROVED → CLOSED`. `APPROVED → PLANNING` ("korekta kosztorysu") and
  `CLOSED → APPROVED` (reopen) are allowed, each with a mandatory reason, each logged.
  PLANNING: plan editable. APPROVED: plan locked, actuals recorded. CLOSED: everything locked.
- `approved_at/by`, `closed_at/by`, `internal_note`, `patron_summary` (2–3 sentences the manager writes
  for the patron report).
- A **cancelled** project keeps its budget: cancellation has costs (deposits). Unlike today's
  contracts workspace, `CANC` is never filtered out of finance.

**`CostItem`** — one row per actual cost, fees and expenses alike (one table, so every total is one
aggregate). `kind`: `FEE | EXPENSE`.
- common: `budget` FK, `budget_line` FK (nullable → "outside the plan", Stage 4), `category`
  (§5.3), `cost_amount`, `incurred_on` (date the cost arises — the concert date for fees; drives grant
  eligibility), `due_on` (nullable), `paid_on` (nullable date — the office's payment date) +
  `paid_marked_by/at`, `note`.
- FEE only:
  - source: `participation` FK (nullable, `PROTECT`) **or** `crew_assignment` FK (nullable,
    `PROTECT`) **or** neither (one-off payee). A DB check constraint allows at most one.
  - `payee_name`, `payee_role` — snapshots. Refreshed from the source on every save while no contract
    is active; frozen from issuance. A one-off payee's are typed by hand.
  - `form`: `DZIELO | ZLECENIE | INVOICE | VOLUNTEER | OTHER`. The default comes from one pure
    function, `default_form_for(source)`, so revising it is a one-table change:

    | Source | Default | Reason |
    |---|---|---|
    | any cast seat (singer or player) | `DZIELO` | Artistic performance of a named programme: a result, with related rights to transfer. The 50% KUP question stays with the office. |
    | collaborator with `company_name` | `INVOICE` | A business invoices; a contract of ours would be wrong. |
    | collaborator `INSTRUMENT`, `VISUALS` | `DZIELO` | A performance or a work (a photograph, a projection design). |
    | collaborator `SOUND`, `LIGHT`, `LOGISTICS`, `OTHER` | `ZLECENIE` | A service performed with due care, not a verifiable result. A dzieło here is what ZUS reclassifies with contributions due retroactively, and 50% KUP has no basis for a technician. |
    | one-off payee | chosen when created | — |

  - `contract_amount` (nullable = unpriced), `employer_contributions` (ZLECENIE only),
    `in_kind_hours` and `in_kind_hourly_rate` (VOLUNTEER only).
  - For `INVOICE`: `document_number`, `document_date` (the vendor's invoice), `vendor_nip`
    optional. `contract_amount` holds the invoice's gross, so "priced" means the same thing for
    every form.
- EXPENSE only: `vendor_name`, `vendor_nip` (optional), `document_type` (`INVOICE | BILL | RECEIPT |
  OTHER`), `document_number`, `document_date`, `description`.
- Validation lives in the service (`clean` duplicates the invariants for the admin), not in the
  serializer.

**`Contract`** — a document the foundation issues for a FEE item: `DZIELO` (umowa o dzieło),
`ZLECENIE` (umowa zlecenia) or `VOLUNTEER` (porozumienie wolontariackie). `INVOICE` and `OTHER` have
no document of ours.
- `cost_item` FK, `number` (unique), `form`, `amount` (snapshot; 0 for a volunteer), `payee_name`
  (snapshot), `issued_at/by`, `status`: `ISSUED | SIGNED | ANNULLED`, `signed_on` (date written on
  the paper), `signed_copy_location` (free text — "segregator 2026", a Drive link; never a file,
  §2.13), `hours_confirmed` (ZLECENIE: from the signed hours confirmation, entered before payment),
  `annulled_at/by`, `annul_reason`.
- At most one non-annulled contract per item (partial unique constraint).
- Numbering: `ContractSequence(year, form)` row read with `select_for_update()` inside the issuing
  transaction. Format `UoD/{n}/{yyyy}`, `UZ/{n}/{yyyy}`, `W/{n}/{yyyy}`. It is one constant: the
  office may have its own scheme, and adopting it is a one-line change.
- The PDF is rendered from the contract row with its annexes (§9), so it prints its number and the
  frozen amount. A contract for an unpriced item cannot exist: it has no row.

**Volunteer insurance.** When a VOLUNTEER contract's period (first rehearsal → concert) is 30 days or
shorter, the foundation must insure the volunteer against accidents (art. 46 of the Public Benefit
and Volunteer Work Act — confirm with the office). The app states this as a warning (§5.4); it does
not buy insurance.

**`FundingSource`** — organisation-level: one grant may fund several projects (Stage 5).
- `kind`: `PUBLIC_GRANT | PRIVATE_GRANT | SPONSOR | DONATIONS | TICKETS | OWN_FUNDS | IN_KIND |
  VOLUNTEER_WORK` (the last two are non-cash contributions — "wkład rzeczowy / osobowy").
- `name`, `grantor`, `agreement_number`, `agreement_date`, `awarded_amount` (nullable until awarded),
  `status`: `PLANNED | APPLIED | AWARDED | REJECTED | SETTLED`.
- Grant rules, all optional: `eligible_from/eligible_to` (costs outside are ineligible),
  `report_due_on`, `required_own_share_pct`, `admin_cost_cap_pct`, `line_tolerance_pct`
  (allowed overrun per kosztorys line without an annex).
- `document_note_template` — the formula the grantor prescribes for describing accounting documents,
  with placeholders (§10.4); a default is provided.

**`ProjectFunding`** — `budget` × `source`: `planned_amount`, `received_amount` (money that actually
arrived: tranche, ticket revenue, collected donations).

**`LineAllocation`** (plan) — `budget_line` × `project_funding` → `amount`.
**`CostAllocation`** (actual) — `cost_item` × `project_funding` → `amount`.
Validation: allocations on one item/line never exceed its amount; the unallocated remainder is
reported as "own funds / unfunded", never silently assigned.

**`BudgetLine`** (plan, Stage 4) — `budget`, `category`, `name` ("Honoraria chórzystów", "Wynajem
kościoła"), `position`, `unit` (`PERSON | PIECE | SERVICE | HOUR | DAY | NIGHT | KM | LUMP_SUM`),
`quantity` (8,2), `unit_cost`, `note`. `planned_amount = quantity × unit_cost`, computed. Its
kosztorys number ("I.3") is derived from category order and position, never stored.

**`FinanceAttachment`** (Stage 4) — a file on a `CostItem` or a `Contract`. Stored under
`MEDIA_ROOT/finance/%Y/`, which **must** be added to the `internal` list in both
`infra/nginx/local.conf` and `infra/nginx/prod.conf` (beside `documents/`); downloaded only through a
manager-only view modelled on `documents/views.py::DocumentDownloadView`.

**`FinanceEvent`** — append-only audit log (plain model, no soft delete): `budget`, `actor`, `at`,
`subject_type`, `subject_id`, `action` (`PRICED`, `FORM_CHANGED`, `PAID`, `UNPAID`,
`CONTRACT_ISSUED`, `CONTRACT_ANNULLED`, `BUDGET_APPROVED`, `BUDGET_REOPENED`, `BUDGET_CLOSED`,
`PLAN_CHANGED`, `ALLOCATION_CHANGED`…), `before`/`after` JSON, `reason`. Written by services only.

### 5.3 Cost categories (enum `CostCategory`)

`PERSONNEL_ARTISTIC` (singers, soloists, conductor, instrumentalists) · `PERSONNEL_TECHNICAL`
(production and technical crew) · `VENUE` · `TRAVEL` · `ACCOMMODATION` · `CATERING` · `MATERIALS`
(score hire, ZAiKS and other rights) · `EQUIPMENT` (instrument hire, tuning) · `PROMOTION` (print,
promotion) · `RECORDING` · `ADMINISTRATION` (accounting, coordination) · `OTHER`.

FEE items take their category from their source: cast → `PERSONNEL_ARTISTIC`; crew →
`PERSONNEL_TECHNICAL` except `Collaborator.Specialty.INSTRUMENT` → `PERSONNEL_ARTISTIC`; a one-off
payee states which side it is on. In a public-benefit kosztorys, `ADMINISTRATION` maps to
"II. Koszty administracyjne" and everything else to "I. Koszty realizacji działań" — derived.

New enum → register in the enum dictionary and bump `DICTIONARY_VERSION` (see memory
`reference_enum_dictionary_cache`).

### 5.4 Warnings — computed by the server, rendered by the client

The budget payload carries `warnings: [{code, severity, subject_ids, params}]`. The client owns the
words (i18n keys `finance.warnings.<code>`). Severity follows the design canon: **`work`** (gold) is
ordinary unfinished business; **`problem`** (crimson) is reserved for something actually wrong.

| Code | Severity | Condition |
|---|---|---|
| `UNPRICED` | work | billable person with no priced item |
| `ORPHANED_FEE` | work | unpaid item whose seat is no longer billable |
| `EMPLOYER_COST_MISSING` | work | ZLECENIE without contributions |
| `HOURS_MISSING` | work | ZLECENIE contract with no `hours_confirmed` once the concert has passed |
| `BELOW_MINIMUM_HOURLY_RATE` | problem | ZLECENIE `contract_amount / hours_confirmed` below the statutory minimum hourly rate — a per-year table in code, entered from the regulation at implementation time and checked by the office |
| `VOLUNTEER_INSURANCE` | work | a VOLUNTEER contract whose period is ≤ 30 days (NNW insurance is the foundation's duty) |
| `NOT_SIGNED` | work | issued contract not marked signed once the concert has passed |
| `DOCUMENT_MISSING` | work | priced DZIELO without a contract, or INVOICE without a document number, once the concert is ≤ 7 days away |
| `PAID_WITHOUT_DOCUMENT` | work | paid DZIELO/ZLECENIE item with no issued contract (paper contracts happen; say it, do not block it) |
| `PAYMENT_OVERDUE` | work | `due_on` passed, unpaid |
| `COST_OUTSIDE_PLAN` | work | actual cost with no plan line, once the budget has lines |
| `LINE_OVER_PLAN` | work | line actual > planned × (1 + tolerance of its charged sources) |
| `REPORT_DUE_SOON` | work | a funding source's report is due within 14 days |
| `PAID_FOR_DECLINED` | problem | paid item whose singer declined |
| `SOURCE_OVERALLOCATED` | problem | allocations exceed a source's awarded or planned amount |
| `OUTSIDE_ELIGIBILITY` | problem | cost charged to a source outside its eligibility period |
| `OWN_SHARE_BELOW` | problem | required own contribution not met |
| `ADMIN_CAP_EXCEEDED` | problem | admin costs above the source's cap |

Time-relative warnings are computed at request time on the server, so they never go stale on a
client that stays open.

### 5.5 Foundation identity — one source for every document

`backend/finance/foundation.py` holds the frozen `FOUNDATION` record: legal name, seat address, KRS
0001237252, NIP 6762718992, REGON 544621525, `representatives`, `privacy_contact` (Q8).

`representatives` is ordered, and every entry can sign alone (statute §13.2a):

1. Florentyn de Bazelaire de Boucheporn — Prezes Zarządu
2. Anna Marcisz — Wiceprezes Zarządu
3. Krystian Bugalski — Wiceprezes Zarządu

Each entry also carries an optional `user_email`.

- **A document prints the first representative who is not its own payee.** Florentyn is also the
  conductor. A contract paying him, signed by him on the foundation's side, is the conflict of
  interest statute §8.5 tells a board member to stand aside from. The payee is matched to a
  representative by `user_email` when the payee has an account, otherwise by the diacritic-folded
  full name (`shared` fold rules, ported).
- **The name is printed in the nominative after a colon** — "reprezentowana przez: Florentyn de
  Bazelaire de Boucheporn – Prezes Zarządu". This is the usual contract form, and it keeps a name
  out of a slot that Polish grammar would inflect (memory `reference_polish_interpolation_dates`).

Every
PDF — contracts, bills, reports and document notes — reads it through one context helper, as fonts
come through `_brand_font_context()`. It is code, not a model: it changes when the KRS entry changes,
and that change deserves a commit. The placeholder block in today's template (§1) is exactly what
this replaces.

---

## 6. API (follow `roster/dtos.py` — `EnterpriseBaseDTO` + `client_payload`)

Base `/api/finance/`. Everything is `IsManager`, except the acts that change a settled fact or the
budget's standing. Those take a new `core.permissions.IsBoard` (`is_staff`, §2.12):

- budget `approve` / `reopen` / `close`
- `unpay`
- contract `annul`
- plan edits in an `APPROVED` budget (the "korekta" path)

The auth profile payload gains `can_approve_finance`, sent as the **effective** answer (same pattern
as `can_edit_site_copy` in `shared/auth/auth.types.ts`), so the client can state why a control is
absent rather than letting it fail with a 403.

| Method & path | Purpose |
|---|---|
| `GET projects/{project_id}/budget/` | The whole budget in one payload: status, summary, warnings, ledger (cast/crew/one-off rows **including computed unpriced rows**), expenses, lines, fundings, allocations. |
| `PATCH projects/{project_id}/fees/` | **One atomic batch**: `{standard_rate?: {cast?, crew?}, items: [{ref, contract_amount, form, employer_contributions?, in_kind_hours?, in_kind_hourly_rate?}]}`. `ref` is `{participation}`, `{crew_assignment}` or `{cost_item}`. Standard rate applies first, then the items, in one transaction; returns the fresh ledger. Standard rate skips paid, contracted, VOLUNTEER and INVOICE rows. |
| `POST projects/{project_id}/fees/one-off/` | Create a one-off payee item. |
| `POST projects/{project_id}/fees/pay/` | Atomic batch `{ids, paid_on}`; refuses unpriced, volunteer and already-paid items as a whole (400 lists them). |
| `POST cost-items/{id}/unpay/` | `{reason}` (board). |
| `POST cost-items/{id}/contract/` | Issue (DZIELO, ZLECENIE, VOLUNTEER). `POST contracts/{id}/sign/` `{signed_on, signed_copy_location}`. `POST contracts/{id}/hours/` `{hours_confirmed}`. `POST contracts/{id}/annul/` `{reason}` (board). `GET contracts/{id}/pdf/` — the contract with its annexes. `GET contracts/{id}/bill.pdf` — the bill (DZIELO, ZLECENIE). |
| `POST projects/{project_id}/contracts/zip/` · `GET contracts/zip/{task_id}/` · `GET contracts/zip/{task_id}/file/` | Moved from `roster/views.py` (`request_project_zip`, `check_zip_status`); packs issued contracts only. The archive is streamed by the third, manager-only view — never a public media URL. |
| `projects/{project_id}/expenses/` CRUD | Stage 4. |
| `projects/{project_id}/lines/` CRUD + `reorder` | Stage 4. |
| `POST projects/{project_id}/budget/{approve,reopen,close}/` | Stage 4; reopen needs a reason. |
| `attachments/` upload · `attachments/{id}/` download | Stage 4. |
| `funding-sources/` CRUD · `projects/{project_id}/fundings/` CRUD | Stage 5; allocations are written with their line or item. |
| `GET overview/` | Portfolio: per-project rollups (server-aggregated), payables (paginated), sources with utilisation, upcoming deadlines. |
| `GET projects/{project_id}/export/{kosztorys-plan,kosztorys-actual,ledger}.csv` | Stage 6 (ledger CSV ships in Stage 2 as the accountant export). |
| `GET projects/{project_id}/report.pdf?audience=patron\|board[&source=]` | Stage 6. |
| `GET projects/{project_id}/document-notes.pdf[?source=]` | Stage 6. |

Retired in Stage 3: `participations/{id}/{fee,payment,contract}/`, `participations/bulk-fee/`,
`participations/request_project_zip/`, `participations/check_zip_status/`, and the crew equivalents.

`Participation` removal is a soft delete (its item becomes orphaned). **`CrewAssignment` removal goes
through a service guard**: unpaid, uncontracted items are deleted with it; a paid or contracted item
makes the removal fail with `409 {code: "crew_has_settled_fee"}` — annul or unpay first.

---

## 7. Privacy, retention, security

- Finance payloads are manager-only and never embedded in roster, schedule, dashboard or
  artist-preview payloads. Extend `core/test_artist_preview.py` to assert it.
- Finance queries set `meta: { persist: false }` (the opt-out in `frontend/src/main.tsx`): names and
  fees do not rest in a device's persisted query cache.
- Cost items, contracts and attachments are **accounting records**: retained 5 years from the end of
  the financial year (art. 74 of the Accounting Act); erasure does not remove them
  (GDPR art. 17(3)(b)). `UserIdentityService.process_account_soft_deletion` gets an explicit,
  commented exemption — the memory `reference_erasure_never_cascades` warns that silence there is
  read as a bug — and `generate_gdpr_export` gains the person's own items and contracts (right of
  access). The retention purge is Stage 7.
- The foundation's register of processing activities needs an entry for fee settlement. That is a
  board task, not code.

## 8. Frontend

### 8.1 Placement (FSD)

New feature `frontend/src/features/finance/`: `api/` (`finance.service.ts`, `finance.queries.ts`,
query keys), `types/finance.dto.ts`, `lib/` (`money.ts` moved from `features/projects/lib/`,
`financePresentation.ts` — the vocabulary for categories, forms, warnings and states), `components/`,
`budget/` (hub sub-tabs), `overview/` (global page). `features/contracts/` is deleted in Stage 2;
`projects/editors/tabs/BudgetTab.tsx`, `useBudgetTab.ts`, `FeeRow.tsx` and `StandardRateField.tsx`
move into `finance/budget/` and are rebuilt there.

### 8.2 Project hub — `/panel/projects/:id/budget/*`

The tab keeps its name, **Budżet** — now it is one. Its body gets a routed sub-navigation (the
`ArchiveTabs` recipe: `NavLink`s, not `SegmentedTabs`). A sub-tab appears in the stage that builds it
— there are never placeholder tabs.

| Sub-route | Name | Stage | Job |
|---|---|---|---|
| `budget` | Przegląd | 2 (grows in 4–6) | Headline cost; rail: Plan (once lines exist) · Koszt · Zapłacone · Do zapłaty; warnings as the work list, each linking to its row; budget status and transitions; exports and reports; history (`FinanceEvent`). |
| `budget/people` | Honoraria | 2 | The ledger. |
| `budget/plan` | Kosztorys | 4 | Plan lines by category; quantity × unit cost; per-source allocations (Stage 5); "fill honoraria from the cast" helper proposes a line (billable count × standard rate), never writes one silently. |
| `budget/costs` | Wydatki | 4 | Non-fee costs: document, vendor, line, allocations, attachment, paid. |
| `budget/funding` | Finansowanie | 5 | Sources on this project; planned vs received; coverage; grant rules as warnings. |

**Honoraria** keeps what the 2026-07 remediation got right (summary rail, a column of figures,
`StandardRateField` feeding a draft, `EditorActionBar` owning the commit) and adds:
- a third ledger, **Spoza obsady** (one-off payees), with "Dodaj osobę" opening a small form (name,
  role, side, form, amount). A one-off payee is purely financial: someone who performs belongs in the
  cast or crew so the call sheet knows them, and their row then comes from there.
- per row: form, document state, paid state. **The resting default says nothing**: the form that
  `default_form_for` would pick shows no chip; a form that differs from it does. A contract shows its
  number as a caption once issued, and "podpisana" once signed. Paid shows the sage tick and date.
  "Unpaid" and "unsigned" are silent until the concert date passes, then they are gold work (the
  clock comes from `shared/lib/dom/useNow`).
- board-only acts (unpay, annul) are absent for a non-board manager, and the row says why in one
  caption. They are never live buttons that answer 403.
- **amounts and forms are drafts** (one atomic `PATCH fees/`); **issuing a contract and marking paid
  are acts** — immediate, per row or via selection + `BulkActionBar`, disabled with a stated reason
  while that row has a pending draft. Mark-paid asks for the payment date (default today).
- the amount field stays `type="text"` + `inputMode="decimal"` + `sanitizeAmountInput`.

### 8.3 Global — `/panel/finance` (replaces `/panel/contracts`; the old path redirects)

- **Projekty** — one row per project: cost, paid, outstanding, warning count, budget status; opens
  the project's budget. No per-project ledger here any more: that lives only in the hub.
- **Do zapłaty** — payables across projects (server-paginated), with due dates; "Eksport dla biura"
  (ledger CSV for a date range).
- **Źródła finansowania** (Stage 5) — sources with awarded / allocated / charged / remaining and
  report deadlines; a source's page lists every cost charged to it across projects, because a grant
  is settled per agreement, not per concert.

### 8.4 Client rules

- The client never sums persisted money; it renders server totals. The draft preview sums in integer
  grosze (`money.ts` gains `toGrosze`/`fromGrosze`; float addition is not used on money anywhere).
- Amounts are always formatted `pl-PL` whatever the interface language (the `money.ts` rule —
  `ProjectFactsCard` currently breaks it and moves to the server summary in Stage 2).
- Finance queries: `meta: { persist: false }`; freshness from `shared/api/queryPolicy.ts`; every
  finance mutation invalidates the project budget and `overview`.
- Offline: finance writes are never queued. While offline the save bar and acts are disabled with a
  sentence saying why.
- New strings: `finance.*` keys in all three locales.

## 9. Documents and what the panel does not hold

The wording is in `project-finance-contract-drafts-2026-09.md` (Polish; drafted by the agent,
awaiting the lawyer and the office). The templates are built from it in Stage 1b, and a correction
lands in the drafts file first, then in the template.

| Template (`backend/templates/finance/`) | For | Annexes |
|---|---|---|
| `contract_dzielo.html` (replaces `contracts/contract_pdf.html`) | DZIELO | 1: concert programme from `ProgramItem`s · 2: GDPR clause |
| `contract_zlecenie.html` | ZLECENIE | 1: contractor's declaration for ZUS/PIT · 2: hours confirmation · 3: GDPR clause |
| `agreement_volunteer.html` | VOLUNTEER | 1: health and safety risk notice · 2: volunteer hours card · 3: GDPR clause |
| `bill.html` | DZIELO, ZLECENIE | — (tax rows left for the office) |

Rules for all of them:

- **Paper is the medium.** The app prints name, number, subject, programme and amount. PESEL,
  address and bank account are dotted lines filled by hand; the app never asks for them (§2.4).
- **The date line is for the signing date**, left blank. The issue date is printed small as
  "wystawiono".
- **The amount is printed in words** as well as figures (`kwota słownie`): a pure
  `amount_to_words_pl(Decimal)` in `finance/infrastructure/`, covering złote and grosze, with tests
  for 0, 1, 2–4 / 5+ inflection, teens, round hundreds and thousands.
- Parties, KRS, NIP, REGON and representation come from `FOUNDATION` (§5.5). A template renders
  nothing without `privacy_contact`: a GDPR clause with no contact is not a clause.
- The print canon applies (`.ai/04_design_system.md` § Print artifacts). These are legal documents:
  the masthead stays sober, and there is no QR.
- Polish only, deliberately not gettext'd — the reasoning in the `generate_participation_contract_pdf`
  docstring stands.

Still true:

- **No scans in the app** (§2.13). Signing is recorded as a date and a free-text location.
  Attachments on **expense** items (a vendor's invoice, company NIP) ship in Stage 4; attachments on
  fee items do not exist until Q6b is decided.
- `INVOICE` has no document of ours; the vendor's number and date are recorded instead.
- **ZUS RUD** (a dzieło reported within 7 days of signing): tracked as a flag only if the office
  wants it (Stage 7).

## 10. Reports (Stage 6; all follow the print canon in `.ai/04_design_system.md` § Print artifacts)

1. **Patron report** (`audience=patron`, optionally `source=` to highlight what that patron's money
   covered). Project, date, venue, the manager's `patron_summary`, total cost, cost structure by
   category, funding structure by kind. **No person and no individual fee ever appears.** Floor: any
   figure derived from fees must aggregate at least **3 payees**; smaller personnel categories merge
   into "Honoraria i obsługa", and if all personnel together number fewer than 3, personnel appears
   only inside the total. Printed as "wersja robocza" in the masthead unless the budget is `CLOSED`.
   Polish only in v1, like the contract.
2. **Board report** (`audience=board`) — internal and complete: plan vs actual per line, deviations,
   funding and allocations, per-person fees, open warnings, open payables.
3. **Kosztorys CSV** (plan and actual variants) in the public-benefit layout: Lp. · Rodzaj kosztu ·
   Liczba jednostek · Koszt jednostkowy · Rodzaj miary · Wartość · z dotacji · z innych środków
   finansowych · z wkładu osobowego · z wkładu rzeczowego. Grant generators (Witkac, eNGO) are
   usually typed into by hand; the CSV is the sheet you type from. Final column set follows Q1.
4. **Document notes** — for each cost charged to a grant, the text written on the back of the
   document ("Wydatek w kwocie … sfinansowano ze środków … w kwocie …, zgodnie z umową nr … z dnia …,
   pozycja kosztorysu …"). Rendered from the source's `document_note_template`, printable as a sheet
   of blocks to cut or copy. Polish only.
5. **Ledger CSV for the office** — every cost item: payee/vendor, form, contract or document number,
   dates, amount, paid date, allocations. `;`, decimal comma, UTF-8 BOM (the `contractsCsv.ts`
   conventions, moved server-side).

---

## 11. Stages

Each stage starts in a fresh session from this file, ends with the verification in `AGENTS.md`
(ruff + mypy + the `finance` tests; `npm run typecheck` + `npm run build` for the frontend), and with
the developer's review in the browser before the next one begins. **Release R1 = Stages 1, 1b, 2
and 3 deployed together**; prod gets no deploy between them. Stages 4, 5 and 6 are each additive and deployable on
their own. Every deploy that touches models needs `make migrate` on prod.

### Stage 1 — Ledger backend

- `backend/finance/`: `apps.py`, `models.py` (`ProjectBudget`, `CostItem` with FEE fields,
  `Contract`, `ContractSequence`, `FinanceEvent`), `services/` (`budget.py` summary + warnings,
  `ledger.py` batch pricing + standard rate + one-off + pay/unpay, `contracts.py` issue/annul/number),
  `dtos.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `tasks.py` (ZIP task moved from
  roster), `tests/`. Contracts are complete as data in this stage: issue, sign, hours, annul,
  numbering. Their PDFs come in Stage 1b.
- `core.permissions.IsBoard` and the `can_approve_finance` capability in the auth profile payload.
- `default_form_for(source)` with the §5.2 table, and the cost rule of §5.1.
- Migrations: `finance/0001` schema; `finance/0002` data copy: every participation/crew assignment
  with a fee or `is_paid` → a FEE item (`form = VOLUNTEER` when fee is 0, else `DZIELO`;
  `paid_on = paid_at.date()`, falling back to `updated_at` when `is_paid` has no timestamp), and a
  `ProjectBudget` per touched project. The copy function lives in a module and is unit-tested.
- Register the app in `config/settings.py` and the URLs in `config/urls.py`. Add the `CrewAssignment`
  deletion guard (§6). Roster fields and endpoints stay untouched in this stage.
- Tests: the §5.1 invariants, standard-rate skip rules, batch atomicity (one bad row rolls back all),
  pay/unpay/annul logging, numbering sequence, the copy migration, the crew deletion guard, Decimal
  summary arithmetic, each warning code, artist-preview leak.

**As built (2026-09-23)** — where Stage 1 differs from the text above:

- **The ZIP task and its two endpoints move to Stage 1b.** They pack issued contracts' PDFs, which
  only exist once Stage 1b renders them from the contract row; the legacy renderer prints the
  placeholder foundation and the roster fee, not the frozen amount. The roster's ZIP endpoints stay.
- **Added beyond the list:** `PATCH cost-items/{id}/` (due date, note, the vendor's document, a
  one-off payee's name and side — without it `DOCUMENT_MISSING` for an invoice could never clear)
  and `GET overview/` (per-project rollups + paginated payables, `?limit=&offset=`), so Stage 2 is
  frontend only. The ledger CSV stays Stage 2 as tagged in §6.
- **Payload:** every write answers with the whole budget (`ProjectMoneySerializer`). A ledger row's
  `key` is the id the client sends back as its `ref` (seat, crew assignment, or cost item for a
  one-off); `origin` is `cast | crew | one_off`; warnings name rows by `key`. `expenses`, `lines`,
  `fundings` and `allocations` are absent until their stages. Errors use the standard envelope
  (`error_code`, not `code`) plus `params` (`index`/`ref` of a refused batch row, `refused` ids).
- **Rules the text left open:** when both form and amount change, whichever changed decides (typing 0
  wins; leaving VOLUNTEER drops 0 to unpriced) — `finance/rules.py::reconcile_pricing`. A paid item
  still takes employer contributions. `DOCUMENT_MISSING` covers ZLECENIE as well as DZIELO. The
  minimum hourly rate table holds 2025–2026. Stage 4–5 warning codes are not computed yet.
- **Copy migration:** a crew assignment marked paid without `paid_at` falls back to the concert date
  (it has no `updated_at`); a paid flag on no fee or 0 zł is copied unpaid, kept in the `IMPORTED`
  event. The admin is read-only for every finance model; the database carries the invariants as
  check constraints. `reset_test_data` wipes `finance` with `roster`; `seed_db` clears it.
- **Not done:** no backend `.po` entries for the new English msgids (admin labels read English); the
  enum-dictionary registration and `DICTIONARY_VERSION` bump are frontend and belong to Stage 2.

### Stage 1b — Documents

- `finance/foundation.py` (§5.5); `finance/infrastructure/documents.py` (render helpers,
  `amount_to_words_pl`), with the generators moved out of
  `roster/infrastructure/document_generator.py`; the four templates of §9 built from the drafts file,
  under the print canon; the `pdf` and `bill.pdf` endpoints and the ZIP task wired to them; the old
  `templates/contracts/contract_pdf.html` deleted.
- Tests: words-for-amounts, each template renders with the minimum context, a missing
  `privacy_contact` refuses to render, the programme annex lists the project's items in order.
- The developer checks one printed copy of each document before Stage 2.

**As built (2026-09-23)** — where Stage 1b differs from the text above:

- **Layout:** `finance/foundation.py`; `finance/infrastructure/amount_words.py`
  (`amount_to_words_pl`, `format_amount_pl`) beside `documents.py`, which renders the four
  documents from the `Contract` row (`render_contract_html/pdf`, `render_bill_html/pdf`);
  `finance/tasks.py` holds the ZIP task. The templates share partials in `templates/finance/`
  (`_styles`, `_masthead`, `_parties`, `_signatures`, `_annex_head`, `_exploitation_fields`,
  `_gdpr_clause`). The contract generators are gone from `roster/infrastructure/document_generator.py`;
  its `_render_pdf` and `_brand_font_context()` stay there and are shared.
- **Payee matching (§5.5):** a representative carries `aliases` besides `user_email`. The conductor
  is "Florent de Bazelaire" in the roster and on the site, and no email is known, so without an
  alias the rule would have missed exactly the case it exists for. Matching errs toward standing
  aside: an email match or a name match (every word of the shorter name, at least two, found in the
  longer; diacritics folded by `roster.duplicates.fold`) is enough. `user_email` is empty for all
  three until the board supplies the account emails.
- **Legacy roster doors:** `participations|crew-assignments/{id}/contract/` now print the record's
  live finance contract and answer 409 `contract_not_issued` without one; `request_project_zip`
  runs the finance task and `check_zip_status` points `file_url` at the finance file view. Both
  still go in Stage 3.
- **The ZIP is private.** The roster task saved it at `/media/exports/Contracts_Project_<title>.zip`,
  public and guessable. The finance task writes `MEDIA_ROOT/finance/exports/<project>/<task>.zip`
  (one per project, replaced on each request), and `/media/finance/` is now `internal` in both nginx
  confs — the entry Stage 4 needed for attachments.
- **Refusals:** an annulled contract is not printed again (`contract_annulled`); a volunteer
  agreement has no bill (`bill_not_applicable`); a missing renderer is 503
  `pdf_renderer_unavailable`. A missing `privacy_contact`, or a board made only of the payee,
  raises `FoundationIdentityError` — a code defect, not a client error.
- **Wording corrections, made in the drafts file first:** a place, a role, a voice or an instrument
  is printed after a colon or in parentheses (the drafts had "w {{miejsce}}", which Polish would
  inflect); the conductor and crew under a dzieło get a "(rola: …)" variant, with a question for the
  lawyer about visuals; the volunteer agreement lists the fields of exploitation instead of pointing
  at a contract the volunteer never signs; the GDPR clause's PESEL sentence is limited to the
  contracts; the bill names the contract's signing date when recorded and has no foundation
  masthead (it is the payee's document).
- **Programme annex:** items by `order`, "kompozytor — tytuł", encores marked "(bis)"; an empty
  programme prints numbered blank lines. It is rendered at download time, not frozen with the row.
- **The printed check:** `manage.py finance_sample_documents` (web container — WeasyPrint needs its
  native libraries) issues one of each document for a throwaway concert inside a transaction it
  rolls back, and writes six PDFs to `MEDIA_ROOT/finance/samples/` (`voct_data/media/…` on the dev
  host). No row and no contract number survives the run.

### Stage 2 — Ledger frontend + global page v1

- `features/finance/` scaffold (§8.1); hub `budget/*` routes with Przegląd v1 + Honoraria (§8.2);
  `ProjectFactsCard` reads `summary`; `/panel/finance` with Projekty + Do zapłaty + ledger CSV export
  (§8.3); redirect `/panel/contracts`; delete `features/contracts/` and the old budget files;
  `finance.*` i18n in pl/en/fr.
- Vitest: grosze parsing and draft summarisation.

**As built (2026-09-23)** — where Stage 2 differs from the text above:

- **Backend, the one piece this stage owned:** `finance/infrastructure/ledger_csv.py` behind
  `GET projects/{id}/export/ledger.csv` and `GET export/ledger.csv?from=&to=` (the office's range,
  across projects, by `incurred_on`, both ends inclusive; `LedgerRangeDTO`). Rows are the ledger's
  `counted` rows, so the file sums to the stated cost. Headers and vocabulary are Polish, like the
  documents; a text cell starting with `= + - @` is written as text. Tests in `test_ledger_csv.py`.
- **Layout:** `features/finance/{api,types,lib,components,budget,overview}`. The hub's
  `ProjectBudgetPage` is now a layout route (`BudgetTabs` + `<Outlet context>`); `budget` index is
  `BudgetOverviewPage`, `budget/people` is `FeesPage`. `/panel/finance` is `overview/FinancePage`.
- **The draft mirrors the server:** `lib/feeDraft.ts` copies `reconcile_pricing` and the
  standard-rate skip rules line for line, so the rail's preview is the total the save produces.
  Per-ledger subtotals are gone: they would be the client summing persisted money. The rail shows
  the server's `by_category` (only as a split of two or more) and the preview only while dirty.
- **Drafts and acts share the dock band:** the selection bar opens only while no draft is pending;
  the save bar says acts wait for the save, and a row's menu names why an act is disabled (its own
  draft, or offline). Mark-paid is not offered for an orphaned fee, although the server would take it.
- **Rows the plan left open:** a one-off's chip compares against its side's fallback form, like a
  roster row against `default_form`. Employer contributions and in-kind valuation are edited in the
  row's details sheet and saved at once (a one-row batch restating the stored amount), not drafted.
  Przegląd names each warning's people as links to `budget/people?focus=<key>`; the portfolio's
  payables link by cost-item id, which the same parameter accepts. Payment happens in the hub only.
- **Shared additions:** `DateTimeField granularity="date"` (a `yyyy-MM-dd` value, no clock),
  `EditorActionBar isConfirmDisabled`, `shared/lib/dom/useIsOnline`, `canApproveFinance` in `rbac.ts`.
- **Not done, deliberately:** no enum-dictionary registration and no `DICTIONARY_VERSION` bump —
  categories and forms are the client's vocabulary (`financePresentation.ts`), never served by
  `/api/options`. Budget status is shown only when it is not `PLANNING`; history and transitions are
  Stage 4. Warning codes of Stages 4–5 fall back to a generic label until those stages map them.
- **Removed:** `features/contracts/`, `widgets/domain/ExportContractButton.tsx`, the old
  `BudgetTab`/`useBudgetTab`/`FeeRow`/`StandardRateField`, `features/projects/lib/money.ts`, the
  `contracts`, `export` and `projects.budget` locale blocks, and the `crewAssignments.all` prefetch
  that only the contracts page read. The `CONTRACT_ISSUED` notification still links to
  `/panel/contracts` (now a redirect to a manager-only page) — Stage 7's performer view owns it.

### Stage 3 — Legacy removal

- Backend: drop `fee`, `is_paid`, `paid_at` from `Participation` and `CrewAssignment`
  (migration depending on `finance/0002`); delete `_fee_action`, `_apply_payment`,
  `_settlement_contract_response` and the retired actions (§6) in `roster/views.py`;
  `update_project_bulk_fee` / `update_project_crew_bulk_fee` in `roster/services.py`;
  `ProjectBulkFeeDTO`; fee handling in `roster/serializers.py`, `roster/admin.py`,
  `management/commands/seed_db.py` (seed finance items instead); `roster/queries/dossier_queries.py`
  earnings read from finance; roster tests that exercise fees move to or are replaced by finance tests.
- Frontend: remove `fee` / `is_paid` / `paid_at` from `shared/types/index.ts`,
  `features/projects/types/project.dto.ts`, `project.optimistic.ts`, and the participation and crew
  mutations; bump the query cache buster (DTO shape changed — memory `reference_query_cache_buster`).
- **R1 release**: deploy, `make migrate` (runs `finance/0001`, `0002` and the roster removal in
  order), then check the first concert's ledger against the old figures.

**As built (2026-09-23)** — where Stage 3 differs from the text above:

- **Migration:** `roster/0062_drop_legacy_fees` depends on `finance/0002`, so no database can drop
  the columns before the copy has run. `finance/data_copy.py` stays, because `0002` imports it; its
  tests became a migration test (`TransactionTestCase`) that rolls the roster back to `0061`, writes
  rows through the historical models and hands the copy those same models.
- **Removed beyond the list:** `live_contract_for` and `ContractNotIssued` (`contract_not_issued`,
  with its client copy and three locale keys) — only the retired roster door used them; the
  participation admin's contract button. The basic/detailed serializer pairs for `Participation`
  and `CrewAssignment` are one serializer each: with no money on the row, nothing was left to hide.
- **Artist merge:** the roster copied a duplicate's fee onto the survivor's seat; the ledger does it
  now. `LedgerService.fold_seat` re-points the duplicate's item at the survivor's seat — paid or
  contracted as it was, logged as `DETAILS_CHANGED` under the merging manager — when that seat has
  none. When it has its own, or the budget is `CLOSED`, the item stays on the folded seat and the
  project is listed in `fee_conflicts`. A merge never fails over money.
- **Dossier earnings** read the ledger: paid is every paid item on the artist's seats, declined or
  removed ones included (a payment stays a payment, as in the ledger); outstanding is what is priced
  and unpaid on live, non-declined seats; a volunteer's 0 is never earnings.
- **Seed:** `seed_db` prices the cast and crew through `LedgerService.apply_fee_batch` and pays
  completed concerts through `LedgerService.pay`; declined seats stay unpriced. A new project's
  creator seat is no longer created with a fee of 0.
- **Client:** `QUERY_CACHE_BUSTER` is `2026-09-ledger-only-fees`; the bulk-fee hooks and service
  calls went with their DTO.
- **Not done:** the backend `.po` files still hold the dropped fields' msgids; the next
  `makemessages` marks them obsolete.

### Stage 4 — Plan, expenses, budget states

- Backend: `BudgetLine`, EXPENSE items, `FinanceAttachment` + nginx `internal` entries (both confs),
  transitions approve/reopen/close with locks, line reorder, `LINE_OVER_PLAN` / `COST_OUTSIDE_PLAN`.
- Frontend: Kosztorys and Wydatki sub-tabs; Przegląd gains Plan and the history view.

### Stage 5 — Funding

- Backend: `FundingSource`, `ProjectFunding`, `LineAllocation`, `CostAllocation`, the grant-rule
  warnings, overview utilisation.
- Frontend: Finansowanie sub-tab; allocation editing on lines and items; global Źródła finansowania +
  a source's page.

### Stage 6 — Reports and exports

- §10 in full: patron and board PDF (WeasyPrint, `_brand_font_context()`, mono-print check),
  kosztorys CSV (column set per Q1), document notes PDF, ledger CSV finalised. Tests for the patron
  aggregation floor.

### Stage 7 — Later (not specified here)

Deadline reminders through the notification engine (the `NotificationType` checklist); RUD tracking;
the retention purge; a transfer list for the office (needs the bank-account decision); a performer's
own read-only view of their contract and payment state; a variant contract for non-resident
performers, if the lawyer asks for one.

## 12. Who builds what

| Work | Model | Effort | Why |
|---|---|---|---|
| This spec + the contract drafts | Opus 5.5 | high | done |
| Stage 1 — ledger backend + data migration | **Fable 5.1** | **xhigh** | Money invariants, an irreversible data move on prod, concurrent numbering. Errors here are silent and expensive; this is where the strongest model pays for itself. |
| Stage 1b — documents (four templates, words-for-amounts, foundation identity) | Opus 5.5 | xhigh | Print canon and WeasyPrint break rules; faithful transcription of the reviewed wording. Rendering work, not domain reasoning. |
| Stage 2 — ledger frontend + global page | Opus 5.5 | xhigh | A large UI stage bound by the design canon, iterated against the developer's browser review. Opus 5.5 defaults to `medium` — set `xhigh` explicitly. |
| Stage 3 — legacy removal | Sonnet 5 | xhigh | Mechanical deletion across a known file list; typecheck, mypy and tests catch what is missed. |
| Stage 4 — plan, expenses, states | Opus 5.5 | xhigh | Full-stack CRUD, state transitions, private file serving. |
| Stage 5 — funding and grant rules | **Fable 5.1** | high | Allocation arithmetic and eligibility rules across projects — domain reasoning more than code volume. |
| Stage 6 — reports and PDFs | Opus 5.5 | xhigh | Print canon, WeasyPrint break rules, privacy aggregation; iterative visual work. |
| Audit after Stages 1, 2, 4, 5, 6 (read-only, against this spec) | Fable 5.1 | high | An independent reviewer that did not write the code. |

No stage goes to Haiku 4.5: nothing here is mechanical enough for its savings to outweigh the cost
of a missed money invariant.
