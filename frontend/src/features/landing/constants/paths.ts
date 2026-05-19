/**
 * @file paths.ts
 * @description Past Concerts Spirituels — content for the "wcześniejsze wybrzmienia" section.
 * Each entry maps to a single <PathCard /> in the catalog grid.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/constants/paths
 */

export interface PathWork {
  readonly text: string;
  readonly italic?: string;
  readonly bis?: boolean;
}

export interface PathDetail {
  readonly works?: readonly PathWork[];
  readonly paragraphs?: readonly string[];
  readonly note?: string;
}

export interface Path {
  readonly slug: string;
  readonly year: string;
  readonly tag: string;
  readonly title: string;
  readonly place: string;
  readonly note: string;
  readonly poster: { readonly src: string; readonly srcset?: string };
  readonly detail: {
    readonly summary: string;
    readonly content: PathDetail;
  };
}

export const PATHS: readonly Path[] = [
  {
    slug: "kontemplacja-wcielenia",
    year: "MMXXIV",
    tag: "Koncert Duchowy · debiut",
    title: "Kontemplacja Wcielenia",
    place: "Bazylika NSPJ w Krakowie · Archikatedra łódzka",
    note: "Muzyczna podróż przez 10 kompozycji 4-, 8- i 12-głosowych — od słów proroka Izajasza po kantyk Symeona. Renesans i Barok spotykają Pärta i Vivancosa, prowadząc słuchacza w tajemnicę Wcielenia.",
    poster: {
      src: "/photos/album-cover-1920.webp",
      srcset: "/photos/album-cover-800.webp 800w, /photos/album-cover-1920.webp 1920w",
    },
    detail: {
      summary: "Repertuar",
      content: {
        works: [
          { text: "C. Monteverdi · ", italic: "Cantate Domino · 1620" },
          { text: "J. Sandström · ", italic: "Es ist ein Ros' entsprungen · 1990" },
          { text: "A. Pärt · ", italic: "Nunc dimittis · 2001" },
          { text: "Ph. Stopford · ", italic: "Lully, Lullay · 2008" },
          { text: "B. Vivancos · ", italic: "Le cri des bergers · 2004" },
          { text: "J. Gallus · ", italic: "Canite tuba · 1590" },
          { text: "B. Vivancos · ", italic: "A Child is born · 2001" },
          { text: "T. L. de Victoria · ", italic: "Alma Redemptoris Mater · 1581" },
          { text: "K. Penderecki · ", italic: "O gloriosa Virginum · 2009" },
          { text: "M. Kramarz · ", italic: "Gdy śliczna Panna · 2018" },
          { text: "", italic: "Gaudete · XVI w. / aranż. B. Kay 1978 · bis", bis: true },
        ],
        note: "Rejestracja: Jakub Garbacz, Ars Sonora Studio. Reprise pod auspicjami Fundacji Carpe Diem.",
      },
    },
  },
  {
    slug: "wolanie-gor",
    year: "MMXXIV",
    tag: "12 głosów i skrzypce",
    title: "Wołanie Gór",
    place: "Centrum Kongresowe · Szczawnica",
    note: "Podróż wokół piękna i pobożności Pienin — od renesansu po współczesność. Opracowania muzyki ludowej z Polski, Korsyki, Francji i Wysp Brytyjskich.",
    poster: { src: "/photos/poster-wolanie-gor-800.webp" },
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
    year: "MMXXIV",
    tag: "Cykl psalmów · 6–12 głosów",
    title: "9 Kart z Księgi Psalmów",
    place: "Bazylika NSPJ w Krakowie · Archikatedra w Łodzi",
    note: "Muzyczna podróż przez duchowe bogactwo psalmów — fundament muzyki sakralnej od wieków. Arcydzieła polifonii renesansu, baroku i romantyzmu na 6, 8, 9 i 12 głosów.",
    poster: { src: "/photos/poster-9-kart-800.webp" },
    detail: {
      summary: "Repertuar",
      content: {
        works: [
          { text: "G. Allegri · ", italic: "Miserere (Ps 51) — pokuta" },
          { text: "J. S. Bach · ", italic: "Singet dem Herrn (Ps 149) — hymn uwielbienia" },
          { text: "S. Rossi · ", italic: "Barukh habba beshem Adonai (Ps 118) — hebrajska tradycja" },
          { text: "A. Bruckner · ", italic: "Os Justi (Ps 37) — psalm mądrościowy" },
          { text: "C. V. Stanford · ", italic: "Beati quorum via (Ps 119) — droga prawa" },
          { text: "O. Gibbons · ", italic: "O clap your hands (Ps 47) — radosne wezwanie" },
          { text: "Laudate Dominum (Ps 117)" },
          { text: "Jauchzet dem Herren (Ps 100)" },
          { text: "Cantate Domino (Ps 98)" },
        ],
      },
    },
  },
  {
    slug: "hymn-poleglym",
    year: "MMXXV",
    tag: "Modlitwa o pokój",
    title: "Hymn Poległym",
    place: "Bazylika Mariacka w Krakowie",
    note: "Hołd dla tych, którzy oddali życie w obronie wolności, i modlitwa o pokój dla rodzin dotkniętych wojną. Muzyka niesie to, czego nie da się wyrazić słowami.",
    poster: { src: "/photos/poster-hymn-poleglym-800.webp" },
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
    year: "MMXXV",
    tag: "Epitafium · 4, 8 i 12 głosów",
    title: "Aeternam — Epitafium dla Gazy",
    place: "Mistrzejowice · Niedzica",
    note: "Wobec cierpienia mieszkańców Gazy szukamy w muzyce języka współczucia. Od Aeternam Vivancosa po dwóch Tavenerów — zawierzenie ofiar Matce Bożej.",
    poster: { src: "/photos/poster-aeternam-800.webp" },
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
