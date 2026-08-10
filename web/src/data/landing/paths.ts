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
   * The line measures 0.381 · 0.288 · 0.451 · 0.088 · 0.451 lit-mean; each panel takes 40% of the
   * distance to the geometric mean in log space, times 1.08 for the parchment ground. TWO panels
   * are capped below their derived value, and both caps were read off a rendered panel rather
   * than argued: Wołanie Gór (1.08 → none, its source already sits at p99 = 0.996) and Hymn
   * Poległym (1.74 → 1.35, past which the nave's floor turns milky and stops being night).
   * Re-derive with a contact sheet at the panel's crop and grade — a reading of `alt` strings
   * answers nothing here.
   */
  readonly frameLift?: number;
  /**
   * Saturation correction for this evening's panel, multiplied into the band's shared `saturate`
   * (`--panel-sat`, 14-imagines.css). Below 1 damps, above 1 deepens; omit for none.
   *
   * Same reasoning as `frameLift` one axis over: one number cannot govern five buildings. The
   * shared 0.74 is aimed at the line's middle, and a nave whose own walls are terracotta arrives
   * at nearly twice the chroma of the other four (measured as mean HSV S at the panel's crop:
   * 0.594 against ~0.34). The lever is deliberately NOT brightness — that panel's exposure is
   * already where the line wants it, and dimming a frame to fix its colour costs the subject.
   *
   * Both hover endpoints multiply by it, exactly as they do for the lift: stated flat, the
   * recession and the return would be a different gesture on a damped panel than on the rest,
   * which is the defect §13 fixed once for exposure.
   */
  readonly frameSaturation?: number;
  /**
   * A corrected copy of `frame`, used by the band ALONE — bare asset name, same convention as
   * `frame`. Omit wherever the photograph as delivered belongs in the line, which is four
   * evenings out of five.
   *
   * It exists because a MATTE grade is not a luminance problem and cannot be fixed downstream of
   * one. The Łódź frames of 9 Kart carry a split-toned shadow lift — per-channel black points of
   * 4 / 20 / 31 against 0 / 0 / 0 for every other photograph in this archive — so the panel's
   * shadows came out TEAL in a line whose other four are warm, on a page whose whole palette is
   * parchment, night and candle. A `contrast()` was tried here first and could never have worked:
   * it scales all three channels about the same midpoint, so it moved the luminance black point
   * and left the 27-level channel spread exactly where it was. CSS has no per-channel transfer
   * short of an SVG `feComponentTransfer`, and a `url()` in the filter chain would have made the
   * hover grade non-interpolable, which costs the band its one gesture.
   *
   * So the correction is baked into a separate file: per-channel linear mapping each channel's
   * own black point to 0 and holding white, which is the exact inverse of the lift and invents
   * nothing. `frame` still names the GALLERY entry, so alt, credit and run all still come from
   * the photograph itself, and the archive keeps the file as its photographer delivered it —
   * this variant is referenced nowhere else and appears on no other surface.
   *
   * Regenerate it, do not retouch it: measure p1 per channel on the whole frame, then
   * `sharp(src).linear(255/(255−p), −p·255/(255−p))` with the triple. Verify by re-measuring —
   * the channel spread must come back under 2, and the shadow B−R must land in the line's warm
   * range rather than merely near zero.
   */
  readonly frameAsset?: string;
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
    frameLift: 0.96,
    // Damped because this basilica's own walls are terracotta and the evening was lit for
    // Christmas, so the frame arrives at 0.594 mean chroma against ~0.34 for the other four and
    // led the line on colour alone.
    //
    // 0.85 AND NOT LOWER, and the reason is the second statistic this panel is scored on. It was
    // held at 0.68 while only chroma was being read, which put its effective saturation at 0.50 —
    // the lowest of the five — on a frame whose hue spread is 10.3°, i.e. one warm brick note and
    // nothing beside it. Monotone AND muted is what reads as a faded photograph rather than a
    // damped one, and the damp is the half we control. At 0.85 the brick still stops short of
    // leading, and the greens of the tree and the candle gold come back far enough to give the
    // panel a second colour. Do not go back under ~0.75 without also finding a frame from this
    // evening with more than one hue in it; that, not the number, is the real constraint here.
    frameSaturation: 0.85,
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
    // Same as Wcielenie: entries 0–3 are the rehearsal in Szczawnica, not the evening — and they
    // are monochrome, so the band's frame can only come from 4 upward whatever else changes.
    frame: "kd-wolanie-4",
    frameDate: "czerwiec MMXXIV",
    // NO LIFT AND NO DAMP, which is the only panel of five that needs neither: at the crop it
    // measures 0.335 lit-mean and 10.2% of its area above mid-luma, against 0.215–0.283 and
    // 1.6–11.1% for the graded rest. The arithmetic asks for 0.97 and that is inside the noise of
    // the measurement, so it is left off rather than written down as a correction that corrects
    // nothing.
    //
    // It is the line's one COOL panel and the only one that will ever be: the blue is the
    // projection behind the singers — the evening's set, shot as it was — not a cast in the
    // blacks, which measure +1.8 and are neutral. That is why it is corrected rather than
    // replaced or rebalanced, and why the correction is saturation.
    //
    // READ THE SIGN, NOT THE MAGNITUDE, before touching this number. Ungraded the panel carries
    // the LOWEST chroma of the five (0.265 against 0.345–0.476), so a reading that asks whether
    // this frame is too colourful answers no and misses the defect entirely. What separates it is
    // B−R: +17 at the crop where the other four run −4.4 to −22.2, i.e. it is the one panel on the
    // cool side of neutral on a page whose palette is parchment, night and candle. At 0.55 it
    // measures B−R +9.4 and chroma 0.166 — the projection reads as a silver glow behind the
    // singers instead of a cyan field, and the line stops having a middle.
    //
    // What this lever CANNOT do is warm it: `saturate` shortens the distance to grey and never
    // crosses it, so even 0.40 leaves B−R at +6.8 with the chroma down to a washed 0.127. Do not
    // chase the sign downward — past ~0.5 the singers' faces go grey before the projection does,
    // and the panel starts reading as the monochrome register the rehearsal frames own. Warming
    // it properly would take a white-balanced `frameAsset`, and that is refused: the 9 Kart
    // variant undoes a grade its PHOTOGRAPHER applied, where this would recolour the light the
    // room actually had.
    frameSaturation: 0.55,
    //
    // What this frame costs is pixels: the source is 900×615, so its square clamps the band's
    // ladder to [360, 480] (lib/croppedShot) and a 2× screen paints the 480 at 1.32×. That is a
    // print problem with a print answer — a larger file from the photographer (PieninyInfo) — and
    // nothing in the grade touches it. The evening's other concert frames are not the answer
    // either: `-5` puts a projected mountain range across half the panel (50.5% above mid-luma,
    // and `framePosition` cannot reach it — the source is landscape, so the square takes its full
    // height), `-6` prints the ensemble's own logotype mid-plate, `-7` is a posed group.
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
    // Chosen on SUBJECT SCALE and on HUE RANGE, which are the two statistics the panels in this
    // line stand or fall on. Scale first: `kd-9-kart-2` once stood here with the ensemble behind a
    // balustrade at the far end of a dark nave, ~1/6 of the frame's height, which at 316px is a
    // photograph of a church. This is the conductor and the singers at the altar, read from the
    // nave, so architecture and people arrive in one frame.
    //
    // HUE RANGE IS WHY THE ŁÓDŹ FRAME LEFT. `-9` satisfied the scale rule and still read as the
    // odd panel, and the number that finally named it was the circular spread of hue across the
    // lit subject: 9.6° against 24.7° and 29.8° for IV and V. Everything in that archikatedra —
    // walls, marble, altar, floor — is one brown, so the panel was effectively monochrome sepia
    // beside four frames that carry several hues each. Its measured exposure was perfectly in
    // band, which is exactly why three passes looked at brightness and found nothing.
    //
    // That was NOT a correctable defect, and the failed attempt is worth keeping: `-9` arrives
    // split-toned (per-channel black points 4 / 20 / 30, shadows +15.6 on B−R where the rest of
    // the archive runs negative), and the `frameAsset` variant that neutralised it took the hue
    // range down with it — 17.6° in the delivered file, 9.6° corrected. Re-derived with the
    // offset alone and no gain it fell further, to 6.8°. The teal WAS the second hue; removing it
    // by any route leaves one brown. A photograph whose only colour variety is its photographer's
    // grade cannot be graded into this line.
    //
    // This frame needs neither correction: shadows measure −3.0 on B−R, hue spread 15.7°, and the
    // violet apse wall, the gilt, the white flowers and the marble floor are four hues that are
    // actually in the room.
    frame: "kd-9-kart-15",
    // The programme toured Rybnik → Łódź → Kraków; this frame is the Kraków evening (16 XI), so
    // the band's date moves with the photograph. The register still dates the programme.
    frameDate: "listopad MMXXIV",
    // 0.95 rather than none: at 1.00 the panel puts 12.9% of its area above mid-luma, which is the
    // most in the line, and the excess is all altar cloth and chrysanthemums rather than subject.
    // Damped it measures 0.246 lit-mean, between I and V where a middle panel belongs.
    frameLift: 0.95,
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
    // `-2` stood here — the nave washed blue, seen the length of the church, the singers a speck
    // at the far end. It was rejected on two counts at once: it showed nothing at 316px, and it
    // was the only cool frame on a page whose whole palette is parchment, night and candle, so
    // the eye entered a line of five in the middle, at its emptiest panel.
    //
    // `-0` was ruled out by §13 as "a black rectangle at any size" ON A GRADE THAT NO LONGER
    // EXISTS: that reading was taken while the band still carried `contrast(1.06)`, which rendered
    // everything under 2.8% luma as literal #000, and §15 removed it. Rendered at the panel's real
    // size under today's grade the singers read plainly. It is the evening's one frame at human
    // scale — `-1` is the altar with the ensemble invisible, `-3` is the audience with a face in
    // the foreground, outside the consent scope, which covers singers.
    frame: "kd-hymn-0",
    frameDate: "luty MMXXV",
    // Capped at 1.35 against a derived 1.74, and read off the panel rather than argued: the lit
    // group holds up through 1.55, but the carpet and the floor behind it come up with it, and
    // past ~1.4 the nave is a grey room rather than a dark one. It stays the line's dark end,
    // which is honest — it was the darkest evening.
    frameLift: 1.35,
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
    // `-3` stood here and read the altar over the conductor's shoulder from behind the ensemble —
    // the architecture carried, the singers as backs. This one is the same altar from in front:
    // faces lit by the pulpit lamps against the gilt, which is the closest this line gets to what
    // the site claims on every other surface (twelve voices in a stone nave).
    frame: "kd-aeternam-5",
    // Two evenings, Mistrzejowice and Niedzica; this frame is Niedzica (18 X).
    frameDate: "październik MMXXV",
    // THE "DO NOT DAMP AETERNAM" EXEMPTION DOES NOT SURVIVE THE CHANGE OF FRAME, and carrying it
    // over was a straight error. It was measured on `-3`, where the gilt is background at a
    // distance and dimming it cost the whole point of the panel. On `-5` the altar is close and
    // the score lamps are in shot: at the inherited 1.08 this panel put 16.0% of its area above
    // 50% luma — double every other panel in the line — and ran p99 = 0.997, i.e. the lamps and
    // the gilt were blown to paper white. The derived 0.90 was right all along; at it the panel
    // measures 11.1% and p99 = 0.815, and the gold reads as gold rather than as highlight.
    frameLift: 0.9,
    video: {
      src: videoAsset("landing-aeternam"),
      portrait: true,
      note: "C. Shaw — and the swallow (Psalm 84) · zapis z nawy · dźwięk na żywo",
    },
    credit: "Partnerzy: Gmina Łapsze Niżne · GOK Łapsze Niżne · ZEW Niedzica · Zamek Dunajec · ACN — Pomoc Kościołowi w Potrzebie. Patroni medialni: Gość Niedzielny · Radio Alex · Tygodnik Podhalański.",
  },
];
