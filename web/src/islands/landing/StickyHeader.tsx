/**
 * @file StickyHeader.tsx
 * @description Glass chrome header island for the landing (`/`). Web/Astro port of the SPA
 *  widget: same markup, brand glyph, mobile nav sheet — but cross-island state travels over
 *  `window` CustomEvents instead of React Context (each island is its own React root in Astro).
 *  Audio toggle dispatches `voct:toggle-audio` and mirrors truth from `voct:audio-state`;
 *  "Wesprzyj" dispatches `voct:open-vault`. The audio controller (Faza 3b) and vault island
 *  (Faza 3c) own those events; until then the listeners are dormant (graceful no-op).
 *  Adaptive tint (`is-on-dark`/`is-active`) is driven by the page motion script, not here.
 * @architecture Astro islands 2026
 * @module islands/landing/StickyHeader
 */

import { useEffect, useState } from "react";

import { useAudioChoice } from "./hooks/useAudioChoice";

// Sections whose surface is dark enough that the glass chrome must invert to its light brand.
const DARK_SELECTORS =
  ".image-rite, .ensemble, .director-dark, .final-support, .preloader, .vault, .regulamin, .gratitude, .failure";

export function StickyHeader(): React.JSX.Element {
  const { read } = useAudioChoice();
  const [menuOpen, setMenuOpen] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  // Adaptive tint, owned by React (an external script toggling these classes would be
  // reverted on the next render). `onDark` = glass over a dark surface; `active` = glass mode
  // engaged once the hero is scrolled past. Hero starts dark, so onDark defaults true.
  const [onDark, setOnDark] = useState(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const header = document.querySelector<HTMLElement>(".voct-landing .chrome");
    const hero = document.querySelector<HTMLElement>(".voct-landing .hero");
    if (!header) return;

    let pending = false;
    const probe = () => {
      pending = false;
      const rect = header.getBoundingClientRect();
      const probeY = Math.round(rect.bottom) + 8;
      const probeX = Math.round(window.innerWidth / 2);
      if (probeY <= 0 || probeY >= window.innerHeight) return;
      const el = document.elementFromPoint(probeX, probeY);
      if (!el) return;
      setOnDark(Boolean(el.closest(DARK_SELECTORS)));
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(probe);
    };

    let io: IntersectionObserver | null = null;
    if (hero) {
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => setActive(e.intersectionRatio < 0.08)),
        { threshold: [0, 0.08, 0.5, 1] },
      );
      io.observe(hero);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    probe();
    // Late probes catch the preloader unlocking scroll + fonts/layout settling.
    const timers = [window.setTimeout(probe, 1200), window.setTimeout(probe, 4600)];

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      io?.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Hydrate the audio label from the persisted threshold choice (avoids a flash to "Cisza"
  // for a returning "voice" visitor), then defer to the audio controller's broadcasts.
  useEffect(() => {
    // Prefer the controller's live truth (robust to island mount order); fall back to the
    // persisted threshold choice so a returning "voice" visitor sees the right label at once.
    const live = (window as Window & { __voctAudioOn?: boolean }).__voctAudioOn;
    setAudioOn(typeof live === "boolean" ? live : read() === "voice");
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<{ isOn: boolean }>).detail;
      if (detail) setAudioOn(Boolean(detail.isOn));
    };
    window.addEventListener("voct:audio-state", onState);
    return () => window.removeEventListener("voct:audio-state", onState);
  }, [read]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const toggleAudio = () => {
    // Optimistic flip; the audio controller confirms via `voct:audio-state`.
    setAudioOn((prev) => !prev);
    window.dispatchEvent(new CustomEvent("voct:toggle-audio"));
  };

  const openVault = (amount: number) => {
    window.dispatchEvent(new CustomEvent("voct:open-vault", { detail: { amount } }));
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={`chrome${onDark ? " is-on-dark" : ""}${active ? " is-active" : ""}${menuOpen ? " menu-open" : ""}`}
      aria-label="Nawigacja"
    >
      {/* view-transition-name: voct-brand → shared element with SiteChrome on the
          subpages, so the brand morphs across "/" ↔ subpage instead of cross-fading. */}
      <a
        className="brand"
        href="#top"
        aria-label="VoctEnsemble"
        style={{ viewTransitionName: "voct-brand" }}
      >
        <span className="brand-glyph-wrap" aria-hidden="true">
          <span className="brand-glyph-halo" />
          <span className="brand-glyph" />
        </span>
        <span>VoctEnsemble</span>
      </a>

      <div className="chrome-actions">
        <button
          type="button"
          className={`audio-toggle plausible-event-name=przycisk+cisza${audioOn ? " is-on" : ""}`}
          aria-pressed={audioOn}
          onClick={toggleAudio}
        >
          {audioOn ? "Głos" : "Cisza"}
        </button>
        <a
          className="support-link plausible-event-name=skarbiec+menu"
          href="#wesprzyj"
          data-no-lenis
          onClick={(e) => {
            e.preventDefault();
            openVault(100);
          }}
        >
          Wesprzyj
        </a>
        <a className="support-link plausible-event-name=o+nas" href="/o-nas">
          O nas
        </a>
        <a className="support-link plausible-event-name=koncerty" href="/koncerty">
          Koncerty
        </a>
        <button
          className="nav-toggle"
          id="navToggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="navMenu"
          aria-label="Menu"
          onClick={() => setMenuOpen(true)}
        />
      </div>

      <nav className="nav-menu" id="navMenu" aria-label="Nawigacja mobilna">
        <div className="nav-menu-links">
          <a href="#top" onClick={closeMenu}>
            Główna
          </a>
          <a href="/o-nas" onClick={closeMenu}>
            O nas
          </a>
          <a href="/koncerty" onClick={closeMenu}>
            Koncerty
          </a>
          <a
            className="nav-support plausible-event-name=skarbiec+menu"
            href="#wesprzyj"
            data-no-lenis
            onClick={(e) => {
              e.preventDefault();
              closeMenu();
              openVault(100);
            }}
          >
            Wesprzyj
          </a>
        </div>
        <button
          className="menu-close"
          id="menuClose"
          type="button"
          aria-label="Zamknij menu"
          onClick={closeMenu}
        >
          ✕
        </button>
      </nav>
    </header>
  );
}
