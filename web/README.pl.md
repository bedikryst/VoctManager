# 🌅 VoctEnsemble / VoctFoundation — Strona publiczna (Astro)

🌍 *Przeczytaj w innych językach: [English](README.md), [Polski](README.pl.md).*

![Astro 6](https://img.shields.io/badge/Astro_6.3-%23BC52EE.svg?style=for-the-badge&logo=astro&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript 6](https://img.shields.io/badge/TypeScript_6-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![View Transitions](https://img.shields.io/badge/View_Transitions-API-c6a45b?style=for-the-badge)

Ten katalog zawiera kod **publicznej strony marketingowej** VoctEnsemble (voctensemble.com / .pl) i VoctFoundation (voctfoundation.pl / .com / .org) — wszystkie pięć domen rozwiązuje się do tego samego buildu Astro. Strona to art-directed sakralny minimalizm w duchu *„Nawy światła"*: ręcznie pisany CSS, art-directed obrazy, oszczędne wyspy React dla genuinely-stateful kawałków (lejek datków Vault, brama audio Threshold, chrome nagłówka). Zbudowane jako osobna aplikacja od panelu SPA w [`../frontend/`](../frontend/); oba buildy współdzielą backend Django pod `/api/*`.

> **Dlaczego Astro, a nie SPA?** Powłoka CSR React była regresją SEO/perf dla strony fundacji starającej się o Google Ad Grants. Astro daje crawlable statyczny HTML + natywne View Transitions + selektywną hydratację — przejścia na poziomie Awwwards bez pustej powłoki `#root`. Decyzja zapadła 2026-05-27; uzasadnienie zarchiwizowane w `MEMORY.md` (`project_react_landing_migration`).

---

## 🎨 Mandat projektowy — art-directed, *nie* Ethereal

Ta strona **NIE podlega projektowemu mandatowi z `CLAUDE.md`** (No-Raw-HTML / Tailwind / Ethereal tokens). To ręcznie pisany sacred-minimalism landing w duchu pierwotnego `LandingPage.html` (patrz `MEMORY.md` → `project_landing_page_html`). Surowe `<h1>`, `<p>`, własny CSS, ręczne gradienty — wszystko dozwolone. Jedyne reguły:

* **Najnowsze technologie 2026, zero długu technicznego.**
* **Ścisłe RODO:** żadnego Google Fonts, Maps, Spotify embeds, reCAPTCHA, analityki ustawiającej cookie. Wszystko self-hostowane (fonty pod `public/fonts/`, ambient audio w `public/ambient.m4a`).
* **Bazowy poziom Awwwards:** każda interaktywna powierzchnia musi być akcelerowana sprzętowo (`transform` / `opacity`), respektować `prefers-reduced-motion` i gracefully degradować bez JS.
* **Kierunek kreatywny:** *Nawa światła* — sakralny minimalizm, splot A-B-C, JASNA paleta paper. Pełna specyfikacja w `.ai/07_marketing_public_site.md` §10 i obowiązuje na wszystkich podstronach.

---

## 🏗️ Architektura

Patrz wersja angielska — układ folderów identyczny. Krótki przegląd:

* **`pages/`** — Astro file-based routing z `build.format: "file"` → `index.html` / `koncerty.html` / `o-nas.html` / `kontakt.html`.
* **`layouts/BaseLayout.astro`** — `<head>`, SEO/OG/canonical, `ClientRouter`, cykl życia Lenis, globalny reveal + parallax.
* **`components/`** — komponenty Astro (zero JS, dopóki nie zhydratowane).
* **`islands/landing/`** — wyspy React, hydratowane tylko tam gdzie naprawdę potrzeba stanu (Preloader, ThresholdGate, AudioController, StickyHeader, SiteCursor, SiteFooter, VaultIsland + Vault/Regulamin/Gratitude/Failure modale).
* **`scripts/`** — plain-TS skrypty: `landing.ts` (kinetyczna typografia + reveal/parallax/rite-glow), `vault-triggers.ts` (capture-phase delegate dla `[data-vault-open]`).
* **`styles/`** — `tokens.css` (CSS custom properties), `base.css` (reset, fonty, reveal, View Transitions, brand-glyph), `landing.css` (sacred-minimalism choreography), `vault.css` (modale datków).
* **`data/landing/`** — ręcznie kuratorowane moduły TS (manifestLines, paths).
* **`content/`** — YAML collections do edycji przez zespół (`concerts/`, `repertoire/`).
* **`assets/photos/`** — oryginalne JPG-i (gitignorowane, wgrywane ręcznie na build host).

---

## 🌬️ Kinematyka i system ruchu

* **Astro `<ClientRouter />`** — natywne View Transitions napędzają przejścia między stronami. Cinematic root fade (320ms wyjście / 540ms wejście) + shared `view-transition-name: voct-brand`, więc świeca-mark morphuje płynnie między stronami. Sakralny ton, akceleracja sprzętowa, zero JS.
* **Reveal** — `.reveal` (+ `data-d="1..4"` stagger) ukryty przez `html.reveal-ready` (inline head script z `data-astro-rerun`, więc re-arms na każdym ClientRouter swap). IntersectionObserver dodaje `.is-in`. Powyżej-fold animuje się przy load.
* **Parallax** — JS przez `data-parallax="0.16"`. Natywne `animation-timeline` wciąż częściowe w Firefox/Safari, więc pojedyncza pętla rAF w `BaseLayout`.
* **Manifest „odsłania"** — światło emanuje Z TEKSTU (textShadow gold bloom + variable-font `wght` axis breath 320 → 480 peak → 360 settled + per-word stagger 28ms). Brak backdrop shaft — *„sacrum nie zdobi, odsłania"*.
* **Lenis v1.3+** — smooth scroll na poziomie okna w BaseLayout. Fine-pointer + motion-allowed only. Re-anchored na `astro:after-swap`.

---

## 🏝️ Komunikacja między wyspami

Każda wyspa Astro to **osobny root React** — providery z jednej nie sięgają drugiej. Stan, który musi przekraczać granice wysp, podróżuje przez `window` CustomEvents:

| Zdarzenie | Kierunek | Payload | Właściciel |
|:---|:---|:---|:---|
| `voct:open-vault`   | header / footer / CTA → `VaultIsland`           | `{ amount?: number }` | `VaultIsland.VaultBridge` |
| `voct:toggle-audio` | `StickyHeader` → `AudioController`              | (brak)                 | `AudioController` |
| `voct:audio-state`  | `AudioController` → `StickyHeader` (i inne)     | `{ isOn: boolean }`    | `AudioController` (broadcaster) |

`window.__voctAudioOn` lustrzy stan audio dla race-proof odczytów.

---

## 🛣️ Routing, cutover i nginx

* **Strony są statyczne.** `build.format: "file"` emituje `index.html`, `koncerty.html`, `kontakt.html`, `o-nas.html` do `dist/`. Produkcyjny nginx (`../infra/nginx/prod.conf`) używa `try_files /<page>.html` dla czystych URL.
* **`/_astro/*`** to content-addressed, serwowane z `Cache-Control: public, max-age=31536000, immutable`.
* **`/home`** — legacy SPA preview path; permanent redirect do `/` przez nginx.
* **Deploy produkcyjny jest w pełni Dockerised.** `frontend/Dockerfile` to multi-stage build z `context: <repo root>` — Stage 1 buduje panel SPA, Stage 2 (`web-builder`) uruchamia `npm ci` + `npm run build` dla tej aplikacji Astro, Stage 3 (runtime nginx) kopiuje *oba* drzewa dist do `/usr/share/nginx/html/app` i `/usr/share/nginx/html/marketing`. Brak host bind-mountu `web/dist`; brak Node na hoście. `docker compose -f docker-compose.yml -f docker-compose.prod.yml build frontend` to jedna komenda. **Host buildu musi jednak zawierać `web/src/assets/photos/` wypełnione oryginalnymi JPG-ami** (są gitignorowane — należą do współtwórców). Brakujące zdjęcie wywala stage Astro z czytelnym błędem `[photos] No image "<name>"`.

---

## 🔌 Powierzchnia backendowa

Dwa endpointy konsumowane:

* **`POST /api/payments/donations/initiate/`** — Axepta hosted-link redirect. Vault inicjuje darowiznę, brama zwraca `?donated=success|failure`, modal wyniku self-triggers.
* **`POST /api/contact/`** (od 2026-05-25) — publiczny formularz kontaktu (Django `contact` app). Obecnie na `/kontakt` widoczne tylko kanały kontaktowe; formularz czeka na finalną weryfikację RODO.

`/donation-progress.json` to statyczny asset z `public/`, nie z Django — display poziomu odświeża się tylko przy ładowaniu strony.

---

## 🚦 Konwencje i wytyczne

* **Zdjęcia żyją poza repo.** `src/assets/photos/` jest gitignorowane (`web/.gitignore`) — oryginały to 5-12 MB JPG-i należące do artystów. Wgrywaj ręcznie na build host przed `npm run build`. `lib/photos.ts` rozwiązuje je po bare name (`photo("hero-landing")`, `bleedPair("koncerty-hero")`).
* **Full-bleed obrazki** idą przez `<BleedImage desktop mobile alt position … />` — emituje AVIF + WebP w responsive widths z 1920px WebP fallback `<img src>`. In-flow obrazki używają Astro `<Picture>`.
* **Brak zewnętrznych framework'ów CSS.** Tokeny w `tokens.css`, primitivy w `base.css`, art-directed CSS per strona / sekcja. Tailwind nie jest tu zainstalowany.
* **Brak `any`.** Strict TypeScript. Bramka `astro check` musi zostać przy `0 errors / 0 warnings`.
* **Komentarz nagłówkowy pliku** wymagany w każdym nowym pliku.

---

## 🛠️ Dostępne skrypty

Uruchamiane z katalogu `web/`:

| Komenda | Opis |
|:---|:---|
| `npm run dev`     | Astro dev server z HMR (domyślny port `4321`). Dev Toolbar pojawia się na dole strony — **tylko w dev**, nie w buildzie. |
| `npm run build`   | Type-check + build produkcyjny do `dist/`. Pipeline obrazków (Sharp) działa tutaj. |
| `npm run preview` | Serwuje `dist/` lokalnie — kanoniczny sposób weryfikacji produkcji (caching, fonty, View Transitions). |
| `npm run check`   | `astro check` — TypeScript + Astro diagnostyka. Musi zostać 0/0 przed merge. |

---

## 📦 Kluczowe zależności

* **Rdzeń:** `astro@6.3+`, `@astrojs/react@5+`, `react@19`, `react-dom@19`, `typescript@6`
* **Ruch:** `lenis@1.3+` (smooth-scroll na poziomie okna)
* **Narzędzia:** `@astrojs/check`

---

## 🔐 Prywatność i przechowywanie w przeglądarce

Strona nie ustawia żadnych first-party cookies, nie wysyła analityki, nie embeduje third-party trackerów. Przechowywanie w przeglądarce ogranicza się do kilku strictly-necessary functional wpisów (udokumentowane w `public/polityka-prywatnosci.html` §10):

| Klucz | Storage | Cel | Czas życia |
|:---|:---|:---|:---|
| `voct.demo.audio` | localStorage | Wybór progowy (cisza / głos) | 3 godziny |
| `voct.preloader.seen` | sessionStorage | Pominięcie rytualnego wejścia przy powrotach w sesji | zamknięcie karty |
| `voct.preloader.last-load` | sessionStorage | Odróżnienie odświeżenia od ClientRouter swap | zamknięcie karty |

Skrypty bramki płatności (BNP Paribas Axepta / PayU) ładują się tylko gdy użytkownik wchodzi w lejek datków; ich cookies są strictly necessary dla transakcji (PSD2 SCA, fraud detection).

---

*Zaprojektowane i zbudowane dla VoctEnsemble / VoctFoundation przez Krystiana Bugalskiego — publiczna strona Astro, sacred-minimalism build.*
