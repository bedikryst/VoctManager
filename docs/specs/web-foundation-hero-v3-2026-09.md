# VoctFoundation hero — third iteration: a produced centrepiece, not a typeset one

Date: 2026-09-18.
Status: direction approved 2026-09-18; stage 0 (this record) done; stage 1 not started.
Supersedes: §9 of [web-foundation-hero-2026-09.md](web-foundation-hero-2026-09.md) as the direction. §1–§9 there remain the record of iterations 1 and 2 and of the measurements they rest on.
Parent brief: [foundation and support page](web-foundation-brief-2026-09.md).

Every earlier rejection in memory and in the parent spec (static-only, no entrance, no logo
sting, light-only palette, the `registers.css` doctrine on entrances) is a verdict on one
execution and is **not** binding here — the developer lifted them explicitly on 2026-09-18.
What still binds is fact: performers' image rights, ZAiKS (audio), the privacy policy
(self-hosted assets only, no third-party runtimes), the build, and Core Web Vitals.

## 1. Why this iteration exists

The developer's verdict on iteration 2: "not world-class 2026". His hypothesis: top brands lean
on a lot of motion, usually produced outside code. Examined against what those sites do:

- **Half right.** What those pages share is not motion. It is a **produced centrepiece** — a
  film shot for the page, a rendered object, a title sequence — and one idea executed to the
  end. Motion is *of the centrepiece*, never applied around a stock composition. Apple's product
  heroes are scrubbed image sequences from Blender/Keyshot; Nike's and the luxury houses' are
  graded film loops; Foam's and Pentagram's cultural work is typography plus commissioned
  photography.
- **Where it is wrong.** "Made outside code" holds for film and 3D. It does not hold for
  typography and the mark: this site self-hosts three variable faces and owns a single-path mark,
  and its own `web/rite/` harness already renders code-driven motion to broadcast video
  frame by frame. Lottie/Rive would rasterise or outline what the browser sets natively. So:
  film = produced asset; type and mark = code, designed like film and reviewed as film.
- **What is actually inert in iteration 2.** The hero has typesetting but no subject.
  `kd-wcielenie-1` is a monochrome rehearsal proxy not shot for this page, sitting in a
  seven-column slot; the sentence is set once and does nothing; nothing in the frame is the
  reason the frame exists.

## 2. Thesis

**The hero is a ten-second film of the ensemble preparing, and the sentence that explains why
it must go on.** "Żeby muzyka miała ciąg dalszy." — the continuation is the subject; the film
shows what continues, the type performs the continuing.

## 3. The centrepiece: film

- **Slot.** The iteration-2 poster grid stays (H1 across the 1240 measure; row 5:7 under it;
  index band). The film takes the wide column and **bleeds to the right viewport edge** — the
  type respects the grid, the image breaks it. Straight edges, no card, no text over the film.
  16:9 on desktop; a 4:5 vertical cut under the H1 on mobile (the vertical iPhone masters exist
  for this).
- **Cut.** 8–12 s, silent, autoplay muted, looped with a hard cut at the seam (film language — a
  cut, not a crossfade; the crossfade is the SaaS tell). Three or four shots held 2.5–4 s each.
  No text, no logo, no fade from black: frame 1 is the poster and the poster is the LCP `<img>`.
- **Grade.** Warm nave light (stone, wood, candle) desaturated toward `--paper`; cobalt lives
  only in the type and the acts, so the two complement instead of compete. Grade in the browser
  (`web/public/probki/` A/B page), never in a system player — the HLG lesson from the AV1 work.
- **Grain.** One static SVG `feTurbulence` grain over the whole hero (type, paper, film) at
  roughly 4–6 %, so paper and film read as one material. A static image, not animated noise.
- **Delivery.** AV1 + H.264 ladder via `videoAssetAv1()` / `AV1_MIME` in `web/src/lib/videos.ts`
  (the pattern `VideoPlayer.tsx` already uses); desktop 1920×1080 at CRF ~30 ≈ 3–4 MB, mobile
  1080×1350 ≈ 1.5–2 MB. `preload="metadata"`, `playsinline`, `disablepictureinpicture`; start
  on IntersectionObserver, pause off-screen. `prefers-reduced-motion` or `Save-Data` → poster
  only.

**Two sources, in order.**

1. **Prototype now, from existing footage.** `web/src/assets/videos/oryginaly/landing-modal.mp4`
   is 1920×1080 H.264 BT.709, 247 s, horizontal (the two iPhone masters, `landing-aeternam.mp4`
   and `landing-wolanie.MOV`, are HLG 10-bit with rotation −90 — vertical, right for the mobile
   cut). A silent 10 s cut from it proves the composition on the real page before a single shoot
   day. It is concert footage, so the message leans "ensemble" rather than "preparation" —
   acceptable for the prototype, wrong for the final.
2. **Shoot for the page.** Brief in §5 (P3). The final replaces the prototype without any code
   change: same slot, same ladder, same poster mechanics.

## 4. The sentence: a title sequence, in code

Storyboarded first, reviewed as video, then built — never tuned live in the browser by feel.

- **Beat sheet (≈1.8 s total; only `transform`, `opacity` and `--wght` move, then nothing moves
  again):**
  - 0 ms — paper, eyebrow already set (no fade), poster frame visible.
  - 200 ms — H1 words rise in weight `200 → 600` over 900 ms on `--pen-ease`
    (`cubic-bezier(0.62, 0.02, 0.34, 1)`, `web/src/styles/landing/01-foundation.css`), 70 ms
    stagger per word; "ciąg dalszy." arrives last and lands in cobalt over the final 120 ms.
  - 900 ms — lead and both acts **cut** in (opacity 0→1 within one frame; no translate).
  - 1000 ms — film starts (`play()` over the poster; frame 1 equals the poster, so the join is
    invisible).
  - 1200 ms — index rules draw left to right (`scaleX` 0→1, 500 ms, 60 ms stagger); the
    numerals 01–04 then set.
  - After that: only the 3 px arrow nudge on hover. Scroll does nothing to the hero (Lenis
    stays as it is; no parallax, no pinned film).
- **Emphasis face — tested in the storyboard, decided on the video:** "ciąg dalszy." in
  Cormorant Garamond italic at the same cap height as the Plex Sans line. The ensemble's face
  carries the word inside the foundation's headline — the foundation's purpose *is* the
  ensemble's continuation. If it reads as a 2024 serif/sans trend rather than as an argument,
  stay in Plex.
- **Weight-axis mechanics (the inheritance trap from the parent spec §5, solved rather than
  avoided):** register `--wght` with `@property` (`syntax: "<number>"`, `inherits: false`) and
  set it per word `<span>`. `.ink-press` in `web/src/styles/registers.css` inherits through
  `font-variation-settings`, which is why iteration 2 cut the H1 off; `nave-menu.css` already
  authors the press locally the same way. `aria-label` on the H1 with the whole sentence so the
  per-word spans do not fragment the accessible name.
- **Reduced motion:** every element at its final state, film paused on the poster, no JS gate.

## 5. Production tracks

| # | Track | Who | Tool | Output | When |
| --- | --- | --- | --- | --- | --- |
| P1 | **Prototype cut** from `landing-modal.mp4`: three or four shots, silent, graded, AV1 + H.264, poster | agent | ffmpeg (the chain from the AV1 work), `probki/` A/B page | `web/src/assets/videos/fundacja-hero-{desktop,mobile}.{av1.mp4,mp4}` + poster JPEG | stage 1 |
| P2 | **Storyboard as video**: the beat sheet rendered frame-stepped through `web/rite/render.mjs` from a standalone HTML — the developer judges the entrance as an MP4, like a title card, before the page changes | agent | `web/rite/` harness (renders any HTML at 30 fps) | `web/rite/out/fundacja-hero-*.mp4`, two variants (Plex-only vs Cormorant italic emphasis) | stage 1 |
| P3 | **Shoot for the page** — one rehearsal, or the 2026-10-11 concert soundcheck in the venue (nave light). iPhone Pro in ProRes Log, or any 10-bit camera; horizontal 4K 25 fps **and** a vertical pass; tripod, and a slider or gimbal for one evening. Shot list, each held static 4–6 s: (a) breath before the entry, faces in profile, shallow focus; (b) hands and scores, one page turn; (c) the upbeat from behind the choir; (d) wide static of the choir under raking light; (e) one detail — stone, candle, a window; (f) the empty nave. Slow slider moves only; no handheld. | developer, or a hired videographer for one evening — the brief is written for either | camera, tripod, slider | masters into `oryginaly/` (excluded from the Docker context; ~1 GB is fine) | stage 3 |
| P4 | **Colour originals** of the rehearsal photographs — as new archive files, never a proxy swapped in place (the `wcielenie` gallery shares the current ones) | developer | `photos:proxy` (`web/downscale-photos.mjs`) | new `kd-*-colour` entries | stage 3 |
| P5 | **Image consent** in writing from every chorister recognisable in the film — a fundraising page is a different use class from a concert gallery | developer | — | signed list before the real footage deploys | before the stage 3 deploy |
| P6 | *Optional, later:* the mark in cobalt as a section device for the page body (the rite's stem-and-light gesture on paper) — a page decision, not a hero one; a Rive file only if a designer will own it | — | `web/rite/rite.html`, `voct-mark.svg` | — | stage 4 |

Not doing, one line each: 3D or a rendered object (off-subject, expensive); a WebGL light shader
(a second idea competing with the film); full-bleed video with text over it (the most copied hero
on the web — the poster grid with a right-bleed slot is rarer and editorial); custom cursor or
magnetic buttons (2019); a scroll-pinned or scrubbed hero (the page is editorial, not a product
tour); audio (ZAiKS, and autoplay audio is blocked anyway); Lottie/Rive for type or mark (the
browser sets them better and the harness already exports them).

## 6. Stages and files

**Stage 0 — record (done 2026-09-18).** This file; a `Status:` pointer in the parent hero spec;
the foundation-page memory updated so the next session does not restore the static verdict.

**Stage 1 — two videos, no page change (one session).**
- P1 prototype cut: ffmpeg, `probki/` A/B, shot selection with the developer on the A/B page.
- P2 storyboard: standalone `web/rite/fundacja-hero.html` (same fonts via `../public/fonts`),
  rendered by `render.mjs` at 1440×900 and 390×844, two emphasis variants.
- The developer reviews both as files. Decisions taken on them: shot order, emphasis face, and
  whether the 1440×900 fold matters once the film is the subject (the agent's position: it does
  not).

**Stage 2 — build (one or two sessions).** Only `web/src/components/pages/FoundationPage.astro`
(`.foundation-hero` markup and styles) plus `web/src/lib/videos.ts` if a poster/vertical helper
is needed. Right-bleed slot; `<video>` ladder with a poster `<img fetchpriority="high">`; grain
filter; `@property --wght` per-word press; cut-in for lead and acts; index-rule draw;
IntersectionObserver play/pause; reduced-motion and Save-Data paths; `sizes` and `aspect-ratio`
so CLS stays 0. Copy unchanged, so no desk round and no locale edits. Nothing below
`#na-co-ida-srodki` moves.

**Stage 3 — production footage (the developer's calendar).** P3 shoot → grade → the same ladder
→ swap files. P4 colour photographs land in the page body when its own redesign comes. P5 signed
before deploy.

**Stage 4 — the body follows (separate spec).** Once the hero stands, the "practical pages"
below will read as a different site. The rule to carry down: Plex 600 heads, cobalt as the one
accent, the grain, and cuts rather than fades. Outside this spec's implementation.

## 7. Verification

- Stage 1: both MP4s open and play in Edge; the prototype's poster equals frame 1 (ffmpeg
  `-frames:v 1` diff); AV1 files tagged `bt709` (`ffprobe color_transfer`).
- Stage 2: `npm run check` and `npm run build` in `web/`; screenshots at 320/390/768/1024/1440
  PL and 1440 EN/FR through the `vm-shot` harness (system Edge), plus one run with
  `prefers-reduced-motion: reduce` emulated — the final state must equal the animated end state.
  Lighthouse on `/fundacja`: LCP is the poster `<img>`, CLS 0, hero video ≤ 4 MB desktop /
  ≤ 2 MB mobile, no request to any third party. Keyboard: acts and index links reachable in DOM
  order; the H1's accessible name is the whole sentence.
- Stage 3: the consent list is complete for every face in the final cut before
  `FOUNDATION_PAGE_LINKED` flips.

## 8. Open inputs from the developer

- Access to the next rehearsal or the 2026-10-11 soundcheck with a camera or iPhone Pro — or a
  videographer for one evening. Does not block stage 1.
- Location of the colour rehearsal originals (outside the repo) for P4.
