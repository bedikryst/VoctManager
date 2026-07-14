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

import { useCallback, useEffect, useRef, useState } from "react";

import { useAudioChoice } from "./hooks/useAudioChoice";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { horaForWarsaw } from "./lib/horaeCanonicae";

// Sections whose surface is dark enough that the glass chrome must invert to its light brand.
const DARK_SELECTORS =
  ".image-rite, .ensemble, .director-dark, .final-support, .preloader, .vault, .regulamin, .gratitude, .failure";

export function StickyHeader(): React.JSX.Element {
  const { read } = useAudioChoice();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  // Adaptive tint, owned by React (an external script toggling these classes would be
  // reverted on the next render). `onDark` = glass over a dark surface; `active` = glass mode
  // engaged once the hero is scrolled past. Hero starts dark, so onDark defaults true.
  const [onDark, setOnDark] = useState(true);
  const [active, setActive] = useState(false);

  // The overlay fades shut over ~0.24s (nave-menu.css) — one quiet breath, no reverse wipe.
  // `menu-closing` keeps it painted through the fade, then the timer flips `menuOpen` off.
  // Escape / Zamknij play the fade; in-page links snap shut (no page swap under them).
  const closeTimer = useRef<number | undefined>(undefined);
  const openMenu = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setMenuClosing(false);
    setMenuOpen(true);
  }, []);
  const closeMenu = useCallback((animated = true) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animated || reduced) {
      setMenuClosing(false);
      setMenuOpen(false);
      return;
    }
    setMenuClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 260);
  }, []);
  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  // Focus stays inside the overlay while it owns the viewport; Escape plays the wipe. The hook
  // restores focus to the hamburger on deactivation (menu-closing counts as deactivated).
  const navRef = useRef<HTMLElement>(null);
  const onEscapeClose = useCallback(() => closeMenu(true), [closeMenu]);
  useFocusTrap(navRef, menuOpen && !menuClosing, { onEscape: onEscapeClose });

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

  // Lock scroll while the overlay owns the viewport (the nave only opens on touch ≤760, where
  // Lenis is dormant, so body overflow is a complete lock) and make the page behind it inert
  // (focus, assistive tech, clicks) — the nave itself lives inside <header>, so it stays live.
  // Cleanup covers unmount on navigation away from the landing.
  useEffect(() => {
    document.body.classList.toggle("nav-open", menuOpen);
    document.querySelectorAll("main, footer").forEach((el) => {
      if (menuOpen) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
    return () => {
      document.body.classList.remove("nav-open");
      document.querySelectorAll("main, footer").forEach((el) => el.removeAttribute("inert"));
    };
  }, [menuOpen]);

  const toggleAudio = () => {
    // Optimistic flip; the audio controller confirms via `voct:audio-state`.
    setAudioOn((prev) => !prev);
    window.dispatchEvent(new CustomEvent("voct:toggle-audio"));
  };

  const openVault = (amount: number) => {
    window.dispatchEvent(new CustomEvent("voct:open-vault", { detail: { amount } }));
  };

  // The antiphon names its hour — computed only while the menu is open, so the SSG snapshot
  // ships the neutral placeholder instead of a build-time hour (no hydration mismatch).
  const hora = menuOpen ? horaForWarsaw(new Date()) : null;

  return (
    <header
      className={`chrome${onDark ? " is-on-dark" : ""}${active ? " is-active" : ""}${menuOpen ? " menu-open" : ""}${menuClosing ? " menu-closing" : ""}`}
      aria-label="Nawigacja"
    >
      {/* view-transition-name: voct-brand → shared element with SiteChrome on the
          subpages, so the brand morphs across "/" ↔ subpage instead of cross-fading.
          The brand persists ABOVE the open "Antyfona" card (z-index 61, tinted ink — see
          01-foundation.css), so tapping it while the card is open must also close the card
          (href="#top" is an in-page jump: no navigation swap does it for us). */}
      <a
        className="brand"
        href="#top"
        aria-label="VoctEnsemble"
        style={{ viewTransitionName: "voct-brand" }}
        onClick={() => closeMenu(false)}
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
        <a className="support-link plausible-event-name=o+nas" href="/o-nas">
          O nas
        </a>
        <a className="support-link plausible-event-name=koncerty" href="/koncerty">
          Koncerty
        </a>
        <a className="support-link plausible-event-name=kontakt" href="/kontakt">
          Kontakt
        </a>
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
        <button
          className="nav-toggle"
          id="navToggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="navMenu"
          aria-label="Menu"
          onClick={openMenu}
        />
      </div>

      {/* "Antyfona" — shared mobile overlay (nave-menu.css); same markup + choreography as the
          Astro SiteChrome on subpages. The card carries NO brand of its own — the bar's .brand
          persists above it — so its top row is just "Zamknij" (also the focus trap's initial
          target, whose focus ring is styled). Each link carries its destination's Latin
          incipit. */}
      <nav className="nave" id="navMenu" aria-label="Nawigacja główna" ref={navRef}>
        <div className="nave-veil" />

        <div className="nave-inner">
          <div className="nave-top">
            <button
              className="nave-close"
              id="menuClose"
              type="button"
              aria-label="Zamknij menu"
              onClick={() => closeMenu(true)}
            >
              Zamknij
            </button>
          </div>

          <div className="nave-list">
            <a className="voice" href="#top" aria-current="page" onClick={() => closeMenu(false)}>
              <span className="voice-lat">Introitus</span>
              <span className="voice-pl">Główna</span>
            </a>
            <a className="voice" href="/o-nas" onClick={() => closeMenu(false)}>
              <span className="voice-lat">De nobis</span>
              <span className="voice-pl">O nas</span>
            </a>
            <a className="voice" href="/koncerty" onClick={() => closeMenu(false)}>
              <span className="voice-lat">Via</span>
              <span className="voice-pl">Koncerty</span>
            </a>
            <a className="voice" href="/kontakt" onClick={() => closeMenu(false)}>
              <span className="voice-lat">Scribe nobis</span>
              <span className="voice-pl">Kontakt</span>
            </a>
          </div>

          <div className="nave-foot">
            <a
              className="nave-cta plausible-event-name=skarbiec+menu"
              href="#wesprzyj"
              data-no-lenis
              onClick={(e) => {
                e.preventDefault();
                closeMenu(false);
                openVault(100);
              }}
            >
              Wesprzyj <em>· Sustinete nos</em>
            </a>
            {/* The antiphon names its hour — live canonical hour while open (see `hora` above). */}
            <span className="nave-colophon">
              <span className="nave-colophon-mark" aria-hidden="true" />
              <span className="nave-hora">
                {hora?.name ?? "Hora"} · <em>{hora?.poem ?? "canonica"}</em>
              </span>
            </span>
          </div>
        </div>
      </nav>
    </header>
  );
}
