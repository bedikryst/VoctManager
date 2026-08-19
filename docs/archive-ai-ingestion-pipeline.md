# Archive AI Ingestion Pipeline — Architektura i przepływ danych

> Dokument opisuje AI-owy pipeline ingestii archiwum (`backend/archive`): rozpoznawanie utworu
> i kompozytora z uploadowanego PDF-a, wzbogacanie z kanonicznych źródeł, generowanie notek
> programowych i tłumaczeń, oraz cockpit recenzji dyrygenta.
> Standard: Anthropic Claude + MusicBrainz + Wikidata + Spotify + YouTube.
>
> **Uwaga nazewnicza:** to NIE jest „Score Package" — generator śpiewników koncertowych dla
> śpiewaków (`backend/roster`, moduły `score_package_*.py`) to osobna, nowsza funkcja zbudowana
> na wynikach tej ingestii. Historyczny tytuł tego pliku brzmiał „Score Package Compiler".
>
> **Stan:** zaktualizowane 2026-08-19 do pipeline'u **v2** (przepisanie 2026-06: jedno
> skonsolidowane wywołanie wzrokowe zamiast łańcucha małych) i do modeli **Sonnet 5 + Opus 5**
> (migracja 2026-08). Powody obu zmian: `archive-ai-compiler-remediation.md` (audyt 2026-06,
> ZAMKNIĘTY) i `archive-ai-model-upgrade-2026-08.md` (migracja modeli, ze zmierzonymi liczbami).
> Przy pracy nad kodem źródłem prawdy jest `backend/archive/services/ingestion.py` + `tasks.py`,
> nie ten dokument.

---

## 1. Po co to powstało?

Dyrygent profesjonalnego zespołu wokalnego traci **godziny** na każdy koncert:

1. Zbiera PDF-y partytur z różnych źródeł (IMSLP, wydawcy, własne edycje).
2. Pisze ręcznie notki programowe, tłumaczenia tekstów liturgicznych, transkrypcje IPA.
3. Skleja wszystko w jeden binder — strona tytułowa, spis treści, ciągła paginacja, materiały pomocnicze przed każdym utworem.

Ingest archiwum zdejmuje z niego punkty 1–2, a generator śpiewnika (osobna funkcja, patrz uwaga
nazewnicza wyżej) punkt 3:

```
Upload PDF-ów  →  AI czyta partyturę wzrokiem  →  Wzbogaca z kanonicznych źródeł
              →  Dyrygent weryfikuje i zatwierdza  →  Notka programowa
              →  (osobno) generator śpiewnika składa concert binder
```

**Co AI robi:** wyciąga, identyfikuje, dedupuje, generuje opisowe materiały.
**Czego AI NIE robi:** nie edytuje nut na partyturze. To jest pułapka — modyfikacja notacji w PDF wymaga MuseScore/Dorico, nie LLM-a. Każda halucynacja zmieniająca nutę zniszczy zaufanie do platformy.

---

## 2. Architektura wysokopoziomowa

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│   Drag&drop upload  →  live postęp po SSE (EventSource)                  │
│                    →  Karta utworu: edycja + weryfikacja w jednym        │
└─────────────────────────────────────────────────────────────────────────┘
                                  ↕  REST API + text/event-stream
┌─────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                     │
│                                                                          │
│   start_ingestion(ScoreEdition)   ◄── services/ingestion.py              │
│           │                                                              │
│           ▼                                                              │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │              CELERY CHAIN — Workflow A                       │       │
│   │  prepare_document → analyze_score → resolve_composer+piece   │       │
│   │   → persist_analysis → lookup_spotify → lookup_youtube       │       │
│   │   → finalize_edition                                         │       │
│   └──────────────────────────────────────────────────────────────┘       │
│           │                                                              │
│           │   generate_program_note — POZA łańcuchem, na żądanie         │
│           │   po weryfikacji tożsamości przez dyrygenta                  │
│           ▼                                                              │
│   ┌────────────────┐   ┌────────────────────┐   ┌────────────────────┐  │
│   │  Anthropic     │   │   MusicBrainz      │   │   Spotify           │  │
│   │  Claude API    │   │   Wikidata         │   │   YouTube Data API  │  │
│   │ Sonnet 5/Opus 5│   │   (canonical)      │   │   (recordings)      │  │
│   └────────────────┘   └────────────────────┘   └────────────────────┘  │
│           │                       │                       │              │
│           └───────────────────────┴───────────────────────┘              │
│                                  ▼                                       │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │  PostgreSQL — repertuar + provenance                         │       │
│   │  Redis — cache zewnętrznych API + token OAuth Spotify        │       │
│   │         + live preview / cancel flag / dzienny licznik spend │       │
│   └──────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Model danych

Lokalizacja: [backend/archive/models.py](../backend/archive/models.py)

### 3.1. Encje istniejące — rozszerzone

| Encja | Nowe pola | Po co |
|---|---|---|
| `Composer` | `mbid`, `wikidata_qid`, `nationality`, `period`, `bio`, `portrait_url`, `portrait_license`, `aliases` | Kanoniczna identyfikacja (MusicBrainz UUID) + dane z Wikidaty + fuzzy match aliasów |
| `Piece` | `mbid_work`, `opus_catalog`, `musical_key`, `text_source`, `lyrics_ipa`, `ingestion_status` | Kanoniczna identyfikacja utworu + dedup |

### 3.2. Encje nowe

| Encja | Po co | Klucze |
|---|---|---|
| `Movement` | Wielo-częściowe utwory (Magnificat ma 12 części) | `(piece, order_index)` unique |
| `ScoreEdition` | Jeden utwór = wiele PDF-ów (Bärenreiter vs IMSLP) | `(piece, is_default=True)` partial unique |
| `Translation` | Wiele tłumaczeń per utwór (en, pl, fr) | `(piece, target_language)` |
| `Recording` | Linki Spotify/YouTube — wiele per utwór | `(source, external_id)` unique |
| `Annotation` | Markup na PDF (highlights, komentarze, freehand); warstwa wspólna + prywatna per śpiewak | `(edition, page_number)` |
| `ProgramNote` | Notka programowa, canonical lub per-koncert | `(piece, project, language)` |
| `ProvenanceRecord` | Audyt: który field skąd pochodzi (GenericFK) | `(content_type, object_id, field_name)` |

### 3.3. Kluczowe decyzje projektowe

**Dlaczego `ScoreEdition` zamiast tylko `Piece.sheet_music`?**
Realnie jeden utwór ma wiele wydań — Bärenreiter, Henle, skan IMSLP, autorska aranżacja. Stary `Piece.sheet_music` (jeden FileField) zostawiamy jako legacy; nowe uploady tworzą `ScoreEdition`.

**Dlaczego `GenericForeignKey` na `ProvenanceRecord`?**
Provenance dotyczy każdego pola każdej encji (`Composer.bio`, `Piece.opus_catalog`, `Translation.text`...). Jedna tabela z GFK > siedem tabel z dedicated FK. Indeks `(content_type, object_id, field_name)` pokrywa typowy lookup.

**Dlaczego partial unique constraint `one_default_edition_per_piece`?**
Wymusza max 1 domyślne wydanie per utwór, ale tylko wśród nieusuniętych (`is_deleted=False`). Soft-delete kompatybilność.

**Dlaczego `mbid` jest `UUIDField(unique=True, null=True)`?**
MusicBrainz ID to natywny UUID. Pole nullable bo nie każdy kompozytor jest w MusicBrainz (zwłaszcza współcześni). `unique=True` egzekwowane tylko gdy obecne (PostgreSQL traktuje wiele NULL jako unikalne).

---

## 4. Pipeline ingestii (Workflow A)

Lokalizacja: [backend/archive/tasks.py](../backend/archive/tasks.py)

### 4.1. Punkt wejścia

```python
from archive.models import ScoreEdition
from archive.services.ingestion import start_ingestion

edition = ScoreEdition.objects.create(
    piece=piece,                    # placeholder — pipeline może go zmienić po dedup
    pdf_file=uploaded_file,
    original_filename='magnificat.pdf',
    sha256='',
    page_count=0,
)
ticket = start_ingestion(edition)
# → IngestionTicket(edition_id=..., celery_task_id=...)
```

Façada [services/ingestion.py](../backend/archive/services/ingestion.py) waliduje preconditions (API key, plik, status) i dispatchuje chain do Celery. **Widoki/admin/management commands nigdy nie wołają `tasks.s()` bezpośrednio** — zawsze przez `start_ingestion()`.

### 4.2. Łańcuch zadań — krok po kroku

| # | Task | Model AI | Po co | Idempotencja |
|---|---|---|---|---|
| 1 | `prepare_document` | — | pypdf → sha256 + page count; limit `MAX_PDF_PAGES` = 100. **Bez bramki na warstwę tekstową** — skan jest poprawnym wejściem, bo model czyta wzrokiem | Bezpieczny re-run; dopisuje tylko puste pola |
| 2 | `analyze_score` | **Sonnet 5** (`effort=medium`) | JEDNO wywołanie wzrokowe na całym PDF: tożsamość + części + tekst śpiewany + IPA + tłumaczenia | Wynik w payload; brak DB writes |
| 3 | `resolve_composer_and_piece` | — | MusicBrainz + Wikidata → dedup → `Composer` + `Piece` rows | Idempotent przez `_find_existing_*` priority; fast path przy podpiętym `piece_id` |
| 4 | `persist_analysis` | — | Zapis części, tekstu, IPA i tłumaczeń z kroku 2 | Pomija części gdy `piece.movements.exists()` |
| 5 | `lookup_spotify` | — | Top 5 nagrań ze Spotify | `update_or_create` na `(source, external_id)` |
| 6 | `lookup_youtube` | — | Top 5 wideo z YouTube Data API | jw. |
| 7 | `finalize_edition` | — | Status → `AWAITING` (gotowe do zatwierdzenia) | Zawsze biegnie; respektuje `FAILED` |

**Poza łańcuchem:** `generate_program_note` (**Opus 5**, `effort=low`, thinking ON) — ~250-słowna notka
audience-facing. Dispatch przez `services.ingestion.dispatch_program_note()`, z kokpitu weryfikacji
albo przy zatwierdzeniu. Pomija istniejącą notkę, chyba że `force=True`.

**Dlaczego jedno wywołanie zamiast łańcucha małych?** Pierwotny pipeline dzielił pracę na `identify_work` /
`detect_movements` / `extract_lyrics` — każde wywołanie widziało tylko swój wycinek dokumentu, więc model
sięgał po to, co wie, zamiast po to, co jest wydrukowane: przy znanym hymnie zwracał tekst kanoniczny
zamiast słów z tej konkretnej strony, co dla archiwum jest dokładnie odwrotnością celu. Konsolidacja
naprawiła dokładność i ścięła rachunek jednocześnie, bo PDF idzie do modelu raz, a nie trzy razy.

**Dlaczego notka wyszła z łańcucha?** Leciała eagerly na końcu i pisała prozę dla publiczności
z *niezweryfikowanej* tożsamości od modelu — zły kompozytor albo zła epoka wchodziły wprost do tekstu,
który czyta słuchacz. Teraz powstaje po weryfikacji, z poprawionymi metadanymi i tekstem śpiewanym
jako kontekstem.

**Reguły ECONOMY.** Prompt dostaje `INGESTION_PRIMARY_LANGUAGE` i `INGESTION_TRANSLATION_LANGUAGES`.
Partytura śpiewana w całości w języku podstawowym nie dostaje przewodnika IPA, a żaden język docelowy
nie dostaje tłumaczenia tekstu, który już jest w tym języku. Na dominującym repertuarze polskim to była
czysto marnowana produkcja tokenów — i to ta reguła, nie model, odpowiada za rozrzut kosztu ingestu
(4¢ za partyturę wyłącznie polską, ~20¢ za dwujęzyczną).

**Live preview.** `analyze_score` streamuje surowy JSON modelu przez `on_text_delta` i publikuje
throttlowany podgląd (aktualna sekcja, tytuł, kompozytor, liczba części) — dyrygent widzi rekord
materializujący się w czasie rzeczywistym po SSE, zamiast wpatrywać się w jedną statyczną etykietę
przez minutę.

**Dedup po SHA-256.** Jeśli identyczny PDF już przeszedł ingest i doszedł do `AWAITING`/`READY`,
`prepare_document` podpina nową edycję do tego samego utworu, ustawia `_aborted` i przeskakuje wprost
do weryfikacji. Model nie jest wołany ani razu.

### 4.3. Status transitions

```
PENDING ──► EXTRACTING ──► ENRICHING ──► GENERATING ──► AWAITING ──► READY
                │              │              │              │
                ▼              ▼              ▼              ▼
                └──────────► FAILED ◄─────────┴──────────────┘
                              ▲
                              │ (przyczyna: ingestion_error)
```

**READY** ustawia dyrygent po manualnym zatwierdzeniu — pipeline tego nie robi. **FAILED** ma zawsze `ingestion_error` z czytelnym powodem.

### 4.4. Abort propagation

Pierwszy task, który napotyka problem (PDF korupted, low confidence, budżet wyczerpany), wywołuje `_fail(edition, reason, payload)`:

1. Ustawia status = `FAILED` + `ingestion_error`.
2. Wpisuje `payload['_aborted'] = True`.

Kolejne taski są opakowane dekoratorem `_guarded`, który short-circuituje na podstawie flagi. `finalize_edition` **nie jest** opakowane — zawsze biegnie i respektuje `FAILED` status (nie nadpisuje go).

### 4.5. Cost ceilings — trzy poziomy

Każdy task wołający Claude robi:

```python
_ensure_budget(edition)  # refresh_from_db + AIClient.enforce_ceiling
# ... AI call ...
_bill_edition(edition, cost.total_cents)  # F() atomic increment
```

| Sufit | Setting | Default | Zakres |
|---|---|---|---|
| Na przebieg | `INGESTION_COST_CEILING_CENTS` | 150¢ | Jeden run na jednej `ScoreEdition`; resetowany przez `start_ingestion` |
| Dożywotni | `INGESTION_LIFETIME_CEILING_CENTS` | 750¢ | Suma po wszystkich runach i regeneracjach tej edycji; **nigdy się nie resetuje** |
| Dzienny | `INGESTION_DAILY_BUDGET_CENTS` | 2000¢ | Cała organizacja, licznik w Redisie; bezpiecznik na runaway loop, nie budżet na partyturę |

Przekroczenie → `CostCeilingExceeded` → `_guarded` łapie → `_fail()` → graceful abort. **To są hard capy** —
chronią przed pętlą zżerającą konto Anthropic.

**Pułapka w UI:** panele pokazują `ingestion_cost_cents_lifetime`, czyli licznik kumulatywny. Czytany
jak koszt pojedynczego wywołania prowadzi do wniosku „notka programowa zżera najwięcej", podczas gdy
przy 2–3¢ jest najtańszym wywołaniem w pipeline.

---

## 5. Integracja z Claude (Anthropic)

Lokalizacja: [backend/archive/infrastructure/ai_client.py](../backend/archive/infrastructure/ai_client.py)

### 5.1. Trzy modele — kiedy używać

| Model | Stała | Zastosowanie | Cena ($/1M tokens) |
|---|---|---|---|
| Haiku 4.5 | `AIModel.HAIKU` | Klasyfikacja, dedup, prosta ekstrakcja. **Obecnie nieużywany w pipeline** — konsolidacja v2 zlikwidowała zadania jego poziomu | $1 in / $5 out |
| Sonnet 5 | `AIModel.SONNET` | **Odczyt dokumentu** — `analyze_score`, czyli całość ekstrakcji | $3 in / $15 out |
| Opus 5 | `AIModel.OPUS` | `generate_program_note` — jedyny tekst, który publiczność czyta dosłownie | $5 in / $25 out |

`LEGACY_SONNET` / `LEGACY_OPUS` (`claude-sonnet-4-6`, `claude-opus-4-8`) istnieją **wyłącznie** po to,
żeby harness ewaluacyjny mógł wycenić przebieg bazowy na poprzedniej generacji (`--model`). Nic
w pipeline ich nie wybiera.

**Reguła:** zaczynaj od Sonneta. Na Opusa przechodź tam, gdzie tekst wychodzi do człowieka bez redakcji.
Zmianę modelu podpieraj przebiegiem harnessu (§5.6), nie argumentem — migracja 2026-08 pokazała, że
uzasadnienie „lepszy wzrok przy skanach" nie miało zastosowania do tego archiwum, a model i tak został,
bo zmierzył się jako 31% tańszy i 2,6× szybszy.

**Cennik trzyma stawki standardowe.** Sonnet 5 miał promocję $2/$10 do 2026-08-31; tabela celowo
zostaje przy $3/$15, bo w trakcie promocji zawyża raportowany koszt, a to bezpieczny kierunek
(spójny z zaokrąglaniem w górę w całej tabeli).

### 5.2. Versioned prompts

Lokalizacja: [backend/archive/infrastructure/prompts.py](../backend/archive/infrastructure/prompts.py)

```python
@dataclass(frozen=True)
class Prompt:
    name: str
    system: str

    @property
    def version(self) -> str:
        # SHA-256 of system text → stable identifier
        # "extract_work_identity_v1@a1b2c3d4e5f6"
```

**Każda zmiana tekstu promptu zmienia version.** Wersja zapisuje się w `ProvenanceRecord.prompt_version` przy każdym AI-generated polu. Pozwala to:

* Powiązać konkretny output z konkretną wersją promptu.
* Wykryć regresję po edycji promptu (porównanie z poprzednią wersją).
* Wymusić regenerację: `if record.prompt_version != EXTRACT_WORK_IDENTITY.version: regenerate()`.

### 5.3. Structured outputs

Wszystkie wywołania AI używają `client.messages.parse(output_format=PydanticSchema)`. Claude jest **zmuszony** zwrócić JSON spełniający schemat — błędna walidacja podnosi exception SDK.

Schematy w [backend/archive/dtos.py](../backend/archive/dtos.py):

* `ScoreAnalysisResult` — output of `analyze_score`; zawiera tożsamość, `movements[]`, tekst śpiewany, IPA i `translations[]`
* `GeneratedProgramNote` — output of `generate_program_note`
* `ExtractedWorkIdentity` — nie jest już bezpośrednim outputem żadnego wywołania; `_identity_from_analysis()` wyprowadza go z `ScoreAnalysisResult` dla resolvera

**Wyjątek od „structured outputs":** `analyze_score` **nie** używa `output_format=` — Anthropic odrzuca
schemat `ScoreAnalysisResult` błędem 400 „Schema is too complex". Schemat JSON idzie w promptcie,
a odpowiedź parsujemy sami (`structured=False`). Nie jest to zaniedbanie do naprawienia.

### 5.4. Prompt caching

Każdy `system` prompt jest opakowany w:

```python
{"type": "text", "text": prompt.system, "cache_control": {"type": "ephemeral"}}
```

Anthropic cache'uje prefix przez 5 minut. Po pierwszym wywołaniu w batchu — `cache_read_input_tokens` dominuje, koszt spada ~80–90%. Weryfikacja przez logi (`ai.parse ... cache_r=N`).

**Pułapka:** każda zmiana w `prompt.system` invaliduje cache. Dlatego prompts są frozen dataclasses i wersjonowane przez SHA.

### 5.5. Adaptive thinking + effort

Aktualne ustawienia call site'ów:

| Wywołanie | Model | `effort` | thinking | `max_tokens` |
|---|---|---|---|---|
| `analyze_score` | Sonnet 5 | `medium` | adaptive | `ANALYZE_MAX_TOKENS` = 49152 |
| `generate_program_note` | Opus 5 | `low` | adaptive | `PROGRAM_NOTE_MAX_TOKENS` = 8192 |

**Pułapka, która kosztowała najwięcej przy migracji: brak klucza `thinking` zmienił znaczenie
między generacjami.** Na Sonnecie 4.6 nieobecny `thinking` znaczył „wyłączone". Na Sonnecie 5 znaczy
„adaptive włączone". `AIClient` ustawia więc `thinking` **zawsze jawnie**, z gałęzią `{"type": "disabled"}`
dla `enable_thinking=False`. Nie usuwaj tej gałęzi jako „martwego kodu".

**Dlaczego notka mimo to ma thinking ON, a nie disabled:** na Opusie ścieżka disabled potrafi przepuścić
tagi `<thinking>` do widocznej odpowiedzi. W jedynym tekście, który ten projekt drukuje dosłownie, to
najgorszy dostępny tryb awarii. Adaptive przy `effort=low` kosztuje tyle samo (zmierzone: 3¢ w obu
konfiguracjach) i tego ryzyka nie ma.

**Guard:** Opus 5 odrzuca `thinking: disabled` przy `effort` `xhigh`/`max` (400). `AIClient` odmawia
lokalnie, zanim pójdzie request. Żaden obecny call site tego nie dotyka.

**`effort` nie jest wspierany przez Haiku** — `_MODELS_WITHOUT_EFFORT` pomija pole dla tego poziomu,
więc call site'y nie muszą o tym wiedzieć.

**`budget_tokens` nie używamy** — adaptive jest jedyną wspieraną formą na Opusie i preferowaną gdzie indziej.

### 5.6. Taksonomia błędów — retry idzie za rachunkiem, nie za kodem HTTP

Klasyfikacja w `ai_client.py` dzieli awarie na dwóch osiach naraz: czy ponowienie może pomóc i czy
nieudana próba **została zafakturowana**.

| Klasa | Wyjątek | Zafakturowane? | Polityka |
|---|---|---|---|
| Przeciążenie / transport | `AIClientOverloadedError` | nie | Retry z backoffem; UI dostaje `WAITING_OVERLOAD`, żeby długa pauza nie wyglądała na zawieszenie |
| Ucięcie na `max_tokens` | `AIClientTruncatedError` | **tak** | Podwojenie budżetu do `_MODEL_OUTPUT_CEILING`, max 2 eskalacje. Powtórzenie identycznego wywołania kupuje tę samą porażkę drugi raz |
| 4xx / auth / permission | `AIClientPermanentError` | nie | Terminalne. `_guarded` woła `_fail()` zamiast pozwolić Celery trzy razy powtórzyć odrzucony request |

`CallCost` z eskalacji to **suma wszystkich prób** — inaczej hard cap nie widziałby prawdziwego rachunku.

### 5.7. Harness ewaluacyjny (golden set)

```bash
python manage.py evaluate_ingestion <golden_dir> [--model sonnet|opus|haiku] \
    [--effort low|medium|high|xhigh|max] [--only PLIK] [--limit N] [--verbose-fields]
```

Puszcza prawdziwe partytury przez żywy pipeline i punktuje dokładność pole po polu, koszt i czas
wobec ręcznie spisanego `expected.json`. **Każdy przebieg to realne, płatne wywołania.**

Złoty zestaw leży w `voct_data/golden_set/` (gitignored — to chronione prawem autorskim wydania).
Reguła przy jego pisaniu: do `expected.json` trafia wyłącznie to, na co strona odpowiada jednoznacznie.
Pominięte pole nic nie kosztuje, błędne oczekiwanie zatruwa każde przyszłe porównanie.

Dwie rzeczy warte zapamiętania o scoringu: `sung_text_contains` jest **wrażliwe na diakrytyki** (fold
tożsamościowy je zdejmuje i skasowałby sygnał), a `_MODEL_OUTPUT_CEILING` zna identyfikatory legacy —
bez nich przebieg bazowy nie mógłby eskalować, podczas gdy bieżący model dostawał dwie próby, co
odczytałoby się jako przewaga jakościowa nowego modelu.

**Ograniczenie, o którym trzeba wiedzieć:** zestaw ma 6 plików, z czego zmierzone są 2, i każda
konfiguracja punktuje 100% — łącznie ze starym modelem. To znaczy, że zestaw jeszcze nie różnicuje
konfiguracji, a nie że problem jest rozwiązany. Nie promuj tańszego `effort` na tej podstawie.

---

## 6. Klienty zewnętrznych źródeł

Lokalizacja: [backend/archive/infrastructure/](../backend/archive/infrastructure/)

### 6.1. Współdzielony `_http.py`

`cached_get_json(...)` to jedyna funkcja HTTP używana przez klienty zewnętrzne. Robi:

1. **Cache lookup** w Redis (DB 1, klucz = `sha256(url + sorted_params)`).
2. **Polite User-Agent** ze `settings.EXTERNAL_API_USER_AGENT`.
3. **Retry on 429/5xx** z exponential backoff (0.5s, 1s, 2s) + `Retry-After` header.
4. **Cache write on success** (default TTL 30 dni).
5. **Exception split**:
   * `ExternalAPIError` — nie do retry (4xx inne niż 429, parse error)
   * `ExternalAPIUnavailable` — retry wyczerpane (caller decyduje czy ponawiać)

### 6.2. Per-client summary

| Klient | Plik | Auth | Endpointy | Cache TTL | Rate limit |
|---|---|---|---|---|---|
| MusicBrainz | `musicbrainz_client.py` | brak (User-Agent wymagany) | `/ws/2/work`, `/ws/2/artist` | 30 dni | 1 req/sec hard |
| Wikidata | `wikidata_client.py` | brak | `w/api.php`, `wikipedia.org/api/rest_v1/page/summary` | 30 dni | rozsądnie |
| Spotify | `spotify_client.py` | Client Credentials OAuth | `/v1/search` | 7 dni | token cached 55min |
| YouTube | `youtube_client.py` | API key | `/youtube/v3/search`, `/videos` | 7 dni | 10k units/dzień quota |

**Uwagi do MusicBrainz `search_composer`:** zapytanie nie filtruje po `tag:composer`
— pokrycie tej tagowej kolekcji jest dziurawe nawet dla kanonu (np. Rachmaninoff
nie ma tagu „composer" w wersji EN). Zamiast tego post-filtrujemy wyniki:
preferujemy `type=Person`, odrzucamy Group/Orchestra/Choir. Próg score: 70
(wcześniej 80) — wystarczająco rygorystyczny, by odsiać szum, a wystarczająco
luźny, by przeżyć rozrzut romanizacji („Rachmaninoff" / „Rachmaninov" /
„Rakhmaninov").

**Uwagi do Wikidata `_entity_to_composer`:** pole `nationality` zwracamy jako
human-readable label (np. „Russia"), nie surowy QID. Resolver robi jeden extra
`wbgetentities` (props=labels) na QID kraju; wynik wpada do tego samego Redis
cache co reszta wywołań Wikidaty, więc drugi kompozytor tej samej narodowości
nic nie kosztuje. Fallback: gdy lookup labela się nie powiedzie, zwracamy QID
jako string — lepiej niż puste pole, a dyrygent poprawi w modal review.

### 6.3. Graceful degradation

Każdy klient sprawdza obecność kluczy w `settings`. Brak klucza → `logger.warning('xxx.no_credentials ...')` + pusty wynik. **Pipeline biegnie do końca** — po prostu pomija to źródło. Możesz uruchomić cały feature z samego MusicBrainz + Wikidata (oba są free) — Spotify/YouTube to wzbogacenie nice-to-have.

---

## 7. Provenance — śledzenie pochodzenia

Lokalizacja: [backend/archive/services/provenance.py](../backend/archive/services/provenance.py)

### 7.1. Po co

Provenance to **audit-grade attribution**: każde pole AI- lub API-sourced ma rekord mówiący „skąd to się wzięło”. Pozwala:

* **Dyrygentowi:** „regeneruj tę notkę programową — była z gorszej wersji promptu”.
* **Compliance:** „pokazuj, które dane biograficzne pochodzą z Wikipedii (CC-BY-SA), a które od AI”.
* **Tobie:** „regresja po edycji `EXTRACT_WORK_IDENTITY` promptu — wszystkie outputy z poprzedniej wersji do regeneracji”.

### 7.2. API

```python
from archive.services import provenance

# Po AI call:
provenance.record_ai(
    target=program_note,                 # dowolny model z UUID PK
    field_name='content',
    model_id=AIModel.SONNET,
    prompt_version=GENERATE_PROGRAM_NOTE.version,
    confidence=0.95,
)

# Po external API call:
provenance.record_external(
    target=composer,
    field_name='bio',
    source=ProvenanceSource.WIKIDATA,
    source_reference='Q1339',            # QID
)

# Po manualnej edycji dyrygenta:
provenance.record_manual(
    target=composer,
    field_name='nationality',
    actor_email=request.user.email,
)
```

### 7.3. Wzorzec użycia w resolverze

`services/resolvers.py` wpisuje provenance dla **każdego pola, które właśnie zapełnił**. Pola już wypełnione (manualnie lub przez wcześniejszy run) nie są nadpisywane — i nowy `ProvenanceRecord` nie powstaje. To jest **konserwatywna semantyka**: pierwsze źródło wygrywa, dyrygent zawsze wygrywa.

---

## 8. Konfiguracja

### 8.1. Wymagane env vars

```bash
# AI
ANTHROPIC_API_KEY=sk-ant-...
INGESTION_COST_CEILING_CENTS=150      # jeden przebieg jednej ScoreEdition
INGESTION_LIFETIME_CEILING_CENTS=750  # suma po wszystkich runach tej edycji, bez resetu
INGESTION_DAILY_BUDGET_CENTS=2000     # bezpiecznik na całą organizację, licznik w Redisie
INGESTION_PRIMARY_LANGUAGE=pl         # steruje regułami ECONOMY (IPA / tłumaczenia)
INGESTION_TRANSLATION_LANGUAGES=pl    # lista ISO 639-1, przecinkami

# External APIs — wszystkie opcjonalne, pipeline biegnie z dowolnym podzbiorem
EXTERNAL_API_USER_AGENT="VoctManager/1.0 ( contact@example.com )"
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
YOUTUBE_API_KEY=

# Cache (już skonfigurowane przez CACHES w settings.py)
CACHE_URL=redis://redis:6379/1
```

### 8.2. Settings dodane do `config/settings.py`

* `ANTHROPIC_API_KEY` — fail-fast: brak klucza = `IngestionPreconditionError` przy `start_ingestion()`.
* `INGESTION_COST_CEILING_CENTS` / `INGESTION_LIFETIME_CEILING_CENTS` / `INGESTION_DAILY_BUDGET_CENTS` — trzy hard capy, §4.5.
* `INGESTION_PRIMARY_LANGUAGE` / `INGESTION_TRANSLATION_LANGUAGES` — wejście reguł ECONOMY w promptcie analizy.
* `EXTERNAL_API_USER_AGENT` — wysyłany do MusicBrainz/Wikidata/Spotify/YouTube.
* `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` — pusty = client.search zwraca pusty wynik.
* `YOUTUBE_API_KEY` — jak wyżej.
* `CACHES['default']` — Redis backend, DB 1 (separate od Celery DB 0).

---

## 9. Jak rozszerzać

### 9.1. Dodać nowy prompt

1. Dodaj `Prompt(name='nazwa_v1', system='...')` w [prompts.py](../backend/archive/infrastructure/prompts.py).
2. Dodaj odpowiednią Pydantic schema do [dtos.py](../backend/archive/dtos.py).
3. Dodaj nowe Celery task w [tasks.py](../backend/archive/tasks.py), wzorując się na `generate_program_note`.
4. Wstaw do `build_ingestion_chain()` w odpowiednim miejscu chain — **albo świadomie zostaw poza nim**,
   jeśli output ma powstawać po weryfikacji przez człowieka (patrz: notka programowa, §4.2).

**Zanim dodasz wywołanie:** sprawdź, czy nowa informacja nie da się wyciągnąć z istniejącego
`analyze_score`. Rozbijanie odczytu na osobne wywołania to dokładnie ten błąd, który naprawiało v2 —
model bez pełnego dokumentu przed sobą zaczyna zgadywać z pamięci.

### 9.2. Dodać nowe źródło zewnętrzne

1. Stwórz `archive/infrastructure/foo_client.py` na wzór `musicbrainz_client.py`:
   * Klasa z `@classmethod`'ami
   * `SOURCE = 'foo'` stała namespace
   * Wszystkie requesty przez `cached_get_json(source=cls.SOURCE, ...)`
2. Dodaj enum do `ProvenanceSource` w [models.py](../backend/archive/models.py).
3. Dodaj migrację (zmiana choices wymaga migracji w Django).
4. Dodaj credentials do settings + .env.
5. Wywołaj klienta z odpowiedniego Celery taska.

### 9.3. Zmienić model dla zadania

```python
# w tasks.py
extracted, cost = client.parse(
    model=AIModel.OPUS,    # ← zmieniasz z SONNET na OPUS
    ...
)
```

Nic więcej. Pricing table w `ai_client.py` zna już wszystkie 3 modele, koszt liczy się automatycznie.

### 9.4. Dodać nowy język tłumaczeń

Nie w kodzie — w settings:
```bash
INGESTION_TRANSLATION_LANGUAGES=pl,en,fr    # ← dodaj nowy ISO 639-1 code
```

Claude wygeneruje dodatkowe tłumaczenie w tym samym wywołaniu, co resztę analizy. Pamiętaj, że reguły
ECONOMY i tak pominą język, w którym tekst już jest.

---

## 10. Troubleshooting

| Objaw | Status | Przyczyna | Co zrobić |
|---|---|---|---|
| `pdf_too_large: N stron (limit 100)` | FAILED | PDF przekracza `MAX_PDF_PAGES` — twardy limit Anthropic na dokument | Podziel partyturę na mniejsze pliki (np. per część). |
| `low_confidence: 0.30 — PDF may not be a score` | FAILED | Claude rozpoznał, że to nie jest partytura (np. dokument tekstowy) lub front matter jest zniekształcony | Sprawdź PDF — zazwyczaj zły upload. |
| `cost_ceiling_exceeded: ...` | FAILED | Przekroczony jeden z trzech sufitów (§4.5) | Sprawdź **który**: dożywotni po wielu regeneracjach wymaga innej reakcji niż dzienny bezpiecznik organizacji. |
| Notka programowa ucięta w połowie zdania w PDF-ie | (cisza) | **Prawie na pewno warstwa druku, nie AI.** `.fp-note` jest ostatnim dzieckiem flexowego `.frontispiece`, a WeasyPrint nie fragmentuje kontenerów flex — nadmiar jest porzucany, nie przenoszony na kolejną stronę | Porównaj z `ProgramNote.content` w bazie. Jeśli w bazie tekst jest cały — fix należy do szablonu `score_package_cards.html`, nie do promptu. Ucięcie budżetem **nie może** zapisać kikuta: podnosi `AIClientTruncatedError` i edycja idzie w FAILED. |
| Brak `Recording` rows | (cisza) | Brak `SPOTIFY_CLIENT_ID` / `YOUTUBE_API_KEY` | Sprawdź env. Jeśli celowo wyłączone — OK, to oczekiwane. |
| MusicBrainz nie znalazł utworu | (cisza) | Score < 70 lub brak wpisu (np. współczesny utwór, ograniczona obecność) | Pipeline kontynuuje z AI-extracted danymi. `Piece` powstanie, ale bez `mbid_work`. |
| Composer duplikuje się przy każdym uploadzie | bug | Resolver nie rozpoznał istniejącego — sprawdź czy `Composer.mbid` jest faktycznie unikalny i wypełniony | Manualnie zmerguj duplikaty (admin), upewnij się że MusicBrainz daje stabilny mbid. |
| `cache_read_input_tokens` zawsze 0 w logach | suboptymalne | Prompt cache nie hit'uje | Sprawdź czy `prompt.system` nie zawiera nic dynamicznego (timestamp, UUID). Powinien być w 100% deterministyczny. |
| Spotify OAuth token expired co request | suboptymalne | Redis cache nie działa | Sprawdź `CACHES['default']` w settings + connection do Redis DB 1. |

---

## 11. Stan funkcji

Pipeline jest wdrożony i biegnie na produkcji. Ta sekcja mówi, co istnieje, a nie jak powstawało —
historia jest w gicie.

### Wdrożone

* **Ingest v2** — 7-stopniowy chain, jedno skonsolidowane wywołanie wzrokowe, dedup po SHA-256,
  kooperatywny cancel, trzy sufity kosztowe, taksonomia błędów z eskalacją budżetu.
* **Live postęp po SSE** — `GET /api/archive/editions/<id>/events/` (`sse_views.py`), streamowany
  podgląd rekordu w trakcie generowania. Produkcja musi chodzić pod ASGI:
  `gunicorn config.asgi -k uvicorn.workers.UvicornWorker`.
* **Provenance na każdym polu** + kokpit weryfikacji z chipami pochodzenia i pewności.
* **Notki programowe** — model `ProgramNote`, generowanie na żądanie, edycja inline, wiele języków.
* **Adnotacje** — `AnnotationViewSet`, warstwa wspólna dyrygenta + prywatna warstwa śpiewaka,
  egzekwowane po stronie serwera.
* **Śpiewnik koncertowy** — `roster/score_package_*.py`, składanie deterministyczne, bez modelu
  na etapie budowania.
* **Harness ewaluacyjny** — §5.7.

### Otwarte

* **Złoty zestaw jest za łatwy** — 6 plików, 2 zmierzone, każda konfiguracja na 100%. Dopóki nie ma
  w nim przypadków, które różnicują konfiguracje (niejednoznaczne atrybucje, utwór wieloczęściowy,
  niejasna tonacja), harness nie umie rankować jakości — umie tylko wykryć regresję.
* **Scoring nie mierzy IPA ani jakości tłumaczeń** — pokrywa tożsamość i frazy tekstu śpiewanego.
* **Modal ujednoznaczniania kompozytora** — przy dedupie priority 3–5 z wieloma kandydatami wygrywa
  pierwszy. Wystarczająco bezpieczne, bo dyrygent poprawia nazwisko w karcie utworu.
* **OCR fallback** — nieaktualny jako zadanie. Model czyta skany wzrokiem, więc bramka na warstwę
  tekstową została usunięta razem z v2.

---

## 12. Pliki i ich rola

```
backend/archive/
├── models.py                          # Encje DB + IngestionStatus / IngestionProgress
├── dtos.py                            # Pydantic schemas (AI output + lookup results)
├── serializers.py                     # DRF; PieceSerializer = SSOT dla Archive/Materials
├── views.py                           # ScoreEditionViewSet, PieceViewSet, AnnotationViewSet
├── sse_views.py                       # GET /editions/<id>/events/ — text/event-stream (ASGI)
├── score_protection.py                # status prawnoautorski + watermark per odbiorca
├── tasks.py                           # 7 tasków chain + generate_program_note (poza chainem)
├── infrastructure/
│   ├── _http.py                       # Shared HTTP (cache + retry)
│   ├── ai_client.py                   # AIClient, taksonomia błędów, eskalacja, cost tracking
│   ├── prompts.py                     # Versioned prompts: ANALYZE_SCORE + GENERATE_PROGRAM_NOTE
│   ├── pdf_extractor.py               # pypdf wrapper (sha256 + page count)
│   ├── musicbrainz_client.py
│   ├── wikidata_client.py
│   ├── spotify_client.py
│   └── youtube_client.py
├── management/commands/
│   ├── evaluate_ingestion.py          # harness golden-set (§5.7) — realne, płatne wywołania
│   └── normalize_piece_languages.py
└── services/
    ├── ingestion.py                   # start_ingestion / dispatch_program_note / cancel_ingestion
    ├── provenance.py                  # record_ai / record_external / record_manual + mapa modeli
    ├── resolvers.py                   # composer + piece dedup/create
    ├── enrichment.py
    └── language.py

frontend/src/features/archive/          # UI slice (FSD) — jeden slice, bez osobnego „score-compiler"
├── ArchivePieceCardPage.tsx            # karta utworu: edycja + weryfikacja AI w jednym miejscu
├── ArchiveManagement.tsx               # lista repertuaru
├── api/{archive.service.ts, archive.queries.ts}
└── components/
    ├── EditionUploadZone.tsx           # drag-and-drop multi-file
    ├── EditionUploadDrawer.tsx
    ├── ActiveIngestionsPanel.tsx       # live postęp po SSE
    ├── OrphanIngestionsPanel.tsx       # ingesty bez podpiętego utworu
    ├── ProvenanceChip.tsx              # AI · 95% / MusicBrainz / Zweryfikowane
    ├── ReviewMeter.tsx, CockpitSection.tsx, ReviewArtifactsEditors.tsx
    └── AIHallucinationWarning.tsx
```

**Uwaga nawigacyjna:** nie ma już trasy `/panel/score-compiler` ani `ConductorReviewModal`. Upload
i weryfikacja mieszkają w karcie utworu pod `/panel/archive-management/:id` (z podtrasami `/edit`
i `/review`).

---

## 13. Notatka dla agentów AI

Jeśli jesteś modelem (Claude, Cursor, Copilot, Codex) modyfikującym ten codebase:

1. **Nie modyfikuj `prompts.py` tekstów inline** — zmiana invaliduje prompt cache i version. Jeśli chcesz porównać warianty: dodaj nowy `Prompt('foo_v2', ...)` obok starego.
2. **Nigdy nie usuwaj `_guarded` decoratora z taska** — bez niego `CostCeilingExceeded` zostanie podniesione do Celery retry, który trzy razy spróbuje wykonać kosztowny task i wyczyści konto Anthropic.
3. **Zawsze stosuj `_bill_edition(edition, cost.total_cents)` PO każdym AI call** — pominięcie psuje rachunkowość i hard cap nie zadziała.
4. **Dla każdego nowego AI-generated pola wpisuj `provenance.record_ai(...)`** — bez tego pole „pojawia się znikąd” i nie da się zregenerować.
5. **Nie wprowadzaj `temperature` / `top_p` / `top_k` do `AIClient.parse`** — poziom Opus zwraca 400 przy tych parametrach.
6. **Zachowaj idempotencję** — każdy task powinien sprawdzać DB state i pomijać pracę jeśli już zrobiona. Inaczej restart Celery worker'a w środku chain'a będzie podwajał dane.
7. **Nie usuwaj jawnej gałęzi `thinking: {"type": "disabled"}`** jako martwego kodu — brak klucza
   `thinking` znaczy na Sonnecie 5 coś przeciwnego niż na 4.6 (§5.5).
8. **Nie rozbijaj `analyze_score` na mniejsze wywołania.** Wygląda to na czystszy podział
   odpowiedzialności, a jest regresją, którą v2 naprawiało: model bez całego dokumentu przed sobą
   uzupełnia luki z pamięci zamiast z wydrukowanej strony.
9. **Po zmianie kodu tasków zrestartuj workera** — `docker restart voct_celery`. Celery nie
   przeładowuje bind-mountowanego kodu, więc bez tego testujesz poprzednią wersję.
