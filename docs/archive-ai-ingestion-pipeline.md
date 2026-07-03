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
> **Stan:** architektura opisana wg stanu z 2026-05 i nadal obowiązuje; szczegóły promptów,
> kosztów i obsługi błędów były później strojone (audyt 2026-06). Przy pracy nad kodem źródłem
> prawdy jest `backend/archive/services/ingestion.py` + `tasks.py`, nie ten dokument.

---

## 1. Po co to powstało?

Dyrygent profesjonalnego zespołu wokalnego traci **godziny** na każdy koncert:

1. Zbiera PDF-y partytur z różnych źródeł (IMSLP, wydawcy, własne edycje).
2. Pisze ręcznie notki programowe, tłumaczenia tekstów liturgicznych, transkrypcje IPA.
3. Skleja wszystko w jeden binder — strona tytułowa, spis treści, ciągła paginacja, materiały pomocnicze przed każdym utworem.

**Score Package Compiler** zamienia ten ręczny proces w jedno kliknięcie:

```
Upload PDF-ów  →  AI rozpoznaje utwór + kompozytora  →  Wzbogaca z kanonicznych źródeł
              →  Generuje notki / tłumaczenia / IPA  →  Dyrygent zatwierdza
              →  Klik „Compile” → polski concert binder gotowy w 30 sekund
```

**Co AI robi:** wyciąga, identyfikuje, dedupuje, generuje opisowe materiały.
**Czego AI NIE robi:** nie edytuje nut na partyturze. To jest pułapka — modyfikacja notacji w PDF wymaga MuseScore/Dorico, nie LLM-a. Każda halucynacja zmieniająca nutę zniszczy zaufanie do platformy.

---

## 2. Architektura wysokopoziomowa

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Phase 3)                              │
│   Drag&drop upload  →  Status polling (SSE / TanStack Query)             │
│                    →  Conductor review screen (potwierdza/edytuje)       │
└─────────────────────────────────────────────────────────────────────────┘
                                  ↕  REST API
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Phase 0–2 — gotowe)                      │
│                                                                          │
│   start_ingestion(ScoreEdition)   ◄── services/ingestion.py              │
│           │                                                              │
│           ▼                                                              │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │              CELERY CHAIN — Workflow A                       │       │
│   │  extract_pdf_text → identify_work → resolve_composer+piece   │       │
│   │   → detect_movements → extract_lyrics → generate_program_note│       │
│   │   → lookup_spotify → lookup_youtube → finalize_edition       │       │
│   └──────────────────────────────────────────────────────────────┘       │
│           │                       │                       │              │
│           ▼                       ▼                       ▼              │
│   ┌────────────────┐   ┌────────────────────┐   ┌────────────────────┐  │
│   │  Anthropic     │   │   MusicBrainz      │   │   Spotify           │  │
│   │  Claude API    │   │   Wikidata         │   │   YouTube Data API  │  │
│   │  (Sonnet)      │   │   (canonical)      │   │   (recordings)      │  │
│   └────────────────┘   └────────────────────┘   └────────────────────┘  │
│           │                       │                       │              │
│           └───────────────────────┴───────────────────────┘              │
│                                  ▼                                       │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │  PostgreSQL — repertuar + provenance                         │       │
│   │  Redis — cache zewnętrznych API + token OAuth Spotify        │       │
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
| `Annotation` | Markup na PDF (highlights, komentarze, freehand). Phase 4. | `(edition, page_number)` |
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
| 1 | `extract_pdf_text` | — | pypdf → sha256 + page count + tekst z pierwszych 3 stron | Bezpieczny re-run; tekst regenerowany |
| 2 | `identify_work` | **Haiku** (no thinking) | Wyciąga title/composer/opus/voicing/key/language + confidence | Wynik w payload; brak DB writes |
| 3 | `resolve_composer_and_piece` | — | MusicBrainz + Wikidata → dedup → `Composer` + `Piece` rows | Idempotent przez `_find_existing_*` priority |
| 4 | `detect_movements` | **Haiku** (no thinking) | Lista części w kolejności wykonawczej | Pomija jeśli `piece.movements.exists()` |
| 5 | `extract_lyrics` | **Sonnet** (effort=medium) | Sung text + IPA + tłumaczenia (en, pl) | Pomija jeśli `lyrics_ipa` + `translations.exists()` |
| 6 | `generate_program_note` | **Sonnet** | ~250-słowna notka audience-facing | Pomija jeśli canonical `ProgramNote` istnieje |
| 7 | `lookup_spotify` | — | Top 5 nagrań ze Spotify | `update_or_create` na `(source, external_id)` |
| 8 | `lookup_youtube` | — | Top 5 wideo z YouTube Data API | jw. |
| 9 | `finalize_edition` | — | Status → `AWAITING` (gotowe do zatwierdzenia) | Zawsze biegnie; respektuje `FAILED` |

**Dlaczego split modeli?** `identify_work` i `detect_movements` to czyste „odczytaj nagłówek, wypisz co widzisz" — Haiku 4.5 robi to w 1/3 kosztu Sonneta, a bez `thinking` nie traci tokenów na rozumowanie, którego nie potrzebuje. `extract_lyrics` z `effort="medium"` zachowuje jakość tłumaczeń (Sonnet ma liturgiczny korpus dobrze wewnętrznie zmapowany), a tnie ~30 % output tokens. Połączone oszczędności na typowym uploadzie: ~13¢ / 44¢ pre-fix → ~31¢ pre-fix.

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

### 4.5. Cost ceiling

Każdy task wołający Claude robi:

```python
_ensure_budget(edition)  # refresh_from_db + AIClient.enforce_ceiling
# ... AI call ...
_bill_edition(edition, cost.total_cents)  # F() atomic increment
```

Ceiling jest w settings: `INGESTION_COST_CEILING_CENTS` (default 200¢ = $2). Przekroczenie → `CostCeilingExceeded` → `_guarded` łapie → `_fail()` → graceful abort. **To jest hard cap** — chroni przed runaway loopem zżerającym konto Anthropic.

---

## 5. Integracja z Claude (Anthropic)

Lokalizacja: [backend/archive/infrastructure/ai_client.py](../backend/archive/infrastructure/ai_client.py)

### 5.1. Trzy modele — kiedy używać

| Model | Stała | Zastosowanie | Cena ($/1M tokens) |
|---|---|---|---|
| Haiku 4.5 | `AIModel.HAIKU` | Klasyfikacja, dedup, prosta ekstrakcja | $1 in / $5 out |
| Sonnet 4.6 | `AIModel.SONNET` | **Domyślny dla pipeline** — enrichment, tłumaczenia, notki | $3 in / $15 out |
| Opus 4.7 | `AIModel.OPUS` | Najtrudniejsze decyzje, multi-step reasoning | $5 in / $25 out |

**Reguła:** zaczynaj od Sonneta. Jeśli wyniki niezadowalające → Opus. Jeśli koszt rośnie i jakość OK → Haiku.

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

* `ExtractedWorkIdentity` — output of `identify_work`
* `ExtractedMovementList` — output of `detect_movements`
* `GeneratedProgramNote` — output of `generate_program_note`
* `LyricsExtractionResult` — output of `extract_lyrics`

### 5.4. Prompt caching

Każdy `system` prompt jest opakowany w:

```python
{"type": "text", "text": prompt.system, "cache_control": {"type": "ephemeral"}}
```

Anthropic cache'uje prefix przez 5 minut. Po pierwszym wywołaniu w batchu — `cache_read_input_tokens` dominuje, koszt spada ~80–90%. Weryfikacja przez logi (`ai.parse ... cache_r=N`).

**Pułapka:** każda zmiana w `prompt.system` invaliduje cache. Dlatego prompts są frozen dataclasses i wersjonowane przez SHA.

### 5.5. Adaptive thinking + effort

Domyślnie:
```python
thinking={"type": "adaptive"}        # Claude decyduje ile myśleć
output_config={"effort": "high"}     # głębokie rozumowanie
```

Dla Opus 4.7 **nie ma** `budget_tokens` (zwraca 400) — adaptive jest jedyną opcją. Dla Sonnet i Haiku — adaptive jest preferowane, choć `budget_tokens` jeszcze działa (deprecated).

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
INGESTION_COST_CEILING_CENTS=200    # default 200¢ = $2 per ScoreEdition

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
* `INGESTION_COST_CEILING_CENTS` — hard cap per `ScoreEdition`.
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
4. Wstaw do `build_ingestion_chain()` w odpowiednim miejscu chain.

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

W `tasks.py::extract_lyrics`:
```python
target_languages = ['en', 'pl', 'fr']    # ← dodaj nowy ISO 639-1 code
```

Claude wygeneruje dodatkowe tłumaczenie w jednym call (~tańsze niż wielokrotne wywołania).

---

## 10. Troubleshooting

| Objaw | Status | Przyczyna | Co zrobić |
|---|---|---|---|
| `no_text_layer — PDF appears to be a scan` | FAILED | PDF to zeskanowane obrazy bez OCR | Dyrygent musi wgrać re-OCR lub digital edition. OCR planowane w Phase 6. |
| `low_confidence: 0.30 — PDF may not be a score` | FAILED | Claude rozpoznał, że to nie jest partytura (np. dokument tekstowy) lub front matter jest zniekształcony | Sprawdź PDF — zazwyczaj zły upload. |
| `cost_ceiling_exceeded: ...` | FAILED | Pipeline przekroczył `INGESTION_COST_CEILING_CENTS` | Podnieś ceiling w settings/env, albo rozbij ingestę na mniejsze edycje. |
| Brak `Recording` rows | (cisza) | Brak `SPOTIFY_CLIENT_ID` / `YOUTUBE_API_KEY` | Sprawdź env. Jeśli celowo wyłączone — OK, to oczekiwane. |
| MusicBrainz nie znalazł utworu | (cisza) | Score < 70 lub brak wpisu (np. współczesny utwór, ograniczona obecność) | Pipeline kontynuuje z AI-extracted danymi. `Piece` powstanie, ale bez `mbid_work`. |
| Composer duplikuje się przy każdym uploadzie | bug | Resolver nie rozpoznał istniejącego — sprawdź czy `Composer.mbid` jest faktycznie unikalny i wypełniony | Manualnie zmerguj duplikaty (admin), upewnij się że MusicBrainz daje stabilny mbid. |
| `cache_read_input_tokens` zawsze 0 w logach | suboptymalne | Prompt cache nie hit'uje | Sprawdź czy `prompt.system` nie zawiera nic dynamicznego (timestamp, UUID). Powinien być w 100% deterministyczny. |
| Spotify OAuth token expired co request | suboptymalne | Redis cache nie działa | Sprawdź `CACHES['default']` w settings + connection do Redis DB 1. |

---

## 11. Roadmap

### Zrobione (Phase 0–3)

* **Phase 0 — Foundations:** Modele DB (Composer mbid, Piece mbid_work, ScoreEdition, Movement, Translation, Recording, Annotation, ProgramNote, ProvenanceRecord), `AIClient` z cost tracking + prompt caching + structured outputs.
* **Phase 1 — External Clients:** MusicBrainz, Wikidata, Spotify, YouTube — wszyscy z cache, retry, graceful degradation.
* **Phase 2 — Ingestion Pipeline:** Workflow A — 9-stepowy Celery chain idempotent z abort propagation + hard cost ceiling.
* **Phase 3 — Backend API + Frontend:**
  * Backend: `ScoreEditionViewSet` (`/api/archive/editions/`) — create (multipart), list, retrieve, patch, delete, `approve`, `reingest?force=`.
  * Frontend: `features/score-compiler/` FSD slice — typy + axios service + TanStack Query hooks (z optimistic updates na piece + edition patches, polling co 3 s gdy chain biegnie) + komponenty:
    * `ScoreCompilerPage` (lazy, default export, route `/panel/score-compiler`, manager-only)
    * `EditionUploadZone` — natywny HTML5 drag-and-drop, multi-file równoległy upload, per-plik progress bar
    * `EditionStatusList` + `EditionStatusBadge` — auto-polling, kinetyczny spinner na statusach `EXTR/ENRI/GENR`, akcje Review / Re-run / Delete (potwierdzenie przez `ConfirmModal`)
    * `ConductorReviewModal` — pełny przegląd ScoreEdition: edytowalne pola piece (`title`, `opus_catalog`, `musical_key`, `language`, `voicing`, `text_source`, `composition_year`, `lyrics_original`) + edition (`publisher`, `editor_name`, `edition_year`, `is_default`); read-only: composer summary (z portretem, linki do MB/Wikidata), movements, IPA, translations, program note, recordings (Spotify/YouTube). Action bar: Save changes (dispatches PATCH /pieces + PATCH /editions tylko gdy dirty), Re-run pipeline, Approve (włącza tylko przy statusie AWAI).
  * Nawigacja: nowy wpis `Score Compiler` w `ADMIN_NAV_GROUPS → data_admin` z ikoną `ScanSearch`, preloader zarejestrowany w `App.tsx`.
  * **Integracja z ArchiveManagement (po pierwszym uplodzie produkcyjnym):**
    * **Hotfix:** Haiku 4.5 odrzuca `output_config.effort` (400 BadRequest). `AIClient.parse` ma teraz set `_MODELS_WITHOUT_EFFORT = {HAIKU}` i pomija pole dla tych modeli — call site'y nie muszą wiedzieć. Dodatkowo: nowa klasa `AIClientPermanentError(AIClientError)` dla 4xx (BadRequest/Auth/PermissionDenied) — `_guarded` łapie ją i wywołuje `_fail()` zamiast pozwalać Celery autoretry 3× powtarzać ten sam zepsuty request. Wcześniejszy traceback: tasks.py:131 → 3× retry → ostatecznie ERROR (wszystko trwało ~8 s i marnowało worker cycles).
    * **PieceSerializer = single source of truth.** Embedował już `tracks` i `voice_requirements`; teraz dokłada `composer` jako nested `_ComposerSummarySerializer` (zamiast string FK), `composer_id` jako write-only PrimaryKeyRelatedField (back-compat: stare write payloads `composer: <uuid>` aliasowane w `to_internal_value`), plus `movements`, `translations`, `recordings`, `program_notes`, `ingestion_status`, `ingestion_status_display`. Jeden DTO konsumowany przez Archive + Score Compiler + Materials.
    * **`shared/types/Piece` i `Composer` rozszerzone** o wszystkie nowe pola (mbid, wikidata_qid, nationality, period, bio, portrait_url, opus_catalog, musical_key, text_source, lyrics_ipa, mbid_work, movements[], translations[], recordings[], program_notes[], ingestion_status). `score-compiler.dto.ts` re-eksportuje shared shapes pod historycznymi aliasami DTO (`PieceSummaryDTO = Piece` etc.) — zero duplikacji typów.
    * **`useArchiveData` ma uproszczoną pętlę dedup** — backend już embeduje composer, więc ręczne join przez `composers.find()` zostało usunięte (był to silent runtime bug po zmianie shape'u). `EnrichedPiece` to teraz `type alias = Piece`.
    * **ArchiveEditorPanel ma trzecią zakładkę „Kontekst AI"** (`ARCHIVE_TABS.AI_CONTEXT`) — read-only widok komponowany z tych samych sekcji co `ConductorReviewModal`: composer card z portretem + MB/Wikidata, identyfikatory utworu (opus/key/text_source/mbid_work), movements, IPA, translations, program notes, recordings. Z deep-linkiem do `/panel/score-compiler` dla edycji. Empty state dla ręcznie wpisanych utworów.
    * **PieceCard ma badge „AI"** w klasterze `PDF` / `Audio` gdy piece ma jakiekolwiek treści wygenerowane przez pipeline (mbid_work, lyrics_ipa, translations, program_notes lub recordings). Kolor zależy od `ingestion_status`: zielony dla RDY, złoty dla AWAI, fioletowy dla in-progress.
    * **Conductor review modal — nowa sekcja „Materiały wykonawcze":**
      * **`estimated_duration`** — dwa inputy (min/sec) zaintegrowane z RHF schema + dirty tracking; rekombinowane do sekund na submit. Pusta para = `null` (clear).
      * **`DivisiEditor`** — kompaktowy wybór ilości głosów per `voice_line` z `+ / −` przyciskami. State trzymany poza RHF (RHF flat schema nie reprezentuje tablicy ergonomicznie); osobny `requirementsDirty` przez deep-equal porównanie sortowanego stringa, fold-in do `piecePatch.requirements_data` na submit. Backend `PieceSerializer.requirements_data` (legacy write-only JSONField) konsumuje to bez nowego endpointu.
    * **Cross-links:**
      * ArchiveAIContextTab → przycisk „Edytuj w Score Compilerze" → `/panel/score-compiler`.
      * EditionStatusList row → przycisk „W archiwum" (tylko gdy `edition.piece` ustawione) → `/panel/archive-management`.
  * **Archive ↔ Materials field-parity pass (po pierwszym smoke-teście integracji):**
    * **Backend `PieceSerializer.editions[]`** — nowy `_PieceEditionSummarySerializer` embedduje lean ScoreEditions (id, pdf_file, original_filename, publisher, edition_year, editor_name, page_count, is_default, ingestion_status, created_at). `PieceViewSet` queryset rozszerzony o `prefetch_related` dla wszystkich 5 nested relations (movements, translations, recordings, program_notes, editions) — zero N+1.
    * **Backend `_ComposerSummarySerializer`** dostał `bio` + `portrait_license` (poprzednio Score Compiler nie zwracał ich w embedded composer, więc Archive widok nie mógł renderować pełnego bio).
    * **Materials backend (`ParticipationMaterialsSerializer`)** — dashboard endpoint dla artystów dostał Score Compiler enrichments. `ComposerSnippetSerializer` rozszerzony o pełne metadane (mbid, wikidata_qid, nationality, period, bio, portrait_url). `PieceMaterialsSerializer` zwraca teraz `opus_catalog`, `musical_key`, `text_source`, `lyrics_ipa`, `mbid_work` plus 4 nested arrays (`translations`, `recordings`, `program_notes`, `editions`) z dedykowanymi snippet serializerami. Queryset (`get_artist_materials_queryset`) dostał 4 dodatkowe `Prefetch` z `to_attr` — wciąż fixed query count.
    * **Frontend `shared/types`** — `ScoreEditionSummary` interface dodany; `Piece.editions?: ScoreEditionSummary[]` dodane.
    * **Frontend helpers (FSD `archive/constants/`):**
      * `getReferenceRecordingLinks()` przepisany — merge'uje legacy `reference_recording_*` URL-e ZE Score Compiler `recordings[]`. Dedupy per-platform: gdy SPF/YTB w `recordings[]` istnieje, legacy field tej samej platformy jest skipowany. Sortuje featured-first. Obsługuje Apple Music + Other.
      * `getPiecePdfLinks()` (nowy) — merge'uje legacy `sheet_music` + ScoreEdition `editions[]`. Edition-list ma priorytet (gdy istnieją editions, legacy field nie jest pokazywany — żeby uniknąć "dwóch tych samych PDF-ów"). Default edition sortuje się pierwsza, potem chronologicznie. Każdy zwracany link ma flagę `is_legacy` żeby UI mógł oznaczyć stare wpisy.
    * **`PieceCard` (Archive list):**
      * PDF badge używa `getPiecePdfLinks` — pokazuje liczbę gdy >1 edition.
      * Reference recordings w expanded view używa unified helper — wspiera Apple/Other platformy, `title=` atrybut z performer/year.
    * **`PieceDetailsForm` (Archive edit form):** nowa GlassCard sekcja „Identyfikatory utworu" z edytowalnymi inputami dla `opus_catalog`, `musical_key`, `text_source` + collapsible textarea dla `lyrics_ipa`. `usePieceForm` wires defaults / normalize / reset / submit payload dla wszystkich 4 nowych pól. Dyrygent może poprawić źle wyciągniętą metadanę bez wchodzenia do Score Compilera.
    * **`ArchiveAIContextTab`** — nowa „Wydania nutowe" GlassCard z linkami do każdego PDF (default + legacy badges, publisher/year/page count). `hasAnything` uwzględnia editions.
    * **Materials feature (`features/materials/`):**
      * `MaterialsPiece` DTO rozszerzony o `opus_catalog`, `musical_key`, `text_source`, `lyrics_ipa`, `mbid_work`, `translations[]`, `recordings[]`, `program_notes[]`, `editions[]`. `MaterialsComposer` ma teraz pełne bio + portret + identyfikatory MB/Wikidata.
      * `PieceMaterialCard` używa `getPiecePdfLinks` (multi-PDF lista z domyślnym wydaniem na górze) + `getReferenceRecordingLinks` (multi-platform z performer/year). PDF badge pokazuje liczbę.
      * `PieceLyricsViewer` przepisany — przyjmuje teraz `lyricsIpa`, `translations[]` (multilang), `programNotes[]`. Renderuje: oryginał + IPA side-by-side (line-by-line aligned), per-language cards dla każdego tłumaczenia (singable flag), program note section z language/tone metadata. Legacy `translationNotes` (scalar) tylko gdy brak nowego `translations[]` — żeby uniknąć duplikacji. Artyści w `/panel/materials` widzą teraz wszystko co AI wygenerował.
  * **Polish pass (po smoke-teście Phase 3):**
    * `EditionUploadZone` przeszedł na `react-dropzone` (~10 kB gz) — daje folder-drop, MIME reject reasons jako rozróżnione `errors[].code`, native keyboard a11y (focus + Enter), `getRootProps`/`getInputProps`. `@dnd-kit` był rozważany i odrzucony — nie obsługuje OS file-drops.
    * Krytyczny bug w `ConductorReviewModal`: RHF `values: initial` resetował formularz przy każdym TanStack refetch (co 3 s gdy chain biegnie), kasując edycje dyrygenta w locie. Zastąpione przez `defaultValues` + ręczną synchronizację w `useEffect` keyed na `edition.updated_at` z guardem `!isDirty` — server-side advance respektuje user edits.
    * Re-run pipeline jest teraz za `ConfirmModal` (ostrzeżenie o naliczeniu kosztów do ceiling) zarówno w modal review jak i w status list.
    * Save action używa `reset(values, { keepValues: true })` — natychmiast czyści `isDirty` bez czekania na poll-refetch (który i tak dopełni server-side normalizację przez dirty-aware sync effect).
    * Composer portrait dostał `onError` fallback do placeholdera (Wikimedia FilePath URL-e bywają 404 lub redirect przez CORS-restricted host).
    * Approve jest zablokowany gdy `piece.composer === null` (zdarza się gdy `resolve_composer_and_piece` nie znalazł kandydatów) — `title=` przycisku tłumaczy, czego brakuje.
    * `useScoreEdition` (detail) ma `refetchOnWindowFocus: false` — dyrygent przełącza karty (MusicBrainz, Wikidata) bez kasowania kontekstu edycji.
    * Wszystkie hard-coded polskie stringi przeniesione do `t("score_compiler.*", "polski default")` — match codebase convention, ekstraktowalne przez i18next-parser.

### Do zrobienia

* **Phase 4 — Annotation Editor:** PDF.js + Konva overlay, layered annotations (highlight/comment/freehand/page ops), touch support dla iPad.
* **Phase 5 — Concert Assembly:** Workflow B — WeasyPrint + pypdf scalanie do concert binder PDF, variant export (conductor/singer).
* **Phase 6 — Polish:** OCR fallback dla scan PDFs, eval harness (10+ reference scores), cost dashboards, Sentry breadcrumbs. Composer disambiguation modal (gdy dedup priority 3–5 znajduje wielu kandydatów) jest dziełem Phase 6 — obecnie najpierw-wygrywający-priorytet jest wystarczająco bezpieczny (dyrygent może edytować nazwisko ręcznie w review modal).

---

## 12. Pliki i ich rola

```
backend/archive/
├── models.py                          # Encje DB (Phase 0)
├── dtos.py                            # Pydantic schemas (AI output + lookup results)
├── admin.py                           # Django admin dla nowych encji
├── tasks.py                           # 9 Celery tasks + build_ingestion_chain()
├── migrations/
│   ├── 0012_score_package_compiler.py # Nowe tabele + rozszerzenia
│   └── 0013_*.py                      # Auto-generated cleanup
├── infrastructure/
│   ├── _http.py                       # Shared HTTP (cache + retry)
│   ├── ai_client.py                   # AIClient wrapper, cost tracking, ceiling
│   ├── prompts.py                     # Versioned prompts (4 sztuki)
│   ├── pdf_extractor.py               # pypdf wrapper
│   ├── musicbrainz_client.py
│   ├── wikidata_client.py
│   ├── spotify_client.py
│   └── youtube_client.py
└── services/
    ├── ingestion.py                   # start_ingestion() façade
    ├── provenance.py                  # record_ai / record_external / record_manual
    └── resolvers.py                   # composer + piece dedup/create

frontend/src/features/score-compiler/   # Phase 3 — UI slice (FSD)
├── ScoreCompilerPage.tsx               # default export, lazy entry, route /panel/score-compiler
├── api/
│   ├── score-compiler.service.ts       # axios: list/retrieve/upload/patch/delete/approve/reingest + patchPiece
│   └── score-compiler.queries.ts       # TanStack hooks z polling (3s) + optimistic updates
├── types/
│   └── score-compiler.dto.ts           # ScoreEditionListDTO/DetailDTO, PiecePatchDTO, status tones
└── components/
    ├── EditionStatusBadge.tsx
    ├── EditionUploadZone.tsx           # drag-and-drop multi-file
    ├── EditionStatusList.tsx           # live list + ConfirmModal-gated delete
    └── modals/
        └── ConductorReviewModal.tsx    # edit + Approve + Re-run
```

---

## 13. Notatka dla agentów AI

Jeśli jesteś modelem (Claude, Cursor, Copilot, Codex) modyfikującym ten codebase:

1. **Nie modyfikuj `prompts.py` tekstów inline** — zmiana invaliduje prompt cache i version. Jeśli chcesz porównać warianty: dodaj nowy `Prompt('foo_v2', ...)` obok starego.
2. **Nigdy nie usuwaj `_guarded` decoratora z taska** — bez niego `CostCeilingExceeded` zostanie podniesione do Celery retry, który trzy razy spróbuje wykonać kosztowny task i wyczyści konto Anthropic.
3. **Zawsze stosuj `_bill_edition(edition, cost.total_cents)` PO każdym AI call** — pominięcie psuje rachunkowość i hard cap nie zadziała.
4. **Dla każdego nowego AI-generated pola wpisuj `provenance.record_ai(...)`** — bez tego pole „pojawia się znikąd” i nie da się zregenerować.
5. **Nie wprowadzaj `temperature` / `top_p` / `top_k` do `AIClient.parse`** — Opus 4.7 zwraca 400 przy tych parametrach.
6. **Zachowaj idempotencję** — każdy task powinien sprawdzać DB state i pomijać pracę jeśli już zrobiona. Inaczej restart Celery worker'a w środku chain'a będzie podwajał dane.
