/**
 * @file paths.ts
 * @description Past Concerts Spirituels — content for the "wcześniejsze wybrzmienia" section.
 *  Each entry maps to a single path card. This file holds only the landing-specific editorial
 *  layer (tag, note, curated intro prose, video fragment); the repertoire itself is NOT stored
 *  here — the card derives its program from the `concerts` collection via `concertId` (SSoT), so
 *  a work list is edited in exactly one place. `poster` is the bare asset name under
 *  src/assets/photos (resolved with `photo()` → optimized <Picture>), not a public URL.
 * @architecture Astro islands 2026
 * @module data/landing/paths
 */

export interface PathDetail {
  readonly paragraphs?: readonly string[];
  readonly note?: string;
}

/** One curated fragment for a register entry — omit the whole slot when no footage exists. */
export interface PathVideo {
  /** Public URL of a self-hosted MP4 (H.264 + AAC) under web/public/video. */
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
  readonly note: string;
  /** Bare asset name under src/assets/photos (no extension), resolved via photo(). */
  readonly poster: string;
  /** Curated video fragment; omit when no footage exists (never fabricate). */
  readonly video?: PathVideo;
  readonly detail: {
    readonly summary: string;
    readonly content: PathDetail;
  };
}

export const PATHS: readonly Path[] = [
  {
    slug: "kontemplacja-wcielenia",
    concertId: "wcielenie",
    year: "MMXXIV",
    tag: "Koncert Duchowy · debiut",
    title: "Kontemplacja Wcielenia",
    place: "Bazylika NSPJ w Krakowie",
    note: "Muzyczna podróż przez 10 kompozycji 4-, 8- i 12-głosowych — od słów proroka Izajasza po kantyk Symeona. Renesans i Barok spotykają Pärta i Vivancosa, prowadząc słuchacza w tajemnicę Wcielenia.",
    poster: "poster-wcielenie",
    // Same file as the hero modal (MODAL_VIDEO in video.ts) — shared browser cache and a
    // shared resume position: one film threaded through hero, Vox and the register.
    video: { src: "/video/landing-modal.mp4" },
    detail: {
      summary: "Repertuar",
      content: {
        note: "Rejestracja: Jakub Garbacz, Ars Sonora Studio. Reprise pod auspicjami Fundacji Carpe Diem.",
      },
    },
  },
  {
    slug: "wolanie-gor",
    concertId: "wolanie-gor",
    year: "MMXXIV",
    tag: "12 głosów i skrzypce",
    title: "Wołanie Gór",
    place: "Dworek Gościnny · Szczawnica",
    note: "Podróż wokół piękna i pobożności Pienin — od renesansu po współczesność. Opracowania muzyki ludowej z Polski, Korsyki, Francji i Wysp Brytyjskich.",
    poster: "poster-wolanie",
    video: {
      src: "/video/landing-wolanie.mp4",
      portrait: true,
      note: "J. Sykulski — Stoi lód na Prośnie · zapis z widowni · dźwięk na żywo",
    },
    detail: {
      summary: "O programie",
      content: {
        paragraphs: [
          "Pieśni sakralne i kompozycje współczesne głęboko eksplorujące piękno przyrody, dziedzictwo, życie wiejskie i pobożność Pienin. Niezapomniana podróż muzyczna od renesansu po współczesność — z mistrzowskimi opracowaniami muzyki ludowej z czterech tradycji europejskich.",
        ],
      },
    },
  },
  {
    slug: "9-kart-z-ksiegi-psalmow",
    concertId: "9-kart",
    year: "MMXXIV",
    tag: "Cykl psalmów · 6–12 głosów",
    title: "9 Kart z Księgi Psalmów",
    place: "Rybnik · Archikatedra w Łodzi · Bazylika NSPJ w Krakowie",
    note: "Muzyczna podróż przez duchowe bogactwo psalmów — fundament muzyki sakralnej od wieków. Arcydzieła polifonii renesansu, baroku i romantyzmu na 6, 8, 9 i 12 głosów.",
    poster: "poster-9-kart",
    detail: {
      summary: "Repertuar",
      content: {},
    },
  },
  {
    slug: "hymn-poleglym",
    concertId: "hymn-poleglym",
    year: "MMXXV",
    tag: "Modlitwa o pokój",
    title: "Hymn Poległym",
    place: "Bazylika Mariacka w Krakowie",
    note: "Hołd dla tych, którzy oddali życie w obronie wolności, i modlitwa o pokój dla rodzin dotkniętych wojną. Muzyka niesie to, czego nie da się wyrazić słowami.",
    poster: "poster-hymn",
    detail: {
      summary: "O koncercie",
      content: {
        paragraphs: [
          "Wspólna obecność jako wyraz pamięci, solidarności i wsparcia dla tych, których wojna dotknęła bezpośrednio — rodzin, przyjaciół i wszystkich, którzy wciąż walczą. Koncert duchowy w intencji pokoju i nadziei dla przyszłych pokoleń.",
        ],
      },
    },
  },
  {
    slug: "aeternam-epitafium-dla-gazy",
    concertId: "aeternam",
    year: "MMXXV",
    tag: "Epitafium · 4, 8 i 12 głosów",
    title: "Aeternam — Epitafium dla Gazy",
    place: "Mistrzejowice · Niedzica",
    note: "Wobec cierpienia mieszkańców Gazy szukamy w muzyce języka współczucia. Od Aeternam Vivancosa po dwóch Tavenerów — zawierzenie ofiar Matce Bożej.",
    poster: "poster-aeternam",
    video: {
      src: "/video/landing-aeternam.mp4",
      portrait: true,
      note: "C. Shaw — and the swallow (Psalm 84) · zapis z nawy · dźwięk na żywo",
    },
    detail: {
      summary: "O programie",
      content: {
        paragraphs: [
          "Kontemplacja, cisza i śpiew mogą unieść zarówno ból, jak i światło nadziei — zwłaszcza tam, gdzie słowa już nie wystarczają.",
          "Od Aeternam Bernata Vivancosa i lamentu Vox in Rama Mikołaja Zieleńskiego, przez modlitwy o pokój Arvo Pärta, Hanny Havrylets i Oli Gjeilo, aż po pasyjne ogniwo Antonia Lottiego. Finałem są dwa utwory Johna Tavenera: pierwszy — cicha, wzniosła modlitwa, która staje się zawierzeniem ofiar Gazy Matce Bożej; drugi — ukazujący Maryję jako świątynię Boga.",
        ],
        note: "Partnerzy: Gmina Łapsze Niżne · GOK Łapsze Niżne · ZEW Niedzica · Zamek Dunajec · ACN — Pomoc Kościołowi w Potrzebie. Patroni medialni: Gość Niedzielny · Radio Alex · Tygodnik Podhalański.",
      },
    },
  },
];
