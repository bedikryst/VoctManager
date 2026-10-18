/**
 * @file ExcerptsPlayer.tsx
 * @description A concert's excerpts reel: a play glyph in the hero and, once it is pressed, a thin
 *  bar fixed to the foot of the viewport — the current work, a progress line under a strip marking
 *  that work's stretch of the file, elapsed / total, play/pause and a stop square. The bar carries
 *  its own toggle because it outlives the glyph on screen: a reader listening while reading is
 *  far below the hero, and stop alone would cost them their place. Styles: styles/excerpts.css.
 *
 *  THE BAR IS PORTALLED TO <body>, and has to be. The glyph stands inside `.kd-hero`, whose
 *  `isolation: isolate` makes it a stacking context: a fixed bar left inside it would be painted
 *  in the hero's layer and every later band of the page would cover it. Leaving <main> also leaves
 *  the concert's re-toned `--candle`, which is why the page hands it down as a prop. The portal is
 *  mounted after hydration only, so the server markup holds the glyph and the `<audio>` alone.
 *
 *  NOTHING PRELOADS AND NOTHING AUTOPLAYS: `preload="none"`, and the first byte is requested by the
 *  press itself, inside its gesture, which is what iOS needs to let a sound start. The bar appears
 *  with the press — no slide, no fade (guardrails §5) — and leaves on stop, on the end of the
 *  file, and with the page (ClientRouter unmounts the island, and a media element taken out of the
 *  document pauses). The glyph and the bar's toggle are one control in two places; Escape stops
 *  while no dialog or menu holds the keyboard.
 *
 *  Joins the site's sound etiquette as VideoPlayer does: `voct:audio-duck` before play and
 *  `voct:audio-restore` on pause (the landing's chant bed, where it is mounted), and
 *  `voct:video-play` both ways, so a film and the reel never sound together. Whenever the bar
 *  appears or leaves it sends `voct:edge-refresh`, so BaseLayout re-reads the iOS edge colour.
 * @module islands/landing/excerpts/ExcerptsPlayer
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Locale } from "../../../i18n/config";
import type { ConcertChrome } from "../../../i18n/content/koncert";
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const glyphRef = useRef<HTMLButtonElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  // The corpus's duration until the file states its own.
  const totalRef = useRef(duration);
  const chapterRef = useRef(0);
  // Render-time mirrors, so window listeners read fresh state without re-subscribing.
  const playingRef = useRef(false);
  playingRef.current = playing;
  const sessionRef = useRef(false);

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

  /** Playhead into the bar: `--p` on the line, the clock, and the chapter when it turns. */
  const paint = useCallback(
    (time: number): void => {
      const total = totalRef.current;
      barRef.current?.style.setProperty("--p", String(Math.min(1, Math.max(0, time / total))));
      if (timeRef.current) timeRef.current.textContent = `${formatTime(time)} / ${formatTime(total)}`;
      const index = chapterAt(chapters, time);
      if (index !== chapterRef.current) {
        chapterRef.current = index;
        setChapter(index);
      }
    },
    [chapters],
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
      if (audio.currentTime === 0) setActive(false);
      restore();
    });
  }, [restore]);

  const stop = useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;
    // The stop square is about to vanish under the focus it holds; hand focus back to the glyph
    // without scrolling the reader to the top of the page.
    const focusInBar = barRef.current?.contains(document.activeElement) ?? false;
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
        }
      } catch {
        // Media Session is a nicety — some engines throw on unknown action names.
      }
    },
    [artwork, chapters, play, stop, title],
  );

  useEffect(() => {
    if (playing) announce(chapter);
  }, [announce, chapter, playing]);

  // Media events are the single source of truth for `playing` — the OS surface and headset keys
  // pause the element without passing through the glyph.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = (): void => setPlaying(true);
    const onPause = (): void => {
      setPlaying(false);
      restore();
    };
    const onTime = (): void => paint(audio.currentTime);
    const onMeta = (): void => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) totalRef.current = audio.duration;
      paint(audio.currentTime);
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
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [paint, restore, stop]);

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
        } catch {
          // As above.
        }
      }
    },
    [restore],
  );

  const now = chapters[chapter];
  const next = chapters[chapter + 1];
  const barStyle: StyleVars = {
    "--candle": candle,
    "--c0": now ? now.at / duration : 0,
    "--c1": next ? next.at / duration : 1,
  };

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
      <audio ref={audioRef} src={src} preload="none" />
      {host &&
        createPortal(
          <div
            ref={barRef}
            className="excerpts-bar"
            role="region"
            aria-label={labels.region}
            hidden={!active}
            style={barStyle}
          >
            <span className="excerpts-span" aria-hidden="true" />
            <span className="excerpts-rail" aria-hidden="true">
              <span className="excerpts-fill" />
            </span>
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
