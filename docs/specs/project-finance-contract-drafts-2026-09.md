# Contract drafts — for legal and accounting review

Status: **Draft 1, written 2026-09-23 by the agent on the developer's instruction ("draft them; we
pass them to the lawyers and the accounting office and apply their corrections"). Not reviewed by a
lawyer or by the accounting office.** These Polish texts are the source that the Stage 1b templates
(`backend/templates/finance/`) are built from (`project-finance-2026-09.md` §9); the templates match
this file as of 2026-09-23. A correction lands here first, then in the template.
Notation: `{{…}}` is filled in by the app; `…………` is filled in by hand after printing. A name,
a role or a place filled in by the app always stands after a colon or in parentheses, in the
nominative, because Polish would otherwise need it inflected ("w Bazylika Mariacka").

---

## Dla prawnika i biura rachunkowego

Fundacja VoctFoundation (KRS 0001237252) prowadzi zespół wokalny VoctEnsemble i organizuje koncerty.
Umowy z wykonawcami generuje aplikacja: wpisuje strony, numer umowy, przedmiot, program koncertu i
kwotę. Dokument jest drukowany, wykonawca wpisuje ręcznie PESEL, adres i numer rachunku, strony
podpisują papier. Aplikacja nie przechowuje PESEL-u ani numerów rachunków.

Pakiet obejmuje pięć dokumentów:

1. **Umowa o dzieło** — dla śpiewaków i instrumentalistów (artystyczne wykonanie programu koncertu).
2. **Umowa zlecenia** z dwoma załącznikami (oświadczenie do celów ZUS i PIT, potwierdzenie liczby
   godzin) — dla obsługi technicznej i organizacyjnej (nagłośnienie, światło, logistyka).
3. **Porozumienie wolontariackie** z informacją o ryzyku i kartą świadczeń — dla osób występujących
   lub pomagających bez wynagrodzenia.
4. **Rachunek** do umowy o dzieło lub zlecenia, z częścią dla biura rachunkowego.
5. **Klauzula informacyjna RODO**, dołączana do każdego z powyższych.

Firmy (osoby prowadzące działalność) wystawiają fakturę i nie dostają umowy z aplikacji.

Prosimy o poprawki w tekście oraz odpowiedź na pytania w sekcji „Do weryfikacji” pod każdym
dokumentem. Zależy nam szczególnie na:

- kwalifikacji umowy o dzieło dla chórzystów (ryzyko przekwalifikowania przez ZUS),
- zastosowaniu 50% kosztów uzyskania przychodu,
- wykonawcach, którzy nie są polskimi rezydentami podatkowymi (dyrygent i część śpiewaków pochodzą
  z Francji),
- wykonawcach niepełnoletnich.

---

## Blok stron (wspólny dla dokumentów 1–4)

> **Fundacja VoctFoundation** z siedzibą w Krakowie, ul. Św. Filipa 23/3, 31-150 Kraków, wpisana do
> Krajowego Rejestru Sądowego pod numerem KRS 0001237252, NIP 6762718992, REGON 544621525,
> reprezentowana przez: {{imię i nazwisko}} – {{funkcja}},
> zwana dalej „{{Zamawiającym | Zleceniodawcą | Korzystającym}}”,
>
> a
>
> **{{imię i nazwisko}}**, PESEL …………………………, zamieszkały/-a: ……………………………………………………………,
> numer rachunku bankowego: ……………………………………………………… *(nie dotyczy porozumienia wolontariackiego)*,
> zwany/-a dalej „{{Wykonawcą | Zleceniobiorcą | Wolontariuszem}}”.

Reprezentacja wynika z § 13 ust. 2 lit. a statutu. Prezes i obaj Wiceprezesi podpisują samodzielnie.
Domyślnie Fundację reprezentuje **Florentyn de Bazelaire de Boucheporn – Prezes Zarządu**.

Gdy stroną umowy jest on sam (jest także dyrygentem), aplikacja wpisuje kolejną osobę:

- Anna Marcisz – Wiceprezes Zarządu,
- a jeśli to ona jest stroną — Krystian Bugalski – Wiceprezes Zarządu.

Wynika to z § 8 ust. 5 statutu (konflikt interesów). Imię i nazwisko stoi w mianowniku po
dwukropku, więc nie trzeba go odmieniać.

**Do weryfikacji:** czy umowa, w której członek zarządu jest wykonawcą, a fundację reprezentuje inny
członek zarządu, wymaga dodatkowo uchwały zarządu? Czy w umowach pisać nazwisko Prezesa tak jak w
KRS („De Bazelaire De Boucheporn”), czy według francuskiej konwencji („de Bazelaire de
Boucheporn”)?

---

## 1. Umowa o dzieło

**UMOWA O DZIEŁO nr {{UoD/n/rrrr}}**
zawarta w Krakowie w dniu ……………………… r.

*(blok stron)*

**§ 1. Przedmiot umowy**

1. Zamawiający zamawia, a Wykonawca zobowiązuje się wykonać dzieło w postaci artystycznego
   wykonania {{partii wokalnej (głos: {{głos}}) | partii instrumentalnej (instrument: {{instrument}})
   | (rola: {{rola}})}} utworów tworzących program koncertu „{{tytuł koncertu}}”, który odbędzie się
   w dniu {{data}} r. w miejscu: {{nazwa i adres miejsca}} (dalej: „Koncert”).
2. Utwory objęte artystycznym wykonaniem określa program Koncertu, stanowiący Załącznik nr 1.
3. Wykonanie dzieła obejmuje przygotowanie partii oraz udział w próbach wyznaczonych przez
   Zamawiającego, w zakresie niezbędnym do artystycznego wykonania utworów podczas Koncertu.
4. Wykonawca wykona dzieło osobiście. Powierzenie wykonania innej osobie wymaga uprzedniej zgody
   Zamawiającego, wyrażonej co najmniej w formie dokumentowej.

**§ 2. Odbiór dzieła**

1. Dzieło uważa się za wykonane i odebrane z chwilą zakończenia Koncertu, jeżeli w terminie 7 dni od
   tej chwili Zamawiający nie zgłosi na piśmie zastrzeżeń co do jego wykonania.
2. Jeżeli Koncert nie odbędzie się z przyczyn, za które żadna ze Stron nie ponosi odpowiedzialności,
   umowa wygasa, a Wykonawcy nie przysługuje wynagrodzenie.
3. Jeżeli Koncert nie odbędzie się z przyczyn dotyczących Zamawiającego, a Wykonawca był gotów
   wykonać dzieło, zastosowanie ma art. 639 Kodeksu cywilnego.

**§ 3. Prawa do artystycznego wykonania i wizerunek**

1. Z chwilą wykonania dzieła Wykonawca przenosi na Zamawiającego, w ramach wynagrodzenia
   określonego w § 4, prawa do artystycznego wykonania, o których mowa w art. 85 i 86 ustawy z dnia
   4 lutego 1994 r. o prawie autorskim i prawach pokrewnych, a w zakresie, w jakim wykonanie
   stanowiłoby utwór — autorskie prawa majątkowe, na następujących polach eksploatacji:
   a) utrwalanie wykonania techniką dźwiękową, wizualną i audiowizualną oraz zwielokrotnianie tych
      utrwaleń każdą techniką, w tym cyfrową;
   b) wprowadzanie do obrotu, użyczanie i najem egzemplarzy, na których wykonanie utrwalono;
   c) nadawanie i reemitowanie, w tym za pośrednictwem sieci telewizyjnych, radiowych i
      internetowych;
   d) publiczne udostępnianie wykonania w taki sposób, aby każdy mógł mieć do niego dostęp w miejscu
      i w czasie przez siebie wybranym, w szczególności w internecie, w serwisach strumieniowych i w
      mediach społecznościowych;
   e) publiczne odtwarzanie.
2. Przeniesienie praw nie jest ograniczone terytorialnie ani czasowo.
3. Wykonawca zezwala Zamawiającemu na nieodpłatne rozpowszechnianie swojego wizerunku, utrwalonego
   w związku z Koncertem i próbami, wraz z imieniem i nazwiskiem, w materiałach dokumentujących i
   promujących działalność statutową Zamawiającego.

**§ 4. Wynagrodzenie**

1. Za wykonanie dzieła i przeniesienie praw, o których mowa w § 3, Zamawiający zapłaci Wykonawcy
   wynagrodzenie w łącznej kwocie **{{kwota}} zł brutto** (słownie: {{kwota słownie}}).
2. Strony ustalają, że całość wynagrodzenia stanowi wynagrodzenie z tytułu rozporządzenia przez
   Wykonawcę prawami do artystycznego wykonania, o którym mowa w § 3 ust. 1.
3. Wynagrodzenie zostanie wypłacone przelewem na rachunek bankowy Wykonawcy wskazany w umowie, w
   terminie 14 dni od dnia odbioru dzieła, na podstawie rachunku wystawionego przez Wykonawcę.
4. Zamawiający, jako płatnik, pobierze od wynagrodzenia zaliczkę na podatek dochodowy zgodnie z
   obowiązującymi przepisami.

**§ 5. Dane osobowe**

Zasady przetwarzania danych osobowych Wykonawcy określa klauzula informacyjna stanowiąca
Załącznik nr 2.

**§ 6. Postanowienia końcowe**

1. Zmiany umowy wymagają formy pisemnej pod rygorem nieważności.
2. W sprawach nieuregulowanych stosuje się przepisy Kodeksu cywilnego oraz ustawy o prawie
   autorskim i prawach pokrewnych.
3. Spory wynikające z umowy rozstrzyga sąd właściwy dla siedziby Zamawiającego.
4. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron.

| Zamawiający | Wykonawca |
|---|---|
| ………………………………… | ………………………………… |

**Załącznik nr 1 — Program Koncertu**
Koncert „{{tytuł koncertu}}”, {{data}} r. Utwory w kolejności wykonania:
{{lista numerowana: kompozytor — tytuł; bis oznaczony „(bis)”. Gdy programu nie ma jeszcze w
aplikacji — puste numerowane linie do wpisania ręcznie}}

**Załącznik nr 2 — Klauzula informacyjna** (dokument 5)

**Do weryfikacji**

- **Kwalifikacja.** Czy artystyczne wykonanie programu koncertu przez chórzystę może być przedmiotem
  umowy o dzieło? Orzecznictwo i praktyka ZUS są niejednolite, a ryzyko to przekwalifikowanie na
  zlecenie ze składkami wstecz. Czy załącznik z programem wystarcza do zindywidualizowania dzieła,
  czy należy dodać terminy prób? Mogą one z kolei upodabniać umowę do starannego działania.
- **50% KUP.** Czy konstrukcja § 4 ust. 2 (całość wynagrodzenia za rozporządzenie prawami pokrewnymi)
  jest akceptowalna, czy trzeba wyodrębnić część wynagrodzenia? Czy biuro stosuje próg
  zryczałtowanego podatku dla umów do 200 zł?
- **RUD.** Kto zgłasza umowę do ZUS (formularz RUD, 7 dni od zawarcia) — biuro czy fundacja?
- **Nierezydenci.** Wykonawca, który nie jest polskim rezydentem podatkowym (np. mieszka we Francji):
  zryczałtowany podatek, certyfikat rezydencji, właściwe postanowienia umowy o unikaniu podwójnego
  opodatkowania (artyści są zwykle opodatkowani w państwie występu). Czy potrzebny jest osobny wariant
  umowy?
- **Niepełnoletni.** Czy wzór wymaga wariantu z podpisem przedstawiciela ustawowego?
- **§ 2 ust. 2–3** (odwołanie koncertu) oraz **§ 6 ust. 3** (sąd właściwy) — czy zostają?
- **§ 3 ust. 3** — obecny wzór mówił o zgodzie „nieodwołalnej”. Tu zamiast tego jest zezwolenie
  umowne z art. 81 pr. aut., związane z Koncertem. Czy taka forma jest właściwa?
- **Wariant „(rola: …)”** — drukuje się dla dyrygenta oraz dla osób z ekipy rozliczanych umową o
  dzieło (np. fotograf, projekcje wizualne). Dla dyrygenta „artystyczne wykonanie” pasuje; dla
  fotografa czy autora projekcji dziełem jest utwór (zdjęcia, projekt), a nie wykonanie. Czy potrzebny
  jest osobny wariant § 1 i § 3 dla takiego dzieła?

---

## 2. Umowa zlecenia

**UMOWA ZLECENIA nr {{UZ/n/rrrr}}**
zawarta w Krakowie w dniu ……………………… r.

*(blok stron)*

**§ 1. Przedmiot umowy**

1. Zleceniodawca zleca, a Zleceniobiorca przyjmuje do wykonania czynności: **{{rola}}** (dalej:
   „Zlecenie”), w związku z koncertem „{{tytuł koncertu}}”, który odbędzie się w dniu {{data}} r. w
   miejscu: {{nazwa i adres miejsca}} (dalej: „Koncert”).
2. Zlecenie obejmuje czynności przygotowawcze, obsługę prób technicznych i Koncertu oraz czynności
   po jego zakończeniu, w terminach uzgodnionych przez Strony.
3. Zleceniobiorca wykona Zlecenie z należytą starannością i osobiście. Powierzenie wykonania osobie
   trzeciej wymaga zgody Zleceniodawcy, wyrażonej co najmniej w formie dokumentowej.
4. Zleceniodawca przekaże Zleceniobiorcy informacje niezbędne do wykonania Zlecenia, w tym
   harmonogram dnia Koncertu.

**§ 2. Wynagrodzenie**

1. Za wykonanie Zlecenia Zleceniobiorcy przysługuje wynagrodzenie w łącznej kwocie **{{kwota}} zł
   brutto** (słownie: {{kwota słownie}}).
2. Strony oświadczają, że wynagrodzenie, przy przewidywanej liczbie godzin wykonywania Zlecenia, nie
   jest niższe od minimalnej stawki godzinowej ustalonej na podstawie ustawy z dnia 10 października
   2002 r. o minimalnym wynagrodzeniu za pracę.
3. Zleceniobiorca potwierdza liczbę godzin wykonywania Zlecenia w formie pisemnej lub dokumentowej,
   według wzoru stanowiącego Załącznik nr 2, najpóźniej w dniu przedstawienia rachunku.
4. Wynagrodzenie zostanie wypłacone przelewem na rachunek bankowy Zleceniobiorcy wskazany w umowie,
   w terminie 14 dni od dnia wykonania Zlecenia, na podstawie rachunku oraz potwierdzenia liczby
   godzin.
5. Zleceniodawca, jako płatnik, pobierze od wynagrodzenia zaliczkę na podatek dochodowy oraz obliczy
   i odprowadzi składki, jeżeli obowiązek ich opłacania powstanie. Podstawą jest oświadczenie
   Zleceniobiorcy stanowiące Załącznik nr 1.

**§ 3. Rezultaty i wizerunek**

1. Materiały i utrwalenia powstałe przy wykonywaniu Zlecenia, w szczególności nagrania i zapisy
   konfiguracji, przysługują Zleceniodawcy. W zakresie, w jakim powstanie utwór lub przedmiot praw
   pokrewnych, Zleceniobiorca przenosi na Zleceniodawcę, w ramach wynagrodzenia określonego w § 2,
   prawa do nich na polach eksploatacji obejmujących utrwalanie, zwielokrotnianie każdą techniką,
   wprowadzanie do obrotu, nadawanie, publiczne odtwarzanie oraz publiczne udostępnianie w sieci.
2. Zleceniobiorca zezwala Zleceniodawcy na nieodpłatne rozpowszechnianie swojego wizerunku,
   utrwalonego w związku z Koncertem, w materiałach dokumentujących i promujących działalność
   statutową Zleceniodawcy.

**§ 4. Rozwiązanie umowy**

Każda ze Stron może wypowiedzieć umowę na zasadach określonych w art. 746 Kodeksu cywilnego.

**§ 5. Dane osobowe**

Zasady przetwarzania danych osobowych Zleceniobiorcy określa klauzula informacyjna stanowiąca
Załącznik nr 3.

**§ 6. Postanowienia końcowe**

1. Zmiany umowy wymagają formy pisemnej pod rygorem nieważności.
2. W sprawach nieuregulowanych stosuje się przepisy Kodeksu cywilnego.
3. Spory wynikające z umowy rozstrzyga sąd właściwy dla siedziby Zleceniodawcy.
4. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron.

| Zleceniodawca | Zleceniobiorca |
|---|---|
| ………………………………… | ………………………………… |

**Załącznik nr 1 — Oświadczenie Zleceniobiorcy do celów ubezpieczeń i podatku**

Zleceniobiorca: {{imię i nazwisko}}

1. Oświadczam, że *(zaznaczyć właściwe)*:
   - ☐ jestem uczniem szkoły ponadpodstawowej lub studentem i nie ukończyłem/-am 26 lat
     (szkoła/uczelnia: ………………………, nr legitymacji: ………………);
   - ☐ jestem zatrudniony/-a na podstawie umowy o pracę u innego pracodawcy, a moje wynagrodzenie w
     miesiącu wykonywania Zlecenia wynosi co najmniej minimalne wynagrodzenie za pracę;
   - ☐ prowadzę pozarolniczą działalność gospodarczą i opłacam z tego tytułu składki na
     ubezpieczenia społeczne;
   - ☐ wykonuję inną umowę zlecenia, zawartą wcześniej, z której podstawa wymiaru składek wynosi co
     najmniej minimalne wynagrodzenie za pracę;
   - ☐ mam ustalone prawo do emerytury lub renty (nr decyzji: ………………);
   - ☐ żadna z powyższych sytuacji mnie nie dotyczy.
2. ☐ Wnoszę o objęcie mnie dobrowolnym ubezpieczeniem chorobowym.
3. ☐ Nie ukończyłem/-am 26 lat i korzystam ze zwolnienia z podatku dochodowego przewidzianego dla
   osób do 26. roku życia.
4. Zobowiązuję się niezwłocznie poinformować Zleceniodawcę o każdej zmianie danych zawartych w
   oświadczeniu.

Data: ……………… Podpis Zleceniobiorcy: ………………………

**Załącznik nr 2 — Potwierdzenie liczby godzin wykonywania Zlecenia**

Zleceniobiorca: {{imię i nazwisko}}. Koncert „{{tytuł koncertu}}”, {{data}} r.

| Data | Liczba godzin | Czynności |
|---|---|---|
| … | … | … |
| **Łącznie** | … | |

Data: ……………… Podpis Zleceniobiorcy: ………………………

**Załącznik nr 3 — Klauzula informacyjna** (dokument 5)

**Do weryfikacji**

- **Zbieg tytułów do ubezpieczeń** — stan prawny na 2026 r. (zapowiadane zmiany w oskładkowaniu
  umów zlecenia). Czy lista w Załączniku nr 1 jest kompletna i aktualna?
- **Minimalna stawka godzinowa** — czy § 2 ust. 2–3 i Załącznik nr 2 spełniają wymogi ustawy?
  Aplikacja zapisze potwierdzone godziny i ostrzeże, gdy kwota podzielona przez godziny spadnie
  poniżej stawki.
- **§ 3 ust. 1** — czy przeniesienie praw w umowie zlecenia jest tu potrzebne (realizator nagrywa
  koncert)?
- Czy przy zleceniu do 200 zł biuro stosuje podatek zryczałtowany i czy wzór coś tu zmienia?

---

## 3. Porozumienie wolontariackie

**POROZUMIENIE O WYKONYWANIU ŚWIADCZEŃ WOLONTARIUSZA nr {{W/n/rrrr}}**
zawarte w Krakowie w dniu ……………………… r. na podstawie art. 44 ustawy z dnia 24 kwietnia 2003 r. o
działalności pożytku publicznego i o wolontariacie

*(blok stron — bez PESEL-u i numeru rachunku)*

**§ 1. Zakres, sposób i czas wykonywania świadczeń**

1. Wolontariusz dobrowolnie i bez wynagrodzenia wykona na rzecz Korzystającego świadczenia
   polegające na {{artystycznym wykonaniu partii wokalnej (głos: {{głos}}) | artystycznym wykonaniu
   partii instrumentalnej (instrument: {{instrument}}) | czynnościach (rola: {{rola}})}} w ramach
   koncertu „{{tytuł koncertu}}” w dniu {{data}} r. w miejscu: {{nazwa i adres miejsca}} (dalej:
   „Koncert”), wraz z udziałem w próbach.
2. Świadczenia będą wykonywane w okresie od {{data pierwszej próby}} do {{data koncertu}}, w
   terminach określonych w harmonogramie prób i Koncertu.

**§ 2. Obowiązki Korzystającego**

Korzystający:
1. poinformował Wolontariusza o ryzyku dla zdrowia i bezpieczeństwa związanym z wykonywanymi
   świadczeniami oraz o zasadach ochrony przed zagrożeniami (Załącznik nr 1);
2. zapewnia Wolontariuszowi bezpieczne i higieniczne warunki wykonywania świadczeń;
3. pokrywa, na zasadach dotyczących pracowników, koszty podróży służbowych i diet, chyba że
   Wolontariusz zwolni go z tego obowiązku w § 4;
4. {{jeżeli okres z § 1 ust. 2 nie przekracza 30 dni:}} zapewnia Wolontariuszowi ubezpieczenie od
   następstw nieszczęśliwych wypadków;
5. wyda, na wniosek Wolontariusza, pisemne zaświadczenie o wykonaniu świadczeń, a na jego wniosek
   także opinię o ich wykonaniu.

**§ 3. Obowiązki Wolontariusza**

Wolontariusz wykona świadczenia osobiście i z należytą starannością, zgodnie z harmonogramem. Będzie
też odnotowywał czas ich wykonywania w karcie świadczeń (Załącznik nr 2).

**§ 4. Koszty**

- ☐ Wolontariusz zwalnia Korzystającego z obowiązku pokrycia kosztów podróży służbowych i diet.
- ☐ Wolontariusz nie zwalnia Korzystającego z tego obowiązku.

**§ 5. Prawa do wykonania i wizerunek**

1. W zakresie, w jakim świadczenia obejmują artystyczne wykonanie, Wolontariusz nieodpłatnie
   przenosi na Korzystającego prawa do artystycznego wykonania, o których mowa w art. 85 i 86 ustawy
   z dnia 4 lutego 1994 r. o prawie autorskim i prawach pokrewnych, na następujących polach
   eksploatacji: *(lit. a–e jak w § 3 ust. 1 umowy o dzieło, wypisane w całości — wolontariusz nie
   podpisuje umowy o dzieło, więc odesłanie do niej byłoby odesłaniem donikąd)*.
2. Wolontariusz zezwala Korzystającemu na nieodpłatne rozpowszechnianie swojego wizerunku,
   utrwalonego w związku z Koncertem i próbami, w materiałach dokumentujących i promujących
   działalność statutową Korzystającego.

**§ 6. Wycena świadczeń**

Na potrzeby wykazania wkładu osobowego w rozliczeniach projektu Strony ustalają wartość świadczeń
Wolontariusza na {{stawka}} zł za godzinę. Ustalenie to nie stanowi wynagrodzenia.

**§ 7. Rozwiązanie porozumienia**

Każda ze Stron może rozwiązać porozumienie za 3-dniowym uprzedzeniem, a z ważnych przyczyn — ze
skutkiem natychmiastowym.

**§ 8. Dane osobowe i postanowienia końcowe**

Zasady przetwarzania danych osobowych określa Załącznik nr 3. W sprawach nieuregulowanych stosuje
się przepisy ustawy o działalności pożytku publicznego i o wolontariacie oraz Kodeksu cywilnego.
Porozumienie sporządzono w dwóch jednobrzmiących egzemplarzach.

| Korzystający | Wolontariusz |
|---|---|
| ………………………………… | ………………………………… |

**Załącznik nr 1 — Informacja o ryzyku dla zdrowia i bezpieczeństwa**

Świadczenia wykonywane są w salach prób, kościołach i salach koncertowych. Występują następujące
ryzyka:

- obciążenie aparatu głosowego;
- długotrwałe stanie;
- poruszanie się po podestach i schodach scenicznych;
- przewody i sprzęt nagłośnieniowy na podłodze;
- intensywne oświetlenie sceniczne;
- niska temperatura w nieogrzewanych wnętrzach sakralnych.

Zasady ochrony:

- stosowanie się do poleceń kierownika produkcji;
- korzystanie wyłącznie z wyznaczonych dróg przejścia;
- zgłaszanie złego samopoczucia;
- odpowiedni ubiór.

Potwierdzam zapoznanie się z informacją: ………………………

**Załącznik nr 2 — Karta świadczeń wolontariusza** (data | godziny | czynności | łącznie | podpis)

**Załącznik nr 3 — Klauzula informacyjna** (dokument 5)

**Do weryfikacji**

- **Ubezpieczenie NNW** przy porozumieniu do 30 dni — czy fundacja ma polisę (np. bezimienną)?
  Aplikacja przypomni o tym obowiązku.
- **§ 5 ust. 1** — nieodpłatne przeniesienie praw pokrewnych przez wolontariusza: czy przeniesienie,
  czy licencja?
- **§ 6** — czy stawka wyceny wkładu osobowego ma być wpisana w porozumieniu, czy tylko w
  rozliczeniu dotacji? Czy należy powołać się na stawkę rynkową za podobną pracę?
- **§ 7** — okres wypowiedzenia.
- **Załącznik nr 1** — czy informacja o ryzyku jest wystarczająca?

---

## 4. Rachunek

**RACHUNEK nr ………… do umowy nr {{numer umowy}} z dnia {{data podpisania, jeżeli zapisana w
aplikacji; inaczej ………………}}**

*(Rachunek jest dokumentem wykonawcy, nie Fundacji — bez nagłówka Fundacji.)*

Wystawca: {{imię i nazwisko}}, zamieszkały/-a: ……………………………………, PESEL: …………………………
Odbiorca: Fundacja VoctFoundation, ul. Św. Filipa 23/3, 31-150 Kraków, NIP 6762718992

Za {{wykonanie dzieła | wykonanie zlecenia}} zgodnie z umową nr {{numer umowy}} proszę o wypłatę
kwoty **{{kwota}} zł brutto** (słownie: {{kwota słownie}}) na rachunek bankowy nr
………………………………………………………

Data: ……………… Podpis wystawcy: ………………………

*Wypełnia {{Zamawiający | Zleceniodawca}} / biuro rachunkowe:*

| Kwota brutto | Koszty uzyskania przychodu | Podstawa opodatkowania | Zaliczka na PIT | Składki ZUS | Do wypłaty |
|---|---|---|---|---|---|
| {{kwota}} | | | | | |

- Sprawdzono pod względem merytorycznym: data ……… podpis ………
- Sprawdzono pod względem formalnym i rachunkowym: data ……… podpis ………
- Zatwierdzono do wypłaty: data ……… podpisy ………
- Źródło finansowania (opis dokumentu): {{opis z rozliczenia dotacji, jeżeli koszt jest do niej
  przypisany}}

**Do weryfikacji:** czy biuro chce rachunku do każdej umowy o dzieło, czy wystarczy sama umowa i
protokół odbioru? Czy układ tabeli odpowiada jego obiegowi dokumentów?

---

## 5. Klauzula informacyjna (art. 13 RODO)

1. Administratorem Pani/Pana danych osobowych jest Fundacja VoctFoundation z siedzibą w Krakowie,
   ul. Św. Filipa 23/3, 31-150 Kraków. Kontakt w sprawach danych osobowych:
   rodo@voctfoundation.com.
2. Dane przetwarzamy w celu:
   a) zawarcia i wykonania umowy lub porozumienia (art. 6 ust. 1 lit. b RODO);
   b) wypełnienia obowiązków prawnych, w szczególności podatkowych, rachunkowych i z zakresu
      ubezpieczeń społecznych (art. 6 ust. 1 lit. c RODO);
   c) rozliczenia dotacji i grantów z podmiotami finansującymi działalność Fundacji (art. 6 ust. 1
      lit. c i f RODO);
   d) ustalenia, dochodzenia lub obrony roszczeń (art. 6 ust. 1 lit. f RODO).
3. Odbiorcami danych mogą być:
   - podmiot prowadzący księgowość Fundacji,
   - bank obsługujący Fundację,
   - organy podatkowe i ZUS,
   - podmioty finansujące działalność Fundacji — w zakresie kontroli rozliczeń,
   - dostawcy usług informatycznych, z których korzysta Fundacja.
4. Dane przechowujemy przez czas wykonywania umowy, a następnie przez okres wymagany przepisami
   podatkowymi i rachunkowymi. Co do zasady jest to 5 lat, liczonych od końca roku, w którym upłynął
   termin płatności podatku lub zatwierdzono sprawozdanie finansowe. Dłużej przechowujemy dane tylko
   do upływu terminu przedawnienia roszczeń.
5. Przysługuje Pani/Panu prawo dostępu do danych, ich sprostowania, usunięcia lub ograniczenia
   przetwarzania, prawo do przenoszenia danych, prawo sprzeciwu wobec przetwarzania opartego na
   art. 6 ust. 1 lit. f RODO oraz prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych
   Osobowych.
6. Podanie danych jest warunkiem zawarcia umowy lub porozumienia. Przy umowie o dzieło i umowie
   zlecenia podanie numeru PESEL i adresu zamieszkania jest wymogiem ustawowym, wynikającym z
   obowiązków płatnika.
7. Dane nie podlegają zautomatyzowanemu podejmowaniu decyzji, w tym profilowaniu.

**Do weryfikacji:** czy dostawcy IT (serwer aplikacji, ewentualnie Google Workspace) przetwarzają
dane poza EOG? Wtedy klauzula wymaga punktu o przekazaniu danych do państwa trzeciego. Potrzebny jest
też wpis tej czynności w rejestrze czynności przetwarzania Fundacji.
