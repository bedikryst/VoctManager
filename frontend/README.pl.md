# ⚛️ VoctManager – Aplikacja Frontendowa

🌍 *Przeczytaj w innych językach: [English](README.md), [Polski](README.pl.md).*

![Vite 7](https://img.shields.io/badge/Vite_7-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![React 19](https://img.shields.io/badge/React_19.2-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript 5.9](https://img.shields.io/badge/TypeScript_5.9-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind v4](https://img.shields.io/badge/Tailwind_v4.2-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Framer Motion v12](https://img.shields.io/badge/Framer_Motion_v12-black?style=for-the-badge&logo=framer&logoColor=blue)
![TanStack Query v5](https://img.shields.io/badge/TanStack_Query_v5-FF4154?style=for-the-badge&logo=react-query&logoColor=white)

Ten katalog zawiera kod źródłowy **uwierzytelnionej aplikacji jednostronicowej (SPA)** platformy **VoctManager** — operacyjnego panelu ERP (`/panel/*`) oraz publicznych ścieżek autoryzacji (`/login`, `/activate`, `/documents/*`). Baza kodu jest zbudowana wokół trzech celów: **ścisłego Feature-Sliced Design**, **UX bez przesunięć układu (zero-layout-shift) przy 60 FPS** oraz **buforowania stanu serwera** przez TanStack Query.

> **Publiczna strona marketingowa została przeniesiona.** Landing voctensemble.com + podstrony (`/`, `/koncerty`, `/o-nas`, `/kontakt`, `/polityka-prywatnosci`) są teraz osobną aplikacją Astro w [`../web/`](../web/) — patrz [web/README.md](../web/README.md). SPA nie zawiera już powierzchni marketingowej, bramy progowej (Threshold), lejka datków (Vault) ani silnika audio; te żyją obecnie jako wyspy Astro. Oba buildy współdzielą backend Django pod `/api/*`.

---

## 🏗️ Architektura — Feature-Sliced Design (FSD)

Frontend ściśle przestrzega metodologii [Feature-Sliced Design](https://feature-sliced.design/). Importy płyną **wyłącznie w dół** — wyższa warstwa może importować z warstw poniżej, nigdy w bok ani w górę. Gwarantuje to izolację domeny i zapobiega klasycznej degeneracji „wszystko importuje wszystko" dużych baz kodu React.

```text
src/
├── app/              ← Powłoka aplikacji (najwyższa warstwa)
│   ├── providers/    # Providery najwyższego poziomu (AuthProvider, CSRFProvider, CursorProvider)
│   ├── router/       # Strażnicy tras (ProtectedRoute, ManagerRoute) + preloadery danych panelu
│   ├── store/        # Store Zustand na poziomie aplikacji (useAppStore)
│   └── styles/       # Globalna warstwa Tailwind v4 + tokeny Ethereal
│
├── pages/            ← Kompozycje na poziomie tras
│   ├── auth/         # Logowanie, reset hasła, aktywacja konta
│   └── panel/        # Uwierzytelnione trasy panelu ERP
│
├── widgets/          ← Złożone bloki UI budowane z features + shared
│   ├── domain/       # Widgety domenowe cross-feature (dashboardy, karty podsumowań)
│   ├── panel-shell/  # Chrome panelu (sidebar, navbar, breadcrumbs)
│   └── utility/      # Widgety generyczne (error boundaries, stany puste)
│
├── features/         ← Samodzielne wycinki domeny
│   ├── archive/      # Archiwum repertuaru + przegląd kompilatora partytur AI (utwory, edycje)
│   ├── artists/      # Zespół, profile, głosy
│   ├── auth/         # Przepływy uwierzytelniania + cykl życia JWT
│   ├── chorister-hub/# Baza wiedzy + metryki tożsamości artysty
│   ├── contracts/    # Generowanie umów i pobieranie WeasyPrint
│   ├── crew/         # Ekipa sceniczna, personel techniczny
│   ├── dashboard/    # Hooki danych dashboardu Bento
│   ├── logistics/    # Lokalizacje, podróże, zarządzanie miejscami
│   ├── materials/    # Dystrybucja nut + audio referencyjnego
│   ├── messages/     # Wątki 1:1 + kanały projektów, triage i skrzynka dyrygenta
│   ├── notifications/# Web push (VAPID) + log emaili transakcyjnych
│   ├── projects/     # Projekty koncertowe, casting, arkusze produkcyjne
│   ├── rehearsals/   # Planowanie prób + obecność
│   ├── schedule/     # Synchronizacja iCal, feed kalendarza
│   └── settings/     # Ustawienia użytkownika i systemu
│
└── shared/           ← Reużywalne bloki budulcowe (najniższa warstwa)
    ├── api/          # Klient Axios, interceptory, generowane typy OpenAPI
    ├── assets/       # Zasoby statyczne (próbki audio, ilustracje)
    ├── auth/         # Dekodowanie JWT, pomocniki sesji
    ├── config/       # Konfiguracja i18n + scentralizowane locales, manifest nawigacji
    ├── hooks/        # Hooki cross-domenowe (useDebounce, useMediaQuery…)
    ├── lib/          # Czyste utility (data, waluta, pomocniki plików)
    ├── types/        # Globalne typy TypeScript
    └── ui/
        ├── primitives/    # Atomowe prymitywy (Button, Input, Heading, Text…)
        ├── composites/    # Złożone UI (GlassCard, PageHeader, MetricBlock, Avatar…)
        ├── kinematics/    # Prymitywy ruchu (PageTransition, EtherealLoader…)
        └── instruments/   # Prymitywy muzyczne (PitchPipe / kamerton)
```

> **Uwaga:** warstwa `entities/` jest celowo pominięta. Encje domenowe żyją obok swojej macierzystej funkcji (`features/<domena>/types/`), utrzymując graf zależności płaskim bez utraty dyscypliny FSD.

---

## 🧠 Strategia zarządzania stanem

Aplikacja ściśle rozdziela stan na **stan serwera** i **stan klienta** — nigdy się nie mieszają.

### 1. Stan serwera — TanStack Query v5.91+

Wszystkie dane asynchroniczne (projekty, zespół, archiwum, wyniki kompilatora partytur) płyną przez `@tanstack/react-query`. Każda funkcja posiada własne hooki zapytań w `features/<domena>/hooks/`.

- **Optimistic UI:** mutacje (zmiany castingu, potwierdzenie obecności, edycje archiwum) aktualizują cache natychmiast, a następnie uzgadniają stan po odpowiedzi serwera. Niepowodzenia są transparentnie wycofywane.
- **Domyślne stale-while-revalidate** utrzymują responsywność UI, podczas gdy odświeżanie w tle pozostaje niewidoczne dla użytkownika.
- **Klucze zapytań są ograniczone do domeny** (`["archive", "piece", pieceId]`), więc unieważnienia cross-feature pozostają chirurgicznie precyzyjne.

### 2. Stan klienta — Zustand v5+

Używany **wyłącznie** dla globalnego stanu UI, którego nie da się rozsądnie umieścić w URL lub kontekście: widoczność paneli wysuwanych, ulotne wersje robocze formularzy, preferencje użytkownika. Store'y żyją w `app/store/` (cała aplikacja) lub `features/<domena>/store/` (ograniczone do domeny).

> **Zasada kciuka:** jeśli fragment stanu pochodzi z API, należy do TanStack Query. Wszystko inne to albo lokalny stan komponentu, albo — jeśli musi być współdzielony — mały wycinek Zustand.

---

## 🎨 Styling, kinematyka i system projektowy

1. **Tailwind CSS v4.2+** — utility-first; cały system projektowy Ethereal (tokeny kolorów, skala z-index, cienie, utility szumu) jest zdefiniowany w [`app/styles/index.css`](src/app/styles/index.css). Surowa typografia HTML i doraźny glassmorphism (`bg-white/10`) są **zabronione** — patrz `CLAUDE.md` w korzeniu projektu dla mandatu No-Raw-HTML.
2. **Framer Motion v12+** — wszystkie deklaratywne animacje wejścia, gesty i kinematyka powiązana ze scrollem. Animacje ograniczone wyłącznie do `transform` i `opacity`, zapewniając akcelerację sprzętową i utrzymane 60 FPS.
3. **Primitywy Radix UI** — dostępne fundamenty dla Dialog, Tooltip, Switch, Slot. W połączeniu z semantycznym HTML spełniają bazowe wymogi Europejskiego Aktu o Dostępności. (Płynne przewijanie Lenis żyje w aplikacji Astro [`../web/`](../web/) — panel używa natywnego przewijania platformy.)

---

## 🛣️ Routing i podział kodu

Tablica tras znajduje się w [`app/App.tsx`](src/app/App.tsx) przy użyciu **React Router v7**; strażnicy dostępu (`ProtectedRoute`, `ManagerRoute`) i bezczynne preloadery chunków panelu żyją w [`app/router/`](src/app/router/). Każda trasa panelu jest lazy-loadowana za granicą `<Suspense>` renderującą `<EtherealLoader>` — nigdy generycznego spinnera. Trasy autoryzacji (`/login`, `/activate`) i pełnoekranowa trasa `/documents/:docType/:docId` rozwiązują się względem zewnętrznego `<Suspense fallback={null}>`, więc loader SaaS nigdy nie miga na tych powierzchniach. Trafienie w `/` w buildzie SPA przekierowuje na `/panel` — produkcyjny nginx serwuje pod `/` aplikację Astro. Utrzymuje to mały początkowy bundle JS i gwarantuje stabilny, zgodny z marką stan ładowania.

---

## 🌍 Internacjonalizacja

Platforma dostarcza **i18next v26** + `react-i18next` v17, wspierając angielski, francuski i polski. Tłumaczenia są scentralizowane w [`shared/config/locales/{en,fr,pl}/translation.json`](src/shared/config/locales/) i ładowane synchronicznie przy starcie (bez migania Suspense). Język jest rozwiązywany przez `localStorage` → domyślny przeglądarki, z `pl` jako fallback. Klucze są ponownie ekstrahowane przez:

```bash
npm run extract-i18n
```

---

## 🚦 Konwencje i wytyczne kodu

* **Wyłącznie eksporty nazwane.** Eksporty domyślne są zarezerwowane dla komponentów stron (konwencja oczekiwana przez React Router).
* **Bez `any`.** Surowy TypeScript w całej bazie kodu; typy pochodzą z `shared/types/`, generowanych typów OpenAPI w `shared/api/` lub lokalnych folderów `types/` per funkcja.
* **Bez surowej typografii HTML.** Używaj `<Heading>`, `<Text>`, `<Eyebrow>`, `<Metric>` z `shared/ui/primitives/typography/`.
* **Bez magicznych wartości Tailwind.** Używaj tokenów Ethereal (`text-ethereal-gold`, `z-nav-dock`, `shadow-glass-ethereal`) zdefiniowanych w `app/styles/index.css`.
* **Klucze list React** muszą być stabilnymi identyfikatorami z bazy danych (`artist.id`), nigdy indeksami tablicy — zapobiega to uszkodzeniu UI podczas miękkiego usuwania i zmiany kolejności.
* **Komentarz nagłówkowy pliku** wymagany w każdym pliku (patrz `CLAUDE.md` w korzeniu projektu §5).
* **Zmienne środowiskowe** — skopiuj `.env.example` do `.env` i wskaż `VITE_API_URL` na origin swojego backendu (domyślnie: `http://localhost:8000`; sufiks `/api/` jest dodawany przez klienta Axios).

---

## 🛠️ Dostępne skrypty

Uruchamiane z katalogu `frontend/`:

| Komenda | Opis |
|:---|:---|
| `npm run dev` | Serwer deweloperski Vite z HMR (domyślny port `5173`). |
| `npm run build` | Sprawdzenie typów + build produkcyjny do `dist/`. |
| `npm run build:analyze` | Build produkcyjny z raportem bundle `rollup-plugin-visualizer`. |
| `npm run preview` | Serwowanie buildu `dist/` lokalnie do weryfikacji przed wdrożeniem. |
| `npm run lint` | ESLint z regułami `typescript-eslint` + `react-hooks`. |
| `npm run extract-i18n` | Ponowna ekstrakcja kluczy tłumaczeń przez `i18next-cli`. |

---

## 📦 Kluczowe zależności (wersje w `package.json`)

* **Rdzeń:** `react@19.2`, `react-dom@19.2`, `react-router-dom@7`, `vite@7.3`, `typescript@5.9`
* **Stan i dane:** `@tanstack/react-query@5.91+`, `zustand@5+`, `axios@1.13+`
* **UI / ruch:** `framer-motion@12+`, `@radix-ui/react-*`, `lucide-react`
* **Formularze i walidacja:** `react-hook-form@7.74+`, `zod@4.3+`, `@hookform/resolvers@5+`
* **Interakcja:** `@dnd-kit/core@6+`, `@dnd-kit/sortable@10+` (gotowe na TouchSensor)
* **PDF i mapy:** `react-pdf@10+`, `@vis.gl/react-google-maps`
* **i18n:** `i18next@26+`, `react-i18next@17+`
* **PWA:** `vite-plugin-pwa@0.21+`, `workbox-precaching@7+`

---

*Zaprojektowane i zbudowane dla VoctEnsemble przez Krystiana Bugalskiego — VoctManager 2026 / Ethereal Design System.*
