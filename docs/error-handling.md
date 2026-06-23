# Error handling — audit & premium 2026 plan

_Status: foundation shipped; feature rollout in progress._

This is the reference for how VoctManager turns failures into words a conductor
or chorister can act on. It captures (1) what we found, (2) the model we are
moving to, and (3) the staged rollout.

---

## 1. Audit — what we found

### 1.1 The catastrophic surface (fixed)

The app shipped with **no router `errorElement`**. Any render-time throw fell
through to React Router's raw "Unexpected Application Error" developer page —
the screen a user photographed and reported. Fixed by the Ethereal fault
surface + layered boundaries (`ErrorScreen`, `RouteErrorBoundary`,
`PanelErrorBoundary`).

### 1.2 The everyday surface (in progress)

Across ~60 call sites, failures were surfaced inconsistently:

| Pattern | Example | Problem |
| --- | --- | --- |
| Generic title | `toast.error(t("common.errors.save_error", "Błąd zapisu"))` | Says _that_ it failed, never _why_ or _which field_. |
| Hard-coded English | `toast.error("Operation unsuccessful. Please verify your connection…")` | Not localized; ignores the real error. |
| Raw server dump | `Object.values(err.response.data).flat().join(" | ")` | Leaks technical, field-less strings into a toast. |
| Swallowed error | `} catch { toast.error("Błąd zapisu") }` | The error object is discarded — a 403, a 409 and a network drop all read the same. |
| Field errors dropped | forms only `toast`, never `setError` | The server says _"email already taken"_; the user sees _"coś jest źle"_ and no field is highlighted. |

### 1.3 Root cause — a non-uniform server contract

The backend emits **at least four shapes** for the same conceptual error, so the
frontend can't parse reliably and falls back to generic copy:

- RFC 7807 envelope (global handler): `{ status, detail, validation_errors | errors }`
- pydantic 422: `validation_errors: [{ field, message }]` — a **list**
- hand-rolled auth: `validation_errors: { new_password: [...] }` — a **dict**, or `{ error_code, message }`
- DRF serializer errors nested under `errors: { field: [...] }`

`error_code` is frequently an empty string (`str(exc)` on an arg-less domain
exception), and human messages are English even when the UI is Polish/French.

---

## 2. The model — one contract on the client

Everything funnels through `@/shared/api/errors`:

```
parseApiError(error)        // any throw  -> NormalizedApiError (pure, testable)
resolveErrorCopy(norm, t)   // normalized -> { title, detail }  (localized)
toastApiError(error, t?)    // parse + localize + toast, in one call
applyFieldErrors(setError…) // normalized.fieldErrors -> react-hook-form, inline
```

`NormalizedApiError` collapses every server shape into:

```ts
{ status, kind, code, serverMessage, fieldErrors, raw }
```

`kind` is the coarse category that drives tone and recovery:
`validation | domain | auth | permission | notfound | conflict | rate_limit |
network | offline | server | unknown`.

**Copy priority** (most specific first): known `error_code` → single rejected
field's own message → meaningful server sentence (domain rules) → localized
fallback for the kind. Localized strings live under `errors.toast.*`,
`errors.codes.*`, `errors.form.*` in `pl` / `en` / `fr`.

### Why this is the premium move

- **Precise, not generic.** "Adres e-mail zajęty" on the email field, not "Błąd
  zapisu".
- **Inline where the eye is.** Server field rejections light up the field via
  `setError`, accessible (`aria-invalid`) and focus-managed.
- **Localized always.** No English leaks into a Polish UI.
- **Honest about cause.** Offline, rate-limited, forbidden and server faults each
  get their own calm, distinct message and the right recovery.
- **One place to improve.** Better copy for a new `error_code` is a dictionary
  entry, not a code change at 60 call sites.

---

## 3. Rollout

**Phase 0 — catastrophic surface.** ✅ Shipped (`ErrorScreen` + boundaries).

**Phase 1 — foundation + headline fixes.** ✅ This change.
- `@/shared/api/errors` toolkit + `errors.*` i18n (pl/en/fr).
- Migrated: artist form (now shows inline field errors), project details form
  (raw `" | "` dump removed), participation/crew/piece-casting mutations
  (9 hard-coded English toasts → localized, precise).

**Phase 2 — editor hooks.** ✅ Shipped. The `} catch {` blocks in
`useBudgetTab`, `useProgramTab` (×5), `useRehearsalsTab` (×2),
`useAttendanceMatrix`, `useCastTab`, `useCrewAssignments` (×2) no longer swallow
the error — they capture it and call `toastApiError(error, t, { id?, fallbackDescription })`.
A 403, a 409 and a dropped connection now read differently instead of all
saying "Błąd zapisu". `fallbackDescription` keeps each feature's tailored copy,
but only surfaces it for a truly opaque `unknown` error — every named cause
(offline, forbidden, server, conflict, …) leads with its own precise detail.

**Phase 3 — zod forms + API call sites.** ✅ Largely shipped.
- Forms that own their submission now light up rejected fields inline via
  `applyFieldErrors`: artist, location, archive piece (new + edit), archive
  review. (The chorister-hub category/document modals delegate submission to a
  parent mutation, so their toasts were made precise at the query layer; inline
  field wiring there is a small follow-up once submission moves into the modal.)
- API layers swept: `chorister-hub.queries` (×5), `project.project /
  rehearsal / program / attendance.mutations` (13 more hard-coded English
  toasts), `messages.queries` (×2), project-hub + dashboard delete/status.
- `resolveErrorCopy` learned that a message-less **domain** rule should defer
  to the caller's `fallbackDescription` (e.g. "project still has contracts"),
  not a generic kind line.

**Phase 3 tail — component handlers.** ✅ Swept. Converted the scattered
component/data-hook `toast.error` API handlers: schedule, rehearsals, artists,
logistics, contracts (Contracts / ContractRow / PayablesBoard), archive
(composers, pieces data, editions, row-tracks), crew (form + data), project
row / card / dashboard / hub. Every server CRUD failure in these surfaces now
states a precise, localized cause.

Intentionally **left bespoke** (not API errors, or special):
- `usePushNotifications` — browser Notification-permission states.
- `EditionUploadZone` — client-side file-type/size validation.
- `AppTab` share — `navigator.clipboard` failure.
- `LocationsManager` — only a React Query `isError` flag is in scope (no error
  object to classify); shows a sync warning.
- `ComposerRowExpanded` — the message is also rendered inline in component
  state, not just toasted.
- `ArtistRow` autosave + `NewThreadModal` — row/compose-scoped copy; revisit
  if they start needing cause-precise messages.

**Phase 4 — backend contract hardening.** ◑ Largely shipped.
- **Stable `error_code` on every envelope branch** (`core/exceptions.py`):
  pydantic 422 → `validation_error`; domain → the exception's explicit `code`
  (e.g. `email_taken`, `invalid_credentials`) or a snake_case of its class name
  (`ParticipationException` → `participation`); HTTP errors → a mapped code
  (`not_found`, `forbidden`, `rate_limited`, …). The client's
  `resolveErrorCopy` maps these straight to curated copy.
- **Domain exceptions carry `code` + `default_message`** (core / archive /
  roster), so `detail` is never empty even for a message-less raise.
  `__init__`/`__str__` are untouched, so existing call sites are unaffected.
- **`Accept-Language` localization**: `LocaleMiddleware` enabled
  (`USE_I18N`, `LANGUAGES`, `LOCALE_PATHS` were already set), and the axios
  client now sends the active UI language — so DRF/domain messages come back in
  the user's locale, matching the UI rather than the browser default.
- **Tests**: `EnterpriseExceptionHandlerTests` covers every envelope branch
  (verified in isolation here; runs in CI with the project's Python/DB).

Deferred (needs coordinated FE + staging verification):
- Retiring the hand-rolled auth payloads in `core/views.py` so the login /
  activation / reset endpoints emit the same envelope + stable codes. The
  client tolerates the current auth shapes today (`parseApiError` +
  `usePasswordReset`), so this is a cleanup, not a blocker.

---

## 4. Usage

```ts
// Component with a form:
import { applyFieldErrors, toastApiError } from "@/shared/api/errors";

try {
  await save(values);
} catch (err) {
  const normalized = toastApiError(err, t, { id: toastId });
  applyFieldErrors(form.setError, normalized); // inline field errors
}

// Outside React (optimistic mutation onError): omit t, the active language is
// read from the global i18n instance.
onError: (error) => toastApiError(error),
```
