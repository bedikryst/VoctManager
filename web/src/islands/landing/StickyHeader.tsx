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

import {
  dismissOverlayEntry,
  isOverlayEntry,
  navigateFromOverlay,
  pushOverlayEntry,
} from "../../lib/overlayHistory";
import type { RibbonEntry } from "../../lib/registrum";
import { localizePath, type Locale } from "../../i18n/config";
import { UI } from "../../i18n/ui";
import type { LandingChrome } from "../../i18n/content/landing";
import { useAudioChoice } from "./hooks/useAudioChoice";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { horaForWarsaw } from "./lib/horaeCanonicae";
import { Typo } from "./lib/Typo";

// Sections whose surface is dark enough that the glass chrome must invert to its light brand.
// The footer is CONDITIONALLY one of them: it is printed on the ground of the canonical hour it
// is read in (`body[data-lumen]`, set by scripts/landing.ts), so at Completorium the bar stands
// over a night plate and a dark brand on it would be unreadable. The probe below runs
// `closest()` on every scroll frame, so the condition is live — a plate that turns at 21:00
// takes the chrome with it.
const DARK_SELECTORS =
  ".litany, .ensemble, .director-dark, .final-support, .preloader, .vault, .regulamin, .gratitude, .failure, body[data-lumen='nox'] .site-footer";

// How long a chosen silk is held before the page swap fires — one beat, so the gesture reads
// before the crossfade (transitions.css) dissolves it. Shared by the desktop registrum's
// bookmark pull AND the mobile Vitta's ribbon descent (nave-menu.css).
const RIBBON_PULL_MS = 220;

export interface StickyHeaderProps {
  /** The desktop "registrum" — one register ribbon per page-bearing concert, derived by
      lib/registrum in LandingPage.astro (islands can't read the collection themselves). Its
      `href` is the canonical Polish base path, which this component localizes. */
  ribbons?: readonly RibbonEntry[];
  /**
   * The page's language. TAKEN, NOT READ: this island is server-rendered, and `documentLocale()`
   * has no document there — it answers Polish, so an English landing would ship a Polish bar and
   * React would answer the mismatch by discarding the server DOM in front of the reader.
   */
  lang: Locale;
  /** The landing's own affordances; everything else here is the site-wide chrome dictionary. */
  chrome: LandingChrome;
}

export function StickyHeader({
  ribbons = [],
  lang,
  chrome,
}: StickyHeaderProps): React.JSX.Element {
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

  // Cross-page tap on any line of the card — RUNNING THE RIBBON (nave-menu.css): copying the
  // row's `--vb`/`--vr` onto the vitta makes the ONE ribbon run through the slot to the chosen
  // line (one height transition — never two ribbons swapping), and the swap is held one
  // PULL_MS beat so the run reads. The card stays OPEN into the swap: the outgoing snapshot
  // captures it mid-run and the page transition (transitions.css) dissolves it into the
  // destination as one motion — the DOM swap tears it down after the snapshot. Classes/vars
  // are set imperatively (no setState) so nothing re-renders them away before the swap;
  // reduced motion skips the hold and lets the swap itself be the transition.
  const commitVoice = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const voice = e.currentTarget;
    const list = voice.closest(".nave-list");
    voice.classList.add("is-chosen");
    list?.classList.add("is-committing");
    const vitta = list?.querySelector<HTMLElement>(".vitta");
    const vb = voice.style.getPropertyValue("--vb").trim();
    if (vitta && vb) {
      vitta.style.setProperty("--vb", vb);
      vitta.style.setProperty("--vr", voice.style.getPropertyValue("--vr").trim() || "0");
    }
    const href = voice.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    // navigateFromOverlay, not navigate: the card pushed a history entry on open, and the
    // destination has to REPLACE it — pushed on top it becomes a shadow entry that eats the first
    // back press. Reduced motion takes the same path without the hold beat, so the back button
    // behaves identically however the visitor has their system set.
    const commit = (): void => void navigateFromOverlay("navOpen", href);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) commit();
    else window.setTimeout(commit, RIBBON_PULL_MS);
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
  const t = UI[lang];
  // Every destination is a base path localized here. A literal that was correct when it was typed
  // does not announce itself when the file around it learns a locale — this bar shipped five of
  // them on the subpages (spec §6z), and the phone's Via was the worst of them, sending every
  // concert row to the Polish page on the only road a phone has to a concert at all.
  const hrefAbout = localizePath("/o-nas", lang);
  const hrefConcerts = localizePath("/koncerty", lang);
  const hrefContact = localizePath("/kontakt", lang);
  const hrefImages = localizePath("/obrazy", lang);
  const hrefColophon = localizePath("/kolofon", lang);

  return (
    <Typo locale={lang}>
      <header
        className={`chrome${onDark ? " is-on-dark" : ""}${active ? " is-active" : ""}${menuOpen ? " menu-open" : ""}${menuClosing ? " menu-closing" : ""}`}
        aria-label={t.nav.ariaHeader}
      >
        {/* The brand fades through the dark threshold with the page root (transitions.css) — no
            shared-element morph, which only produced artifacts across the differing header states.
            It still persists ABOVE the open "Antyfona" card (z-index 61, tinted ink — see
            01-foundation.css), so tapping it while the card is open must also close the card
            (href="#top" is an in-page jump; no navigation swap does it for us). */}
        <a
          className="brand"
          href="#top"
          aria-label={t.nav.brandAria}
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
            {audioOn ? chrome.audioOn : chrome.audioOff}
          </button>
          <a className="support-link plausible-event-name=o+nas" href={hrefAbout}>
            {t.nav.about}
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
            <a className="support-link plausible-event-name=koncerty" href={hrefConcerts}>
              {t.nav.concerts}
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
                        href={localizePath(r.href, lang)}
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
                    {/* The register's closing line — the archive of every evening's
                        photographs, filed under the section it belongs to. Deliberately NOT a
                        sixth ribbon (registrum.css): no numeral, no silk, no leader. It takes
                        no pull beat either — the beat exists to let a bookmark be YANKED, and
                        this line has no silk to yank. */}
                    <a className="registrum-all" href={hrefImages}>
                      <span className="registrum-all-word">{t.nav.archive}</span>
                      <span className="registrum-all-gloss">{t.nav.archiveGloss}</span>
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
          <a className="support-link plausible-event-name=kontakt" href={hrefContact}>
            {t.nav.contact}
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
            {t.nav.support}
          </a>
          <button
            className="nav-toggle"
            id="navToggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="navMenu"
            aria-label={t.nav.menu}
            onClick={openMenu}
          />
        </div>

        {/* "Vitta" — shared mobile overlay (nave-menu.css): a ruled parchment page whose every
            line sits on one band — the hour's antiphon, the four voices, the Wesprzyj line —
            with ONE crimson ribbon falling from the head rule to the current voice (here always
            Główna: the landing is the current page). Same markup + choreography as the Astro
            SiteChrome on subpages. The card carries NO brand of its own — the bar's .brand
            persists above it — so its top row is just "Zamknij" (also the focus trap's initial
            target). commitVoice retargets the one ribbon's `--vi` and holds the swap a beat so
            the run reads. */}
        <nav className="nave" id="navMenu" aria-label={t.nav.ariaPrimary} ref={navRef}>
          <div className="nave-veil" />

          <div className="nave-inner">
            <div className="nave-top">
              <button
                className="nave-close"
                id="menuClose"
                type="button"
                aria-label={t.nav.closeAria}
                onClick={dismiss}
              >
                {t.nav.close}
              </button>
            </div>

            <div className="nave-list">
              {/* The ONE ribbon — resting at Główna, the first voice under the antiphon's band
                  (the landing is always the current page); commitVoice copies the chosen line's
                  `--vb`/`--vr` onto it so it RUNS there (nave-menu.css GEOMETRY). */}
              <span
                className="vitta is-set"
                style={{ "--vb": 1.5, "--vr": 0 } as React.CSSProperties}
                aria-hidden="true"
              >
                <span className="vitta-cord" />
                <span className="vitta-strip" />
              </span>
              {/* The antiphon names its hour — the page's first ruled line, name left and poem
                  right across the measure, the card's one living element (see `hora`: computed
                  only while open, so the SSG snapshot ships the neutral placeholder). */}
              <span className="nave-antiphon">
                <span>{hora?.name ?? "Hora"}</span>
                <em>{hora ? hora.poem[lang] : "canonica"}</em>
              </span>
              {/* Each voice is one index entry — word · leader · incipit (nave-menu.css); the
                  leader is drawn furniture, hence aria-hidden. "Główna" is an in-page jump
                  (#top) — no page swap, so it closes the card. The three cross-page voices
                  leave it open and let the fade-through-dark carry it. */}
              <a
                className="voice"
                href="#top"
                aria-current="page"
                style={{ "--i": 0, "--vb": 1.5, "--vr": 0 } as React.CSSProperties}
                onClick={() => closeMenu(false)}
              >
                <span className="voice-gloss">{t.nav.home}</span>
                <span className="voice-lead" aria-hidden="true" />
                <span className="voice-lat">Introitus</span>
              </a>
              <a
                className="voice"
                href={hrefAbout}
                style={{ "--i": 1, "--vb": 2.5, "--vr": 0 } as React.CSSProperties}
                onClick={commitVoice}
              >
                <span className="voice-gloss">{t.nav.about}</span>
                <span className="voice-lead" aria-hidden="true" />
                <span className="voice-lat">De nobis</span>
              </a>
              <a
                className="voice"
                href={hrefConcerts}
                style={{ "--i": 2, "--vb": 3.5, "--vr": 0 } as React.CSSProperties}
                onClick={commitVoice}
              >
                <span className="voice-gloss">{t.nav.concerts}</span>
                <span className="voice-lead" aria-hidden="true" />
                <span className="voice-lat">Via</span>
              </a>
              <a
                className="voice"
                href={hrefContact}
                style={{ "--i": 3, "--vb": 4.5, "--vr": 0 } as React.CSSProperties}
                onClick={commitVoice}
              >
                <span className="voice-gloss">{t.nav.contact}</span>
                <span className="voice-lead" aria-hidden="true" />
                <span className="voice-lat">Scribe nobis</span>
              </a>

              {/* THE VIA — the concert register (nave-menu.css), the same rows the desktop hangs
                  under KONCERTY and the phone's only road to them. Fed by the `ribbons` prop
                  (islands can't read the collection themselves); the label counts as the
                  register's first --vrow, hence `--vr: i + 1.5` on each row. That number is
                  load-bearing twice: it places the ribbon's tip on the row AND paces the
                  register's entrance, since (--vr − 0.5) is the row's ordinal in the run
                  (nave-menu.css). No separate `--i` for that reason — a second index could
                  drift out of step with the first. */}
              {ribbons.length > 0 && (
                <div className="via">
                  <span className="via-label">Via</span>
                  {ribbons.map((r, i) => (
                    <a
                      key={r.id}
                      className="via-row"
                      href={localizePath(r.href, lang)}
                      style={{ "--vb": 5, "--vr": i + 1.5 } as React.CSSProperties}
                      onClick={commitVoice}
                    >
                      <span className="via-roman">{r.roman}</span>
                      <span className="via-title">{r.title}</span>
                      <span className="via-lead" aria-hidden="true" />
                      <span className="via-date">{r.viaDate}</span>
                    </a>
                  ))}
                  {/* The register's closing entry — the archive, one row past the last concert
                      (nave-menu.css). It commits exactly like a concert row: commitVoice reads
                      the `--vb`/`--vr` off the element, so the ribbon runs to it too. */}
                  <a
                    className="via-row via-all"
                    href={hrefImages}
                    style={{ "--vb": 5, "--vr": ribbons.length + 1.5 } as React.CSSProperties}
                    onClick={commitVoice}
                  >
                    <span className="via-title">{t.nav.archive}</span>
                    <span className="via-lead" aria-hidden="true" />
                    <span className="via-lat">Imagines</span>
                  </a>
                </div>
              )}
            </div>

            <div className="nave-foot">
              {/* The closing line of the page — the same entry grammar as the voices above, one
                  step smaller, under the foot's gold rule. Not a button: see nave-menu.css. */}
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
                <span className="nave-cta-word">{t.nav.support}</span>
                <span className="voice-lead" aria-hidden="true" />
                <em className="voice-lat">Sustinete nos</em>
              </a>
              {/* The page's fine print — Kolofon is a real page with no other road from the
                  phone (nave-menu.css). A cross-page link, but not an index entry: it closes
                  the card rather than running the ribbon. */}
              <span className="nave-fine">
                <a href={hrefColophon} onClick={() => closeMenu(false)}>
                  {t.footer.colophon}
                </a>
              </span>
            </div>
          </div>
        </nav>
      </header>
    </Typo>
  );
}
