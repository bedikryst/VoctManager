# Translation glossary and rights ledger (EN / FR)

The termbase stage E writes against, and the record of where every sung text's English and French
comes from. Written for `concerts.yaml`, but the register rules and the naming decisions outlive it:
stage G brings the static pages into the same two locales and must not re-decide any of this.

Companion to `docs/web-copy-desk-2026-09.md` (§5 says what is translated and what never is; §2 says
a translation is never handed over on the pass that wrote it). Nothing here overrides that file.

## How to read this

- **§1 Rules that hold in both languages** — names, structure, dates, punctuation. Read first.
- **§2 English** — register per field family, then the termbase.
- **§3 French** — the same, plus the two traps `lib/typo.ts` sets.
- **§4 The rights ledger** — one row per sung text: what the original is, and what its English and
  French gloss is allowed to be.
- **§5 What the ledger does NOT license.**

---

## §1 Rules that hold in both languages

**A name is never translated, and a label beside a name always is.** `realizacja` is
"Skrzypce: Radu Ropotan" — the violinist keeps his name, the word for the instrument does not.
Same shape in `credits[].role`, `video.note` ("J. Sykulski — Stoi lód na Prośnie · zapis z widowni"
is a name, a work title, and two descriptions), and `pullQuote.about` ("menedżer VoctEnsemble, z
zapowiedzi koncertu").

**A work's title stays itself.** `program[].work` is not on the desk at all, and a title quoted
inside prose follows it: *Le cri des bergers* is that in every locale, and so is *Stoi lód na
Prośnie*. Where the Polish prose glosses a title in passing ("utwór *Le cri des bergers*, od którego
wieczór wziął nazwę"), the gloss travels but the title does not.

**A place is a name in English and an exonym in French**, which the repository has already decided:
`concert.9-kart.about.place` is `Rybnik · Łódź · Kraków` in the English overlay and
`Rybnik · Łódź · Cracovie` in the French. Kraków keeps its diacritics in English. Building names ARE
translated in both — *Bazylika NSPJ* is *Sacred Heart Basilica* / *Basilique du Sacré-Cœur*,
*Bazylika Mariacka* is *St Mary's Basilica* / *Basilique Sainte-Marie*.

**A date is never typed.** The dateline is composed at render from `date` (§6a). Two fields still
carry a Polish month inside a translatable string and stage F has not split them yet, so until it
does the translator renders the month and accepts that it will drift from `date`:
`reflectionAttribution` ("Florent de Bazelaire · 20 stycznia 2024", "VoctEnsemble · luty 2025") and
`roster.note` ("Skład wieczoru w Szczawnicy, 1 czerwca 2024"). `viaDate` is not on the desk and will
print Polish on both foreign pages until stage F derives it.

**A gloss is the sung text in the reader's language, and it collapses into the original when the two
are the same language.** Thirteen sung texts here are English already and one is Polish; their slots
are filled in every locale regardless — an empty one falls back to Polish and would print a Polish
stanza under an English original — and the page prints a gloss identical to its original only once
(`glossFor`, `src/i18n/config.ts`).

**`inscriptioGloss` does two jobs and only one of them is translation.** Where the work has an
`inscriptio`, the slot holds that Latin's vernacular. Where it has none, it holds a standalone
editorial note in a catalogue register — "tekst: H. M. MacGill (1876)", "z Partity na skrzypce solo
nr 3 E-dur", "na sześć głosów wysokich · fermata ciszy na końcu". Measured: **34 glosses, 26 notes.**
A note is rendered per locale as the note it is, never back against a Latin that is not there.

**`textNote` is not a translation of itself.** It states where the printed texts and their glosses
come from — "przekłady polskie hymnów i antyfon za tradycją kościelną, pozostałe własne" — so its
English has to be a true sentence about the ENGLISH glosses on that page. It is the field the ledger
below publishes into, and it is written last, after the ledger is settled for that concert.

**The middle dot `·` is the site's separator in all three languages** and is pinned by `typo.ts`.
Keep it; do not substitute a comma or an en dash.

## §2 English

British spelling and punctuation (`en-GB`; the dateline already formats day-first). Serial comma
only where it removes an ambiguity.

**Register per family.**

| family | register |
|---|---|
| `title`, `essence`, `facts` | the poster's voice: nominal, unpunctuated, no verb where the Polish has none. `9 psalmów` → `9 psalms`, not "nine psalms are sung". |
| `prologue`, `programArc`, `programLede` | programme-book prose, present tense, third person. The Polish sets a scene before it explains; keep the order. |
| `note` (58 of them, the bulk of the corpus) | a programme note: past tense for what happened, present for what the music does. Anecdote survives — this is where the writing is, and flattening it into a catalogue entry is the failure mode to watch for. |
| `rubric` | a missal's stage direction: short, past tense, attestable. "Śpiewane z galerii" → "Sung from the gallery", never "The choir sang from the gallery". |
| `reflection`, `reflectionNote`, `verbum.*` | the ensemble speaking in its own voice; first person plural where the Polish is. |
| `gallery[].alt` (621 words) | what a sighted reader sees, in one sentence, no "photo of". Not a caption — the caption is its own field. |
| `roster.groups[].voice` | the choral convention, not a literal: `Soprany` → `Sopranos`, `Sopran I` → `Soprano I`, `Kwartet solistów` → `Solo quartet`. |
| `credits[].role` | `Dyrygent` → `Conductor`, `Słowo wprowadzające` → `Introductory word`, `Słowo i błogosławieństwo` → `Word and blessing`, `Kantor bazyliki` → `Cantor of the basilica`, `Reżyseria światła` → `Lighting design`, `Wiolonczela` → `Cello`, `Kwartet smyczkowy` → `String quartet`. |
| `links[].label` | keep the trailing `↗`. |

**Fixed terms.**

| Polish | English |
|---|---|
| Koncert Duchowy / cykl Koncertów Duchowych | Spiritual Concert / the Spiritual Concerts cycle *(set by the existing overlay)* |
| chór / zespół | the ensemble (VoctEnsemble takes a singular verb) |
| o. (jezuita) | Fr |
| ks. inf. | Mgr *(Monsignor; "ks. inf. Dariusz Raś" → "Mgr Dariusz Raś")* |
| abp / bp | Archbishop / Bishop |
| Msza św. | Mass |
| suma | high Mass |
| nawa | the nave |
| chorał (gregoriański) | plainchant |
| wokaliza | vocalise |
| prawykonanie | first performance |
| opracowanie / aranżacja | arrangement |
| oprac. na … | arr. for … |
| głos / na 8 głosów | voice / for eight voices |
| antyfona / responsorium | antiphon / responsory |
| klamra | clasp *(the site's own word for the seam between works — keep it)* |
| akt (movements) | act |
| Zapowiedź · Narodziny · Cień · Spełnienie · Uwielbienie · Wołanie · Orędowniczka · Tajemnica ołtarza · Gwiazdy · Lot · Powrót · Na wejście · Żałoba · Zbroja · Nad grobem · Światłość · Epitafium · Lament niewinnych · Modlitwa o pokój · Obraz męki · Schronienie · Zawierzenie | Prophecy · Nativity · Shadow · Fulfilment · Praise · Call · Advocate · Mystery of the altar · Stars · Flight · Return · Entrance · Mourning · Breastplate · At the grave · Light · Epitaph · Lament of the innocents · Prayer for peace · Image of the Passion · Refuge · Commendation |
| Miserere — część I | Miserere — part I |
| Przerwa | Interval |

**Four words each page has to keep using**, settled by pass 2 because a page that says the same
thing twice in Polish must not say it two ways in English.

| Polish | English | where it bites |
|---|---|---|
| wołanie / krzyk | call / cry | `wolanie-gor` — `wołanie` names the concert, the first act and the piece the evening is named after, so the act is **Call**, not "Cry", and `krzyk` keeps "cry" for itself. |
| różdżka | rod | `wcielenie` — the Isaiah inscription, the act, the bridge and the note all say rod, even where Baker's carol beside them says rose. |
| róg (Canite tuba) | trumpet | `wcielenie` — one instrument in three places; "horn" in one of them broke the thread. |
| zawierzenie | commendation | `aeternam` — the act, both lines and the note. It is the word the funeral rite uses for this act; "entrustment" says it a second way. |

## §3 French

**Never type a hard space.** `lib/typo.ts` inserts the narrow no-break space before `? ! : ;` and the
ordinary one after `«` / before `»` at build time; a hand-typed one doubles up. Type
`Un programme : de la pénitence` with an ordinary space and let the build do its work. (The hash
normalization folds hard spaces, so a hand-typed one does not even mark the row stale — it just
prints wrong.)

**Quotation marks are `«` and `»`**, and the Polish `„…"` becomes them. Italics inside prose survive
as they are.

**Register** follows §2 with two adjustments: French programme prose carries the *passé composé*
where the Polish reaches for a narrative past, and the nominal poster register is looser — where an
English `9 psalms` stands alone, French takes `Neuf psaumes`.

**Fixed terms.**

| Polish | French |
|---|---|
| Koncert Duchowy / cykl | Concert Spirituel / le cycle des Concerts Spirituels *(set by the existing overlay)* |
| o. (jezuita) | P. |
| ks. inf. | Mgr |
| abp / bp | Mgr (archevêque) / Mgr (évêque) |
| Msza św. | la messe |
| nawa | la nef |
| chorał | le plain-chant |
| wokaliza | la vocalise |
| prawykonanie | la création |
| opracowanie | l'arrangement |
| na osiem głosów | à huit voix |
| antyfona / responsorium | l'antienne / le répons |
| klamra | l'agrafe |
| akt | l'acte |
| Soprany · Alty · Tenory · Basy | Sopranos · Altos · Ténors · Basses |
| Dyrygent | Direction |
| Przerwa | Entracte |
| Kraków · Łódź | Cracovie · Łódź *(only cities with a settled French exonym are translated)* |

## §4 The rights ledger

**The principle that shrinks this to a short list.** The site already publishes a Polish vernacular
gloss of every one of these texts. An English or French gloss WE write adds no new category of use —
it is the same act in another language. What the ledger exists to control is the other thing: pasting
somebody else's *published* translation. So each row answers one question — is there a canonical
translation that a reader of this repertoire would expect, and is it free to use?

**Two traps worth stating.** "The author died over 70 years ago" is not sufficient for liturgical
texts: the modern English (ICEL 2010) and French (AELF) translations of the Missal and the Office are
under copyright although the Latin is ancient. Use the older public-domain layer instead — the Book
of Common Prayer and its Coverdale psalter, the Douay-Rheims and King James versions in English;
Crampon (1923) and Segond (1910) in French. And a composer's own singing translation (Rutter's
English of the Ukrainian prayer, for instance) is his publisher's property even where the text he set
is not.

**Legend.** *= original* — the sung text is already in this language, so the gloss collapses into it
(`glossFor`) and nothing is written. *own* — our own literal gloss, the same status the Polish one
already has. *PD:…* — a public-domain published translation, used and credited in `textNote`.

| concert · work | original | EN | FR |
|---|---|---|---|
| wcielenie · Sandström, *Es ist ein Ros'* | German, Speyer 1599 | PD: Baker 1894, "Lo, how a rose e'er blooming" | own *(the French carol "Dans une étable obscure" is an adaptation, not a translation — offer it to Florent, do not assume it)* |
| wcielenie · Handl, *Canite tuba* | Latin, Advent responsory | own (Douay basis) | own (Crampon basis) |
| wcielenie · Stopford, *Lully, Lullay* | English, Coventry Carol | = original | own |
| wcielenie · Pärt, *Nunc dimittis* | Latin, Lk 2:29–32 | PD: BCP, "Lord, now lettest thou thy servant" | PD: Crampon (Cantique de Siméon) |
| wcielenie · *Gaudete* | Latin, Piae Cantiones 1582 | own | own |
| wolanie-gor · *Salve Regina* | Latin antiphon | PD: traditional "Hail, holy Queen" — NOT the ICEL text | own *(the AELF text is under copyright)* |
| wolanie-gor · *Tantum ergo* | Latin, Aquinas | PD: Caswall 1849, "Down in adoration falling" | own |
| wolanie-gor · Ešenvalds, *O salutaris hostia* | Latin, Aquinas | PD: Caswall, "O saving Victim" | own |
| wolanie-gor · Górecki, *Sanctus* | Latin | PD: BCP, "Holy, holy, holy, Lord God of hosts" | own |
| wolanie-gor · Ešenvalds, *Stars* | English, Sara Teasdale (d. 1933) | = original | own |
| wolanie-gor · Monteverdi, *Quel augellin* | Italian, Guarini | own | own |
| wolanie-gor · Vaughan Williams, *The Lark Ascending* | English, Meredith (d. 1909) | = original | own |
| wolanie-gor · Sykulski, *Stoi lód na Prośnie* | **Polish** | own | own |
| wolanie-gor · Steven, *Dawn and Dusk* | English, composer's own poem | = original | own — living author; the Polish gloss already carries this exposure, so it is one decision, not two |
| 9-kart · Allegri, *Miserere* (+ 9 clasps) | Latin, Ps 51 | PD: BCP Coverdale psalter | PD: Crampon |
| 9-kart · Lasso, *Laudate Dominum* | Latin, Ps 117 | PD: BCP Coverdale | PD: Crampon |
| 9-kart · Bruckner, *Os justi* | Latin, Ps 37:30–31 | PD: BCP Coverdale | PD: Crampon |
| 9-kart · Stanford, *Beati quorum via* | Latin, Ps 119:1 | PD: BCP Coverdale | PD: Crampon |
| 9-kart · Bach, *Singet dem Herrn* | German, Ps 149 + Gramann chorale | PD psalter for the psalm, own for the chorale | own |
| 9-kart · Gibbons, *O clap your hands* | English, BCP Ps 47 | = original | PD: Crampon |
| 9-kart · Rossi, *Barukh habba* | Hebrew, Ps 118:26–29 | PD: BCP Coverdale | PD: Crampon |
| 9-kart · Schütz, *Jauchzet dem Herrn* | German, Ps 100 | PD: BCP Jubilate | PD: Crampon |
| 9-kart · Monteverdi, *Cantate Domino* | Latin, Ps 96/98 | PD: BCP Coverdale | PD: Crampon |
| 9-kart · Gibbons, *Drop, drop, slow tears* | English, Phineas Fletcher | = original | own |
| hymn-poleglym · Rutter, *A Ukrainian Prayer* | Ukrainian, Konysky 1885 | own — **do not paste Rutter's own English**, which is his publisher's | own |
| hymn-poleglym · Rachmaninov, *Ektenia* | Church Slavonic | own ("Lord, have mercy. To thee, O Lord.") | own |
| hymn-poleglym · Palestrina, *Super flumina* | Latin, Ps 137 | PD: BCP Coverdale | PD: Crampon |
| hymn-poleglym · Pärt, *The Deer's Cry* | English, Meyer's Lorica (d. 1919) | = original | own |
| hymn-poleglym · Tavener, *Song for Athene* | English, Mother Thekla + Hamlet | = original | own — living estate; same single decision as *Dawn and Dusk* |
| hymn-poleglym · Sibelius, *Be Still My Soul* | English, Borthwick 1855 | = original | own |
| hymn-poleglym · Fauré, *Pie Jesu* | Latin, Requiem | own | own |
| hymn-poleglym · Elgar, *Lux aeterna* | Latin, Requiem communion | own (pre-1965 missal wording is PD) | own |
| hymn-poleglym · Bairstow, *I sat down under his shadow* | English, Song of Songs (KJV) | = original | PD: Crampon |
| aeternam · Vivancos, *Aeternam* | Latin, Requiem introit | own | own |
| aeternam · Zieleński, *Vox in Rama* | Latin, Jer 31:15 / Mt 2:18 | PD: Douay | PD: Crampon |
| aeternam · Pärt, *Da pacem Domine* | Latin antiphon | PD: traditional "Give peace, O Lord, in our time" | own |
| aeternam · Gjeilo, *Serenity* | Latin, *O magnum mysterium* | own | own |
| aeternam · Havrylets, *Prayer* | Ukrainian | own | own |
| aeternam · Lotti, *Crucifixus* | Latin, Creed | PD: BCP Creed | own |
| aeternam · Shaw, *and the swallow* | English, Ps 84 | = original | PD: Crampon |
| aeternam · Tavener, *Mother of God, here I stand* | English (after Lermontov) | = original | own |
| aeternam · Tavener, *A Hymn to the Mother of God* | English | = original | own |
| aeternam · Dubra, *O crux, ave* | Latin, *Vexilla regis* | PD: Neale (d. 1866) | own |

**Thirteen "= original" rows in English, one in Polish** — the count `glossFor` exists for.

## §5 What this ledger does not license

It says nothing about the **music**. Performing rights, the recordings on the concert pages and the
ZAiKS question are a separate matter the project handles elsewhere, and nothing here changes what may
be published as audio or video.

It says nothing about **`program[].text` itself**. The sung originals are already in the corpus and
already on the public Polish page; the ledger governs the gloss beside them, not their presence.

And it decides nothing that Florent cannot overturn. Where it says *own*, a canonical translation he
knows and prefers is a better answer than ours — the desk is where he says so.
