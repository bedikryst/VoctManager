# Ryt — animacja znaku VoctEnsemble jako materiał wideo

Animacja otwierająca stronę [voctensemble.pl](https://voctensemble.pl), wyjęta ze strony tak, żeby
dało się ją wyrenderować jako plik wideo — pod intro na YouTube, bumper, planszę tytułową.

W folderze są dwa pliki, które robią różne rzeczy:

- **`rite.html`** — sama animacja, samodzielny plik. Otwórz go dwuklikiem w Chrome albo Edge i
  zagra; kliknij gdziekolwiek, żeby zobaczyć jeszcze raz. To jest **źródło ruchu** — nic innego
  w tym folderze nie odtwarza animacji po swojemu.
- **`render.mjs`** — zamienia `rite.html` w klatki, a klatki w plik wideo.

Leży tu jeszcze `voct-mark.svg` — czysty wektor znaku. `rite.html` go **nie** czyta (ma go
wklejonego w środku, żeby był jednym samodzielnym plikiem); jest tutaj na wypadek, gdybyś chciała
odtworzyć animację natywnie w After Effects zamiast renderować z tego folderu.

Nie musisz rozumieć żadnego z nich, żeby wyrenderować materiał. Wystarczy sekcja *Instalacja*
i *Jak renderować*.

---

## Co się właściwie dzieje na ekranie

Dwa takty, w kolejności, w jakiej powstaje rękopis.

**Pióro** pisze tę jedną linię znaku, która naprawdę jest linią: długi pionowy trzon schodzący do
swojego punktu. Jest rysowany jak prawdziwe pociągnięcie, z góry na dół.

**Światło** wznosi się od tego punktu i **otwiera literę V w jej prawdziwym, modulowanym
kroju**. V nigdy nie jest rysowane, obrysowywane ani „pisane" — jest *odsłaniane* przez
przechodzące światło. To jest cały pomysł tej animacji. Każda wersja, która próbowała V
narysować, dawała strzałkę w dół zamiast litery.

Cienka kreska pióra zostaje widoczna pod światłem. Pióro ma grubość 8 jednostek tam, gdzie
prawdziwy trzon znaku ma 13 — w tym samym złocie — więc światło **wyprzedza** kreskę: włos
nabiera ciała tam, gdzie światło już przeszło, i zostaje włosem powyżej.

Tło (plansza) to ta sama ciemność i ta sama ciepła poświata, co w krótkiej wersji rytu na
stronie.

---

## Instalacja

Do zrobienia raz. Potrzebne są trzy rzeczy: **Node.js**, **ffmpeg** i **Playwright**.

### Windows

1. **Node.js** — pobierz wersję LTS z [nodejs.org](https://nodejs.org) i zainstaluj (same „Dalej").
2. **ffmpeg** — otwórz PowerShell i wpisz:
   ```powershell
   winget install Gyan.FFmpeg
   ```
   Potem **zamknij i otwórz PowerShell na nowo** (inaczej system jeszcze nie widzi ffmpeg).
3. **Playwright** — wejdź do tego folderu i zainstaluj zależności:
   ```powershell
   cd sciezka\do\rite
   npm install
   ```
   To pobiera też przeglądarkę, w której renderujemy (ok. 150 MB), więc potrwa chwilę.

### macOS

1. **Homebrew**, jeśli go nie masz — [brew.sh](https://brew.sh).
2. **Node.js i ffmpeg**:
   ```bash
   brew install node ffmpeg
   ```
3. **Playwright**:
   ```bash
   cd sciezka/do/rite
   npm install
   ```

### Sprawdzenie, czy działa

```bash
node --version     # powinno pokazać v20 albo wyżej
ffmpeg -version    # powinno wypisać kilka linii o wersji
```

Jeśli któraś komenda mówi „nie znaleziono" — ta rzecz nie jest zainstalowana albo trzeba zamknąć
i otworzyć terminal na nowo.

---

## Jak renderować

Wszystko wychodzi do folderu `out/`. Jedna komenda na jeden wariant:

```bash
npm run intro       # GŁÓWNY PLIK: 4K, plansza jak na stronie, ProRes 422 HQ
npm run intro-hd    # to samo w 1920×1080
npm run preview     # lekki .mp4 do obejrzenia i wysłania — NIE do montażu
npm run black       # płaskie ciemne tło, bez poświaty
npm run alpha       # sam znak na przezroczystości (ProRes 4444) — do nakładania na materiał
npm run shorts      # pion 1080×1920 pod Shorts
npm run all         # wszystkie naraz
```

Domyślnie: **30 klatek/s, 3,5 sekundy, bez wygaszania na końcu** (intro kończy się na zapalonym
znaku — cięcie robisz Ty). Kadencja idzie 0–2,6 s, gotowy znak stoi 0,9 s.

Kadr nie zaczyna się od razu: przez pierwsze 1,2 s **poświata wchodzi z czerni**, a pióro pisze
już w nią. To jest otwarcie filmu — cięcie nie ma nic przed pierwszą klatką, więc bez tego
pociągnięcie zaczyna się w połowie gestu. Nie kosztuje ani milisekundy kadencji, bo gra *pod*
pisaniem, a nie przed nim.

Obok każdego pliku wideo pojawia się plik `.json` z dokładnym klatkażem, liczbą klatek, długością
i tym, gdzie wypadają poszczególne takty. **Konformuj według niego**, nie na oko.

W `.json` są dwie długości: `requestedMs` (ile zamówiono) i `durationMs` (ile plik naprawdę ma).
Bywają różne, kiedy klatkaż nie dzieli długości równo — 3,5 s przy 25 kl/s to 87,5 klatki, więc
plik wychodzi 88-klatkowy i trwa 3,52 s. Renderer wypisuje to na ekranie, kiedy się zdarzy.

### Inny klatkaż, inna rozdzielczość, inna długość

Dopisz parametry po `--`:

```bash
npm run intro -- --fps=25                    # 25 kl/s
npm run intro -- --fps=24 --dur=4000         # 24 kl/s, 4 sekundy
npm run intro -- --width=1920 --height=1080  # inna rozdzielczość
npm run intro -- --nib=1                     # z kropką atramentu na czole kreski
npm run intro -- --lead=250                  # dłuższa nieruchoma głowa przed kadencją
npm run intro -- --open=0                    # bez otwarcia, twardy start na piórze
npm run intro -- --exit=1                    # z wygaszeniem na końcu (pod outro)
```

Możesz też wołać renderer wprost, bez presetu:

```bash
node render.mjs --width=2560 --height=1440 --fps=50 --bg=plate --format=prores422
```

## Wszystkie parametry

| Parametr | Domyślnie | Co robi |
|---|---|---|
| `--preset` | — | `intro` · `intro-hd` · `intro-mp4` · `intro-black` · `intro-alpha` · `shorts` |
| `--width` `--height` | `3840` `2160` | Rozmiar kadru. |
| `--fps` | `30` | Klatkaż. Renderuj **w klatkażu docelowym** — patrz *Pułapki*. |
| `--dur` | `3500` | Długość całości w milisekundach. |
| `--format` | `prores422` | `prores422` (plansza) · `prores4444` (z alfą) · `webm` (z alfą, lżejszy) · `h264` (mp4) · `png` (sekwencja klatek) |
| `--bg` | `plate` | `plate` (ciemne tło + poświata, jak na stronie) · `dark` (płaska ciemność) · `alpha` (przezroczyste) |
| `--ground` | `080807` | Kolor tła, gdyby trzeba było czystą czerń: `--ground=000000`. |
| `--mark` | 62% wysokości kadru | Wysokość znaku w pikselach. |
| `--shift` | `0` | Przesunięcie znaku w pionie, jako ułamek jego wysokości. Ujemne = w górę. |
| `--bloom` | `0.99` | Promień poświaty, jako ułamek wysokości znaku. |
| `--open` | `1200` | Otwarcie: poświata wchodzi z czerni przez tyle ms. `--open=0` wyłącza. |
| `--nib` | `0` | Kropka atramentu na czole kreski. `--nib=1` włącza. |
| `--lead` | `120`, z kropką `400` | Nieruchoma głowa przed kadencją. Z `--nib=1` to jest okno docisku stalówki. |
| `--exit` | `0` | `--exit=1` dokłada wygaszenie na końcu (pod outro). |
| `--exitdur` | `700` | Długość wygaszenia w ms. |
| `--stroke` | `8` | Grubość kreski pióra. **Nie podnoś do 13** — patrz *Pułapki*. |
| `--hold` | liczone z `--dur` | Ile ms gotowy znak stoi, zanim się skończy. Nadpisuje `--dur`. |
| `--drawease` | `pen` | Krzywa pióra: `pen` · `site` · `soft` · `sharp` · `linear`, albo własne `cubic-bezier(...)`. |
| `--blur` | `8` z kropką, inaczej `1` | Rozmycie ruchu: ile próbek na klatkę. `1` = brak. |
| `--shutter` | `0.5` | Kąt migawki jako ułamek klatki (0,5 = 180°, standard filmowy). |
| `--keepframes` | — | `--keepframes=1` zostawia sekwencję PNG po zakodowaniu. |
| `--name` | z presetu | Nazwa pliku wyjściowego. |

---

## Dlaczego to renderuje klatki, a nie nagrywa ekranu

Renderer **zatrzymuje animację** i przestawia ją klatka po klatce, robiąc zrzut każdej pozycji.
Dzięki temu czas jest dokładny co do milisekundy, identyczny przy każdym uruchomieniu, i zupełnie
niezależny od tego, jak długo trwa zapis klatki 4K.

Nagranie ekranu tej animacji gubi i dubluje klatki na ruchomym włosku — co widać jako drganie — a
takt punktu (180 ms) ląduje na innej klatce przy każdym podejściu.

Przy tym cały czas liczy to silnik przeglądarki na krzywych ze strony. Nic tutaj nie przepisuje
easingu po swojemu, a to jest zwykła droga, którą „wyeksportowana" animacja po cichu odjeżdża od
oryginału.

---

## Specyfikacja

Poniżej jest wszystko, co robi `rite.html` — na wypadek, gdyby animację trzeba było odtworzyć
natywnie (After Effects, Nuke) zamiast renderować z tego pliku.

**Kolory** — złoto `#c6a45b`, tło `#080807`. Oba są kolorami marki; nie zastępuj ich „cieplejszym"
ani „bogatszym" złotem. Dostarczaj w bt709.

**Geometria** — z dołączonego `voct-mark.svg`, viewBox `0 0 1000 2469.8`:

- trzon rysowany piórem: `M 500,4 L 500,2221.7`, grubość kreski `8`
- punkt: elipsa `cx 500 cy 2427.3 rx 60,8 ry 38,5`, obrócona `-22,7°`
- światło: prostokąt na całą szerokość pola znaku i **128%** jego wysokości, zakotwiczony do dołu,
  wypełniony `#c6a45b 0% → #c6a45b 78% → przezroczysty 100%`, maskowany całym znakiem i jadący
  `translateY(100%) → translateY(0)`
- poświata: `radial-gradient(circle at 50% 48%, rgba(198,164,91,0.16), transparent R)`, gdzie
  `R` = 0,99 wysokości znaku
- kropka atramentu: elipsa jadąca po czole kreski, w wielokrotnościach grubości pióra `S` (=8).
  Krzywa kształtu jest **liniowa** — stopnie są rozstawione względem *już złagodzonego* ruchu
  kreski, więc drugie złagodzenie na wierzchu je rozjedzie. `cy` zawsze = −0,72·`ry`:

  | stopień | `rx` | `ry` |
  |---|---|---|
  | 0% | 1,70 S | 1,70 S |
  | 5% | 1,35 S | 3,40 S |
  | 30% | 1,15 S | 2,30 S |
  | 70% | 0,80 S | 1,15 S |
  | 100% | 0,50 S | 0,50 S |

  Rozciągnięcie kulminuje w 48%, bo tam krzywa pióra jest najszybsza — atrament wyciąga prędkość.
  Ostatni stopień to połowa grubości kreski, czyli kropka staje się jej końcem. **Stopnie są
  skalibrowane pod krzywą `pen`**; przy innym `--drawease` szczyt prędkości przesuwa się i
  zgrubienie wypadnie w złym miejscu (renderer o tym ostrzega).

**Oś czasu** (t = 0 to pierwsza klatka; wartości bez zapłonu — z zapłonem wszystko przesuwa się
o 400 ms):

| Takt | Start | Długość | Krzywa | Co się rusza |
|---|---|---|---|---|
| Otwarcie | `0` | `1200ms` | `cubic-bezier(0.16, 0.84, 0.24, 1)` | krycie poświaty 0 → 1 |
| Docisk *(opcjonalny)* | `0` | = `--lead` | `ease-out` | krycie kropki 0 → 1 |
| Pióro | `0` | `900ms` | `cubic-bezier(0.62, 0.02, 0.34, 1)` | `stroke-dashoffset` 1 → 0 |
| Kropka: przejazd *(opcj.)* | `0` | `900ms` | **ta sama co pióro** | `translateY` 4 → 2221,7 |
| Kropka: kształt *(opcj.)* | `0` | `900ms` | `linear` | `rx`/`ry`/`cy` — patrz niżej |
| Punkt | `880ms` | `180ms` | `cubic-bezier(0.22, 0.61, 0.16, 1)` | krycie 0 → 1 |
| Światło | `1000ms` | `1600ms` | `cubic-bezier(0.1, 0.45, 0.75, 0.72)` | prostokąt z gradientem wznosi się |
| Spoczynek | `2600ms` | reszta | — | zapalony znak stoi |
| Wygaszenie *(opcjonalne)* | koniec − 700ms | `700ms` | `cubic-bezier(0.16, 0.84, 0.24, 1)` | krycie → 0, rozmycie → 4,29% wysokości znaku |

Domyślnie (3,5 s, bez kropki, głowa 120 ms): otwarcie 0–1200 ms, pióro 120–1020 ms, punkt
1000 ms, światło 1120–2720 ms, spoczynek 2720–3500 ms.

`--lead` przesuwa **całą kadencję**; otwarcie zostaje na swoim miejscu, bo gra pod spodem.

**Akcenty pod dźwięk**, gdyby powstał sound design (przy głowie 120 ms): `1000 ms` (punkt ląduje),
`1120 ms` (światło rusza), `2720 ms` (znak zapalony w pełni). Przy innej głowie — dodaj różnicę.
Dokładne wartości są w pliku `.json` obok renderu, w polu `timing`.

---

## Pułapki

Każda z nich albo została kiedyś popełniona na stronie, albo jest sposobem, w jaki wersja
filmowa może się zepsuć, a webowa nie.

**Kropka atramentu nie może iść bez rozmycia ruchu.** Krzywa pióra wsypuje ~30% trzonu w pierwsze
33 ms, więc przy 30 kl/s kropka przeskakuje między próbkami około ćwierć kadru. Rosnąca linia to
wybacza — oko czyta wzrost jako prędkość — ale **śledzony obiekt** w takim tempie stroboskopuje.
Renderer robi prawdziwą migawkę: próbkuje oś czasu kilka razy w obrębie klatki i uśrednia, tak jak
kamera. `--nib=1` włącza to automatycznie (`--blur=8`, migawka 180°); bez kropki nic tu nie jest
ruchomym obiektem, więc domyślnie jest wyłączone i render idzie osiem razy szybciej.

Rozmycia **nie da się sensownie dodać później** w montażówce — wtyczki zgadują wektory ruchu z
gotowych klatek i na cienkim złotym włosku na czerni zgadują źle. Musi być wypalone w renderze.

**Renderuj w klatkażu docelowym.** Jeśli kanał jest 25 kl/s, wyrenderuj 25, nie 30 czy 60.
Konform 60 → 25 zrobi pull-down na ruchomym włosku, czyli dokładnie na tym, co jest tu najbardziej
wrażliwe. Zmiana klatkażu to jeden parametr, więc nie ma powodu tego nie zrobić.

**Cienkie kreski.** Pióro ma 8 jednostek w znaku wysokim na 2469,8 jednostek, więc jego grubość w
pikselach to `wysokość znaku / 309`. W masterze 4K to ok. 4,3 px i jest bezpiecznie. W masterze
1080p to ok. 2,2 px — na tyle cienko, że koder YouTube potrafi z tego zrobić migotanie.
**Rób master w 4K i pozwól YouTube zejść w dół.** Jeśli 1080p jest konieczne, podnieś `--stroke`
do 10.

**Nigdy nie podnoś `--stroke` do 13 ani wyżej.** Przy 13 pióro równa się prawdziwemu trzonowi i
światło przestaje cokolwiek wyprzedzać — cały efekt „włos nabiera ciała" znika, a kreska po prostu
zmienia kolor. Renderer i tak przycina to na 12,5.

**Nigdy nie wygaszaj samej kreski pióra.** Kusi (po zapaleniu wygląda na zbędną) i jest błędem: na
timerze gasi górny trzon, kiedy światło jest jeszcze pod wierzchołkiem V, a potem wznoszące się
światło odsłania go po raz drugi — i czyta się to jak rysowanie tej samej linii dwa razy, od
środka.

**Krzywa pióra jest wspólna ze stroną.** `--drawease=pen` to dokładnie ta sama `cubic-bezier(0.62,
0.02, 0.34, 1)`, którą rysuje trzon preloader na voctensemble.pl (`--pen-ease` w
`styles/landing/01-foundation.css`). Film i strona mają pisać jedną ręką, więc zmiana należy do
obu miejsc naraz. Pozostałe wartości `--drawease` są do porównań, nie do wydania.

**Nie przetaktowuj światła przez zmianę jego długości.** Litera V zajmuje tylko odcinek 0,28–0,79
przebiegu światła, i krzywa jest wykrojona wokół niej: po trzonie jak po loncie, pełzanie w
trakcie otwierania V (ok. 1,05 s z 1,6 s), potem szybko niewidoczny czubek. Rozciągnięcie długości
wsypuje cały dodatkowy czas w goły włos nad literą, gdzie nic się nie dzieje. Jeśli takt ma być
dłuższy, wydłuż **spoczynek** (`--dur`), nie światło.

**Kadr.** Znak jest wysoki i wąski (proporcja 0,405), z długim trzonem nad literą i punktem pod
nią, więc wyśrodkowany w pudełku czyta się nisko. `--shift` go przesuwa. Na stronie nie ma tego
parametru, bo tam znak siedzi w kurtynie na cały ekran, a nie w komponowanym kadrze.

**Alfa.** Poświata jest światłem *na ciemnym tle* — nad przezroczystością nie ma się na czym
odbić i źle się premnoży, więc renderer ją w trybie `alpha` pomija. Jeśli ma być nad innym
materiałem, złóż ją w kompozycji.

**Banding.** Plansza to prawie czarny kadr z bardzo płaskim gradientem przez cały ekran — czyli
dokładnie ten sygnał, na którym 8-bitowy H.264 robi pasy. Dlatego master idzie w ProRes, a `.mp4`
z `npm run preview` jest tylko do obejrzenia. Na YouTube wysyłaj eksport z montażówki, nie ten
podgląd.

**Kropka atramentu nie jest osobnym obiektem — jest czołem pociągnięcia.** To jedyny sposób, w
jaki może działać. Wcześniejsza wersja stawiała iskrę na starcie kreski i pozwalała pióru odjechać
bez niej; przy tak przednio obciążonej krzywej (~40% trzonu w pierwszych 60 ms) dwa niezależne
obiekty **zawsze** się rozjeżdżają, a oko widzi kropkę dogasającą w punkcie, który linia już
opuściła. Żadne przestrojenie czasu tego nie naprawia.

Działa, bo trzon jest **linią prostą**: pozycja czoła jest liniowa w parametrze animacji, więc
przesunięcie o tej samej długości, opóźnieniu i krzywej co kreska siedzi na czole co do jednostki,
w każdej klatce — bez odczytywania czegokolwiek w skrypcie. **Zmiana długości albo krzywej samej
kreski bez zmiany tych samych wartości dla kropki natychmiast ją od czoła oderwie.**

Sylwetka łzy bierze się sama z linii, po której kropka jedzie: ogon nachodzi na już narysowany
trzon w tym samym złocie, więc widać wyłącznie to, co **szersze od linii** — a elipsa zwęża się ku
końcom, czyli pokazuje zgrubienie przy czole i zbieg w górę. Środek masy leży na czole
(`cy` = −0,72·`ry` na każdym stopniu), nie nad nim, i odrobina kropki wyprzedza odłożoną linię —
tam, gdzie realnie jest mokra stalówka. Na końcu kropka schodzi do **połowy grubości kreski**,
czyli staje się zakończeniem linii: nie trzeba jej chować ani wygaszać, bo znika przez dojście do
celu.

Nic z tego nie jest ruchem ze strony: tam pióro poprzedza oddychająca pętla oczekiwania, której
film nie ma.

**Film musi mieć nieruchomą głowę, i to nie jest kwestia gustu.** Kadencja rusza z maksymalną
prędkością dokładnie w `t=0`, a otwarta migawka uśrednia okno zaczynające się w momencie klatki —
więc bez głowy **pierwsza klatka pliku zawiera już kawałek narysowanej linii** i materiał otwiera
się w połowie pociągnięcia. Głowa musi być dłuższa niż jedno okno migawki (przy 30 kl/s i 180° to
16,7 ms); domyślne 120 ms daje cztery czyste klatki planszy. Renderer ostrzega, kiedy `--lead`
spadnie poniżej tego progu.

**Bez dźwięku, bez nazwy, bez fontów.** To jest sam znak. Nazwa „VoctEnsemble" pod spodem, podpis,
claim — to są decyzje projektowe, a nie ustawienia eksportu; nie składaj ich z dowolnego kroju.
Poproś o gotowy layout.

---

## Jeśli animacja na stronie się zmieni

`rite.html` jest przepisaniem kadencji z pliku
`web/src/styles/landing/01-foundation.css` (`.rite`, `.rite-skel`, `.rite-fill` oraz klatki
kluczowe `riteDraw` / `riteNote` / `riteIllum`). Świadomie pomija warstwę rastrową i pętlę
oczekiwania — powody są opisane w komentarzu na początku samego pliku. Jeśli tamten CSS zostanie
przetaktowany, ten plik trzeba przetaktować ręcznie; nic ich nie synchronizuje automatycznie.
