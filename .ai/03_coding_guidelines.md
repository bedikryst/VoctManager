# Coding Standards and Architecture Guidelines (VoctManager 2026)

## STRICT AI DIRECTIVE: CODE PURITY

**ABSOLUTE BAN:** You MUST NOT use placeholder comments (e.g., `// TODO`, `// FIXED`, `// ADD LOGIC HERE`).
**ABSOLUTE BAN:** You MUST NOT write inline comments in any language other than English.
**MANDATE:** Every code snippet you generate MUST be immediately production-ready, flawlessly typed, and explicitly handle all edge cases.

---

## 1. Frontend Architecture: Strict Feature-Sliced Design (FSD)

The frontend application strictly isolates domains within `src/features/` (e.g., `archive`, `projects`, `artists`).

- **Hermetic Boundary:** A feature module MUST contain its own `/api`, `/components`, `/hooks`, `/types`, and `/constants`.
- **The Shared Ban:** You MUST NOT leak domain-specific logic (like a `ProjectCard`) into `src/shared/`. `shared/` is exclusively for universal UI primitives and utils.
- **No Default Exports:** You MUST strictly use named exports (`export const Component = ...`). Default exports are banned across the entire codebase (except for lazy-loaded route pages).
- **No Raw API Calls in Components:** You MUST NOT write `axios` or `fetch` calls directly inside `.tsx` components. All API calls MUST be encapsulated in React Query custom hooks inside `/hooks`.

---

## 2. Backend Architecture: The Service Layer Pattern

Django is used strictly as a routing and ORM layer. We do NOT use "Fat Models".

- **The Flow:** View/Endpoint -> DRF Serializer (Validation) -> `services.py` (Business Logic) -> ORM/Database.
- **Services Mandate:** ALL business logic MUST reside in `services.py` within the respective Django app. Views (endpoints) must be extremely thin—they only parse requests, call a service, and return responses.
- **Pydantic Boundary:** Services MUST NOT accept DRF Serializers or raw HTTP request objects. They must accept and return strictly typed Pydantic DTOs or Django Model instances.
- **Cross-App Isolation:** A Django app (e.g., `projects`) CANNOT import models directly from another app (e.g., `artists`). It MUST call the public methods exposed in `artists/services.py`.

---

## 3. State Management & Data Flow (React)

- **Container/Presenter Pattern:** UI components (`shared/ui/` and `features/.../components/`) MUST be completely stateless ("dumb"). They only receive props and emit events.
- **Hook Orchestration:** All React Query hooks, Zustand state selectors, and complex data transformations MUST be handled by custom hooks (e.g., `useProjectDashboard`).
- **Optimistic Updates:** EVERY React Query mutation MUST implement optimistic UI updates using `queryClient.setQueryData()` and explicitly call `queryClient.invalidateQueries()` upon success or error.

---

## 4. Strict Typing (TypeScript & Python)

- **TypeScript:** ZERO tolerance for the `any` type. Interfaces and DTOs must explicitly define all fields. Use `unknown` if a type is truly dynamic, and validate it with Zod.
- **Python:** Type Hints (`->`, `: type`) are STRICTLY MANDATORY for every single function, method parameter, and return type across the entire backend.

---

## 5. Fail-Fast Error Handling

- **No Silent Failures:** **ABSOLUTE BAN** on silent error swallowing (`try { ... } catch (e) {}` or `except Exception: pass`).
- **Backend Domain Exceptions:** The service layer (`services.py`) MUST NOT raise HTTP exceptions (e.g., `ValidationError` from DRF). It must raise custom domain exceptions (e.g., `ArtistUnavailableError`), which are then caught and translated by the view/exception handler.
- **Frontend Toast Notifications:** API errors caught in React Query mutations MUST be communicated to the user via the established toast notification system (e.g., `sonner`).
