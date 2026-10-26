/**
 * @file ExcerptsPlayer.tsx
 * @description A concert's excerpts reel: a play glyph in the hero and, once it is pressed, a thin
 *  bar fixed to the foot of the viewport — the current work, a seekable timeline cut into one
 *  segment per work, elapsed / total, play/pause and a stop square. The bar carries its own toggle
 *  because it outlives the glyph on screen: a reader listening while reading is far below the
 *  hero, and stop alone would cost them their place. Styles: styles/excerpts.css.
 *
 *  THE TIMELINE IS THE LIST OF WORKS. Each work is a segment of the rail, parted from the next by a
 *  gap, and the segment now sounding is lit a step above the others: the stretch a work occupies
 *  is read off the line the playhead runs on, never off a second line beside it. The rail is a
 *  slider with VideoPlayer's keymap (arrows ±5 s, Page ±30 s, Home / End) and its
 *  `data-cursor="seek"`, so over it the site cursor becomes the caret and the timestamp.
 *
 *  A PAGE MAY START THE REEL AT A WORK. Any `button[data-excerpt-at]` in the document (the concert
 *  programme prints one beside each work the reel holds) plays from that offset — or pauses and
 *  resumes, when its work is the one already in the bar. The island answers by delegation and
 *  writes the state back (`data-sounding` on the button whose work is playing, `disabled` on all of
 *  them once the file has failed), so the page's markup stays static and the page hides it without
 *  JavaScript.
 *
 *  THE BAR IS PORTALLED TO <body>, and has to be. The glyph stands inside `.kd-hero`, whose
 *  `isolation: isolate` makes it a stacking context: a fixed bar left inside it would be painted
 *  in the hero's layer and every later band of the page would cover it. Leaving <main> also leaves
 *  the concert's re-toned `--candle`, which is why the page hands it down as a prop.
 *
 *  THE <audio> IS MADE AFTER HYDRATION, with the portal, so the server markup holds the glyph
 *  alone. ClientRouter parses the next page with DOMParser and moves its body in later; a media
 *  element born in that document runs its source selection where nothing can load, ends in
 *  NETWORK_NO_SOURCE before the island listens for `error`, and current Chrome does not retry once
 *  it stands in the page, so every press would be refused in silence until a reload. Made by
 *  React in the page's own document, it starts clean on every arrival. (VideoPlayer's poster has
 *  to be in the markup, so it repairs the same state with `load()` instead.)
 *
 *  NOTHING PRELOADS AND NOTHING AUTOPLAYS: `preload="none"`, and the first byte is requested by the
 *  press itself, inside its gesture, which is what iOS needs to let a sound start. A seek asked
 *  before the file has stated its length waits for `loadedmetadata`, and one asked while the
 *  previous seek still runs waits for `seeked`, so a drag never floods the host with range
 *  requests. The bar appears with the press — no slide, no fade (guardrails §5) — and leaves on
 *  stop, on the end of the file, and with the page (ClientRouter unmounts the island, and a media
 *  element taken out of the document pauses). The glyph and the bar's toggle are one control in
 *  two places; Escape stops while no dialog or menu holds the keyboard.
 *
 *  Joins the site's sound etiquette as VideoPlayer does: `voct:audio-duck` before play and
 *  `voct:audio-restore` on pause (the landing's chant bed, where it is mounted), and
 *  `voct:video-play` both ways, so a film and the reel never sound together. Whenever the bar
 *  appears or leaves it sends `voct:edge-refresh`, so BaseLayout re-reads the iOS edge colour. The
 *  OS media surface takes the seek bar, and its previous / next keys step between works.
 * @module islands/landing/excerpts/ExcerptsPlayer
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Locale } from "../../../i18n/config";
import type { ConcertChrome } from "../../../i18n/content/koncert";
import { UI } from "../../../i18n/ui";
import { Typo } from "../lib/Typo";
import { formatTime } from "../video/formatTime";

export interface ExcerptChapter {
  /** Offset into the file, in seconds. */
  readonly at: number;
  /** The composer as the bar prints the name: the surname ("Vaughan Williams", "Weiss / Thiele"). */
  readonly composer: string;
  /** The work's title in this locale, as `lib/programmeLine` renders it — markup, since a title
      may italicise a name inside a vernacular phrase. The corpus's own text, never a visitor's. */
  readonly work: string;
}

interface ExcerptsPlayerProps {
  readonly src: string;
  /** The file's length in seconds, from the corpus: printed before any byte has loaded. */
  readonly duration: number;
  /** In order of `at`, the first at 0. */
  readonly chapters: readonly ExcerptChapter[];
  readonly labels: ConcertChrome["excerpts"];
  /** The page's language, taken rather than read: this island is server-rendered (see VideoPlayer). */
  readonly lang: Locale;
  /** The concert's candle colour. The bar lives outside the <main> that sets it. */
  readonly candle: string;
  /** The concert's title and hero still, for the OS media surface (lock screen, headset keys). */
  readonly title: string;
  readonly artwork?: string;
}

type StyleVars = React.CSSProperties & Record<`--${string}`, string | number>;

/** Same dip VideoPlayer uses — the chant bed recedes under the reel, never dies. */
const DUCK_GAIN = 0.04;
/** Identity on the `voct:video-play` broadcast. One reel per page. */
const PLAYER_ID = "excerpts";
/** VideoPlayer's slider steps, so the site's two timelines answer the same keys alike. */
const SEEK_STEP_S = 5;
const SEEK_PAGE_S = 30;
/** A seek never lands closer to the end than this, or the element fires `ended` and the bar goes. */
const END_MARGIN_S = 0.25;
/** "Previous" restarts the work sounding, unless no more than its first seconds have played. */
const RESTART_WINDOW_S = 3;

/** The chapter sounding at `time`: the last one whose offset has been reached. */
function chapterAt(chapters: readonly ExcerptChapter[], time: number): number {
  let index = 0;
  for (let i = 1; i < chapters.length; i += 1) {
    const chapter = chapters[i];
    if (!chapter || chapter.at > time) break;
    index = i;
  }
  return index;
}

/** A title's markup reduced to its text, for the media surface, which takes no markup. */
const plain = (markup: string): string => markup.replace(/<[^>]*>/g, "");

/** Where along the timeline a pointer stands, 0..1 of its width. */
function fractionOf(event: React.PointerEvent<HTMLButtonElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  return rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
}

/** VideoPlayer's two glyphs, shared by the hero's disc and the bar's toggle. */
const PLAY_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);
const PAUSE_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

export function ExcerptsPlayer({
  src,
  duration,
  chapters,
  labels,
  lang,
  candle,
  title,
  artwork,
}: ExcerptsPlayerProps): React.JSX.Element {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const glyphRef = useRef<HTMLButtonElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const scrubRef = useRef<HTMLButtonElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  // The corpus's duration until the file states its own.
  const totalRef = useRef(duration);
  const chapterRef = useRef(0);
  // A seek the element cannot take yet: before its metadata, or while it runs the previous one.
  // While one waits, the bar shows where it will land, not where the element still is.
  const pendingRef = useRef<number | null>(null);
  const scrubbingRef = useRef(false);
  // Whether anything has sounded since the last stop: a refused play keeps the bar only if so.
  const heardRef = useRef(false);
  // Render-time mirrors, so window listeners read fresh state without re-subscribing.
  const playingRef = useRef(false);
  playingRef.current = playing;
  const activeRef = useRef(false);
  activeRef.current = active;
  const sessionRef = useRef(false);

  const joiner = UI[lang].player.ofDuration;

  // Gates the portal and the <audio> alike: both are made only in the page's own document.
  useEffect(() => setHost(document.body), []);

  // A page may colour iOS Safari's strip under the bar by whether the bar stands (`--edge-foot`
  // keyed on `.excerpts-bar:not([hidden])`), and BaseLayout otherwise reads that colour only when
  // the footer crosses the viewport's edge. Runs after the commit, so `hidden` is already set.
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("voct:edge-refresh"));
  }, [active]);

  const restore = useCallback((): void => {
    window.dispatchEvent(new CustomEvent("voct:audio-restore"));
  }, []);

  /** Playhead into the bar: `--p` on the line, the clock, the slider's value, and the chapter
      when it turns. Imperative, so `timeupdate` never re-renders the island. */
  const paint = useCallback(
    (time: number): void => {
      const total = totalRef.current;
      barRef.current?.style.setProperty("--p", String(Math.min(1, Math.max(0, time / total))));
      if (timeRef.current) timeRef.current.textContent = `${formatTime(time)} / ${formatTime(total)}`;
      const index = chapterAt(chapters, time);
      const scrub = scrubRef.current;
      if (scrub) {
        const now = chapters[index];
        scrub.setAttribute("aria-valuenow", String(Math.round(time)));
        scrub.setAttribute(
          "aria-valuetext",
          `${formatTime(time)} ${joiner} ${formatTime(total)}${now ? `, ${now.composer} · ${plain(now.work)}` : ""}`,
        );
      }
      if (index !== chapterRef.current) {
        chapterRef.current = index;
        setChapter(index);
      }
    },
    [chapters, joiner],
  );

  /** The playhead to `time`, now or as soon as the element can take it. */
  const seek = useCallback(
    (time: number): void => {
      const audio = audioRef.current;
      if (!audio) return;
      const target = Math.min(Math.max(time, 0), Math.max(totalRef.current - END_MARGIN_S, 0));
      paint(target);
      if (audio.readyState >= HTMLMediaElement.HAVE_METADATA && !audio.seeking) {
        pendingRef.current = null;
        audio.currentTime = target;
      } else {
        pendingRef.current = target;
      }
    },
    [paint],
  );

  const play = useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;
    window.dispatchEvent(new CustomEvent("voct:audio-duck", { detail: { gain: DUCK_GAIN } }));
    window.dispatchEvent(new CustomEvent("voct:video-play", { detail: { id: PLAYER_ID } }));
    setActive(true);
    audio.play().catch(() => {
      // A file that does not load also fires `error`, which owns that path. A refusal leaves the
      // bar standing only if something has already sounded.
      if (!heardRef.current) setActive(false);
      restore();
    });
  }, [restore]);

  const stop = useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;
    // The stop square is about to vanish under the focus it holds; hand focus back to the glyph
    // without scrolling the reader to the top of the page.
    const focusInBar = barRef.current?.contains(document.activeElement) ?? false;
    pendingRef.current = null;
    heardRef.current = false;
    audio.pause();
    audio.currentTime = 0;
    setActive(false);
    paint(0);
    if (focusInBar) glyphRef.current?.focus({ preventScroll: true });
  }, [paint]);

  const toggle = useCallback((): void => {
    if (failed) return;
    if (playingRef.current) audioRef.current?.pause();
    else play();
  }, [failed, play]);

  /** A page's button for one work: the reel from that work's start, or the toggle when the work
      is already the one in the bar. */
  const playWork = useCallback(
    (at: number): void => {
      if (failed) return;
      if (activeRef.current && chapterAt(chapters, at) === chapterRef.current) {
        toggle();
        return;
      }
      seek(at);
      if (!playingRef.current) play();
    },
    [chapters, failed, play, seek, toggle],
  );

  /** The OS media surface names the work now sounding, and answers its keys. */
  const announce = useCallback(
    (index: number): void => {
      if (!("mediaSession" in navigator)) return;
      const now = chapters[index];
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: now ? `${now.composer} · ${plain(now.work)}` : title,
          artist: "VoctEnsemble",
          album: title,
          artwork: artwork ? [{ src: artwork }] : [],
        });
        if (!sessionRef.current) {
          navigator.mediaSession.setActionHandler("play", () => play());
          navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
          navigator.mediaSession.setActionHandler("stop", () => stop());
          sessionRef.current = true;
          // After the flag: an engine that refuses one of these keeps the three above, once.
          navigator.mediaSession.setActionHandler("seekto", (details) => {
            if (details.seekTime !== undefined) seek(details.seekTime);
          });
          navigator.mediaSession.setActionHandler("previoustrack", () => {
            const audio = audioRef.current;
            if (!audio) return;
            const start = chapters[chapterRef.current]?.at ?? 0;
            const earlier = chapters[chapterRef.current - 1]?.at ?? 0;
            seek(audio.currentTime - start > RESTART_WINDOW_S ? start : earlier);
          });
          navigator.mediaSession.setActionHandler("nexttrack", () => {
            const next = chapters[chapterRef.current + 1];
            if (next) seek(next.at);
          });
        }
      } catch {
        // Media Session is a nicety — some engines throw on unknown action names.
      }
    },
    [artwork, chapters, play, seek, stop, title],
  );

  useEffect(() => {
    if (playing) announce(chapter);
  }, [announce, chapter, playing]);

  // Media events are the single source of truth for `playing` — the OS surface and headset keys
  // pause the element without passing through the glyph. Bound once `host` has made the element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const applyPending = (): void => {
      const pending = pendingRef.current;
      if (pending === null || audio.seeking) return;
      pendingRef.current = null;
      audio.currentTime = pending;
    };

    const onPlay = (): void => setPlaying(true);
    const onPlaying = (): void => {
      heardRef.current = true;
    };
    const onPause = (): void => {
      setPlaying(false);
      restore();
    };
    const onTime = (): void => {
      if (scrubbingRef.current || pendingRef.current !== null) return;
      paint(audio.currentTime);
    };
    const onMeta = (): void => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        totalRef.current = audio.duration;
        scrubRef.current?.setAttribute("data-duration", String(audio.duration));
        scrubRef.current?.setAttribute("aria-valuemax", String(Math.round(audio.duration)));
      }
      paint(pendingRef.current ?? audio.currentTime);
      applyPending();
    };
    // `pause` fires before `ended`, so the bed is already restored; this only lowers the bar.
    const onEnded = (): void => stop();
    // Missing file (the recording lives out of band on the host) — the glyph says so and rests.
    const onError = (): void => {
      setFailed(true);
      setPlaying(false);
      setActive(false);
      restore();
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("seeked", applyPending);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("seeked", applyPending);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [host, paint, restore, stop]);

  // The page's own buttons for single works, answered wherever they stand.
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      const target = event.target;
      const button =
        target instanceof Element ? target.closest<HTMLButtonElement>("button[data-excerpt-at]") : null;
      if (!button) return;
      const at = Number(button.dataset.excerptAt);
      if (Number.isFinite(at)) playWork(at);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [playWork]);

  // …and their state written back: which one is sounding, and whether any can sound at all.
  useEffect(() => {
    document.querySelectorAll<HTMLButtonElement>("button[data-excerpt-at]").forEach((button) => {
      const at = Number(button.dataset.excerptAt);
      button.toggleAttribute("data-sounding", active && playing && chapterAt(chapters, at) === chapter);
      button.disabled = failed;
    });
  }, [active, chapter, chapters, failed, playing]);

  // One sound at a time: a film starting anywhere on the page pauses the reel.
  useEffect(() => {
    const onOther = (event: Event): void => {
      const otherId = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (otherId !== PLAYER_ID && playingRef.current) audioRef.current?.pause();
    };
    window.addEventListener("voct:video-play", onOther);
    return () => window.removeEventListener("voct:video-play", onOther);
  }, []);

  // Escape stops — unless a dialog or the nave menu owns the key, which then closes only itself.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"], .chrome.menu-open')) return;
      stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, stop]);

  // Leaving the page: silence, the bed back, and no stale handlers on the lock screen.
  useEffect(
    () => () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        audio.pause();
        restore();
      }
      if (sessionRef.current && "mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.setActionHandler("play", null);
          navigator.mediaSession.setActionHandler("pause", null);
          navigator.mediaSession.setActionHandler("stop", null);
          navigator.mediaSession.setActionHandler("seekto", null);
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
        } catch {
          // As above.
        }
      }
    },
    [restore],
  );

  const onScrubDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      if (event.button !== 0) return; // middle stays with autoscroll, right with the menu
      event.currentTarget.setPointerCapture(event.pointerId);
      scrubbingRef.current = true;
      setScrubbing(true);
      seek(fractionOf(event) * totalRef.current);
    },
    [seek],
  );

  const onScrubMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      if (!scrubbingRef.current) return;
      seek(fractionOf(event) * totalRef.current);
    },
    [seek],
  );

  const onScrubEnd = useCallback((event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onScrubKey = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>): void => {
      const audio = audioRef.current;
      if (!audio) return;
      const now = pendingRef.current ?? audio.currentTime;
      let next: number;
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowDown":
          next = now - SEEK_STEP_S;
          break;
        case "ArrowRight":
        case "ArrowUp":
          next = now + SEEK_STEP_S;
          break;
        case "PageDown":
          next = now - SEEK_PAGE_S;
          break;
        case "PageUp":
          next = now + SEEK_PAGE_S;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = totalRef.current;
          break;
        default:
          return;
      }
      event.preventDefault();
      seek(next);
    },
    [seek],
  );

  const now = chapters[chapter];
  const barStyle: StyleVars = { "--candle": candle };

  return (
    <Typo locale={lang}>
      <button
        ref={glyphRef}
        type="button"
        className={`excerpts-glyph${playing ? " is-playing" : ""}${failed ? " is-failed" : ""}`}
        aria-label={playing ? labels.pause : labels.play}
        aria-disabled={failed || undefined}
        onClick={toggle}
      >
        <span className="excerpts-disc" aria-hidden="true">
          {playing ? PAUSE_ICON : PLAY_ICON}
        </span>
        <span className="excerpts-total">{formatTime(duration)}</span>
        <span className="excerpts-text">
          <span className="excerpts-title">{labels.title}</span>
          <span className="excerpts-source">{failed ? labels.unavailable : labels.source}</span>
        </span>
      </button>
      {host && <audio ref={audioRef} src={src} preload="none" />}
      {host &&
        createPortal(
          <div
            ref={barRef}
            className={`excerpts-bar${scrubbing ? " is-scrubbing" : ""}`}
            role="region"
            aria-label={labels.region}
            hidden={!active}
            style={barStyle}
          >
            {/* The slider's value, its text and data-duration are kept fresh imperatively (paint,
                loadedmetadata); the props here are the values before any byte has loaded. */}
            <button
              ref={scrubRef}
              type="button"
              role="slider"
              className="excerpts-scrub"
              aria-label={labels.timeline}
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={0}
              data-cursor="seek"
              data-duration={duration}
              onPointerDown={onScrubDown}
              onPointerMove={onScrubMove}
              onPointerUp={onScrubEnd}
              onPointerCancel={onScrubEnd}
              onKeyDown={onScrubKey}
            >
              <span className="excerpts-rail" aria-hidden="true">
                {chapters.map((item, i) => {
                  const segment: StyleVars = {
                    "--c0": item.at / duration,
                    "--c1": (chapters[i + 1]?.at ?? duration) / duration,
                  };
                  return (
                    <span
                      key={item.at}
                      className={`excerpts-segment${i === chapter ? " is-now" : ""}`}
                      style={segment}
                    >
                      <span className="excerpts-fill" />
                    </span>
                  );
                })}
              </span>
              <span className="excerpts-head" aria-hidden="true" />
            </button>
            <div className="excerpts-row">
              <span className="excerpts-now">
                {now && (
                  <>
                    <span className="excerpts-composer">{now.composer}</span>
                    <span className="excerpts-dot" aria-hidden="true">
                      ·
                    </span>
                    <span className="excerpts-work" dangerouslySetInnerHTML={{ __html: now.work }} />
                  </>
                )}
              </span>
              <span ref={timeRef} className="excerpts-time">
                {`${formatTime(0)} / ${formatTime(duration)}`}
              </span>
              <span className="excerpts-controls">
                <button
                  type="button"
                  className="excerpts-toggle"
                  aria-label={playing ? labels.pause : labels.play}
                  onClick={toggle}
                >
                  <span aria-hidden="true">{playing ? PAUSE_ICON : PLAY_ICON}</span>
                </button>
                <button type="button" className="excerpts-stop" aria-label={labels.stop} onClick={stop}>
                  <span aria-hidden="true" />
                </button>
              </span>
            </div>
          </div>,
          host,
        )}
    </Typo>
  );
}
