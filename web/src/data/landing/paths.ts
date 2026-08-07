/**
 * @file paths.ts
 * @description Past Concerts Spirituels — content for the "Co już zabrzmiało" register.
 *  Each entry maps to a single path card. This file holds only the landing-specific editorial
 *  layer (tag, lead note, provenance credit, video fragment); the repertoire itself is NOT stored
 *  here — every card's expandable "Program koncertu" derives its work list from the `concerts`
 *  collection via `concertId` (SSoT), edited in exactly one place. `poster` is the bare asset name under
 *  src/assets/photos (resolved with `photo()` → optimized <Picture>), not a public URL.
 * @architecture Astro islands 2026
 * @module data/landing/paths
 */

import { videoAsset } from "../../lib/videos";

/** One curated fragment for a register entry — omit the whole slot when no footage exists. */
export interface PathVideo {
  /** Bundled URL of a self-hosted MP4 (H.264 + AAC). */
  readonly src: string;
  /** Phone-shot 9:16 document — the player switches to a portrait, height-driven frame. */
  readonly portrait?: boolean;
  /** Honest provenance line under the lightbox caption (piece credit · recording origin). */
  readonly note?: string;
}

export interface Path {
  readonly slug: string;
  /** Concert id in the `concerts` collection — the SSoT the program list is read from. */
  readonly concertId: string;
  readonly year: string;
  readonly tag: string;
  readonly title: string;
  readonly place: string;
  /** The lead — one honest sentence shown in the closed register row. */
  readonly note: string;
  /** Bare asset name under src/assets/photos (no extension), resolved via photo(). */
  readonly poster: string;
  /** Curated video fragment; omit when no footage exists (never fabricate). */
  readonly video?: PathVideo;
  /** Optional provenance footnote (recording credit / partners) shown under the program. */
  readonly credit?: string;
  /** The one photograph that stands for this evening in the Imagines band, named by its `img`
   *  in the concert's own `gallery` (so alt, caption and credit come with it). Omit to take the
   *  gallery's first entry — set it only where that first entry documents something other than
   *  the evening itself, e.g. a rehearsal. A name that is not in that gallery fails the build. */
  readonly frame?: string;
}

/** The register's numbering, by position. Shared with the Imagines band so the band's numerals
 *  and the register's are one sequence rather than two lists that happen to agree — the band
 *  states the same five evenings the register states directly below it. */
export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const;

export const PATHS: readonly Path[] = [
  {
    slug: "kontemplacja-wcielenia",
    concertId: "wcielenie",
    year: "MMXXIV",
    tag: "Koncert Duchowy · debiut",
    title: "Kontemplacja Wcielenia",
    place: "Bazylika NSPJ w Krakowie",
    note: "Wejście w tajemnicę Wcielenia, od zapowiedzi Izajasza po kantyk Symeona. Renesansowa polifonia, Pärt, Vivancos.",
    poster: "poster-wcielenie",
    // The gallery opens on three rehearsal frames; the band announces the evening, so it takes
    // the first one shot at the concert itself.
    frame: "kd-wcielenie-3",
    // Same file as the hero modal (MODAL_VIDEO in video.ts), so cache and resume position
    // are shared only across this exact MP4.
    video: { src: videoAsset("landing-modal") },
    credit: "Rejestracja: Jakub Garbacz, Ars Sonora Studio. Reprise pod auspicjami Fundacji Carpe Diem.",
  },
  {
    slug: "wolanie-gor",
    concertId: "wolanie-gor",
    year: "MMXXIV",
    tag: "12 głosów i skrzypce",
    title: "Wołanie Gór",
    place: "Dworek Gościnny · Szczawnica",
    note: "Program, dla którego góry były oddechem. Sakralna polifonia i pieśni ludowe Polski, Korsyki, Francji i Wysp Brytyjskich, ze skrzypcami Radu Ropotana.",
    poster: "poster-wolanie",
    // Same as Wcielenie: entries 0–2 are the rehearsal in Szczawnica, not the evening.
    frame: "kd-wolanie-3",
    video: {
      src: videoAsset("landing-wolanie"),
      portrait: true,
      note: "J. Sykulski — Stoi lód na Prośnie · zapis z widowni · dźwięk na żywo",
    },
  },
  {
    slug: "9-kart-z-ksiegi-psalmow",
    concertId: "9-kart",
    year: "MMXXIV",
    tag: "Cykl psalmów · 6–12 głosów",
    title: "9 Kart z Księgi Psalmów",
    place: "Bazylika św. Antoniego w Rybniku · Archikatedra w Łodzi · Bazylika NSPJ w Krakowie",
    note: "Dziewięć psalmów: pokuta, lament, uwielbienie. Miserere Allegriego, podzielone na dziewięć części, oplata cały wieczór.",
    poster: "poster-9-kart",
  },
  {
    slug: "hymn-poleglym",
    concertId: "hymn-poleglym",
    year: "MMXXV",
    tag: "Modlitwa o pokój",
    title: "Hymn Poległym",
    place: "Bazylika Mariacka w Krakowie",
    note: "Hołd tym, którzy oddali życie w obronie Ukrainy. W kulminacji, przy otwarciu ołtarza Mariackiego, zabrzmiał hymn Ukrainy.",
    poster: "poster-hymn",
  },
  {
    slug: "aeternam-epitafium-dla-gazy",
    concertId: "aeternam",
    year: "MMXXV",
    tag: "Epitafium · 4, 8 i 12 głosów",
    title: "Aeternam — Epitafium dla Gazy",
    place: "Mistrzejowice · Niedzica",
    note: "Wieczór za mieszkańców Gazy. Aeternam Vivancosa, dwaj Tavenerowie, zawierzenie ofiar Matce Bożej.",
    poster: "poster-aeternam",
    video: {
      src: videoAsset("landing-aeternam"),
      portrait: true,
      note: "C. Shaw — and the swallow (Psalm 84) · zapis z nawy · dźwięk na żywo",
    },
    credit: "Partnerzy: Gmina Łapsze Niżne · GOK Łapsze Niżne · ZEW Niedzica · Zamek Dunajec · ACN — Pomoc Kościołowi w Potrzebie. Patroni medialni: Gość Niedzielny · Radio Alex · Tygodnik Podhalański.",
  },
];
