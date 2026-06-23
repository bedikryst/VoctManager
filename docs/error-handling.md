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

**Phase 2 — editor hooks.** Convert the `} catch {` blocks in
`useBudgetTab`, `useProgramTab`, `useRehearsalsTab`, `useAttendanceMatrix`,
`useCastTab`, `useCrewAssignments` to capture the error and call
`toastApiError(error, t, { id: toastId, description })`, keeping each feature's
tailored description as the override where it reads better than the server's.

**Phase 3 — remaining `toast.error` sites + zod forms.** Sweep the rest of the
58 sites; wire `applyFieldErrors` into every `zodResolver` form
(`useLocationForm`, `usePieceFormState`, modals, …).

**Phase 4 — backend contract hardening (recommended).** Make the client able to
_fully_ trust the server:
- One error envelope for every endpoint (retire the hand-rolled auth payloads).
- `error_code` always a stable kebab string (`invalid-credentials`,
  `email-taken`, …), never empty — the client maps these to curated copy.
- Localize messages by `Accept-Language` (the `backend/locale/` machinery is
  already present) so `serverMessage` is safe to show verbatim.
- Always key field errors by field name so `applyFieldErrors` is exhaustive.

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
