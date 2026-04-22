# UI Architecture & Ethereal Design System (VoctManager 2026)

## STRICT AI DIRECTIVE: THE "NO-RAW-HTML" MANDATE

You are operating in an Enterprise SaaS environment governed by a strict Design System.
**ABSOLUTE BAN:** You MUST NOT use raw HTML text tags (`<h1>`, `<p>`, `<span>`) with raw Tailwind text classes (e.g., `text-xl`, `font-bold`, `text-gray-500`).
**ABSOLUTE BAN:** You MUST NOT manually create glassmorphism or cards using `bg-white/10`, `backdrop-blur`, or manual shadows.
You MUST exclusively construct UIs by composing the pre-built Primitives, Composites, and Kinematics from `frontend/src/shared/ui/`.

---

## 1. Typography System (The Unbreakable Law)

All text in the application MUST be wrapped in components from `shared/ui/primitives/typography/`. The system uses CVA variants for size, weight, and color.

- **`Heading`**: For all section and page titles. Maps to `font-serif tracking-tight`. (Props: `size="3xl" | "huge"`, `weight="medium"`).
- **`Text`**: For all standard body text and descriptions. Maps to `font-sans`.
- **`Eyebrow`**: For overlines, categories, and small labels (e.g., "NEXT REHEARSAL", "MAESTRO"). Strictly uppercase with wide tracking. Use `color="muted"` or `color="default"`.
- **`Metric`**: Exclusively for large numbers/KPIs in dashboard widgets. Maps to `font-serif font-light`.
- **`Unit`**: Accompanies `Metric` for units (e.g., "voc.", "rehearsals").
- **`Emphasis`**: For italicized, golden highlighting within text blocks.

_Correct AI Usage:_ `<Eyebrow color="muted">Opis</Eyebrow>`
_Forbidden AI Usage:_ `<span className="text-xs uppercase tracking-widest text-gray-400">Opis</span>`

---

## 2. Structural Composites & Glassmorphism

The application exists in a cinematic, multi-layered 3D space. Do not build flat UIs.

- **`GlassCard`**: The absolute foundation of EVERY widget, form, and module.
  - _Variants:_ `ethereal` (default, standard glass), `light` (highly transparent), `dark` (dark glass), `outline` (interactive borders).
  - _Features:_ Use `withNoise={true}` and `glow={true}` for interactive directive cards (like in `SystemModuleCard`). Use `padding="none"` if you need custom edge-to-edge layouts inside.
- **`PageHeader` / `SectionHeader`**: Mandatory for page and section introductions. `PageHeader` accepts `roleText` (Eyebrow), `title`, and `titleHighlight`.
- **`MetricBlock`**: Use this immediately whenever a design calls for a statistic, KPI, or telemetry data. Do not build custom flexboxes for numbers. Accepts `label`, `value`, `unit`, and `icon`.
- **`ArtifactCard`**: A domain-specific wrapper for entities (Projects, Pieces, Artists). Used heavily in Spotlight widgets.

---

## 3. Layouts & The Bento Grid Architecture

Dashboards and module directories MUST adhere to the Staggered Bento Grid architecture to ensure 60/120FPS cinematic entrance animations.

- **`StaggeredBentoContainer`**: Wraps the entire dashboard grid. It orchestrates the staggered Framer Motion entrance.
- **`StaggeredBentoItem`**: Wraps individual `GlassCard` widgets.
- **Layout Rule:** The container should use a standard Tailwind CSS Grid (e.g., `grid-cols-1 md:grid-cols-12 xl:grid-cols-13`). The `StaggeredBentoItem` handles the spanning (e.g., `className="col-span-1 md:col-span-5"`).

_Correct AI Architecture for Dashboards:_

```tsx
<StaggeredBentoContainer className="grid grid-cols-12 gap-4">
  <StaggeredBentoItem className="col-span-4">
    <TelemetryWidget />
  </StaggeredBentoItem>
</StaggeredBentoContainer>
```

---

## 4. Kinematics, Motion, and Aura

The UI must feel like a living, breathing sacred space.

- **`PageTransition`**: Every top-level Route/Page component must return this as its root element.
- **`EtherealLoader`**: Absolute ban on generic spinners. Use this for all Suspense fallbacks and React Query loading states.
- **Hardware Acceleration:** When creating custom motion, always use `framer-motion` and ensure properties map to `transform` or `opacity` to maintain the `will-change-transform transform-gpu` pipeline.

---

## 5. Domain Widgets vs. Shared UI

- `shared/ui/...`: Strictly "dumb" components. They know nothing about the backend, VoctManager, or domain logic.
- `shared/widgets/...` or `features/.../components`: "Smart" composites. E.g., `SystemModuleCard` knows how to use React Router `Link` and specific domain typography. `TelemetryWidget` knows about SATB voices.

**When asked to "build a new widget", you MUST:**

1. Wrap it in `<StaggeredBentoItem>` (if on a dashboard).
2. Base it on `<GlassCard>`.
3. Use `<SectionHeader>` for its title.
4. Use `<MetricBlock>` for its data points.
5. Apply `<Text>` and `<Eyebrow>` for remaining content.

---

## 6. Form Primitives (Ethereal Inputs)

All interactive forms MUST use the specialized primitives that enforce the design system's glassmorphism and validation states.

- **`Select`**: For all dropdown choices.
  - _Props:_ `label` (optional Eyebrow), `error` (validation message), `leftIcon` (optional Lucide icon), `variant` (`glass` | `solid` | `ghost`).
  - _Usage:_ Wrap `<option>` tags inside. Use `variant="glass"` (default) for floating cards.
- **`Textarea`**: For multi-line text input.
  - _Props:_ `label`, `error`, `variant` (`glass` | `solid` | `ghost`).
  - _Feature:_ Supports automatic `resize-y`.

---

When you need to apply utility classes via `className` (e.g., adjusting margins, grid properties, or passing overrides), you MUST strictly adhere to the custom "Ethereal" theme defined in `frontend/src/app/styles/index.css`.

**ABSOLUTE BAN:** Do NOT hallucinate standard Tailwind colors (e.g., `text-yellow-500`, `bg-gray-100`) or arbitrary magic numbers (e.g., `z-[70]`, `w-[120px]`).

**1. Color Palette (Ethereal):**

- **Surfaces:** `bg-ethereal-alabaster`, `bg-ethereal-parchment`, `bg-ethereal-marble`
- **Accents:** `text-ethereal-gold`, `bg-ethereal-sage`, `border-ethereal-amethyst`, `text-ethereal-incense`
- **Dark/Text:** `text-ethereal-ink`, `text-ethereal-graphite`
- **Alerts:** `text-ethereal-crimson`, `bg-ethereal-crimson-light`
  _(Note: Tailwind opacity modifiers are allowed, e.g., `bg-ethereal-gold/20`)_

**2. Custom Shadows (Do not build manual rgba shadows):**

- Use: `shadow-glass-ethereal`, `shadow-glass-ethereal-hover`, `shadow-glass-solid`, `shadow-glass-outline-hover`

**3. Spatial & Z-Index Tokens:**

- **Spacing:** `w-sidebar` (120px), `p-nav-dock`, `h-sheet-expanded`
- **Z-Index:** `z-nav-dock` (70), `z-nav-sheet` (80), `z-focus-trap` (90), `z-toast` (100)

**4. Custom Behaviors:**

- **`ethereal-scroll`**: Apply to scrollable containers for elegant, golden-tinted thin scrollbars.
- **`no-scrollbar`**: Apply to completely hide scrollbars while retaining scroll functionality.
- **`bg-noise`**: Apply to inject the SVG fractal noise texture into a container.
