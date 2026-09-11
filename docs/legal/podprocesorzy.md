# Lista podprocesorów i status umów powierzenia (art. 28 RODO)

> **Status: PROJEKT ROBOCZY.** Zestawienie dostawców, którzy przetwarzają dane
> osobowe na zlecenie Fundacji, wyprowadzone z kodu (stan: 2026-09-05).
> Dla każdego potrzebna zawarta **umowa powierzenia przetwarzania (DPA)**.
> Zadaniem administratora jest ją *zawrzeć/zaakceptować i zachować kopię* — nie
> negocjować od zera. Większość dostawców udostępnia gotowe DPA.

## Jak działają DPA u dostawców

DPA występuje w trzech formach:
1. **Wbudowane w regulamin** — akceptujesz je, korzystając z usługi (typowe dla Google). Wystarczy potwierdzić, że zaakceptowano aktualne warunki i zachować odnośnik.
2. **Klik / akceptacja w panelu** — przełącznik „accept DPA" w ustawieniach konta.
3. **Gotowy PDF do pobrania / kontrasygnaty** — pobierasz, podpisujesz (elektronicznie), archiwizujesz.

---

## Podprocesorzy (przetwarzają dane NA ZLECENIE Fundacji)

| Dostawca | Zakres | Dane osobowe | DPA — jak uzyskać | Transfer USA |
|---|---|---|---|---|
| **DigitalOcean** (USA) | Serwery aplikacji i bazy | wszystkie dane w bazie | **Nie ma czego podpisywać.** Ich DPA to addendum do Customer Terms of Service, wiążące z chwilą akceptacji regulaminu; SCC włączone do niego przez odesłanie. Obowiązkiem Fundacji jest *udokumentować, że obowiązuje*: datowane kopie [DPA](https://www.digitalocean.com/legal/data-processing-agreement) i [listy podprocesorów](https://www.digitalocean.com/trust/subprocessors) w archiwum. **Warunek, bez którego to nie działa:** profil rozliczeniowy konta musi wskazywać Fundację (nazwa, adres, NIP) — DPA wiąże tego, kto zaakceptował regulamin, więc konto na prywatnym adresie oznacza umowę zawartą przez osobę prywatną, nie przez administratora danych. | Serwer w **regionie Frankfurt** — dane spoczywają w UE. Transfer mimo to TAK, bo podmiot jest amerykański; mechanizm: SCC. |
| **EmailLabs / Vercom S.A.** (PL) | Wysyłka e-maili transakcyjnych **oraz zawiadomień o koncertach** — dostawca docelowy, zastępuje Resend | e-mail odbiorcy, treść powiadomień. Także adresy osób spoza zespołu — subskrybentów listy zawiadomień; to odrębna kategoria podmiotów danych, nie tylko inny typ wiadomości. | Samoobsługowo w panelu: **Konto → RODO → „+" → Karta Powierzenia Danych** (NIE Podpowierzenia — Fundacja jest administratorem własnej bazy). Potwierdzenie kodem SMS zamiast podpisu; PDF przychodzi mailem i zostaje na liście do pobrania. Zarchiwizować. | NIE — spółka polska, serwerownie Poznań i Berlin |
| **Resend** (USA) | jw. — dostawca **wycofywany**; wpis znika po przełączeniu i tygodniu obserwacji | jw. | DPA dostępne (resend.com — sekcja legal/DPA). | TAK — SCC / DPF |
| **Google Maps Platform** | Mapy w logistyce | dane lokalizacji (obiekty, nie osoby) | Google Cloud Data Processing Terms — wbudowane w akceptację warunków Google. Zweryfikować akceptację. | TAK — DPF |
| **Anthropic** | Analiza AI zawartości nut | treść nut (utwory; nie PII członków) | DPA w ramach Commercial Terms / na żądanie. API komercyjne NIE trenuje na danych; dostępne opcje zerowej retencji (ZDR). | TAK — SCC |
| **Axepta BNP Paribas** (jeśli darowizny aktywne) | Bramka płatnicza | e-mail darczyńcy, dane transakcji | Umowa z bankiem obejmuje powierzenie + zgodność PCI-DSS. | UE — do zweryfikowania |

## Odrębni administratorzy (NIE podprocesorzy — nie potrzebują DPA, ale wymagają ujawnienia)

| Podmiot | Kiedy | Uwaga |
|---|---|---|
| **Spotify** | osadzony odtwarzacz po zgodzie użytkownika | Spotify przetwarza jako własny administrator wg swojej polityki. **REKOMENDACJA: usunąć osadzenie, zostawić link** → znika transfer USA, zgoda i obowiązek ujawnienia. |
| Usługi push przeglądarki (Google/Mozilla/Apple) | doręczanie web push (VAPID) | widzą endpoint i metadane doręczeń; payload szyfrowany po stronie aplikacji. **Jedyny kanał push, jaki system ma** — panel jest PWA, więc każda subskrypcja należy do przeglądarki. |

## Do zrobienia (checklist)

- [ ] DigitalOcean: uzupełnić profil rozliczeniowy danymi Fundacji (nazwa, adres, NIP) — bez tego stroną umowy jest osoba prywatna. Pobrać datowane kopie DPA i listy podprocesorów.
- [ ] Skrzynka właściciela konta DigitalOcean (`voctensemble@gmail.com`) to dziś jedyny klucz do serwerów Fundacji: włączyć 2FA i zapewnić dostęp co najmniej jednej innej osobie z zarządu. Zapisać, kto go ma.
- [ ] **Zawrzeć Kartę Powierzenia Danych w EmailLabs** (Konto → RODO → „+"), pobrać PDF, zarchiwizować. Warunek uruchomienia wysyłki — przez tego dostawcę idą adresy osób spoza zespołu (lista zawiadomień), a polityka prywatności ujawnia go publicznie jako podmiot przetwarzający.
- [ ] Po przełączeniu i tygodniu obserwacji: wykreślić Resend z tej tabeli, usunąć jego rekordy z DNS i klucz z `.env`.
- [ ] Gdy ruszy kanał SMS: dopisać dostawcę bramki (SMSAPI — LINK Mobility Poland sp. z o.o., grupa LINK Mobility ASA, Norwegia/EOG) i zawrzeć z nim DPA. **Numer telefonu to nowa kategoria danych** — wymaga też wpisu w `rodo-ropa.md` i w polityce prywatności.
- [ ] Zweryfikować akceptację Google Cloud Data Processing Terms (Maps).
- [ ] Zaakceptować DPA Anthropic (rozważyć opcję zerowej retencji ZDR).
- [ ] (jeśli darowizny) potwierdzić powierzenie w umowie z BNP Paribas / Axepta.
- [ ] **Decyzja: usunąć osadzenie Spotify na rzecz linku** (rekomendowane).
- [ ] Utrzymywać ten plik jako aktualny rejestr podprocesorów; aktualizować przy każdej zmianie narzędzi.

## Fundacja NIE wyznaczyła inspektora ochrony danych

Karta Powierzenia zawarta z Vercom S.A. (11.09.2026) drukuje pole kontaktowe pod nagłówkiem
„Dane kontaktowe inspektora ochrony danych". **To jest etykieta z ich szablonu, nie wyznaczenie
IOD.** Wpisana tam osoba jest kontaktem do tej umowy.

Ma to znaczenie, bo wyznaczenie IOD uruchamia obowiązek zgłoszenia go Prezesowi UODO w ciągu
14 dni i opublikowania danych kontaktowych. Obowiązek wyznaczenia (art. 37 RODO) Fundacji nie
dotyczy: nie jest organem publicznym, nie monitoruje nikogo na dużą skalę i nie przetwarza na
dużą skalę danych z art. 9. Gdyby to się kiedyś zmieniło — albo gdyby zarząd zdecydował inaczej —
zgłoszenie do UODO jest osobnym krokiem, którego ten PDF nie zastępuje.

## Zasada porządkująca

> Zmiana dostawcy **nie zmniejsza** liczby wymaganych DPA — potrzebujesz jednego na
> każdego podprocesora. Liczbę DPA zmniejsza **wyłącznie** rezygnacja z funkcji
> (usunięcie podprocesora), a nie podmiana jednego narzędzia na drugie.
