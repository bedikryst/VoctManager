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
  /** Which part of `frame` survives the band's square crop. The crop happens at BUILD (sharp, via
   *  lib/croppedShot), so this is the whole lever — the band's sheet has no `object-position`
   *  left to turn, because by the time the file reaches the browser it is already the panel's
   *  shape. Sharp's vocabulary: `"top"`, `"left top"`, `"attention"`, `"entropy"`. Omit for
   *  centre, which is where all five stand until a crop is seen to land badly. */
  readonly framePosition?: string;
  /**
   * Exposure correction for this evening's panel, multiplied into the band's shared grade
   * (`--panel-lift`, 14-imagines.css). Above 1 lifts, below 1 damps; omit for none.
   *
   * It exists because five photographs shot in five buildings do not share an exposure and one
   * filter cannot equalise them. The values are a PARTIAL correction toward the line's middle,
   * not a normalisation: flattening five naves to one luminance would cost the chiaroscuro that
   * is the reason these photographs are worth showing.
   *
   * MEASURE THE LIT PART, NOT THE FRAME. The statistic is the mean of the panel's brightest 40%
   * (`> p60`) at the band's crop and grade, and the flat mean it replaces is why the previous set
   * was wrong about one panel: Wołanie Gór is a close-up against a black studio backdrop, so 42%
   * of its area is background and the frame mean read it as underexposed while its subject was
   * already the second brightest in the line. A statistic that cannot tell a dark room from a
   * dark subject will keep asking for light the subject does not need.
   *
   * The line measures 0.376 · 0.285 · 0.243 · 0.186 · 0.427 lit-mean; each panel takes 40% of the
   * distance to the geometric mean in log space, times 1.08 for the parchment ground. Hymn
   * Poległym is the one panel capped below its derived value (1.29 → 1.16): past ~1.20 the blue
   * wash across its nave clips and the window flattens into one saturated field, which is the
   * same trade §13 refused when it changed that evening's photograph rather than lift it harder.
   * Re-derive with a contact sheet at the panel's crop and grade — a reading of `alt` strings
   * answers nothing here.
   */
  readonly frameLift?: number;
  /**
   * The date printed in the band's readout, beside the evening's name. It dates the PHOTOGRAPH's
   * own night, which for a programme that toured is not the same as `year` — the register dates
   * the programme, the band dates the evening it is showing. Written out because the register's
   * bare year is not a chronology here: three of five panels read MMXXIV.
   */
  readonly frameDate: string;
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
    frame: "kd-wcielenie-6",
    frameDate: "styczeń MMXXIV",
    frameLift: 0.97,
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
    frameDate: "czerwiec MMXXIV",
    // Barely moved, and deliberately: this is the line's one close-up and its blacks are a studio
    // backdrop rather than an unlit nave. Its singers already sit second brightest in the line, and
    // the score in their hands is clipped in the source — lifting toward the frame mean would only
    // spread that white.
    frameLift: 1.09,
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
    // gallery[0] is a photograph of the printed programme — a good archive entry and the one
    // thing in the band that was not an evening. It was also the brightest panel of five on a
    // night ground, so the eye landed on the middle of the line before its beginning.
    frame: "kd-9-kart-2",
    // The programme toured Rybnik → Łódź → Kraków; this frame is the Kraków evening (16 XI).
    frameDate: "listopad MMXXIV",
    // The line's one frame with a lifted black point of its own, so it takes light with almost no
    // clipping — the cheapest lift of the five, and the panel the crushed grade cost the most.
    frameLift: 1.16,
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
    // gallery[0] is a photograph of the evening and unusable as a panel: measured at the band's
    // crop, 85% of it sits under 6% luma — a black rectangle at any size the line can give it,
    // which is precisely what web-imagines-spec §2 rejects the thumbnail grid for. Of this
    // gallery's four, `-2` is the only one that reads at the panel's width, and it is also the
    // line's one cool frame, so it separates two warm naves rather than repeating them. (`-3`
    // measures brightest and is the audience seen from the back, with a face in the foreground —
    // outside the consent scope, which covers singers.)
    frame: "kd-hymn-2",
    frameDate: "luty MMXXV",
    // The darkest of the five and still the one that may take the LEAST of what the arithmetic
    // offers it: the blue wash filling the middle of this nave clips past ~1.20 and the window
    // goes flat. It stays the line's dark end, which is honest — it was the darkest evening.
    frameLift: 1.16,
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
    // gallery[0] is the widest frame of the set — an evenly lit hall seen from the back rows.
    // Cropped to the band's square it keeps neither the architecture nor the singers, which is
    // the one thing a panel this size cannot afford. This one carries both.
    frame: "kd-aeternam-3",
    // Two evenings, Mistrzejowice and Niedzica; this frame is Niedzica (18 X).
    frameDate: "październik MMXXV",
    // The line's brightest, and it is NOT damped back toward the middle — that was tried at 0.86
    // and only cost the gilt. It takes the parchment gain alone, so the equalisation runs upward
    // from the dark end rather than downward from this one. Above ~1.16 the vault behind the altar
    // brightens faster than the gold and the arch loses its depth. Raising `saturate` instead is
    // the wrong instrument: it deepens the vault's blue before it warms the gold, i.e. it pushes
    // this panel toward IV's register rather than away from it.
    frameLift: 1.08,
    video: {
      src: videoAsset("landing-aeternam"),
      portrait: true,
      note: "C. Shaw — and the swallow (Psalm 84) · zapis z nawy · dźwięk na żywo",
    },
    credit: "Partnerzy: Gmina Łapsze Niżne · GOK Łapsze Niżne · ZEW Niedzica · Zamek Dunajec · ACN — Pomoc Kościołowi w Potrzebie. Patroni medialni: Gość Niedzielny · Radio Alex · Tygodnik Podhalański.",
  },
];
