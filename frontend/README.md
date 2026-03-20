# ⚛️ VoctManager – Frontend Application

![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-black?style=for-the-badge&logo=framer&logoColor=blue)

This directory contains the source code for the User Interface (Single Page Application) of the **VoctManager** system. The application is architected with a strict focus on ultra-high performance (60FPS animations), fault-tolerance (Strict TypeScript), and aggressive data caching (Zero-Layout-Shift).

---

## 🏗️ Architecture & Directory Structure

The project utilizes a modular feature-based structure to facilitate scalability and maintain a strict separation of concerns between business logic and the presentation layer.

```text
src/
├── assets/         # Static assets (images, audio samples) and global CSS
├── components/     # UI components divided by domain:
│   ├── home/       # Public-facing landing elements (Hero, Team, Experience)
│   ├── layout/     # Structural wrappers (Navbar, Footer, Sidebar)
│   ├── panel/      # Enterprise dashboard modules (Dashboard, Archive, Projects)
│   └── ui/         # Reusable, atomic base components (Modals, Buttons)
├── context/        # React Context providers (AuthContext, CursorContext)
├── hooks/          # Custom React hooks (useProjectData, useMouseAndGyro, etc.)
├── pages/          # Top-level route components
├── store/          # Global client-state definitions (Zustand)
├── types/          # Global TypeScript interfaces and type definitions
└── utils/          # Helper functions and API client configuration
```

---

## 🧠 State Management Strategy

To avoid props drilling and ensure reliable data synchronization, the application strictly separates its state into two distinct paradigms:

### 1. Server-State
Used for all asynchronous communication with the Django backend (fetching projects, roster, archive).
* **Concept:** Data fetched from the API should *never* pollute the global client state. It is cached within the hook layer (e.g., `useProjectData`).
* **Note:** The architecture is fully prepared for deeper integration with `@tanstack/react-query` to handle complex optimistic updates in the future.

### 2. Client-State
Used strictly for global UI state (e.g., slide-over panel visibility, user preferences, temporary form data).
* **Tool:** `Zustand` (`src/store/useAppStore.ts`).
* **Rule:** Zustand is only utilized when React Context would cause unnecessary re-renders across the entire component tree.

---

## 🎨 Styling & Kinematics

1. **Tailwind CSS:** Utility-first styling approach. Global styles in `index.css` are restricted to the absolute minimum (CSS resets, theme variables).
2. **Framer Motion:** Powers all declarative entry animations (Page Transitions), complex gestures, and scroll-linked kinematics.
3. **Lenis:** Implements smooth scrolling at the window level, ensuring perfect synchronization with React rendering cycles and Framer Motion physical springs.

---

## 🚦 Conventions & Code Guidelines

* **Strict TypeScript:** Every new logical file must use the `.ts` or `.tsx` extension. The use of `any` is strictly prohibited in favor of explicitly defined interfaces located in `src/types/`.
* **React Keys:** When rendering lists (e.g., `map()`), always use unique database identifiers (e.g., `artist.id`) rather than array indices. This prevents UI bugs during soft-deletion or list reordering.
* **Environment Variables:** Ensure your local `.env` file (based on `.env.example`) is correctly configured so API requests resolve to the proper backend endpoint (e.g., `http://localhost:8000/api/`).

---

## 🛠️ Available Scripts

In the `frontend` directory, you can run the following commands:

| Command | Description |
|:---|:---|
| `npm run dev` | Starts the Vite development server with Hot Module Replacement (HMR). |
| `npm run build` | Executes TypeScript type-checking and builds an optimized production bundle into `dist/`. |
| `npm run lint` | Runs ESLint to statically analyze the code and catch potential issues. |
| `npm run preview` | Boots a local server to serve the production build from `dist/` (useful for pre-deployment testing). |

*Developed for VoctEnsemble by Krystian Bugalski.*