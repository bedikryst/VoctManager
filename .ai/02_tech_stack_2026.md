# Tech Stack and Version Mandates (April 2026 Standards)

## STRICT AI DIRECTIVE: VERSION HALLUCINATION PREVENTION

You are operating in the year 2026. You MUST strictly adhere to the software versions listed below. Absolutely DO NOT generate code using deprecated syntaxes, legacy hooks, or outdated configuration patterns.

---

## 1. Frontend (SPA)

- **Core:** React 19.2+ with Vite 7.3+ and TypeScript 6.0+.
  - _Ban:_ Do not use Webpack, Create React App, or legacy React class components. Zero tolerance for `any` types in TypeScript.
- **Styling:** Tailwind CSS 4.2+ combined with `clsx` and `tailwind-merge`.
  - _Ban:_ Do not hallucinate or use legacy Tailwind v3 utility classes or configuration files. Rely on v4 CSS variables and modern syntax.
- **State Management:** Zustand 5+ for global state.
- **Data Fetching & Caching:** `@tanstack/react-query` v5.91+.
  - _Mandate:_ All mutation hooks MUST implement Optimistic UI updates.
- **Routing:** React Router v7+.
- **Animations & Kinematics:** Framer Motion v12+, Three.js v0.183, and custom interactive hooks (e.g., `useMouseAndGyro`).
- **Forms & Validation:** React Hook Form v7+ strictly integrated with Zod v4.3+.
- **Time Management:** `date-fns` v4+ and `date-fns-tz`.
  - _Mandate:_ Strict timezone enforcement is required. Never rely on the standard JS `Date` object for complex timezone logic.
- **UI Components:** Built exclusively using Radix UI Primitives and `class-variance-authority` (CVA).
- **Drag & Drop:** Strictly use @dnd-kit/core v6+ with TouchSensor for mobile-first interactions. Absolute ban on react-beautiful-dnd or its forks.

## 2. Backend (REST API)

- **Framework:** Django 6.0+ and Django REST Framework (DRF) 3.16+.
- **Database:** PostgreSQL (using the `psycopg` v3 binary driver).
- **Authentication:** JWT (JSON Web Tokens) via `djangorestframework-simplejwt`.
  - _Mandate:_ Strict Role-Based Access Control (RBAC) is required on all endpoints.
- **Background Tasks:** Celery 5.3+ with Redis 5+ as the broker.
  - _Ban:_ Document generation (PDFs) and email dispatch MUST NOT block the main thread. They must be offloaded to Celery.
- **Document Generation:** WeasyPrint v68+ (for generating Run Sheets, Contracts, etc.).
- **Application Server:** Gunicorn 21+ / Uvicorn.
- **Python Standards:**
  - _Mandate:_ Type Hints are absolutely mandatory across the entire codebase.
  - Use `Pydantic` for advanced data validation within the service layer.

## 3. Infrastructure

- **Containerization:** Docker and Docker Compose.
- **Static Files:** WhiteNoise / Nginx.
