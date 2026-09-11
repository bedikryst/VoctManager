# Klauzule informacyjne RODO (art. 13/14) — do dostarczenia poza aplikacją

> **Status: PROJEKT ROBOCZY do weryfikacji przez radcę prawnego.**
> Polityka prywatności w aplikacji spełnia obowiązek informacyjny wobec osób,
> które *same* logują się do panelu. Nie obejmuje jednak dwóch sytuacji, w
> których informację trzeba dostarczyć **inną drogą**:
>
> 1. **Członek, którego dane wprowadza zarząd, ZANIM dostanie konto** (art. 14 —
>    dane nie pochodzą od osoby, której dotyczą). → klauzula w mailu z zaproszeniem.
> 2. **Współpracownik bez konta** (`Collaborator`) — nie ma dostępu do apki, więc
>    modal go nie obejmuje. → klauzula w pierwszym mailu / umowie.
> 3. **Subskrybent listy zawiadomień o koncertach** (od 2026-09) — osoba spoza
>    zespołu, która nigdy nie zobaczy panelu. → klauzula **przy samym formularzu**
>    na stronie publicznej; sekcja C poniżej mówi, gdzie ona żyje i co ją wiąże.
>
> Teksty poniżej są po polsku (A i B), bo są dostarczane polskim osobom, których dane
> dotyczą. Wyjątkiem jest C: strona publiczna mówi w trzech językach, a klauzula, którą
> ktoś akceptuje, musi być w języku, w którym czyta.

---

## A. Klauzula do maila z zaproszeniem (nowy członek zespołu)

> **Informacja o przetwarzaniu danych osobowych**
>
> Administratorem Twoich danych jest Fundacja „VoctFoundation", ul. Św. Filipa
> 23/3, 31-150 Kraków (KRS 0001237252). W sprawach danych osobowych pisz na:
> rodo@voctensemble.com.
>
> Twoje dane (imię, nazwisko, adres e-mail, telefon) otrzymaliśmy w związku z
> nawiązaniem współpracy artystycznej z zespołem VoctEnsemble i wprowadziliśmy je
> do panelu VoctManager, abyś mógł/mogła aktywować konto. Przetwarzamy je w celu
> organizacji pracy zespołu i realizacji współpracy — na podstawie art. 6 ust. 1
> lit. b lub f RODO. Pełne informacje (cele, odbiorcy, okresy przechowywania,
> Twoje prawa, w tym prawo sprzeciwu i skargi do Prezesa UODO) znajdziesz w
> Polityce Prywatności dostępnej pod adresem: https://[domena]/legal/privacy
>
> Podanie danych jest dobrowolne, ale niezbędne do korzystania z panelu i
> uczestnictwa w projektach zespołu.

---

## B. Klauzula dla współpracownika bez konta (`Collaborator`)

> **Informacja o przetwarzaniu danych osobowych**
>
> Administratorem Twoich danych jest Fundacja „VoctFoundation", ul. Św. Filipa
> 23/3, 31-150 Kraków (KRS 0001237252); kontakt: rodo@voctensemble.com.
>
> Przetwarzamy Twoje dane kontaktowe (imię, nazwisko, e-mail, telefon) wyłącznie
> w celu koordynacji współpracy przy produkcjach zespołu VoctEnsemble — na
> podstawie naszego prawnie uzasadnionego interesu (art. 6 ust. 1 lit. f RODO).
> Dane przechowujemy przez czas współpracy i nie udostępniamy ich podmiotom
> trzecim poza dostawcami niezbędnymi do jej prowadzenia. Masz prawo dostępu do
> danych, ich sprostowania, usunięcia, ograniczenia i wniesienia sprzeciwu, a
> także skargi do Prezesa UODO. W sprawach danych pisz na: rodo@voctensemble.com.

### Uwaga do modelu `Collaborator`

Trzymanie listy współpracowników **w aplikacji jest bezpieczniejsze** niż w
prywatnym notatniku mailowym (kontrola dostępu, możliwość usunięcia, brak
rozproszenia). Przeniesienie danych „do notatnika" **nie zwalnia** z obowiązku
informacyjnego — RODO nie zależy od nośnika. Dla małej listy osób, z którymi masz
bezpośredni kontakt, obowiązek realizuje **jedno powyższe zdanie w pierwszym
mailu/umowie**. Dodatkowo art. 14 ust. 5 lit. b (niewspółmierny wysiłek) może ten
obowiązek ograniczać — do oceny przez prawnika.

---

## C. Klauzula przy zapisie na listę zawiadomień o koncertach

**Tekstu nie ma w tym pliku i nie powinno tu trafić.** Klauzula jest czytana na ekranie,
w trzech językach, więc jej jedynym domem jest kod strony:

- **Treść (PL / EN / FR):** `web/src/i18n/content/nuntius.ts`, pole `form.consentHtml`.
  Świadomie jest to *chrome*, a nie tekst z copy desku: pole z desku ma fallback per pole,
  więc angielski czytelnik zobaczyłby polską klauzulę, a baza zapisałaby wersję zgody tak,
  jakby ją przeczytał. To jedyny fallback na tej stronie, który czyniłby zapis nieprawdziwym.
- **Numer wersji:** `backend/outreach/consent.py` → `NOTICE_CLAUSE_VERSION`. Jest własnością
  serwera (formularz go nie przysyła), a przy każdym potwierdzeniu ląduje w wierszu zgody
  i w logu `NoticeConsentEvent`.
- **Pełny opis przetwarzania:** § 3, 4, 5, 6 i 7 polityki prywatności
  (`web/src/content/pages/polityka-prywatnosci.yaml`), do której klauzula linkuje.

**Zmiana tego, co klauzula OBIECUJE** — cel, częstotliwość („jeden list na jeden wieczór"),
administrator, sposób wycofania zgody — to jedna zmiana w trzech miejscach naraz: tekst,
`NOTICE_CLAUSE_VERSION` i nowa wersja polityki prywatności z wpisem w jej historii. Poprawka
literówki albo tłumaczenia, które mówi to samo, wersji NIE podbija: numer, który zmienia się
bez zmiany znaczenia, czyni historię zgód nieczytelną.

**Obowiązek z art. 13 jest wykonany przy formularzu**, a nie mailem — dane pochodzą od samej
osoby i w chwili ich podania widzi ona administratora, cel, podstawę, sposób wycofania zgody
i link do pełnej polityki. Wiadomość potwierdzająca powtarza administratora i ten link
(`backend/outreach/copy.py`), bo jest to jedyny dokument, który zostaje w skrzynce.

---

## Gdzie to wpiąć w aplikacji (opcjonalnie, do rozważenia)

- Klauzulę **A** można dodać na stałe do szablonu maila z zaproszeniem
  (`notifications` / e-mail aktywacyjny) — wtedy dostarcza się automatycznie.
- Link `https://[domena]/legal/privacy` to publiczna, drukowalna strona dodana
  2026-07-09 (trasa `/legal/:type`). Podmień `[domena]` na produkcyjną.
