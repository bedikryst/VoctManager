# Lista podprocesorów i status umów powierzenia (art. 28 RODO)

> **Status: PROJEKT ROBOCZY.** Zestawienie dostawców, którzy przetwarzają dane
> osobowe na zlecenie Fundacji, wyprowadzone z kodu (stan: 2026-07-10).
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
| **Hosting** (DigitalOcean lub faktyczny dostawca — POTWIERDŹ) | Serwery aplikacji i bazy | wszystkie dane w bazie | DigitalOcean: DPA wbudowane w Terms + PDF do pobrania na stronie legal. Zachować kopię. | zależnie od regionu — wybrać region EOG |
| **Resend** | Wysyłka e-maili transakcyjnych | e-mail odbiorcy, treść powiadomień | DPA dostępne (resend.com — sekcja legal/DPA). Zaakceptować/pobrać. | TAK — SCC / DPF |
| **Google Firebase Cloud Messaging** | Push mobilny | token urządzenia push | Google Cloud/Firebase Data Processing Terms — wbudowane w akceptację warunków Google. Zweryfikować akceptację. | TAK — Google certyfikowany w DPF |
| **Google Maps Platform** | Mapy w logistyce | dane lokalizacji (obiekty, nie osoby) | jw. — te same warunki Google. | TAK — DPF |
| **Anthropic** | Analiza AI zawartości nut | treść nut (utwory; nie PII członków) | DPA w ramach Commercial Terms / na żądanie. API komercyjne NIE trenuje na danych; dostępne opcje zerowej retencji (ZDR). | TAK — SCC |
| **Axepta BNP Paribas** (jeśli darowizny aktywne) | Bramka płatnicza | e-mail darczyńcy, dane transakcji | Umowa z bankiem obejmuje powierzenie + zgodność PCI-DSS. | UE — do zweryfikowania |

## Odrębni administratorzy (NIE podprocesorzy — nie potrzebują DPA, ale wymagają ujawnienia)

| Podmiot | Kiedy | Uwaga |
|---|---|---|
| **Spotify** | osadzony odtwarzacz po zgodzie użytkownika | Spotify przetwarza jako własny administrator wg swojej polityki. **REKOMENDACJA: usunąć osadzenie, zostawić link** → znika transfer USA, zgoda i obowiązek ujawnienia. |
| Usługi push przeglądarki (Google/Mozilla/Apple) | doręczanie web push (VAPID) | widzą endpoint i metadane doręczeń; payload szyfrowany po stronie aplikacji. |

## Do zrobienia (checklist)

- [ ] Potwierdzić faktycznego dostawcę hostingu i pobrać jego DPA.
- [ ] Zaakceptować/pobrać DPA Resend i zarchiwizować.
- [ ] Zweryfikować akceptację Google Cloud/Firebase Data Processing Terms.
- [ ] Zaakceptować DPA Anthropic (rozważyć opcję zerowej retencji ZDR).
- [ ] (jeśli darowizny) potwierdzić powierzenie w umowie z BNP Paribas / Axepta.
- [ ] **Decyzja: usunąć osadzenie Spotify na rzecz linku** (rekomendowane).
- [ ] Utrzymywać ten plik jako aktualny rejestr podprocesorów; aktualizować przy każdej zmianie narzędzi.

## Zasada porządkująca

> Zmiana dostawcy **nie zmniejsza** liczby wymaganych DPA — potrzebujesz jednego na
> każdego podprocesora. Liczbę DPA zmniejsza **wyłącznie** rezygnacja z funkcji
> (usunięcie podprocesora), a nie podmiana jednego narzędzia na drugie.
