# Rejestr czynności przetwarzania (RoPA) — VoctManager

> **Status: PROJEKT ROBOCZY do weryfikacji przez radcę prawnego.** Nie jest to
> gotowy dokument prawny. Zawartość wyprowadzona z faktycznego kodu aplikacji
> (stan: 2026-07-10; czynność 11 — lista zawiadomień — dopisana 2026-09-05;
> dostawca wysyłki poczty zmieniony na EmailLabs / Vercom S.A. 2026-09-11).
> Kolumny „Podstawa prawna" i „Retencja" wymagają
> potwierdzenia przez prawnika — w szczególności wybór art. 6 ust. 1 lit. b vs f
> dla członków (wolontariat vs umowa).

**Administrator:** Fundacja „VoctFoundation", ul. Św. Filipa 23/3, 31-150 Kraków ·
KRS 0001237252 · NIP 6762718992 · REGON 544621525 · kontakt: rodo@voctensemble.com

**Ustalenia dot. relacji (wg developera, 2026-07-10):**
- Zarząd (m.in. autor aplikacji, dyrygent Florent) — umowy **zlecenia**, zawierane poza aplikacją.
- Śpiewacy — umowy **o dzieło** per koncert, zawierane poza aplikacją.
- Generator umów w aplikacji = wyłącznie szablon pomocniczy (imię/nazwisko → dokument); PESEL/adres uzupełniane ręcznie POZA systemem. Funkcja rozwojowa, mało dopracowana.

---

## Czynności przetwarzania

### 1. Zarządzanie kontami i tożsamością członków
- **Podmioty danych:** członkowie zespołu (śpiewacy, dyrygent, ekipa z kontem).
- **Kategorie danych:** imię, nazwisko, e-mail, telefon, zdjęcie profilowe, język, forma grzecznościowa, strefa czasowa, rola. (`core.UserProfile`, `roster.Artist`, `User`)
- **Cel:** założenie i obsługa konta, współpraca artystyczna.
- **Podstawa prawna:** art. 6 ust. 1 lit. b (wykonanie umowy) lub lit. f (uzasadniony interes) — **do potwierdzenia zależnie od statusu członka**.
- **Odbiorcy/podprocesorzy:** dostawca hostingu.
- **Retencja:** przez czas posiadania konta; po usunięciu — anonimizacja tożsamości, usunięcie profilu i zdjęcia.
- **Transfer poza EOG:** nie (hosting w EOG).

### 2. Dane wokalne i ocena artystyczna
- **Podmioty danych:** śpiewacy.
- **Kategorie danych:** typ głosu, ocena czytania a vista (1–5), skala głosu. (`roster.Artist`)
- **Cel:** dobór obsad, planowanie artystyczne.
- **Podstawa prawna:** art. 6 ust. 1 lit. f.
- **Odbiorcy:** wyłącznie zarząd/dyrygent (rola manager). **Nie widoczne dla samego artysty w aplikacji** — wykluczone nawet z widoku własnego profilu (`ArtistMeSerializer`); ujawnia je tylko `ArtistDetailedSerializer`.
- **Retencja:** czas posiadania konta.
- **Transfer poza EOG:** nie.

### 3. Logistyka sceniczna (stroje)
- **Kategorie danych:** rozmiar ubrań, rozmiar buta, wzrost. (`core.UserProfile`)
- **Cel:** zamawianie strojów koncertowych.
- **Podstawa prawna:** art. 6 ust. 1 lit. f.
- **Retencja:** czas posiadania konta.
- **Uwaga:** dane dietetyczne/alergie (art. 9) zostały ŚWIADOMIE usunięte z systemu (2026-07-09) — nie są przetwarzane.

### 4. Harmonogram, obsady i frekwencja
- **Kategorie danych:** udział w projektach, potwierdzenia (RSVP), gotowość, obecność na próbach/koncertach. (`roster.Project`, `roster.Participation`, `roster.Attendance`)
- **Cel:** organizacja prób i koncertów, rozliczanie frekwencji.
- **Podstawa prawna:** art. 6 ust. 1 lit. f.
- **Odbiorcy:** zarząd; częściowa widoczność współobsady (widok koncertu pokazuje współśpiewaków w ramach tego samego koncertu).
- **Retencja:** dane operacyjne anonimizowane/usuwane po usunięciu konta.
- **Transfer poza EOG:** nie.

### 5. Komunikacja wewnętrzna (wiadomości)
- **Kategorie danych:** treść wiadomości, znaczniki odczytu, przypisanie wątku, członkostwa w kanałach projektowych. (`messaging.Thread`, `Message`, `ThreadReadState`, `ProjectChannel`, `ChannelMembership`, `ChannelMessage`)
- **Cel:** koordynacja organizacyjna i artystyczna.
- **Podstawa prawna:** art. 6 ust. 1 lit. f.
- **Odbiorcy:** wyłącznie uczestnicy wątku/kanału; treść nie jest przekazywana zewnętrznym komunikatorom.
- **Retencja:** przy usunięciu konta treść wiadomości jest trwale zacierana (`[treść usunięta]`), wątki i członkostwa usuwane.
- **Transfer poza EOG:** nie.

### 6. Powiadomienia (e-mail i web push)
- **Kategorie danych:** e-mail; dane subskrypcji web push (`registration_token` — adres endpointu, `p256dh_key`, `auth_key`); preferencje kanałów; treść/metadane powiadomień. (`notifications.Notification`, `PushDevice`, `NotificationPreference`)
- **Cel:** dostarczanie powiadomień o wydarzeniach, wiadomościach, przypomnieniach.
- **Podstawa prawna:** art. 6 ust. 1 lit. f; dla push — zgoda (subskrypcja urządzenia).
- **Odbiorcy/podprocesorzy:** **EmailLabs / Vercom S.A.** (e-mail). Push obsługiwany samodzielnie (VAPID) — panel jest PWA, więc każda subskrypcja należy do przeglądarki; doręczenie idzie przez usługę push przeglądarki (Google/Mozilla/Apple), która widzi endpoint i metadane doręczeń, ale nie treść.
- **Retencja:** subskrypcja do momentu wyrejestrowania urządzenia lub unieważnienia jej przez usługę push; powiadomienia zgodnie z polityką aplikacji.
- **Transfer poza EOG:** NIE dla samej wysyłki — Vercom S.A. jest spółką polską, serwerownie Poznań i Berlin. Transfer pozostaje po stronie hostingu (DigitalOcean, USA — region Frankfurt, mechanizm SCC) oraz usług push przeglądarek, które są odrębnymi administratorami.

### 7. Kalendarz iCal
- **Kategorie danych:** sekretny token w URL feedu kalendarza. (`core.UserProfile.calendar_token`)
- **Cel:** subskrypcja harmonogramu w zewnętrznym kalendarzu użytkownika.
- **Podstawa prawna:** art. 6 ust. 1 lit. f.
- **Retencja:** czas posiadania konta; możliwość resetu (unieważnia stary URL).
- **Transfer poza EOG:** zależny od kalendarza użytkownika (poza kontrolą administratora — to jego wybór).

### 8. Dystrybucja i ochrona nut
- **Kategorie danych:** imię i nazwisko wtapiane w watermark serwowanego PDF; log dostępów: kto, kiedy, numer kopii, czy watermarkowane. (`archive.ScoreEdition`, `archive.ScoreAccessLog`, `archive/score_protection.py`)
- **Cel:** ochrona praw licencyjnych wydawców nut, kontrola dystrybucji.
- **Podstawa prawna:** art. 6 ust. 1 lit. f (ochrona praw i dochodzenie roszczeń).
- **Odbiorcy/podprocesorzy:** dostawca hostingu; **Anthropic** (analiza AI zawartości nut — utwory, nie dane osobowe członków).
- **Retencja:** log audytowy — do potwierdzenia okres.
- **Transfer poza EOG:** TAK — Anthropic (USA). Mechanizm: SCC. API komercyjne Anthropic nie trenuje na przekazywanych danych.

### 9. Generowanie szablonów umów
- **Kategorie danych:** imię i nazwisko (wstawiane do szablonu). PESEL/adres — POZA systemem.
- **Cel:** pomocnicze generowanie wzoru dokumentu.
- **Podstawa prawna:** art. 6 ust. 1 lit. b / f.
- **Retencja:** system nie przechowuje gotowych umów z danymi wrażliwymi (stan obecny).
- **Transfer poza EOG:** nie.

### 10. Darowizny (jeśli funkcja aktywna)
- **Podmioty danych:** darczyńcy (NIE członkowie).
- **Kategorie danych:** e-mail darczyńcy, kwota, waluta, status, identyfikator płatności bramki. (`payments.Donation`, `payments.PatronLead`)
- **Cel:** przyjęcie i rozliczenie darowizny.
- **Podstawa prawna:** art. 6 ust. 1 lit. b/c (wykonanie + obowiązki księgowo-podatkowe).
- **Odbiorcy/podprocesorzy:** **Axepta BNP Paribas** (bramka płatnicza).
- **Retencja:** ustawowe okresy przechowywania dokumentacji rozliczeniowej (rachunkowość, prawo podatkowe).
- **Transfer poza EOG:** do zweryfikowania (Axepta — UE).

### 11. Lista zawiadomień o koncertach (strona publiczna)
- **Podmioty danych:** odwiedzający witrynę, którzy sami poprosili o zawiadomienie (NIE członkowie, NIE darczyńcy).
- **Kategorie danych:** adres e-mail, język strony, znacznik czasu potwierdzenia, wersja klauzuli zgody, powierzchnia zapisu, dwa tokeny (potwierdzający i wypisujący). (`outreach.ConcertNoticeSubscription`, `outreach.NoticeConsentEvent`)
- **ŚWIADOMIE NIE ZBIERAMY:** imienia (zawiadomienie go nie potrzebuje) ani adresu IP — dowodem panowania nad skrzynką jest samo potwierdzenie double opt-in, a IP byłoby drugim identyfikatorem do obrony.
- **Cel:** wysłanie jednej wiadomości o każdym kolejnym koncercie.
- **Podstawa prawna:** art. 6 ust. 1 lit. a RODO (zgoda) + art. 10 ust. 2 UŚUDE. **Dowodem zgody jest `confirmed_at` wraz z wersją klauzuli** — inaczej niż przy `PatronLead`, gdzie wystarcza sam wiersz, bo darowiznę potwierdza transakcja. Lista powiadomień nie zostawia innego śladu, więc dowód jest zapisywany wprost. Rozdzielona odpowiedzialność: wiersz subskrypcji opisuje zgodę BIEŻĄCĄ, a `NoticeConsentEvent` to dopisywalny log każdej udzielonej i wycofanej zgody — ponowny zapis po wypisaniu resetuje wiersz i bez logu nadpisałby dowód zgody, pod którą wysłano już pocztę.
- **Odbiorcy/podprocesorzy:** **EmailLabs / Vercom S.A.** (wysyłka poczty). Poza tym nikt — adres nie opuszcza bazy w żadnym innym celu.
- **Retencja:** zapis niepotwierdzony — usuwany (twardo) po wygaśnięciu linku, tj. po 7 dniach; zgoda wycofana — dowód przechowywany 3 lata od ostatniego zdarzenia, potem twarde usunięcie. Egzekwuje to zadanie `outreach.purge_notice_records` (Celery beat, raz na dobę); okresy są tożsame z tym, co publikuje polityka prywatności (§ 7), i muszą się zmieniać razem.
- **Transfer poza EOG:** NIE — wysyłkę obsługuje Vercom S.A. (EmailLabs), spółka polska, serwerownie Poznań i Berlin. Polityka prywatności mówi to samo od wersji 1.4; wcześniejsze wersje (do 1.3) wskazywały tu Resend, Inc. i Standardowe Klauzule Umowne, więc wobec osoby, która zapisała się przed 11.09.2026, obowiązywała tamta treść.
- **Realizacja praw:** wycofanie zgody — link w każdej wiadomości (jedno kliknięcie: nagłówek `List-Unsubscribe` zgodny z RFC 8058 oraz odnośnik w treści), odpowiedź na wiadomość (nagłówek `Reply-To`) albo `rodo@voctensemble.com`; usunięcie danych (art. 17) — twarde skasowanie wiersza w panelu administracyjnym, co kasuje kaskadowo także log zgód. **Zgłoszenie wiadomości jako spam u dostawcy poczty jest traktowane jak wycofanie zgody:** webhook dostawcy przestawia wiersz na UNSUBSCRIBED i dopisuje zdarzenie WITHDRAWN, więc adresat nie musi już nic klikać.

### 12. Osadzony odtwarzacz Spotify (opcjonalny) — **REKOMENDACJA: USUNĄĆ**
- **Kategorie danych:** adres IP i dane techniczne przekazywane do Spotify po aktywnej zgodzie.
- **Cel:** referencyjny podgląd playlisty.
- **Podstawa prawna:** zgoda.
- **Status Spotify:** ODRĘBNY ADMINISTRATOR (nie podprocesor).
- **Transfer poza EOG:** TAK — Spotify (USA).
- **Rekomendacja:** zastąpić osadzenie zwykłym linkiem → eliminuje zgodę, ujawnienie odrębnego administratora i transfer USA przy zerowej stracie funkcjonalnej.

### 13. Monitorowanie błędów (Sentry) — **NIEAKTYWNE**
- Kod integracji istnieje (`config/settings.py`), ale uruchamia się dopiero po ustawieniu `SENTRY_DSN`. Obecnie wyłączone → nie ujmowane jako czynność.
- **Przed włączeniem:** dodać jako podprocesora (USA), zaktualizować politykę prywatności i sekcję transferów. NIE włączać bez uprzedniego ujawnienia.
