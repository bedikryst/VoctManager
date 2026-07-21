/**
 * @file o-nas.ts
 * @description Per-locale copy for the About page (the reference translation). This is the model
 *  for the whole site's i18n: PAGE PROSE lives in a typed content module (one object per locale),
 *  the shared component (components/pages/AboutPage.astro) renders it, and the atomic chrome
 *  labels stay in i18n/ui.ts. Polish is the source of truth and is copied VERBATIM from the
 *  pre-i18n o-nas.astro — including the exact &nbsp; pins and the founder's-letter stanzas, which
 *  are quoted founding text, not copywriting (see the letter comment). English and French are
 *  literary translations that keep the contemplative register; proper names (people, venues,
 *  works, the ensemble/foundation) are never translated.
 *
 *  FIELD CONVENTION — two kinds of field:
 *   • plain text (…Text, labels, headings): rendered as `{typoFor(lang)(value)}`, so Polish gets
 *     its orphan pins, French its space-before-punctuation, English nothing. Author WITHOUT markup.
 *   • rich HTML (…Html): rendered with `set:html` and NO typography pass (the pass would corrupt
 *     tags/URLs), so any inline <em>/<strong> and hard &nbsp; are authored inline. Polish keeps its
 *     verbatim entities; English/French add their own where a language needs them.
 * @architecture Astro islands 2026
 * @module i18n/content/o-nas
 */

import type { Locale } from "../config";

/** Eyebrow = a locale-neutral Latin rubric + its vernacular gloss. */
export interface Eyebrow {
  readonly lat: string;
  readonly label: string;
}

/** One "Co robimy" activity card. `cta`, when present, links to the concerts path (card 0 only). */
export interface DoingCard {
  readonly k: string;
  readonly p: string;
  readonly cta?: string;
}

/** A board member's translatable fields — the name and portrait are structural (kept in the
    component), only the role line and the one-sentence remit are translated. In board order. */
export interface BoardRole {
  readonly role: string;
  readonly vision: string;
}

export interface AboutCopy {
  readonly meta: { readonly title: string; readonly description: string };
  readonly hero: {
    readonly aria: string;
    readonly eyebrow: Eyebrow;
    readonly titleLine1: string;
    readonly titleLine2Html: string;
    readonly ledeText: string;
    readonly scrollCue: string;
  };
  readonly letter: {
    readonly aria: string;
    readonly eyebrow: Eyebrow;
    readonly h2: string;
    readonly leadHtml: string;
    readonly stanzas: readonly { readonly lat: string; readonly label: string; readonly paraHtml: string }[];
    readonly signatureMeta: string;
    readonly portraitAlt: string;
    readonly portraitCaption: string;
  };
  readonly ensemble: {
    readonly aria: string;
    readonly eyebrow: Eyebrow;
    readonly h2: string;
    readonly leadText: string;
    readonly p2Text: string;
    readonly p3Html: string;
    readonly collabLabel: string;
    readonly collabText: string;
  };
  readonly plate: { readonly aria: string; readonly quote: string };
  readonly doings: {
    readonly aria: string;
    readonly eyebrow: Eyebrow;
    readonly h2: string;
    readonly leadText: string;
    readonly cards: readonly DoingCard[];
  };
  readonly cantus: {
    readonly aria: string;
    readonly eyebrow: Eyebrow;
    readonly h2: string;
    readonly leadText: string;
    readonly p2Text: string;
    readonly p3Text: string;
    readonly moreLink: string;
  };
  readonly milestones: {
    readonly aria: string;
    readonly eyebrow: Eyebrow;
    readonly h2: string;
    readonly moreLink: string;
  };
  readonly foundation: {
    readonly aria: string;
    readonly eyebrow: Eyebrow;
    readonly h2: string;
    readonly leadText: string;
    readonly p2Html: string;
    readonly goals: readonly string[];
    readonly legalNote: string;
    readonly statuteLabel: string;
  };
  readonly governance: {
    readonly aria: string;
    readonly eyebrow: Eyebrow;
    readonly h2: string;
    readonly intro: string;
    readonly roles: readonly BoardRole[];
  };
  readonly cta: {
    readonly aria: string;
    readonly h2: string;
    readonly p: string;
    readonly write: string;
    readonly concerts: string;
    readonly support: string;
  };
}

const pl: AboutCopy = {
  meta: {
    title: "O nas — VoctEnsemble | Fundacja VoctFoundation",
    description:
      "VoctEnsemble — krakowska formacja wokalna i zespół-rezydent Fundacji VoctFoundation. Koncerty duchowe, liturgie i muzyka sakralna od średniowiecznej polifonii po współczesny minimalizm.",
  },
  hero: {
    aria: "O nas",
    eyebrow: { lat: "De nobis", label: "O nas" },
    titleLine1: "Zaczęło się",
    titleLine2Html: "od <em>tęsknoty.</em>",
    ledeText:
      "VoctEnsemble — krakowska formacja wokalna i zespół-rezydent Fundacji VoctFoundation. Zaczynamy od trzech pytań: skąd się wzięliśmy, co robimy i co śpiewamy.",
    scrollCue: "Przeczytaj list",
  },
  letter: {
    aria: "List Florenta",
    eyebrow: { lat: "Initium", label: "List założyciela" },
    h2: "Skąd się wzięliśmy?",
    leadHtml: "Odpowiedź założyciela — cztery akapity, od&nbsp;tęsknoty po&nbsp;kruchość.",
    // VERBATIM founding text — stanzas I/II from Florent's "Skąd się wzięliśmy?", III from the
    // Kontemplacja Wcielenia booklet, IV from "Co śpiewamy?". Never rewrite the Polish; the
    // EN/FR renderings translate it while keeping its meditative register.
    stanzas: [
      {
        lat: "I",
        label: "Z tęsknoty",
        paraHtml:
          "Z tęsknoty, natchnienia i marzenia. Jak anachoreci, w odosobnieniu, z&nbsp;daleka od zgiełku i&nbsp;muzyki zatęskniono za muzyką. Wizja muzyki jako powiew ducha, który przemienia świat swoją polifonią, otulając i&nbsp;przenikając do głębi człowieka — rezonując i&nbsp;znajdując miejsce w&nbsp;jego duszy niczym żywy organizm.",
      },
      {
        lat: "II",
        label: "W ciszy",
        paraHtml:
          "W ciszy rodzi się muzyka. W&nbsp;ciszy się kontempluje. Muzyka jest kontemplacją duszy w&nbsp;czasie. Tak powstał Voct — z&nbsp;ciszy i&nbsp;kontemplacji.",
      },
      {
        lat: "III",
        label: "Wymiana",
        paraHtml:
          "Wymiana myśli i&nbsp;próba zanurzenia się w&nbsp;interpretację drugiego człowieka pobudzała inwencję muzyczną, otwierając na nowe ścieżki interpretacyjne. Interpretacja opiera się na wymianie ludzkich umiejętności i&nbsp;intuicji, które dynamicznie splatają się, by odkryć głębie ukryte w&nbsp;utworze.",
      },
      {
        lat: "IV",
        label: "Kruchość",
        paraHtml:
          "Nie czulibyśmy się sobą, śpiewając muzykę, która nie obejmowałaby całego człowieka, dotykała jego głębi i&nbsp;próbowała urzec go pięknem mimo jego złożoności i&nbsp;kruchości.",
      },
    ],
    signatureMeta: "kierownictwo artystyczne · 2024",
    portraitAlt: "Florent de Bazelaire prowadzący VoctEnsemble",
    portraitCaption: "Florent de Bazelaire · kierownictwo artystyczne",
  },
  ensemble: {
    aria: "Kim jesteśmy",
    eyebrow: { lat: "Voces", label: "Zespół" },
    h2: "Krakowski zespół wokalny prowadzony jak kameralna wspólnota.",
    leadText:
      "Na scenie spotyka się zwykle dwanaście głosów — profesjonalnych i pre-profesjonalnych muzyków, dla których precyzja jest punktem wyjścia.",
    p2Text:
      "Skład jest żywy: wokół stałego rdzenia obsada zmienia się z projektu na projekt — głosy dobieramy do programu, przestrzeni i intencji, tak jak dobiera się repertuar.",
    p3Html:
      "Pod kierownictwem Florenta de Bazelaire budujemy brzmienie, w&nbsp;którym dyscyplina i&nbsp;czułość trzymają się razem. Nazwa łączy <em>voces</em> (głosy), <em>octo</em> (osiem) i&nbsp;<em>ensemble</em> — obietnicę głosów, które słuchają siebie nawzajem, związanych więzią zarówno muzyczną, jak i&nbsp;międzyludzką.",
    collabLabel: "Współpraca",
    collabText:
      "Na scenie i przy realizacjach spotykamy się m.in. z reżyserką świateł Adą Bystrzycką, realizatorem dźwięku Jakubem Garbaczem (Ars Sonora Studio), Sebastianem Kuźmą (animacja wizualna) i skrzypkiem Radu Ropotanem; instytucjonalnie — z Fundacją Carpe Diem i Ośrodkiem Kultury Norwida w krakowskich Mistrzejowicach.",
  },
  plate: { aria: "Idea", quote: "Nade wszystko, dzielimy się." },
  doings: {
    aria: "Co robimy",
    eyebrow: { lat: "Operatio", label: "Co robimy?" },
    h2: "Koncerty duchowe, liturgia, ważne uroczystości.",
    leadText:
      "Głównym nurtem są autorskie Koncerty Duchowe — współczesna forma dawnych Concerts Spirituels. Poza nimi śpiewamy tam, gdzie liturgia i uroczystość proszą o głos.",
    cards: [
      {
        k: "Koncerty Duchowe",
        p: "Autorski cykl — współczesna forma dawnych Concerts Spirituels. Każdy wieczór ma osobną intencję.",
        cta: "Zobacz drogę koncertów →",
      },
      {
        k: "Liturgia i uroczystości",
        p: "Oprawa mszy i kościelnych świąt. Ostatnio — liturgia w uroczystość św. Andrzeja Boboli w Warszawie, w 100-lecie polskich prowincji jezuickich: Msza pod przewodnictwem abp. Adriana Galbasa, homilia o. Artura Sosy SJ.",
      },
      {
        k: "Dialog tradycji",
        p: "Śpiewaliśmy podczas 28. Dnia Judaizmu w Kościele katolickim, w krakowskiej Kaplicy św. Doroty, i wystąpiliśmy w Synagodze Tempel — muzyka jako miejsce spotkania.",
      },
      {
        k: "Śluby i sakramenty",
        p: "Oprawialiśmy liturgie ślubne w Kolegiacie św. Anny w Krakowie i w Opactwie Benedyktynów w Tyńcu. Jesteśmy dyspozycyjni dla takich uroczystości.",
      },
    ],
  },
  cantus: {
    aria: "Co śpiewamy",
    eyebrow: { lat: "Cantus", label: "Co śpiewamy?" },
    h2: "Muzyka jako odbicie duszy słowa.",
    leadText:
      "Dzielimy się śpiewem i przemyślanymi narracjami — utkanymi z utworów, w których muzyka i słowo są swoimi lustrzanymi odbiciami.",
    p2Text:
      "Interesuje nas świat: widzialny — przyroda i całe stworzenie — oraz ten niematerialny, którego szukamy i próbujemy zrozumieć. Muzyka sakralna jest w tej wędrówce dobrą towarzyszką.",
    p3Text:
      "Czerpie z geniuszu ludzkiego, z Biblii i z mądrości przodków, po którą kompozytorzy wciąż sięgają, by wyrazić na wskroś osobisty sposób to, co przeżywają i co ich najbardziej dotyka.",
    moreLink: "Repertuar siedmiu wieków — od Llibre Vermell po współczesność →",
  },
  milestones: {
    aria: "Droga koncertów",
    eyebrow: { lat: "Via", label: "Co już wybrzmiało" },
    h2: "Krótka droga, ale już zapisana miejscami i intencjami.",
    moreLink: "Zobacz repertuar i szczegóły koncertów →",
  },
  foundation: {
    aria: "Fundacja VoctFoundation",
    eyebrow: { lat: "Fundatio", label: "Fundacja" },
    h2: "Forma, która pozwala muzyce mieć ciągłość.",
    leadText:
      "VoctFoundation jest prawnym i organizacyjnym zapleczem działalności artystycznej. To dzięki niej zespół może myśleć nie tylko o kolejnym koncercie, ale o archiwum, edukacji, produkcji i długim trwaniu repertuaru.",
    p2Html:
      "Statutowo Fundacja działa w&nbsp;obszarze <strong>kultury, sztuki, ochrony dóbr kultury i&nbsp;dziedzictwa narodowego</strong>. Może prowadzić projekty artystyczne i&nbsp;interdyscyplinarne, utrwalać nagrania, wspierać młodych artystów oraz działać przez stały zespół artystyczny w&nbsp;formule zespołu-rezydenta.",
    goals: [
      "Twórczość muzyczna: produkcja, koprodukcja, organizacja i prezentacja projektów w kraju i za granicą.",
      "Dziedzictwo: dokumentowanie, archiwizowanie i udostępnianie muzyki oraz praktyk wykonawczych.",
      "Edukacja i dostępność: popularyzowanie kultury oraz wspieranie uczestnictwa w niej.",
      "Młodzi artyści: rozwój, promocja, mentoring, rezydencje i projekty wykonawcze.",
      "Współpraca: praca z artystami, instytucjami kultury, uczelniami, mediami i organizacjami społecznymi.",
    ],
    legalNote:
      "Dochody Fundacji przeznaczane są w całości na realizację celów statutowych. Nie podlegają podziałowi między fundatora, członków organów ani osoby związane z Fundacją; działalność gospodarcza, jeżeli jest prowadzona, pozostaje pomocnicza wobec misji statutowej.",
    statuteLabel: "Statut fundacji ↗",
  },
  governance: {
    aria: "Zarząd fundacji",
    eyebrow: { lat: "Consilium", label: "Zarząd" },
    h2: "Odpowiedzialność rozpisana na trzy głosy.",
    intro:
      "Fundacja ma jedno zadanie: utrzymać jakość — artystyczną, organizacyjną i cyfrową — tak, aby projekty mogły dojrzewać, wracać i zostawiać po sobie ślad.",
    roles: [
      {
        role: "Kierownictwo artystyczne · dyrygent",
        vision:
          "Odpowiada za profil artystyczny, repertuar, pracę nad brzmieniem i długą linię rozwoju zespołu.",
      },
      {
        role: "Produkcja · relacje · komunikacja",
        vision:
          "Prowadzi organizację projektów, kontakt z partnerami, wizerunek zespołu i rytm pracy poza sceną.",
      },
      {
        role: "Digital · technologia · stabilność",
        vision:
          "Odpowiada za obecność cyfrową, narzędzia, publikację, bezpieczeństwo i stabilność infrastruktury fundacji.",
      },
    ],
  },
  cta: {
    aria: "Zaproszenie do kontaktu",
    h2: "Zaproście nas do przestrzeni, która potrzebuje głosu.",
    p: "Koncert duchowy, oprawa liturgii, ważna uroczystość, mecenat albo współpraca artystyczna. Czekamy na Wasz kontakt.",
    write: "Napisz do nas",
    concerts: "Koncerty Duchowe",
    support: "Wesprzyj fundację",
  },
};

const en: AboutCopy = {
  meta: {
    title: "About — VoctEnsemble | VoctFoundation",
    description:
      "VoctEnsemble — a Kraków vocal ensemble and the resident ensemble of the VoctFoundation. Spiritual concerts, liturgies and sacred music from medieval polyphony to contemporary minimalism.",
  },
  hero: {
    aria: "About us",
    eyebrow: { lat: "De nobis", label: "About" },
    titleLine1: "It began",
    titleLine2Html: "with <em>longing.</em>",
    ledeText:
      "VoctEnsemble — a Kraków vocal ensemble and the resident ensemble of the VoctFoundation. We begin with three questions: where we came from, what we do, and what we sing.",
    scrollCue: "Read the letter",
  },
  letter: {
    aria: "Florent's letter",
    eyebrow: { lat: "Initium", label: "Founder's letter" },
    h2: "Where did we come from?",
    leadHtml: "The founder's answer — four paragraphs, from longing to fragility.",
    stanzas: [
      {
        lat: "I",
        label: "Out of longing",
        paraHtml:
          "Out of longing, inspiration and a dream. Like anchorites, in seclusion, far from the clamour and from music, a longing for music was born. A vision of music as a breath of the spirit that transforms the world with its polyphony, enfolding a person and reaching into their depths — resonating and finding a place in the soul like a living organism.",
      },
      {
        lat: "II",
        label: "In silence",
        paraHtml:
          "In silence, music is born. In silence, one contemplates. Music is the soul's contemplation in time. So Voct came to be — out of silence and contemplation.",
      },
      {
        lat: "III",
        label: "Exchange",
        paraHtml:
          "The exchange of thought, and the attempt to immerse oneself in another person's reading, kindled musical invention and opened new paths of interpretation. Interpretation rests on an exchange of human skills and intuitions that weave together, dynamically, to uncover the depths hidden within a work.",
      },
      {
        lat: "IV",
        label: "Fragility",
        paraHtml:
          "We would not feel ourselves singing music that did not embrace the whole person, touch their depths, and try to enthral them with beauty in spite of their complexity and fragility.",
      },
    ],
    signatureMeta: "artistic direction · 2024",
    portraitAlt: "Florent de Bazelaire conducting VoctEnsemble",
    portraitCaption: "Florent de Bazelaire · artistic direction",
  },
  ensemble: {
    aria: "Who we are",
    eyebrow: { lat: "Voces", label: "The ensemble" },
    h2: "A Kraków vocal ensemble led as a chamber community.",
    leadText:
      "On stage there are usually twelve voices — professional and pre-professional musicians for whom precision is the starting point.",
    p2Text:
      "The line-up is alive: around a stable core, the roster changes from project to project — we choose voices to fit the programme, the space and the intention, just as one chooses repertoire.",
    p3Html:
      "Under the direction of Florent de Bazelaire we build a sound in which discipline and tenderness hold together. The name joins <em>voces</em> (voices), <em>octo</em> (eight) and <em>ensemble</em> — a promise of voices that listen to one another, bound as much by music as by human ties.",
    collabLabel: "Collaboration",
    collabText:
      "On stage and in production we work with, among others, lighting director Ada Bystrzycka, sound engineer Jakub Garbacz (Ars Sonora Studio), Sebastian Kuźma (visual animation) and violinist Radu Ropotan; and, institutionally, with the Carpe Diem Foundation and the Norwid Cultural Centre in Kraków's Mistrzejowice district.",
  },
  plate: { aria: "Idea", quote: "Above all, we share." },
  doings: {
    aria: "What we do",
    eyebrow: { lat: "Operatio", label: "What we do" },
    h2: "Spiritual concerts, liturgy, occasions that matter.",
    leadText:
      "Our main current is the Spiritual Concerts — a contemporary form of the old Concerts Spirituels. Beyond them, we sing wherever liturgy and celebration ask for a voice.",
    cards: [
      {
        k: "Spiritual Concerts",
        p: "Our own cycle — a contemporary form of the old Concerts Spirituels. Each evening carries its own intention.",
        cta: "See the path of the concerts →",
      },
      {
        k: "Liturgy and celebrations",
        p: "Music for Mass and church feasts. Most recently — the liturgy for the feast of St Andrew Bobola in Warsaw, marking the centenary of the Polish Jesuit provinces: Mass presided over by Archbishop Adrian Galbas, homily by Fr Arturo Sosa SJ.",
      },
      {
        k: "A dialogue of traditions",
        p: "We sang during the 28th Day of Judaism in the Catholic Church, in Kraków's Chapel of St Dorothy, and performed at the Tempel Synagogue — music as a meeting place.",
      },
      {
        k: "Weddings and sacraments",
        p: "We have provided music for wedding liturgies at St Anne's Collegiate Church in Kraków and at the Benedictine Abbey in Tyniec. We are available for such occasions.",
      },
    ],
  },
  cantus: {
    aria: "What we sing",
    eyebrow: { lat: "Cantus", label: "What we sing" },
    h2: "Music as a reflection of the soul of the word.",
    leadText:
      "We share song and carefully considered narratives — woven from works in which music and word are each other's mirror image.",
    p2Text:
      "The world interests us: the visible one — nature and all creation — and the immaterial one we seek and try to understand. Sacred music is a good companion on that journey.",
    p3Text:
      "It draws on human genius, on the Bible and on the wisdom of our forebears — to which composers still reach in order to express, in a wholly personal way, what they live through and what touches them most.",
    moreLink: "Seven centuries of repertoire — from the Llibre Vermell to the present day →",
  },
  milestones: {
    aria: "The path of the concerts",
    eyebrow: { lat: "Via", label: "What has sounded" },
    h2: "A short road, but already marked by places and intentions.",
    moreLink: "See the repertoire and concert details →",
  },
  foundation: {
    aria: "The VoctFoundation",
    eyebrow: { lat: "Fundatio", label: "The foundation" },
    h2: "A form that lets music endure.",
    leadText:
      "The VoctFoundation is the legal and organisational backbone of the artistic work. It is what lets the ensemble think not only about the next concert, but about an archive, education, production and the long life of the repertoire.",
    p2Html:
      "By its statute, the Foundation works in the field of <strong>culture, the arts, and the protection of cultural goods and national heritage</strong>. It may run artistic and interdisciplinary projects, make recordings, support young artists, and act through a permanent artistic ensemble in a resident-ensemble arrangement.",
    goals: [
      "Musical creation: production, co-production, organisation and presentation of projects at home and abroad.",
      "Heritage: documenting, archiving and sharing music and performance practice.",
      "Education and access: fostering culture and supporting participation in it.",
      "Young artists: development, promotion, mentoring, residencies and performance projects.",
      "Collaboration: working with artists, cultural institutions, universities, media and civil-society organisations.",
    ],
    legalNote:
      "The Foundation's income is devoted entirely to its statutory purposes. It is not distributed among the founder, the members of its bodies, or persons connected with the Foundation; any economic activity, if conducted, remains ancillary to the statutory mission.",
    statuteLabel: "Foundation statute ↗",
  },
  governance: {
    aria: "The foundation's board",
    eyebrow: { lat: "Consilium", label: "The board" },
    h2: "Responsibility scored for three voices.",
    intro:
      "The Foundation has one task: to hold quality — artistic, organisational and digital — so that projects can mature, return, and leave something behind.",
    roles: [
      {
        role: "Artistic direction · conductor",
        vision:
          "Responsible for the artistic profile, the repertoire, the work on sound and the ensemble's long line of development.",
      },
      {
        role: "Production · relations · communication",
        vision:
          "Leads the organisation of projects, contact with partners, the ensemble's image and the rhythm of work off stage.",
      },
      {
        role: "Digital · technology · stability",
        vision:
          "Responsible for the digital presence, the tools, publication, security and the stability of the foundation's infrastructure.",
      },
    ],
  },
  cta: {
    aria: "An invitation to get in touch",
    h2: "Invite us into a space that needs a voice.",
    p: "A spiritual concert, music for a liturgy, an important celebration, patronage or an artistic collaboration. We look forward to hearing from you.",
    write: "Write to us",
    concerts: "Spiritual Concerts",
    support: "Support the foundation",
  },
};

const fr: AboutCopy = {
  meta: {
    title: "À propos — VoctEnsemble | Fondation VoctFoundation",
    description:
      "VoctEnsemble — un ensemble vocal cracovien et l'ensemble en résidence de la Fondation VoctFoundation. Concerts spirituels, liturgies et musique sacrée, de la polyphonie médiévale au minimalisme contemporain.",
  },
  hero: {
    aria: "À propos",
    eyebrow: { lat: "De nobis", label: "À propos" },
    titleLine1: "Tout a commencé",
    titleLine2Html: "par la <em>nostalgie.</em>",
    ledeText:
      "VoctEnsemble — un ensemble vocal cracovien et l'ensemble en résidence de la Fondation VoctFoundation. Nous commençons par trois questions : d'où nous venons, ce que nous faisons et ce que nous chantons.",
    scrollCue: "Lire la lettre",
  },
  letter: {
    aria: "La lettre de Florent",
    eyebrow: { lat: "Initium", label: "Lettre du fondateur" },
    h2: "D'où venons-nous ?",
    leadHtml: "La réponse du fondateur — quatre paragraphes, de la nostalgie à la fragilité.",
    stanzas: [
      {
        lat: "I",
        label: "De la nostalgie",
        paraHtml:
          "De la nostalgie, de l'inspiration et d'un rêve. Comme des anachorètes, dans le retrait, loin du vacarme et de la musique, une nostalgie de la musique est née. Une vision de la musique comme un souffle de l'esprit qui transforme le monde par sa polyphonie, enveloppant l'être humain et le pénétrant jusqu'au plus profond — résonnant et trouvant place en son âme comme un organisme vivant.",
      },
      {
        lat: "II",
        label: "Dans le silence",
        paraHtml:
          "Dans le silence naît la musique. Dans le silence, on contemple. La musique est la contemplation de l'âme dans le temps. Ainsi est né Voct — du silence et de la contemplation.",
      },
      {
        lat: "III",
        label: "L'échange",
        paraHtml:
          "L'échange des pensées et l'effort de se plonger dans l'interprétation de l'autre éveillaient l'invention musicale et ouvraient de nouvelles voies d'interprétation. L'interprétation repose sur un échange de savoir-faire et d'intuitions humaines qui s'entrelacent, dynamiquement, pour découvrir les profondeurs cachées dans une œuvre.",
      },
      {
        lat: "IV",
        label: "La fragilité",
        paraHtml:
          "Nous ne nous sentirions pas nous-mêmes à chanter une musique qui n'embrasserait pas l'être tout entier, ne toucherait pas ses profondeurs et ne chercherait pas à le charmer par la beauté, malgré sa complexité et sa fragilité.",
      },
    ],
    signatureMeta: "direction artistique · 2024",
    portraitAlt: "Florent de Bazelaire dirigeant VoctEnsemble",
    portraitCaption: "Florent de Bazelaire · direction artistique",
  },
  ensemble: {
    aria: "Qui nous sommes",
    eyebrow: { lat: "Voces", label: "L'ensemble" },
    h2: "Un ensemble vocal cracovien mené comme une communauté de chambre.",
    leadText:
      "Sur scène se rencontrent d'ordinaire douze voix — des musiciens professionnels et pré-professionnels pour qui la précision est le point de départ.",
    p2Text:
      "L'effectif est vivant : autour d'un noyau stable, la distribution change de projet en projet — nous choisissons les voix selon le programme, l'espace et l'intention, comme on choisit un répertoire.",
    p3Html:
      "Sous la direction de Florent de Bazelaire, nous bâtissons une sonorité où la discipline et la tendresse tiennent ensemble. Le nom réunit <em>voces</em> (les voix), <em>octo</em> (huit) et <em>ensemble</em> — la promesse de voix qui s'écoutent les unes les autres, liées autant par la musique que par l'humain.",
    collabLabel: "Collaboration",
    collabText:
      "Sur scène et en production, nous collaborons notamment avec la conceptrice lumière Ada Bystrzycka, l'ingénieur du son Jakub Garbacz (Ars Sonora Studio), Sebastian Kuźma (animation visuelle) et le violoniste Radu Ropotan ; et, sur le plan institutionnel, avec la Fondation Carpe Diem et le Centre culturel Norwid, dans le quartier de Mistrzejowice à Cracovie.",
  },
  plate: { aria: "Idée", quote: "Par-dessus tout, nous partageons." },
  doings: {
    aria: "Ce que nous faisons",
    eyebrow: { lat: "Operatio", label: "Ce que nous faisons" },
    h2: "Concerts spirituels, liturgie, grandes célébrations.",
    leadText:
      "Notre courant principal, ce sont les Concerts Spirituels — une forme contemporaine des concerts spirituels d'autrefois. Au-delà, nous chantons là où la liturgie et la fête réclament une voix.",
    cards: [
      {
        k: "Concerts Spirituels",
        p: "Notre propre cycle — une forme contemporaine des concerts spirituels d'autrefois. Chaque soir porte une intention distincte.",
        cta: "Voir le chemin des concerts →",
      },
      {
        k: "Liturgie et célébrations",
        p: "La musique de la messe et des fêtes de l'Église. Récemment — la liturgie de la fête de saint André Bobola à Varsovie, pour le centenaire des provinces jésuites polonaises : messe présidée par l'archevêque Adrian Galbas, homélie du père Arturo Sosa SJ.",
      },
      {
        k: "Dialogue des traditions",
        p: "Nous avons chanté lors de la 28ᵉ Journée du judaïsme dans l'Église catholique, dans la chapelle Sainte-Dorothée à Cracovie, et nous nous sommes produits à la synagogue Tempel — la musique comme lieu de rencontre.",
      },
      {
        k: "Mariages et sacrements",
        p: "Nous avons assuré la musique de liturgies de mariage à la collégiale Sainte-Anne de Cracovie et à l'abbaye bénédictine de Tyniec. Nous sommes disponibles pour de telles célébrations.",
      },
    ],
  },
  cantus: {
    aria: "Ce que nous chantons",
    eyebrow: { lat: "Cantus", label: "Ce que nous chantons" },
    h2: "La musique comme reflet de l'âme du mot.",
    leadText:
      "Nous partageons le chant et des récits mûrement pensés — tissés d'œuvres où la musique et le mot sont l'image l'un de l'autre.",
    p2Text:
      "Le monde nous intéresse : le visible — la nature et toute la création — et l'immatériel, que nous cherchons et tentons de comprendre. La musique sacrée est une bonne compagne sur ce chemin.",
    p3Text:
      "Elle puise dans le génie humain, dans la Bible et dans la sagesse des anciens, vers laquelle les compositeurs se tournent encore pour exprimer, de façon tout intime, ce qu'ils vivent et ce qui les touche le plus.",
    moreLink: "Sept siècles de répertoire — du Llibre Vermell à aujourd'hui →",
  },
  milestones: {
    aria: "Le chemin des concerts",
    eyebrow: { lat: "Via", label: "Ce qui a déjà résonné" },
    h2: "Un chemin court, mais déjà inscrit dans des lieux et des intentions.",
    moreLink: "Voir le répertoire et le détail des concerts →",
  },
  foundation: {
    aria: "La Fondation VoctFoundation",
    eyebrow: { lat: "Fundatio", label: "La fondation" },
    h2: "Une forme qui permet à la musique de durer.",
    leadText:
      "La Fondation VoctFoundation est le socle juridique et organisationnel de l'activité artistique. C'est grâce à elle que l'ensemble peut penser non seulement au prochain concert, mais à un archivage, à l'éducation, à la production et à la longue vie du répertoire.",
    p2Html:
      "Selon ses statuts, la Fondation agit dans le domaine de <strong>la culture, des arts et de la protection des biens culturels et du patrimoine national</strong>. Elle peut mener des projets artistiques et interdisciplinaires, réaliser des enregistrements, soutenir de jeunes artistes et agir par un ensemble artistique permanent, en résidence.",
    goals: [
      "Création musicale : production, coproduction, organisation et présentation de projets en Pologne et à l'étranger.",
      "Patrimoine : documenter, archiver et rendre accessibles la musique et les pratiques d'interprétation.",
      "Éducation et accessibilité : diffuser la culture et soutenir la participation à celle-ci.",
      "Jeunes artistes : développement, promotion, mentorat, résidences et projets d'interprétation.",
      "Coopération : travailler avec des artistes, des institutions culturelles, des universités, des médias et des organisations de la société civile.",
    ],
    legalNote:
      "Les revenus de la Fondation sont intégralement affectés à la réalisation de ses buts statutaires. Ils ne sont pas répartis entre le fondateur, les membres des organes ou les personnes liées à la Fondation ; l'activité économique, si elle est exercée, demeure accessoire à la mission statutaire.",
    statuteLabel: "Statuts de la fondation ↗",
  },
  governance: {
    aria: "Le conseil de la fondation",
    eyebrow: { lat: "Consilium", label: "Le conseil" },
    h2: "La responsabilité répartie sur trois voix.",
    intro:
      "La Fondation a une seule tâche : tenir la qualité — artistique, organisationnelle et numérique — pour que les projets puissent mûrir, revenir et laisser une trace.",
    roles: [
      {
        role: "Direction artistique · chef de chœur",
        vision:
          "Responsable du profil artistique, du répertoire, du travail sur la sonorité et de la ligne de développement de l'ensemble.",
      },
      {
        role: "Production · relations · communication",
        vision:
          "Dirige l'organisation des projets, le contact avec les partenaires, l'image de l'ensemble et le rythme du travail hors scène.",
      },
      {
        role: "Numérique · technologie · stabilité",
        vision:
          "Responsable de la présence numérique, des outils, de la publication, de la sécurité et de la stabilité de l'infrastructure de la fondation.",
      },
    ],
  },
  cta: {
    aria: "Une invitation à nous contacter",
    h2: "Invitez-nous dans un espace qui a besoin d'une voix.",
    p: "Un concert spirituel, la musique d'une liturgie, une célébration importante, un mécénat ou une collaboration artistique. Nous attendons votre message.",
    write: "Écrivez-nous",
    concerts: "Concerts Spirituels",
    support: "Soutenir la fondation",
  },
};

export const ABOUT: Record<Locale, AboutCopy> = { pl, en, fr };
