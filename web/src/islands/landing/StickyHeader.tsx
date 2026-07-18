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

import { navigate } from "astro:transitions/client";
import { useCallback, useEffect, useRef, useState } from "react";

import { dismissOverlayEntry, isOverlayEntry, pushOverlayEntry } from "../../lib/overlayHistory";
import type { RibbonEntry } from "../../lib/registrum";
import { useAudioChoice } from "./hooks/useAudioChoice";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { horaForWarsaw } from "./lib/horaeCanonicae";

// Sections whose surface is dark enough that the glass chrome must invert to its light brand.
const DARK_SELECTORS =
  ".image-rite, .ensemble, .director-dark, .final-support, .preloader, .vault, .regulamin, .gratitude, .failure";

// How long a chosen silk is held before the page swap fires — one beat, so the gesture reads
// before the crossfade (transitions.css) dissolves it. Shared by the desktop registrum's
// bookmark pull AND the mobile Vitta's ribbon descent (nave-menu.css).
const RIBBON_PULL_MS = 220;

export interface StickyHeaderProps {
  /** The desktop "registrum" — one register ribbon per page-bearing concert, derived by
      lib/registrum in index.astro (islands can't read the collection themselves). */
  ribbons?: readonly RibbonEntry[];
}

export function StickyHeader({ ribbons = [] }: StickyHeaderProps): React.JSX.Element {
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

  // Pure-dismiss closers (Zamknij, Escape) route through `dismiss`: pop the entry pushed on open
  // (→ popstate → animated close) so no "swallowed" back press lingers. A genuine back press lands
  // straight in the popstate handler. Navigation-adjacent closers (brand #top, the voices, the
  // vault CTA) keep their own close — they hand off to another surface, and consuming the entry
  // there would race with the #top hash push / the vault's own pushState.
  const dismiss = useCallback(() => {
    dismissOverlayEntry("navOpen", () => closeMenu(true));
  }, [closeMenu]);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  // History integration: opening the card pushes a state entry so the mobile back button /
  // edge-swipe dismisses the "Antyfona" overlay instead of leaving the landing. A cross-page
  // voice tap leaves the card open and lets the swap carry it — the stranded same-URL entry
  // simply backs out to the landing. Mirrors VaultModal.
  useEffect(() => {
    if (!menuOpen) return;
    // Hash-marked entry pushed via ClientRouter's own navigate() (see overlayHistory.ts), so
    // consuming it (back) is a same-page hash traversal — NO View Transition swap; a raw
    // pushState made the router re-swap the document and ghost the card mid-close. No #menu
    // element exists, so nothing scrolls; the hash is transient (only while the card is open).
    pushOverlayEntry("navOpen", "menu");
    const onPop = (): void => {
      if (!isOverlayEntry("navOpen")) closeMenu(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [menuOpen, closeMenu]);

  // Cross-page voice tap — RUNNING THE RIBBON (nave-menu.css): retargeting the vitta's `--vi`
  // makes the ONE ribbon run through the slot to the chosen row (one height transition — never
  // two ribbons swapping), and the swap is held one PULL_MS beat so the run reads. The card
  // stays OPEN into the swap: the outgoing snapshot captures it mid-run and the page
  // transition (transitions.css) dissolves it into the destination as one motion — the DOM
  // swap tears it down after the snapshot. Classes/vars are set imperatively (no setState) so
  // nothing re-renders them away before the swap; reduced motion skips the hold and lets the
  // swap itself be the transition.
  const commitVoice = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const voice = e.currentTarget;
    const list = voice.closest(".nave-list");
    voice.classList.add("is-chosen");
    list?.classList.add("is-committing");
    const vitta = list?.querySelector<HTMLElement>(".vitta");
    const vi = voice.style.getPropertyValue("--i").trim();
    if (vitta && vi) vitta.style.setProperty("--vi", vi);
    const href = voice.getAttribute("href");
    if (!href) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    window.setTimeout(() => {
      void navigate(href);
    }, RIBBON_PULL_MS);
  }, []);

  // Registrum ribbon: pull the chosen bookmark long, then let the page dissolve onto its concert.
  // Same gesture as the Astro SiteChrome's delegated handler on subpages. Plain primary clicks
  // only — modified / middle clicks navigate normally (new tab); reduced motion skips to the swap.
  // The classes are set imperatively (like commitVoice) so no re-render strips them before the
  // hold; navigate() then runs the View Transition crossfade (transitions.css).
  const commitRibbon = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const ribbon = e.currentTarget;
    const href = ribbon.getAttribute("href");
    if (!href) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    const registrum = ribbon.closest(".registrum");
    ribbon.classList.add("is-chosen");
    // is-committing also starts easing the hush blur to 0 (registrum.css), timed to be spent by
    // this beat's end; is-leaving then swaps blur(0) for NONE in the navigate tick — an invisible
    // change, but required BEFORE the View Transition captures the outgoing page (a live
    // backdrop-filter seams the snapshot; the dim tint stays and dissolves with it).
    registrum?.classList.add("is-committing");
    window.setTimeout(() => {
      registrum?.classList.add("is-leaving");
      void navigate(href);
    }, RIBBON_PULL_MS);
  }, []);

  // Focus stays inside the overlay while it owns the viewport; Escape plays the wipe. The hook
  // restores focus to the hamburger on deactivation (menu-closing counts as deactivated).
  const navRef = useRef<HTMLElement>(null);
  const onEscapeClose = useCallback(() => dismiss(), [dismiss]);
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
      {/* The brand fades through the dark threshold with the page root (transitions.css) — no
          shared-element morph, which only produced artifacts across the differing header states.
          It still persists ABOVE the open "Antyfona" card (z-index 61, tinted ink — see
          01-foundation.css), so tapping it while the card is open must also close the card
          (href="#top" is an in-page jump; no navigation swap does it for us). */}
      <a
        className="brand"
        href="#top"
        aria-label="VoctEnsemble"
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
        {/* "Registrum" — mute breviary register silks + ink index under KONCERTY
            (registrum.css); same markup + CSS choreography as the Astro SiteChrome on
            subpages. Pure :hover/:focus-within state — the only JS is the Escape blur
            below (the subpage script's equivalent is gated off this page by its missing
            #chrome id). */}
        <div
          className="registrum"
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            (document.activeElement as HTMLElement | null)?.blur();
          }}
        >
          <a className="support-link plausible-event-name=koncerty" href="/koncerty">
            Koncerty
          </a>
          {ribbons.length > 0 && (
            <>
              {/* The hush: full-viewport fixed layer quieting the whole page while the
                  register hangs open — a SIBLING of the drop (the drop's transform would
                  hijack its fixed containing block, see registrum.css traps). */}
              <span className="registrum-hush" aria-hidden="true" />
              <div className="registrum-drop">
                <div
                  className="registrum-sleeve"
                  style={{ "--n": ribbons.length } as React.CSSProperties}
                >
                  {ribbons.map((r, i) => (
                    <a
                      key={r.id}
                      className="ribbon"
                      href={r.href}
                      style={{ "--rib": r.accent, "--i": i } as React.CSSProperties}
                      onClick={commitRibbon}
                    >
                      <span className="ribbon-line">
                        <span className="ribbon-roman">{r.roman}</span>
                        <span className="ribbon-title">{r.title}</span>
                        <span className="ribbon-thread" aria-hidden="true" />
                      </span>
                      <span className="ribbon-meta">{r.meta}</span>
                      <span className="ribbon-silk" aria-hidden="true">
                        <span className="ribbon-cord" />
                        <span className="ribbon-strip" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
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

      {/* "Vitta" — shared mobile overlay (nave-menu.css): a parchment page with ONE crimson
          ribbon hanging down the left margin to the current voice (here always Główna — the
          landing is the current page); same markup + choreography as the Astro SiteChrome on
          subpages. The card carries NO brand of its own — the bar's .brand persists above it —
          so its top row is just "Zamknij" (also the focus trap's initial target). Every row
          carries a hidden margin ribbon (--i drives its length); choosing a voice lays its
          ribbon through the head rule while the current one withdraws (pull beat in
          commitVoice). */}
      <nav className="nave" id="navMenu" aria-label="Nawigacja główna" ref={navRef}>
        <div className="nave-veil" />

        <div className="nave-inner">
          <div className="nave-top">
            <button
              className="nave-close"
              id="menuClose"
              type="button"
              aria-label="Zamknij menu"
              onClick={dismiss}
            >
              Zamknij
            </button>
          </div>

          <div className="nave-list">
            {/* The ONE ribbon — resting at Główna (the landing is always the current page);
                commitVoice retargets `--vi` so it RUNS to the chosen row (nave-menu.css). */}
            <span
              className="vitta is-set"
              style={{ "--vi": 0 } as React.CSSProperties}
              aria-hidden="true"
            >
              <span className="vitta-cord" />
              <span className="vitta-strip" />
            </span>
            {/* "Główna" is an in-page jump (#top) — no page swap, so it closes the card. The
                three cross-page voices leave it open and let the fade-through-dark carry it. */}
            <a
              className="voice"
              href="#top"
              aria-current="page"
              style={{ "--i": 0 } as React.CSSProperties}
              onClick={() => closeMenu(false)}
            >
              <span className="voice-lat">Introitus</span>
              <span className="voice-pl">Główna</span>
            </a>
            <a
              className="voice"
              href="/o-nas"
              style={{ "--i": 1 } as React.CSSProperties}
              onClick={commitVoice}
            >
              <span className="voice-lat">De nobis</span>
              <span className="voice-pl">O nas</span>
            </a>
            <a
              className="voice"
              href="/koncerty"
              style={{ "--i": 2 } as React.CSSProperties}
              onClick={commitVoice}
            >
              <span className="voice-lat">Via</span>
              <span className="voice-pl">Koncerty</span>
            </a>
            <a
              className="voice"
              href="/kontakt"
              style={{ "--i": 3 } as React.CSSProperties}
              onClick={commitVoice}
            >
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
