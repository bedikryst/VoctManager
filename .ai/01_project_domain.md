# Project Domain: VoctManager

## 1. Context, Purpose, and Tone of Voice

VoctManager is an enterprise resource planning (ERP/CRM) and digital operations platform built for a professional vocal ensemble (choir), **VoctEnsemble**. The application operates in a serious, sacred, and highly professional musical domain.

**STRICT AI RULES (Negative Prompting):**

- **No childishness or slang:** Absolute ban on colloquialisms, jokes, emojis (except rigidly selected UI icons from Lucide/Radix), or programming slang in comments.
- **Formal Error Messages:** The system must return formal, official messages (e.g., "Authorization failed", "Score update unsuccessful" instead of "Oops, something went wrong").
- **AI Responses (Zero-Chat Rule):** Absolute ban on chatty responses or default filler phrases ("Here is your code", "Hope this helps"). The AI must return concise solutions, focusing exclusively on code, architecture, and required shell commands.

**AI Response Example (One-Shot):**

- ❌ BAD: "Sure, here is the updated component. I also added a cool animation! Hope you like it:"
- ✅ GOOD: "Updating the `ScoreViewer` component to include the `EtherealLoader`:"

## 2. Domain Dictionary & Entity Relationships

All code naming conventions (variables, DB models, TypeScript interfaces) must strictly adhere to the following dictionary and respect the defined RBAC (Role-Based Access Control) and State Machines:

- **User / UserProfile:**
  - **Admin:** Full system access.
  - **Manager:** Manages projects, casting, and logistics (no system settings access).
  - **Artist / Singer:** Read-only access to assigned projects, attendance confirmation, score downloads. Assigned a voice group: Soprano (S), Alto (A), Tenor (T), Bass (B).
  - **Crew:** Technical/logistics access (e.g., sound engineer, director).
- **Archive / Piece:** Musical archive and individual piece (composer, epoch). Linked to `Score` (Sheet Music PDF) and `Track` (Reference recording).
- **Project / Concert:** The central entity. Contains location (Google Maps API `place_id`), timezone, program (`Piece`), cast (`Casting`), and schedule (`Rehearsal`).
  - _State Machine:_ `Draft` -> `Published` -> `Archived`. Can transition to `Cancelled` from any state.
- **Rehearsal:** Choir rehearsal, strictly linked to a specific `Project`.
- **Attendance / Participation:** Artist's attendance status for a Project/Rehearsal. (States: `Pending`, `Confirmed`, `Declined`, `Late`).
- **Casting / Micro-Casting (`ProjectPieceCasting`):** Roster assignment for a specific project/piece (links `Project`, `Piece`, and `Artist`).
- **Documents:** `Run Sheet` (Production schedule) and `Contract` (Automatically generated PDF/HTML).
- **Logistics:** Managing locations, concert venues, and rehearsal spaces.

## 3. Core UX/UI & Architecture Principles

- **Zero-Layout-Shift:** The screen must remain absolutely stable. Mandatory use of preloaders and skeletons (`React Query` / `Suspense`) during async data fetching.
- **Cinematic / Ethereal UX:** Fluid, non-bouncy animations (60FPS). When modifying UI, AI must exclusively use pre-built components from `frontend/src/shared/ui/kinematics/` (e.g., `EtherealLoader`, `PageTransition`, `CustomCursor`, `ResonancePillar`).
- **Styling & Accessibility:** Tailwind CSS (v4+), `clsx` / `tailwind-merge`. Frosted glass effect (e.g., `GlassCard`). Absolute ban on raw browser styles. Strict WCAG compliance (aria-attributes, high contrast) is required for all Radix UI based components.
