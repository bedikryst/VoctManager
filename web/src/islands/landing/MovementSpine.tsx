/**
 * @file MovementSpine.tsx
 * @description Right-edge orientation spine for the landing's three liturgical movements
 *  (I · Lumen Christi, II · Vox memoriae, III · Sustinete nos). Turns the conceptual structure
 *  into a function: a fixed hairline index that marks where the reader is in the rite and lets
 *  them jump between movements. Reveals after the hero; desktop / fine-pointer only (the mobile
 *  nav sheet covers small screens). An IntersectionObserver on a viewport centre-band tracks the
 *  active movement. Candle-gold (reads on both parchment and the dark full-bleed sections),
 *  faint at rest, full only on the active movement.
 *
 *  It floats in the page's 5vw gutter, so it clears every section that keeps one — but a section
 *  that bleeds its CONTENT to the viewport edge has no gutter to float in, and the spine then
 *  prints itself on that content. Such a section marks itself `data-spine-clear` and the spine
 *  withdraws for as long as it holds the viewport centre. Withdrawing is the right way round:
 *  the spine is orientation, the bled object is the page.
 * @architecture Astro islands 2026
 * @module islands/landing/MovementSpine
 */

import { useCallback, useEffect, useState } from "react";

interface Movement {
  readonly key: string;
  readonly roman: string;
  readonly latin: string;
}

interface LenisLike {
  scrollTo: (target: number | HTMLElement, opts?: { duration?: number; offset?: number }) => void;
}

const MOVEMENTS: readonly Movement[] = [
  { key: "lumen", roman: "I", latin: "Lumen Christi" },
  { key: "vox", roman: "II", latin: "Vox memoriae" },
  { key: "sustinete", roman: "III", latin: "Sustinete nos" },
];

export function MovementSpine(): React.JSX.Element {
  const [active, setActive] = useState(-1);
  const [visible, setVisible] = useState(false);
  const [veiled, setVeiled] = useState(false);

  // Track the active movement via a zero-height band at viewport centre: exactly one movement
  // spans it at a time (none in the hero/manifest gap before I — active stays -1 there).
  useEffect(() => {
    const sections = MOVEMENTS.map((m) =>
      document.querySelector<HTMLElement>(`[data-movement="${m.key}"]`),
    );
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = sections.findIndex((s) => s === entry.target);
          if (idx !== -1) setActive(idx);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    sections.forEach((s) => {
      if (s) io.observe(s);
    });
    return () => io.disconnect();
  }, []);

  // Withdraw over full-bleed content (`data-spine-clear`), on the SAME centre band the active
  // movement is read from — the spine sits at `top: 50%`, so the centre is exactly where it
  // would collide. A Set rather than a boolean because two marked sections can be on screen at
  // once during the crossing; a boolean would un-veil on the first `isIntersecting: false` and
  // flash the spine back onto the second one's photographs.
  useEffect(() => {
    const held = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) held.add(entry.target);
          else held.delete(entry.target);
        }
        setVeiled(held.size > 0);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    document.querySelectorAll("[data-spine-clear]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Reveal once past the hero so the opening threshold stays uncluttered.
  useEffect(() => {
    let raf: number | null = null;
    const onScroll = (): void => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        setVisible(window.scrollY > window.innerHeight * 0.6);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, []);

  const onJump = useCallback((event: React.MouseEvent<HTMLAnchorElement>, key: string): void => {
    event.preventDefault();
    const target = document.querySelector<HTMLElement>(`[data-movement="${key}"]`);
    if (!target) return;
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    if (lenis) lenis.scrollTo(target, { duration: 1.2, offset: -10 });
    else target.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <nav
      className={`movement-spine${visible ? " is-visible" : ""}${veiled ? " is-veiled" : ""}`}
      aria-label="Części"
    >
      <ul>
        {MOVEMENTS.map((m, i) => (
          <li key={m.key} className={i === active ? "is-active" : ""}>
            <a
              href={`#ruch-${m.roman.toLowerCase()}`}
              onClick={(event) => onJump(event, m.key)}
              aria-current={i === active ? "true" : undefined}
            >
              <span className="movement-spine-latin">{m.latin}</span>
              <span className="movement-spine-roman">{m.roman}</span>
              <span className="movement-spine-tick" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
