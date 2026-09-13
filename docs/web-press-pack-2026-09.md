# `/press` and the press pack — Etap 3 (2026-09)

What `docs/web-board-feedback-2026-09.md` §1 lists as "Etap 3 — Press pack + `/press` recut".
Built 2026-09-13. This file is the authority for it; the roadmap's paragraph points here.

## How to read this file

- **§1 The reframe, and what the recut removed** — read this before questioning any cut.
- **§2 The shape** — the page's seven sections, the desk port, and the pack's two states.
- **§3 The three orders** — ready to send. Two of them are why this stage is not finished.
- **§4 Traps** — things that looked correct and would have shipped wrong. Three are new.
- **§5 What is deliberately absent** — the rider, and the download. Both are decisions.
- **§6 Runbook** — what the developer does, and what was verified here.

Companion to `.ai/07_marketing_public_site.md` (rules) and `docs/web-landing-guardrails.md`
(the negative space). Nothing here overrides those two.

---

## §1 The reframe, and what the recut removed

**`/press` is not a persuasion surface, it is an execution surface.** Nobody commits a fee off a
press kit; they decide from a recommendation, a hearing, or the main site. The page's real reader
has already said yes and now has to produce a poster, a programme book and a press note on a
deadline — often not the person who did the inviting. If they cannot get a biogram and a
photograph in a minute, they write their own text and it is wrong.

That single sentence decides every cut below, and it is the roadmap's, not this file's.

| removed | where it lives instead |
|---|---|
| the hero film + the `VideoPlayer` island + `vplayer.css` | the landing's modal plays the same *Wcielenie* registration |
| the three vignettes | `/o-nas`, at length |
| the concert register, with a player per row | `/koncerty` |
| the A–Z repertoire, 45 composers hand-typed | the live `repertoire` collection, rendered at `/koncerty#repertuar` |
| the three liturgy cards | `/koncerty`'s `Officia · Poza cyklem` band; the page is Etap 4 |
| the nine-anchor jump nav | seven sections do not need an index |
| three of the four contact cards | `/kontakt` |

**The repertoire list was not just a duplicate, it was a diverging one.** The page's hand-typed
catalogue claimed 45 composers and 69 works; `repertoire.yaml`, which `/koncerty` renders, holds 43
named composers plus one anonymous row and 57 works. Two surfaces of one site printed two different
sizes for the same repertoire, and nothing could notice. The fact tiles now count the collection, so
the number is whatever the corpus says.

### What replaced them

**The biogram is the page's centre of gravity**, because it is the thing an organiser actually
takes. It is printed in three measures — around 300, 1000 and 2018 characters — each with a copy
button that puts *plain text* on the clipboard. The 300 and the 1000 are new, and they are
condensations of the ensemble's own 2018-character text: they introduce no fact it does not carry,
and they are on the copy desk so Florent can correct them before the pack starts mailing them out.

**The invoicing block is new** and is the other half of "execution": name, seat, KRS, NIP, REGON and
both accounts, each with a copy button, set in the ledger face. An organiser filling a contract form
retypes none of it.

---

## §2 The shape

### The page

Seven sections: the head (who we are, and the one address, before anything is asked of the reader),
the three biograms, the pack, the facts and the invoicing block, the collaborators a programme book
must credit, the published coverage, and the closing invitation.

`noindex,follow` stays, and so does the hand-written sitemap exclusion in `astro.config.mjs`. Its
only traffic is a link we send — and per the roadmap, that link goes in the **second** mail, after
the yes.

### The desk port

The 913-line single file became the site's normal page shape, because the recut was rewriting the
markup anyway and extracting the prose cost nothing at that moment:

| file | what it holds |
|---|---|
| `src/components/pages/PressPage.astro` | the body, `lang` as a prop |
| `src/pages/press.astro` | one line — `<PressPage lang="pl" />` |
| `src/content/pages/press.yaml` | the Polish prose |
| `src/i18n/content/press.ts` | the schema, the desk contract, the not-copy table, the chrome |
| `copydesk/extractPages.mjs` | one entry in `PAGE_SPECS` |

**On the desk, NOT in `TRANSLATED_ROUTES`** — the two switches are independent and this page is on
the first only. §2 of `docs/web-copy-desk-2026-09.md` forbids translating prose that is still being
rewritten; the English and French wait until this Polish stops moving. When it does, the order is
route files first, ledger entry last.

The backend needed nothing: `scope_from_key` derives the scope from the key, and `page.press.*`
satisfies `KEY_PATTERN` as it stands.

### The pack, and its two states

`npm run press:pack` assembles `public/press/voctensemble-press-YYYY-MM.zip`. **Five of its eight
items are generated from the site's own data** — the three biograms from the same YAML field the
page prints, the photo credits from `concerts.yaml`, the invoicing sheet from
`src/data/foundation.ts`, the programmes from the corpus, the recording links from the corpus and
the page. None of them is typed twice, so none of them can drift.

Three come from outside and are named in `press-pack/manifest.yaml`: the cleared photographs, the
technical rider, and which evenings ship as sample programmes.

**The page looks; it is never told.** `lib/pressPack.ts` reads `public/press/` at build and the
section renders either a download tile (name, size, month) or the honest "write to us" band. There
is no hard-coded href anywhere, which is the direct answer to the 2026-07 audit's finding of seven
dead download links on this page.

**The archive is gitignored**, on the same terms as the photographs it carries: build it where the
originals are, upload it to the build host. A host without it builds a page that says the pack is
being assembled, which is true there.

### `src/data/foundation.ts`

The registry numbers and the accounts finally have one home, because the pack's invoicing sheet is
written by a Node script and an `.astro` template cannot be read from one. Two files each declared
in their own header that they were the single source of truth for the bank details
(`constants/vaultConfig.ts` and `vault/transferFields.tsx`); both now import. **Seven display
surfaces still carry their own copies** — the two footers, `FinalSupportSection`, `AboutPage`,
`ContactPage`, `KolofonPage`, and the policy / terms YAML where the number sits inside a sentence
and belongs to the desk. That sweep is mechanical and is deliberately a separate pass;
`docs/web-colophon-remediation.md` has been asking for it since 2026-08.

---

## §3 The three orders

**Nothing left in the roadmap can be finished by the developer.** §1 of the roadmap says both
external clocks should be started before either stage is built, and as of this stage neither had
been. These are written to be sent as they stand.

### 3.1 Rider techniczny — do zespołu (Florent)

> Temat: **Rider techniczny — jedna strona, potrzebna do pakietu prasowego**
>
> Cześć,
>
> kończę stronę `/press` i pakiet prasowy, który wysyłamy organizatorom po tym, jak nas zaproszą.
> Brakuje w nim jednej rzeczy, której nie mogę napisać za Was: **jednostronicowego ridera
> technicznego**.
>
> Ważne: stara wersja strony podawała parametry techniczne, które ktoś kiedyś oszacował —
> pogłos „co najmniej 2 sekundy", podest 6 × 4 m, „12–14 głosów", „60–75 minut". Żadna z tych
> liczb nie była przez Was potwierdzona, więc **usunąłem je w lipcu i nie wracają jako domysł.**
> Wolę pustą sekcję niż liczbę, na której organizator oprze budżet.
>
> Rider to nie jest dokument na dwie godziny — wystarczy, że odpowiecie na to, o co i tak pytają:
>
> - ile głosów zwykle wychodzi na scenę (i jakie jest minimum, poniżej którego nie gramy programu),
> - jak się ustawiacie i ile miejsca to wymaga — szerokość, głębokość, czy potrzebny jest podest,
> - jaka akustyka jest dla Was dobra, a jaka wyklucza koncert (to pytanie zadaje każdy kościół),
> - czy potrzebne jest nagłośnienie i monitoring, czy śpiewacie wyłącznie akustycznie,
> - światło: co jest niezbędne, a co jest opcją (Ada wie to najlepiej),
> - garderoba i zaplecze — ile osób, czy potrzebne osobne pomieszczenie,
> - ile czasu potrzebujecie na próbę akustyczną w dniu koncertu,
> - czy program wymaga instrumentu (organy, fortepian) i jakiego,
> - zasilanie: ile gniazd i gdzie.
>
> Format bez znaczenia — może być mail, lista w punktach, cokolwiek. Ja to złożę na jedną stronę.
> **To jest najdłuższy element na liście**, więc im szybciej, tym lepiej: dopóki go nie ma, pakiet
> prasowy się nie buduje i strona pisze organizatorom, żeby napisali po materiały mailem.

### 3.2 Wybór zdjęć — do zespołu (Ania)

> Temat: **Zdjęcia do pakietu prasowego — potrzebne 3–5 kadrów, w tym pion**
>
> Cześć,
>
> do pakietu prasowego (ten, który dostaje organizator po zaproszeniu nas) potrzebuję **3 do 5
> zdjęć**. Reszta pakietu jest już gotowa — biogramy, dane do faktury, programy, logotyp.
>
> Czego konkretnie potrzebuję:
>
> - **3–5 kadrów**, i **koniecznie przynajmniej jeden w pionie**. To nie jest drobiazg: plakat jest
>   pionowy. Jeśli organizator dostanie same poziome zdjęcia, albo przytnie któreś sam (źle), albo
>   użyje własnego. Pion to najczęstszy powód, dla którego do nas piszą.
> - **nazwisko fotografa przy każdym zdjęciu** — część mam już w danych serwisu (Tomasz Czajkowski,
>   Kamila Grudzińska, Wojciech Przybył, Edyta Gonet, Jakub Garbacz, Andrzej Płachetko), ale
>   potwierdź, czy przy tych konkretnych kadrach są właściwe.
> - **zgodę fotografa na redystrybucję w celach prasowych** — czyli że organizator może to zdjęcie
>   opublikować w plakacie, programie i zapowiedzi, podając nazwisko. Bez tego nie mogę ich włożyć
>   do pliku, który rozsyłamy.
>
> Dwie rzeczy, które sprawdziłem po naszej stronie:
>
> - **Poziomych kadrów mamy pod dostatkiem** — z *Wcielenia* są dwa w 8256 × 5504, co przy 300 dpi
>   daje wydruk większy niż A3. Rozdzielczość nie jest problemem.
> - **Pionowych jest mało.** Realnie: `kd-hymn-0`, `kd-hymn-1`, `kd-hymn-2`, `kd-hymn-3`
>   i portret Florenta. Stąd pytanie: **czy fotograf *Wcielenia* zgodzi się na pionowe
>   kadrowanie** jednego ze swoich kadrów? Przy 8256 × 5504 wycięty pion nadal trzyma 300 dpi
>   powyżej A4, więc technicznie się da — ale kadrowanie zmienia zdjęcie i nie zrobię tego bez
>   jego zgody.
>
> I jedna rzecz, której **nie da się użyć**: `kd-hymn-4` i `kd-hymn-5` mają wpaloną w plik ramkę
> i podpis, więc grafik nie może ich złamać w swoim layoucie. Jeśli są oryginały bez ramki, to
> zmienia sprawę.

### 3.3 Pytanie do zarządu — Etap 4

> Temat: **Pytanie przed podstroną o oprawach liturgii i ślubach**
>
> Kolejnym etapem po `/press` jest podstrona o oprawach liturgii, mszach ślubnych i uroczystościach
> kościelnych. Z całej listy to ona ma najwyższą wartość komercyjną i jako jedyna realnie potrzebuje
> pozycjonowania w wyszukiwarce — reszta serwisu jest instrumentem darczyńcowym i grantowym.
>
> **Zanim ją zaprojektuję, potrzebuję decyzji zarządu w jednej sprawie**, bo ona zmienia, co ta
> strona w ogóle może napisać:
>
> **Czy oprawy, za które bierzemy wynagrodzenie, prowadzimy jako odpłatną działalność pożytku
> publicznego, czy jako działalność gospodarczą?**
>
> To nie jest pytanie o wygląd strony, tylko o to, czy fundacja może na stronie mówić o cenniku,
> i na jakich zasadach. Fundacja reklamująca płatne usługi bez rozstrzygnięcia tej różnicy wchodzi
> w obszar, w którym łatwo o zarzut przy kontroli.
>
> Niezależnie od odpowiedzi jedna rzecz jest już przesądzona po stronie projektu: **to nie będzie
> strona usługowa z cennikiem.** To byłoby zdewaluowanie reszty serwisu. Ma to być strona o tym,
> czym jest ta muzyka, kiedy służy obrzędowi, a nie wieczorowi — z Bobolą jako przykładem
> i ślubem jako jednym z przypadków. Pasmo `Officia · Poza cyklem`, które stoi już na `/koncerty`,
> jest zalążkiem tej strony i celowo mówi wyłącznie, **czym ta muzyka jest**, nigdy ile kosztuje.

---

## §4 Traps

- **`.press-eyebrow` is a member of `base.css`'s rubric roster**, and the page that shipped until
  now silently opted out of it. It appears in the `.titulus` compound and in both two-tier
  `:is(…):has(.lat)` rules, but the page's own `<style>` restated the atom's face, size, weight,
  tracking and case — at (0,2,0) with the page bundle loading last, which wins. The effect was the
  vernacular gloss staying in Cinzel caps instead of turning to Plex Sans lowercase: the exact
  defect `docs/web-board-feedback-2026-09.md` §2.3 records for `.kd-section-label`, arrived at
  independently on a second page. The recut removed those declarations; the page now states only
  the rubric's ground and its layout, and carries `.titulus` in the markup. **When a page's style
  block names a class that base.css also names, base.css has already lost.**
- **A content module may not re-export a VALUE.** `press.ts` briefly carried
  `export { counted } from "./obrazy"`, which is a real runtime resolution — and these modules are
  loaded by plain Node (the desk's extractor), where an extensionless specifier does not resolve.
  It fails the extractor, not the build, so it fails late and somewhere else. Every cross-module
  import in `i18n/content/*` is `import type` for exactly this reason; type-stripping erases it
  before Node sees a specifier. The page imports `counted` from `obrazy.ts` directly, as
  `KolofonPage` already does.
- **A camera original is not a press photograph.** The first pack built at **71.5 MB** — the two
  *Wcielenie* frames are 8256 × 5504 and over 40 MB each — against a spec that caps the archive at
  50. The answer is not "drop a frame": the script resamples anything above a 5000 px long edge
  (42 cm at 300 dpi, the long side of A3) to JPEG at quality 92 with the colour profile kept. The
  same pack is then 10.5 MB. Delivering the raw file is not generosity; it is an archive nobody
  downloads on a deadline.
- **`dateLabel` is a `LocalizedText` map, not a string.** The first generated programme file
  printed `[object Object]` where the date belongs. Anything in `concerts.yaml` that a component
  reads through `pickLocale` will do the same to a script that does not.
- **The corpus's `links[]` and the page's press cards are the same links.** The Bobola broadcast and
  the Gość / KAI pieces are in both, so the first `nagrania.txt` listed each twice under two names.
  A reader opening the same page twice looking for a second source has been misled by a list that
  counted one thing as two.

---

## §5 What is deliberately absent

- **The technical rider.** Not "to do" — *absent*. Every number the page printed under that heading
  was invented and was deleted in 2026-07 rather than corrected. §3.1 is the request that ends this.
- **The download.** The archive does not exist yet, and the page says so plainly instead of linking
  at a file that is not there. This is the same rule, applied to a different object.
- **The singers' names.** `content.config.ts` states that `roster` is cleared for concert pages only
  and names press materials as the case it is NOT cleared for. The pack ships no roster.
- **Video files and the photograph archive.** The pack is a working set, not a library; `/obrazy`
  is linked instead. The looping-phrase video grid remains rejected pending masters *and* a design
  pass — `docs/web-imagines-spec.md` §2 already rejected a wall of moving thumbnails.
- **EN and FR.** §2 of the copy-desk spec, stated above.

---

## §6 Runbook

**What the developer does.** Environment: this machine, `web/`.

1. Send §3.1 and §3.2 to the ensemble, and §3.3 to the board. Two of them are the stage's only
   remaining blockers, and neither clock had been started.
2. When the photographs and the rider arrive: put the rider in `press-pack/assets/`, fill in
   `press-pack/manifest.yaml`, run `npm run press:pack`.
3. Upload `public/press/voctensemble-press-YYYY-MM.zip` to the build host, beside
   `src/assets/photos/`, and rebuild. The page's download tile lights by itself — no code change.
4. `npm run copy:sync` from a clean tree, so `page.press.*` reaches the desk and Florent sees the
   new segments (needs the `COPYDESK_*` credentials).

**Verified here.** `npm run test:copydesk` 29 green, and the accounting reports `press: declared
but unused: none` — every path in the new YAML is classified. `npm run check`: 13 errors, all of
them the pre-existing `rite/render.mjs` ones, none in a file this stage touched. `npm run build`
clean — 46 pages, typography 47/47, register audit 2774 nodes with its one standing note.
`npm run test:audit` 24 green. `npm run press:pack` refuses with an empty manifest and names both
missing inputs, which is the contract the page is written against.

**The pack was built end to end and opened.** A temporary manifest (three cleared frames, a stub
rider) produced a 10.5 MB archive, extracted with `Expand-Archive` outside this toolchain: sixteen
files, directories intact, Polish diacritics correct, credits resolved from `concerts.yaml`, print
sizes computed. The ZIP writer is ours (`scripts/zip.mjs`, ~110 lines) rather than a dependency;
that round trip is why it can be trusted. The test artefacts were removed and the manifest restored
to empty.

**Not verified, because it cannot be from here:** how the three biograms read to an editor. They go
to Florent on the desk before the pack mails them anywhere.
