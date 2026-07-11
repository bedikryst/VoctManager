# Rejestr czynności przetwarzania (RoPA) — VoctManager

> **Status: PROJEKT ROBOCZY do weryfikacji przez radcę prawnego.** Nie jest to
> gotowy dokument prawny. Zawartość wyprowadzona z faktycznego kodu aplikacji
> (stan: 2026-07-10). Kolumny „Podstawa prawna" i „Retencja" wymagają
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

### 6. Powiadomienia (e-mail, push mobilny i web)
- **Kategorie danych:** e-mail; tokeny urządzeń push (`registration_token`, `p256dh_key`, `auth_key`); preferencje kanałów; treść/metadane powiadomień. (`notifications.Notification`, `PushDevice`, `NotificationPreference`)
- **Cel:** dostarczanie powiadomień o wydarzeniach, wiadomościach, przypomnieniach.
- **Podstawa prawna:** art. 6 ust. 1 lit. f; dla push — zgoda (subskrypcja urządzenia).
- **Odbiorcy/podprocesorzy:** **Resend** (e-mail), **Google Firebase Cloud Messaging** (push mobilny). Web push obsługiwany samodzielnie (VAPID), ale doręczenie idzie przez usługę push przeglądarki (Google/Mozilla/Apple), która widzi endpoint i metadane doręczeń.
- **Retencja:** token do momentu wyrejestrowania urządzenia; powiadomienia zgodnie z polityką aplikacji.
- **Transfer poza EOG:** TAK — Resend, Google FCM (USA). Mechanizm: DPF / SCC.

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

### 11. Osadzony odtwarzacz Spotify (opcjonalny) — **REKOMENDACJA: USUNĄĆ**
- **Kategorie danych:** adres IP i dane techniczne przekazywane do Spotify po aktywnej zgodzie.
- **Cel:** referencyjny podgląd playlisty.
- **Podstawa prawna:** zgoda.
- **Status Spotify:** ODRĘBNY ADMINISTRATOR (nie podprocesor).
- **Transfer poza EOG:** TAK — Spotify (USA).
- **Rekomendacja:** zastąpić osadzenie zwykłym linkiem → eliminuje zgodę, ujawnienie odrębnego administratora i transfer USA przy zerowej stracie funkcjonalnej.

### 12. Monitorowanie błędów (Sentry) — **NIEAKTYWNE**
- Kod integracji istnieje (`config/settings.py`), ale uruchamia się dopiero po ustawieniu `SENTRY_DSN`. Obecnie wyłączone → nie ujmowane jako czynność.
- **Przed włączeniem:** dodać jako podprocesora (USA), zaktualizować politykę prywatności i sekcję transferów. NIE włączać bez uprzedniego ujawnienia.
