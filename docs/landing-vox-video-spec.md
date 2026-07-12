# Spec: concert video on the landing — Vox moment, hero CTA, video lightbox, donation reorg

Status: READY TO IMPLEMENT · Written 2026-07-10 · Frontend (`web/` Astro app) only · No backend, no migrations.

Every file path and line number below was verified against the current tree on 2026-07-10.
Trust them; only re-verify if a line number is off by a few. **Nothing here needs discovery —
implement top to bottom.** All work happens in `web/` (the Astro marketing site — panel
conventions like Ethereal tokens do NOT apply; `web/` owns its CSS, see `.ai/07_marketing_public_site.md`).

---

## Background — decisions locked with the owner (do not re-litigate)

1. **The landing gets exactly ONE curated concert video** (a 60–90 s reel), reachable from
   three places: a hero CTA, an in-flow "Vox" moment in movement II, and per-concert
   "Zobacz fragment" links in the path register. `/press` remains the full video library.
2. **All video is self-hosted MP4.** GDPR hard rule (`.ai/07` §Hard rules): zero third-party
   requests — a YouTube/Vimeo **iframe is forbidden** (it phones home before any consent).
   An outbound *link* to YouTube is fine; an embed is not.
3. **Placeholder era:** every video slot uses the existing `/demo/demo_video.mp4`
   (already in `web/public/demo/`). The owner swaps real footage later — all sources live in
   ONE new file (`web/src/data/landing/video.ts`) so the swap is a one-file edit.
   ⚠ Do not deploy publicly while placeholders are wired — same caveat as `/press`.
4. **Donation reorg:** the hero's standing donation pill ("Następny Koncert Duchowy powstaje
   teraz — pomóż mu wybrzmieć") is removed; the experience (video) becomes the hero's primary
   CTA. Donation asks concentrate in movement III (*Sustinete nos*) + the path-next card +
   the header "Wesprzyj" (all unchanged). When a real concert date lands, an announcement
   pill returns to the hero — keep that note in the code comment.
5. **Ambient interplay:** the page's ambient bed (`/ambient.m4a`, a ~50 s perfect-loop
   recording of the actual choir) keeps playing site-wide. When any video plays, the bed
   **ducks** (fades to gain 0.04 over 600 ms) and **restores** (900 ms) when the video
   pauses/ends/closes. The plumbing already exists: `voct:audio-duck` / `voct:audio-restore`
   are honoured by [AudioController.tsx:80-96](../web/src/islands/landing/AudioController.tsx#L80-L96)
   and are non-invasive (never flip the saved Cisza/Głos choice; no-op when ambient is off).
   The new player only has to dispatch them.
6. **ListenMoment is superseded.** The audio-only "Posłuchaj" island (dormant — its
   `/audio/vox-excerpt.*` asset never materialised) is replaced by the video VoxMoment.
   Delete it (Part H).
7. **SilenceMoment needs NO work** — its scroll-lock was already removed
   ([landing.ts:518-529](../web/src/scripts/landing.ts#L518-L529), "no scroll-lock, ever").

### Confirmed facts (verified against the tree — do not re-derive)

- Duck/restore handler: [AudioController.tsx:80-96](../web/src/islands/landing/AudioController.tsx#L80-L96).
  Duck detail shape: `{ gain?: number }`, default 0.05; ListenMoment used `0.04` — keep 0.04.
- Static-DOM → island event delegation precedent: `setupInteractions` in
  [landing.ts:534-566](../web/src/scripts/landing.ts#L534-L566) (`[data-vault-open]` →
  `voct:open-vault`). Our `[data-video-open]` block is appended inside the same `onClick`.
- Modal precedent: `VaultModal` uses `useBodyClass("vault-open")`
  ([VaultModal.tsx:33](../web/src/islands/landing/vault/VaultModal.tsx#L33)) +
  `data-lenis-prevent` on the panel (line 60) + scroll lock via
  `body.theme-marketing.vault-open` ([08-vault.css:1](../web/src/styles/landing/08-vault.css#L1)).
- Hooks ready to reuse: [useBodyClass.ts](../web/src/islands/landing/hooks/useBodyClass.ts)
  (refcounted body class), [useFocusTrap.ts](../web/src/islands/landing/hooks/useFocusTrap.ts)
  (`(ref, active, { onEscape })` — restores focus on deactivate).
- Pre-hydration guard precedent: `VaultBuffer` + `window.__voctVaultBuffer`. We use a simpler
  flag (`window.__voctVideoReady`) because the video CTA has a meaningful native fallback
  (its `href` IS the MP4).
- `index.astro`: ListenMoment import at line 35, mount at line 113
  (`<ListenMoment client:visible />`), `VaultIsland client:idle` at line 127, `getImage` +
  `bleedPair` already imported (lines 11–13), jsonLd at lines 46–72.
- `HeroSection.astro`: hero-occasion pill = lines 39–51; hero-actions = lines 52–57
  (primary "Poznaj nas" → `/o-nas`, secondary "Koncerty Duchowe" → `/koncerty`).
- `EnsembleSection.astro`: `FACTS` array = lines 15–19; intro paragraph = lines 30–35;
  facts grid div = lines 36–45. `.ensemble*` styles live in
  `web/src/styles/landing/04-rooms-interludes.css`.
- `PathSection.astro`: `path-entry-summary` paragraph = line 40, `<details>` = lines 41–62.
- `paths.ts`: `interface Path` = lines 22–35.
- Styles barrel: [landing.css:22](../web/src/styles/landing.css#L22) imports `12-listen.css`.
- `--night` token exists (used by press styles); landing tokens: `--paper`, `--ink`,
  `--ink-muted`, `--candle`, `--line`, `--serif`, `--mono`, `--ease`, `--ease-slow`.

---

## Part A — video source SSOT

**New file** `web/src/data/landing/video.ts`:

```ts
/**
 * @file video.ts
 * @description Video sources for the landing — single source of truth. ALL entries are
 *  PLACEHOLDER (/demo/demo_video.mp4, shared with /press) until the real cuts arrive:
 *  swap the paths here (and in paths.ts `video` fields), nothing else changes. Self-hosted
 *  MP4 only — GDPR hard rule: no YouTube/Vimeo embeds (an outbound link is fine, an iframe
 *  is not). Recommended real-asset home: web/public/video/.
 * @architecture Astro islands 2026
 * @module data/landing/video
 */

export interface VideoSource {
  /** Public URL of a self-hosted MP4 (H.264 + AAC), served from web/public. */
  readonly src: string;
  /** Mono caption line rendered under the frame and in the lightbox. */
  readonly caption: string;
}

/** The 60–90 s concert reel — hero CTA + the Vox moment in movement II. */
export const REEL: VideoSource = {
  // PLACEHOLDER — swap for the real reel (e.g. /video/voct-reel.mp4) when it lands.
  src: "/demo/demo_video.mp4",
  caption: "Fragment Koncertu Duchowego · VoctEnsemble",
};
```

Creative note for the eventual swap (owner-facing, keep in mind when cutting): the in-flow
Vox frame sits inside the page's calm — prefer the **calmest horizontal material** there
(long takes, slow or static camera, live a cappella sound, no music-bed). The dynamic
Instagram-style cut is acceptable **in the lightbox** (a separate dark room), less so in-flow.

## Part B — shared player: `VideoPlayer`

**New file** `web/src/islands/landing/video/VideoPlayer.tsx`. Custom minimal chrome (never
native `controls`): poster + circle play affordance, click-to-toggle, hairline scrub, mono
time label, fullscreen. Owns the ambient contract and single-voice exclusivity.

```tsx
/**
 * @file VideoPlayer.tsx
 * @description Shared minimal video player for the landing's video surfaces (VoxMoment
 *  in-flow, VideoLightbox overlay). Custom chrome in the site's register — poster + circle
 *  play affordance, hairline scrub, mono time label, fullscreen — never native controls.
 *  Owns the ambient-bed contract: dispatches `voct:audio-duck` before play and
 *  `voct:audio-restore` on pause/end/unmount (AudioController fades the choir loop and
 *  no-ops when the visitor chose silence). Broadcasts `voct:video-play` so only one video
 *  sounds at a time, and pauses itself when scrolled out of view. Self-hosted media only.
 * @architecture Astro islands 2026
 * @module islands/landing/video/VideoPlayer
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

interface VideoPlayerProps {
  readonly src: string;
  readonly poster?: string;
  readonly caption?: string;
  /** Lightbox: try to start immediately (rides the opening click's transient activation). */
  readonly autoPlay?: boolean;
}

/** Same dip ListenMoment used — the choir bed recedes under the video, never dies. */
const DUCK_GAIN = 0.04;

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({
  src,
  poster,
  caption,
  autoPlay = false,
}: VideoPlayerProps): React.JSX.Element {
  const id = useId();
  const [playing, setPlaying] = useState(false);

  const rootRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  // Render-time ref mirror (same pattern as AudioController.tsx:23-24) so window listeners
  // and the IntersectionObserver read fresh state without re-subscribing.
  const playingRef = useRef(false);
  playingRef.current = playing;

  const restore = useCallback((): void => {
    window.dispatchEvent(new CustomEvent("voct:audio-restore"));
  }, []);

  const pause = useCallback((): void => {
    videoRef.current?.pause();
  }, []);

  const play = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;
    window.dispatchEvent(new CustomEvent("voct:audio-duck", { detail: { gain: DUCK_GAIN } }));
    window.dispatchEvent(new CustomEvent("voct:video-play", { detail: { id } }));
    try {
      await video.play();
    } catch {
      // Autoplay refused (transient activation expired) — stay in poster state.
      restore();
    }
  }, [id, restore]);

  // Media events are the single source of truth for `playing` — covers native fullscreen
  // controls on iOS and OS media-session pauses, not just our buttons.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = (): void => setPlaying(true);
    const onPause = (): void => {
      setPlaying(false);
      restore();
    };
    const onEnded = (): void => {
      setPlaying(false);
      restore();
      video.currentTime = 0;
      fillRef.current?.style.setProperty("transform", "scaleX(0)");
    };
    const onTime = (): void => {
      if (video.duration > 0) {
        fillRef.current?.style.setProperty(
          "transform",
          `scaleX(${video.currentTime / video.duration})`,
        );
      }
      if (timeRef.current) {
        timeRef.current.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onTime);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onTime);
    };
  }, [restore]);

  // Only one video sounds at a time: any player starting broadcasts; the others pause.
  useEffect(() => {
    const onOther = (event: Event): void => {
      const otherId = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (otherId !== id && playingRef.current) pause();
    };
    window.addEventListener("voct:video-play", onOther);
    return () => window.removeEventListener("voct:video-play", onOther);
  }, [id, pause]);

  // Scrolled out of view while playing → pause (no sound from nowhere).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting && playingRef.current) pause();
        }),
      { threshold: 0 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [pause]);

  // Lightbox: start with the opening gesture's transient activation.
  useEffect(() => {
    if (autoPlay) void play();
    // Mount-time intent only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unmount (lightbox close, view-transition swap): stop sound, lift the duck.
  useEffect(() => {
    return () => {
      videoRef.current?.pause();
      window.dispatchEvent(new CustomEvent("voct:audio-restore"));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScrub = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
    // Keyboard "clicks" carry no coordinates (detail === 0) — don't seek to 0:00.
    if (event.detail === 0) return;
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    video.currentTime = fraction * video.duration;
  }, []);

  const onFullscreen = useCallback((): void => {
    const video = videoRef.current as FullscreenVideo | null;
    if (!video) return;
    if (video.requestFullscreen) void video.requestFullscreen();
    else video.webkitEnterFullscreen?.(); // iOS Safari
  }, []);

  return (
    <figure className="vplayer" ref={rootRef}>
      <div className="vplayer-stage">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          preload="none"
          playsInline
          onClick={() => (playing ? pause() : void play())}
        />
        <button
          type="button"
          className={`vplayer-btn${playing ? " is-quiet" : ""}`}
          aria-label={playing ? "Zatrzymaj odtwarzanie" : "Odtwórz wideo"}
          aria-pressed={playing}
          onClick={() => (playing ? pause() : void play())}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          )}
        </button>
      </div>
      <button type="button" className="vplayer-scrub" aria-label="Przewiń wideo" onClick={onScrub}>
        <span className="vplayer-rail" aria-hidden="true">
          <span className="vplayer-fill" ref={fillRef} />
        </span>
      </button>
      <figcaption className="vplayer-meta">
        {caption && <span className="vplayer-caption">{caption}</span>}
        <span className="vplayer-side">
          <span className="vplayer-time" ref={timeRef} aria-hidden="true">
            0:00 / 0:00
          </span>
          <button
            type="button"
            className="vplayer-fs"
            aria-label="Pełny ekran"
            onClick={onFullscreen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </span>
      </figcaption>
    </figure>
  );
}
```

(If JSX complains about `stroke-width`, use `strokeWidth={1.5}` — React prop naming.)

## Part C — `VoxMoment` (movement II, replaces ListenMoment)

**New file** `web/src/islands/landing/VoxMoment.tsx`:

```tsx
/**
 * @file VoxMoment.tsx
 * @description "Zobacz i usłysz" — the heart of movement II (Vox memoriae): after the
 *  silence beat, the actual voice — with image. One cinematic frame playing the concert
 *  reel in place (VideoPlayer owns the ambient duck/restore contract). Successor of the
 *  audio-only ListenMoment; the poster is optimized by the page (astro:assets) and passed
 *  in as a prop.
 * @architecture Astro islands 2026
 * @module islands/landing/VoxMoment
 */

import { REEL } from "../../data/landing/video";
import { VideoPlayer } from "./video/VideoPlayer";

interface VoxMomentProps {
  /** Optimized poster URL, computed by index.astro via getImage. */
  readonly poster: string;
}

export function VoxMoment({ poster }: VoxMomentProps): React.JSX.Element {
  return (
    <section className="vox" aria-label="Zobacz i usłysz">
      <div className="vox-inner">
        <p className="vox-eyebrow">
          <span className="lat">Vox</span> · Zobacz i usłysz
        </p>
        <p className="vox-line">
          Zanim przeczytasz — <em>usłysz.</em>
        </p>
        <VideoPlayer src={REEL.src} poster={poster} caption={REEL.caption} />
      </div>
    </section>
  );
}
```

## Part D — `VideoLightbox` (the dark projection room)

**New file** `web/src/islands/landing/VideoLightbox.tsx`:

```tsx
/**
 * @file VideoLightbox.tsx
 * @description Full-screen video room — the nave goes dark for the projection. Opens on
 *  `voct:open-video` ({ src?, caption? }, defaults to the reel), closes on ✕ / Escape /
 *  backdrop. The player mounts only while open, so its unmount cleanup pauses the video and
 *  restores the ambient bed. Sets `window.__voctVideoReady` so the static-DOM delegation in
 *  scripts/landing.ts knows whether to intercept `[data-video-open]` clicks or let the
 *  native href (the MP4 itself) serve as the pre-hydration/no-JS fallback.
 * @architecture Astro islands 2026
 * @module islands/landing/VideoLightbox
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { REEL } from "../../data/landing/video";
import { useBodyClass } from "./hooks/useBodyClass";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { VideoPlayer } from "./video/VideoPlayer";

interface OpenDetail {
  readonly src?: string;
  readonly caption?: string;
}

interface VideoLightboxProps {
  /** Optimized poster for the default reel (computed by index.astro via astro:assets). */
  readonly poster: string;
}

export function VideoLightbox({ poster }: VideoLightboxProps): React.JSX.Element | null {
  const [open, setOpen] = useState<OpenDetail | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((): void => setOpen(null), []);

  useBodyClass(open ? "video-open" : null);
  useFocusTrap(panelRef, open !== null, { onEscape: close });

  useEffect(() => {
    (window as Window & { __voctVideoReady?: boolean }).__voctVideoReady = true;
    const onOpen = (event: Event): void => {
      const detail = (event as CustomEvent<OpenDetail>).detail;
      setOpen({ src: detail?.src, caption: detail?.caption });
    };
    window.addEventListener("voct:open-video", onOpen);
    return () => {
      (window as Window & { __voctVideoReady?: boolean }).__voctVideoReady = false;
      window.removeEventListener("voct:open-video", onOpen);
    };
  }, []);

  if (!open) return null;

  const src = open.src ?? REEL.src;

  return (
    <div
      className="video-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Wideo z koncertu"
    >
      <button
        type="button"
        className="video-lightbox-backdrop"
        aria-label="Zamknij"
        onClick={close}
        tabIndex={-1}
      />
      <div className="video-lightbox-panel" data-lenis-prevent ref={panelRef}>
        <button type="button" className="video-lightbox-close" aria-label="Zamknij" onClick={close}>
          ✕
        </button>
        <VideoPlayer
          src={src}
          poster={src === REEL.src ? poster : undefined}
          caption={open.caption ?? REEL.caption}
          autoPlay
        />
      </div>
    </div>
  );
}
```

Notes:
- Entrance is animated with mount-time `@keyframes` (Part G) — no double-frame class trick
  needed. No exit animation (instant close is fine; the vault behaves comparably).
- The `autoPlay` attempt rides the opening click's transient activation; when a browser
  refuses, the player falls back to its poster + play button (handled in Part B).

## Part E — static-DOM triggers

### E1. Delegation in `landing.ts`

In `setupInteractions` ([landing.ts:534-566](../web/src/scripts/landing.ts#L534-L566)),
append after the `vaultBtn` block (i.e. after line 562's closing `}`, before line 563's `};`):

```ts
    const videoBtn = target.closest<HTMLElement>("[data-video-open]");
    if (videoBtn) {
      // Pre-hydration fallback: until VideoLightbox is mounted, let the native href
      // (the MP4 itself) handle the click instead of dispatching into the void.
      if (!(window as Window & { __voctVideoReady?: boolean }).__voctVideoReady) return;
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("voct:open-video", {
          detail: {
            src: videoBtn.getAttribute("href") ?? undefined,
            caption: videoBtn.dataset.videoCaption,
          },
        }),
      );
    }
```

Also update the comment block above `setupInteractions` (lines 531–533) to mention the
video dispatch alongside the vault one.

### E2. Hero — `HeroSection.astro`

Frontmatter: add `import { REEL } from "../../data/landing/video";`.

Replace the whole hero-rail content (lines 39–58: the occasion pill comment+anchor AND the
hero-actions block; keep `hero-cue`):

```astro
    <div class="hero-rail intro-stage s6">
      {/* The hero's one standing invitation is the experience itself: sixty seconds of the
          actual voice. The donation line moved to movement III (Sustinete nos), where the
          asks concentrate; when a concert date lands, an announcement pill returns here. */}
      <div class="hero-actions">
        <a
          class="primary-link plausible-event-name=hero+wideo"
          href={REEL.src}
          data-video-open
          data-video-caption={REEL.caption}
        >
          Zobacz i usłysz
        </a>
        <a class="secondary-link plausible-event-name=hero+koncerty" href="/koncerty">
          Koncerty Duchowe
        </a>
      </div>
      <span class="hero-cue" aria-hidden="true">Zejdź w głąb</span>
    </div>
```

("Poznaj nas" drops from the hero — `/o-nas` stays one click away in the chrome header and
the mobile sheet.)

Then grep `hero-occasion` across `web/src/styles/` and delete the now-dead rule blocks
(expected in `02-hero-sections.css`, possibly `07-responsive.css`/`11-mobile.css`). Update
the `@file` header of `HeroSection.astro` (it mentions "hero-rail holds the CTA anchors +
downward cue" — still true; drop any mention of the occasion pill if present).

### E3. Path register — `paths.ts` + `PathSection.astro`

`paths.ts` — extend `interface Path` (after `poster`, line 30):

```ts
  /** Public URL of a self-hosted MP4 fragment; omit when no footage exists (never fabricate). */
  readonly video?: string;
```

Add to **each of the five** `PATHS` entries (after `poster: …`):

```ts
    video: "/demo/demo_video.mp4", // PLACEHOLDER — swap for the real fragment or delete this line
```

`PathSection.astro` — after the summary paragraph (line 40,
`<p class="path-entry-summary">{path.note}</p>`), before `<details>`:

```astro
                {path.video && (
                  <a
                    class="path-entry-video plausible-event-name=path+fragment"
                    href={path.video}
                    data-video-open
                    data-video-caption={`${path.title} · ${path.year}`}
                  >
                    <span class="path-entry-video-glyph" aria-hidden="true">▸</span>
                    Zobacz fragment
                  </a>
                )}
```

## Part F — `index.astro` wiring

1. Line 35: replace `import { ListenMoment } from "../islands/landing/ListenMoment";` with:

```ts
import { VoxMoment } from "../islands/landing/VoxMoment";
import { VideoLightbox } from "../islands/landing/VideoLightbox";
```

2. Frontmatter, after the `ogImage` computation (lines 42–44):

```ts
// Poster for the concert reel (Vox moment + lightbox). EDITABLE: swap the source photo
// when a real video still exists — bleedPair name only, the optimization stays.
const voxPoster = (
  await getImage({ src: bleedPair("chor-spot").desktop, width: 1600, format: "webp" })
).src;
```

3. Line 113: `<ListenMoment client:visible />` → `<VoxMoment client:visible poster={voxPoster} />`.

4. After `<VaultIsland client:idle />` (line 127): `<VideoLightbox client:idle poster={voxPoster} />`.

5. Update the `@file` header comment (line 2–9) — it lists ListenMoment in the braid.

## Part G — styles: `12-vox.css` replaces `12-listen.css`

Delete `web/src/styles/landing/12-listen.css`. Create `web/src/styles/landing/12-vox.css`.
Update [landing.css:22](../web/src/styles/landing.css#L22) to:

```css
@import "./landing/12-vox.css"; /* Vox — zobacz i usłysz (movement II) + shared player + video lightbox */
```

Content of `12-vox.css` (starting point — visual polish is the owner's browser call):

```css
  /* ── Vox · Zobacz i usłysz ────────────────────────────────────────────────────────────
     Movement II's heart: after the silence beat, the actual voice — with image. One
     cinematic frame (VoxMoment island) between SilenceMoment and PathSection, plus the
     shared minimal player chrome (.vplayer) and the full-screen projection room
     (.video-lightbox) opened by the hero CTA and the path-register fragments. Light
     parchment shell to match both neighbours; the frame is the only dark object — a
     window, not a room. */
  .vox {
    position: relative;
    padding: clamp(72px, 9vw, 132px) max(28px, 5vw);
    background: var(--paper);
    isolation: isolate;
  }

  .vox-inner {
    max-width: 880px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(20px, 2.6vw, 32px);
  }

  .vox-eyebrow {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }

  .vox-eyebrow .lat {
    color: var(--candle);
    font-family: var(--serif);
    font-style: italic;
    font-size: 14px;
    letter-spacing: 0;
    text-transform: none;
  }

  .vox-line {
    margin: 0;
    max-width: 18ch;
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(24px, 3.4vw, 44px);
    line-height: 1.18;
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  .vox-line em {
    font-style: italic;
    color: var(--candle);
  }

  /* ── Shared player chrome (.vplayer) — used in-flow and inside the lightbox ── */
  .vplayer {
    width: 100%;
    margin: clamp(6px, 1vw, 12px) 0 0;
    display: grid;
    gap: 10px;
    text-align: left;
  }

  .vplayer-stage {
    position: relative;
    aspect-ratio: 16 / 9;
    background: var(--night);
    overflow: hidden;
    box-shadow:
      0 30px 90px -36px rgba(22, 21, 20, 0.55),
      0 0 0 1px var(--line);
  }

  .vplayer-stage video {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    cursor: pointer;
  }

  .vplayer-btn {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(198, 164, 91, 0.65);
    border-radius: 50%;
    background: rgba(8, 8, 7, 0.35);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    color: var(--candle);
    cursor: pointer;
    transition:
      opacity 0.5s var(--ease),
      background-color 0.5s var(--ease),
      border-color 0.5s var(--ease);
  }

  .vplayer-btn:hover {
    background: rgba(198, 164, 91, 0.16);
  }

  .vplayer-btn:focus-visible {
    outline: 1px solid var(--candle);
    outline-offset: 5px;
  }

  .vplayer-btn svg {
    width: 24px;
    height: 24px;
  }

  /* While playing the affordance recedes; the frame itself is the pause target. */
  .vplayer-btn.is-quiet {
    opacity: 0;
  }

  .vplayer-stage:hover .vplayer-btn.is-quiet,
  .vplayer-btn.is-quiet:focus-visible {
    opacity: 0.85;
  }

  .vplayer-scrub {
    display: block;
    width: 100%;
    padding: 8px 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .vplayer-rail {
    position: relative;
    display: block;
    height: 1px;
    background: var(--line);
    overflow: hidden;
  }

  .vplayer-fill {
    position: absolute;
    inset: 0 auto 0 0;
    width: 100%;
    transform: scaleX(0);
    transform-origin: left center;
    background: linear-gradient(90deg, var(--candle), #e8cf90);
    will-change: transform;
  }

  .vplayer-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }

  .vplayer-side {
    display: inline-flex;
    align-items: center;
    gap: 14px;
  }

  .vplayer-time {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .vplayer-fs {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    transition: color 0.35s var(--ease);
  }

  .vplayer-fs:hover {
    color: var(--candle);
  }

  .vplayer-fs:focus-visible {
    outline: 1px solid var(--candle);
    outline-offset: 3px;
  }

  .vplayer-fs svg {
    width: 15px;
    height: 15px;
  }

  /* ── Path register: fragment link ── */
  .path-entry-video {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-muted);
    padding-bottom: 4px;
    border-bottom: 1px solid transparent;
    transition:
      color 0.35s var(--ease),
      border-color 0.35s var(--ease);
  }

  .path-entry-video:hover {
    color: var(--ink);
    border-color: var(--candle);
  }

  .path-entry-video-glyph {
    color: var(--candle);
    font-size: 9px;
  }

  /* ── Projection room (lightbox) ── */
  body.theme-marketing.video-open {
    overflow: hidden;
  }

  .video-lightbox {
    position: fixed;
    inset: 0;
    /* NOTE: match .vault's z-index from 08-vault.css (grep `z-index` there) — the two
       overlays never open together, but both must clear the chrome header. */
    z-index: 90;
    display: grid;
    place-items: center;
    padding: max(20px, 4vh) max(16px, 4vw);
    animation: videoRoomIn 0.55s var(--ease) both;
  }

  .video-lightbox-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(8, 8, 7, 0.94);
    cursor: default;
  }

  .video-lightbox-panel {
    position: relative;
    width: min(1100px, 100%);
    animation: videoRoomRise 0.55s var(--ease) both;
  }

  .video-lightbox-panel .vplayer-stage {
    box-shadow:
      0 40px 120px -40px rgba(0, 0, 0, 0.9),
      0 0 0 1px rgba(244, 241, 233, 0.08);
  }

  .video-lightbox-panel .vplayer-meta {
    color: rgba(244, 241, 233, 0.58);
  }

  .video-lightbox-panel .vplayer-time {
    color: rgba(244, 241, 233, 0.85);
  }

  .video-lightbox-panel .vplayer-rail {
    background: rgba(244, 241, 233, 0.16);
  }

  .video-lightbox-panel .vplayer-fs {
    color: rgba(244, 241, 233, 0.58);
  }

  .video-lightbox-close {
    position: absolute;
    right: 0;
    top: -52px;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(244, 241, 233, 0.28);
    border-radius: 50%;
    background: transparent;
    color: rgba(244, 241, 233, 0.85);
    font-size: 14px;
    cursor: pointer;
    transition:
      color 0.35s var(--ease),
      border-color 0.35s var(--ease);
  }

  .video-lightbox-close:hover {
    color: var(--candle);
    border-color: var(--candle);
  }

  .video-lightbox-close:focus-visible {
    outline: 1px solid var(--candle);
    outline-offset: 4px;
  }

  @keyframes videoRoomIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes videoRoomRise {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 640px) {
    .vplayer-btn {
      width: 60px;
      height: 60px;
    }
    .video-lightbox {
      padding: 12px;
    }
    .video-lightbox-close {
      top: auto;
      bottom: -56px;
      right: 50%;
      transform: translateX(50%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .video-lightbox,
    .video-lightbox-panel {
      animation: none;
    }
  }
```

## Part H — EnsembleSection: concrete fact + origin line

In `EnsembleSection.astro`:

1. `FACTS` (lines 15–19) — replace the vague `"PL · UE"` tile:

```ts
const FACTS = [
  { num: "12+", label: "głosów na scenie" },
  { num: "2024", label: "debiut · Kontemplacja Wcielenia" },
  { num: "V wieków", label: "repertuar · 50+ utworów · od XIV w." },
] as const;
```

2. After the intro paragraph (line 35's `</p>`), before `.ensemble-facts` (line 36), insert
   (copy EDITABLE — adapted from the origin story on /press):

```astro
      <p class="ensemble-origin">
        Zaczęło się od tęsknoty — jak anachoreci, w odosobnieniu, z daleka od zgiełku,
        zatęskniliśmy za muzyką, która otula, przenika i zostaje w duszy niczym żywy
        organizm.
      </p>
```

3. In `web/src/styles/landing/04-rooms-interludes.css`, append next to the `.ensemble-facts`
   rules (grep `.ensemble-facts` for the anchor; the section sits over a dark full-bleed, so
   the light ink is correct):

```css
  .ensemble-copy .ensemble-origin {
    margin: 28px 0 0;
    max-width: 34rem;
    padding-left: 18px;
    border-left: 1px solid rgba(198, 164, 91, 0.55);
    font-family: var(--serif);
    font-style: italic;
    font-weight: 300;
    font-size: clamp(16px, 1.3vw, 20px);
    line-height: 1.6;
    color: rgba(244, 241, 233, 0.82);
  }
```

## Part I — cleanup

1. **Delete** `web/src/islands/landing/ListenMoment.tsx` (VoxMoment supersedes it; the only
   references are index.astro's import/mount, replaced in Part F — other grep hits for
   "listen" are `addEventListener` noise).
2. **Delete** `web/src/styles/landing/12-listen.css` (Part G created `12-vox.css`).
3. **Rewrite** `web/public/audio/README.md` (its ListenMoment/vox-excerpt instructions are
   obsolete):

```md
# /public/audio

Self-hosted audio served at the site root (no third party, GDPR-clean).

The landing's ambient bed lives at `/public/ambient.m4a` (a ~50 s perfect-loop recording of
VoctEnsemble; started by the threshold choice, owned by `AudioController`). The former
audio-only "Posłuchaj" moment was superseded by the video Vox moment
(`islands/landing/VoxMoment.tsx`) — video sources live in `src/data/landing/video.ts`.

This folder is kept for future audio assets.
```

## Part J — DEFERRED: `VideoObject` structured data (do when the REAL reel lands)

Not now — the demo placeholder must not be registered with search engines. When the real
reel replaces `REEL.src`, extend the landing `jsonLd` (index.astro lines 46–72) with a
`video` member so Google can show a video rich result (thumbnail + play badge in search):

```ts
  video: {
    "@type": "VideoObject",
    name: "VoctEnsemble — fragment Koncertu Duchowego",
    description: "60 sekund koncertu VoctEnsemble: muzyka sakralna a cappella.",
    thumbnailUrl: `https://voctensemble.com${voxPoster}`,
    contentUrl: "https://voctensemble.com/video/voct-reel.mp4",
    uploadDate: "2026-MM-DD",
    duration: "PT1M",
  },
```

Adjust `contentUrl`/`uploadDate`/`duration` to the final file. Leave a `// TODO` comment
near jsonLd now if helpful, nothing more.

---

## Verification

1. `cd web` → `npm run build` (Astro build must pass; it type-checks the islands).
2. Owner's browser checklist (visual verification is the owner's step):
   - Hero "Zobacz i usłysz" → lightbox opens, video auto-plays with sound, ambient choir
     bed fades under it; ✕ / Escape / backdrop click closes, ambient swells back.
   - Same flow with "Cisza" chosen at the threshold: video plays, no ambient anywhere.
   - Vox moment (movement II): poster + circle play; play ducks ambient; pause/end restores;
     scrolling far away pauses it.
   - Playing the Vox video, then opening the lightbox → the Vox player pauses (exclusivity).
   - Path register: "Zobacz fragment" under each entry opens the lightbox with the entry's
     caption (title · year).
   - Mobile: lightbox close button reachable; `playsinline` honoured (no forced fullscreen);
     scrub + fullscreen work.
   - Reduced motion: lightbox appears without animation; everything else static-correct.
   - Pre-hydration sanity: with JS disabled, the hero CTA navigates straight to the MP4.
3. Grep sanity: `ListenMoment`, `12-listen`, `hero-occasion`, `vox-excerpt` → no live
   references left in `web/src`.
