# roster/management/commands/seed_db.py
# ==========================================
# Database Seeder (Enterprise SaaS 2026)
# ==========================================
"""
Generates a rich, realistic, Polish-flavoured dataset for local development,
demos, staging and manual QA. It works the ORM directly (bypassing the service
layer) so it stays resilient against service refactors, and is *idempotent*:
re-running it tops up missing rows instead of duplicating.

What it seeds, across every bounded context that exists today:

  • logistics  — Locations covering every category (halls, church, studio,
                 rehearsal room, hotel, station, airport, private workspace),
                 including one retired venue
  • core/IAM   — superuser, production manager and a crew account; per-user
                 UserProfiles (RBAC, salutation + vocative, sizes, digest
                 windows, consent stamps, generated avatars)
  • roster     — singers across the full voice spectrum in every account state
                 (activated / invited-but-not-activated / archived), conductors,
                 collaborators, projects in every lifecycle state, participations
                 (paid/unpaid), crew assignments, concert programmes with the
                 score-book cockpit overrides, micro-casting (divisi), rehearsals
                 (plenary + sectional) with attendance history, per-piece practice
                 readiness, and a ScorePackage per project in every build state
  • archive    — composers (some enriched with external identifiers) + repertoire
                 with opus/key/text-source/IPA/starting pitches, multi-movement
                 works, voice requirements, translations, reference recordings,
                 program notes, rehearsal audio, score editions across the whole
                 licence spectrum and every ingestion state, conductor markup
                 (annotation layers), provenance records and score access logs
  • documents  — Knowledge-Base categories + role-gated documents
  • messaging  — 1:1 artist↔management threads (assigned, unassigned intake,
                 project-anchored, archived) and per-project group channels
  • payments   — donations (settled/pending/failed) + recurring-patron leads
  • notifications — per-user inbox items spanning every composer, the pending
                 announcement queue of a live project, push devices and granular
                 delivery preferences

Flags:
  --artists N    number of active singers to generate (default 28)
  --seed N       RNG seed for a reproducible dataset (default 2026)
  --clear        hard-wipe previously-seeded data before re-seeding
  --no-media     skip generating placeholder files (audio tracks, score
                 editions, knowledge-base documents, avatars, score books)
  --quiet        only print the final summary

Login after seeding:  admin / admin123   (also  manager / manager123, crew / crew123)
"""

from __future__ import annotations

import base64
import hashlib
import io
import random
import struct
import uuid
from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, Any, NamedTuple
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont

# Archive
from archive.models import (
    Annotation,
    AnnotationType,
    Composer,
    EpochChoices,
    IngestionProgress,
    IngestionStatus,
    Movement,
    Piece,
    PieceVoiceRequirement,
    ProgramNote,
    ProvenanceRecord,
    ProvenanceSource,
    Recording,
    RecordingSource,
    ScoreAccessLog,
    ScoreEdition,
    ScoreLicenseType,
    Track,
    Translation,
)

# Core
from core.constants import AppRole, ClothingSizeChoices, VoiceLine
from core.models import UserProfile

# Documents (Knowledge Base / Chorister Hub)
from documents.models import Document, DocumentCategory, DocumentIconKey

# Logistics
from logistics.models import Location, LocationCategory

# Messaging
from messaging.models import (
    ChannelMembership,
    ChannelMessage,
    ChannelRole,
    Message,
    ProjectChannel,
    Thread,
    ThreadContextType,
    ThreadReadState,
    ThreadStatus,
)

# Notifications
from notifications.models import (
    AnnouncementKind,
    AnnouncementSubject,
    DeviceType,
    Notification,
    NotificationLevel,
    NotificationPreference,
    NotificationType,
    PendingAnnouncement,
    PushDevice,
)
from notifications.time_metadata import build_event_time_metadata

# Payments
from payments.models import Donation, DonationCurrency, DonationStatus, PatronLead, PatronLeadStatus

# Roster
from roster.invitations import build_invitation_context, build_invitation_metadata
from roster.models import (
    DEFAULT_EVENT_TIMEZONE,
    Artist,
    Attendance,
    Collaborator,
    CrewAssignment,
    Participation,
    PieceReadiness,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    Rehearsal,
    ScorePackage,
    VoiceType,
)
from roster.score_package_service import ScorePackageService

# `get_user_model()` returns a runtime value mypy cannot use as a type. Bind the
# concrete model under TYPE_CHECKING so annotations resolve, while keeping the
# dynamic swappable-model lookup at runtime.
if TYPE_CHECKING:
    from django.contrib.auth.models import User
else:
    User = get_user_model()

SEED_DOMAIN = "voctmanager.test"
TZ = DEFAULT_EVENT_TIMEZONE
# Mirrors LEGAL_DOCS_VERSION in the frontend's LegalContent — the version every
# seeded member is recorded as having accepted at activation.
TERMS_VERSION = "2026-07-09"


# --------------------------------------------------------------------------- #
# Static reference data                                                        #
# --------------------------------------------------------------------------- #

class LocationSpec(NamedTuple):
    name: str
    category: str
    address: str
    latitude: Decimal | None
    longitude: Decimal | None
    notes: str
    place_id: str = ""
    is_active: bool = True


# Keyed by the short handle projects and rehearsals refer to.
LOCATIONS: dict[str, LocationSpec] = {
    "philharmonic": LocationSpec(
        "Filharmonia Narodowa", LocationCategory.CONCERT_HALL,
        "Jasna 5, 00-013 Warszawa", Decimal("52.236000"), Decimal("21.010300"),
        "Wejście dla artystów od ul. Sienkiewicza. Garderoby na poziomie -1.",
        place_id="ChIJseed0000000000philharmonic",
    ),
    "church": LocationSpec(
        "Bazylika Świętego Krzyża", LocationCategory.CHURCH,
        "Krakowskie Przedmieście 3, 00-047 Warszawa", Decimal("52.238900"), Decimal("21.016600"),
        "Akustyka: ok. 4 s pogłosu. Ustawienie chóru na chórze organowym.",
        place_id="ChIJseed0000000000holycross",
    ),
    "studio": LocationSpec(
        "Studio Koncertowe S1 Polskiego Radia", LocationCategory.OTHER,
        "Woronicza 17, 00-999 Warszawa", Decimal("52.186900"), Decimal("21.007000"),
        "Sesja nagraniowa — cisza absolutna między ujęciami. Reżyserka na zapleczu.",
        place_id="ChIJseed0000000000studios1",
    ),
    "rehearsal": LocationSpec(
        "Sala prób — Dom Muzyka", LocationCategory.REHEARSAL_ROOM,
        "Złota 9, 00-019 Warszawa", Decimal("52.231000"), Decimal("21.005000"),
        "Kod do drzwi: 1903#. Fortepian nastrojony, pulpity w szafie.",
    ),
    "krakow": LocationSpec(
        "Filharmonia im. K. Szymanowskiego", LocationCategory.CONCERT_HALL,
        "Zwierzyniecka 1, 31-103 Kraków", Decimal("50.058800"), Decimal("19.932000"),
        "Przystanek trasy letniej. Nocleg 600 m od sali.",
        place_id="ChIJseed0000000000krakowphil",
    ),
    "hotel": LocationSpec(
        "Hotel Wyspiański", LocationCategory.HOTEL,
        "Westerplatte 15, 31-033 Kraków", Decimal("50.061400"), Decimal("19.941700"),
        "Doba hotelowa od 15:00. Śniadanie 6:30–10:00, dla chóru rezerwacja sali śniadaniowej.",
    ),
    "station": LocationSpec(
        "Dworzec Warszawa Centralna", LocationCategory.TRANSIT_STATION,
        "Aleje Jerozolimskie 54, 00-024 Warszawa", Decimal("52.228700"), Decimal("21.003300"),
        "Zbiórka pod tablicą odjazdów, peron 4. Bilety grupowe u kierownika trasy.",
    ),
    "airport": LocationSpec(
        "Lotnisko Chopina", LocationCategory.AIRPORT,
        "Żwirki i Wigury 1, 00-906 Warszawa", Decimal("52.165700"), Decimal("20.967200"),
        "Odprawa grupowa 2,5 h przed odlotem. Nuty wyłącznie w bagażu podręcznym.",
    ),
    "workspace": LocationSpec(
        "Pracownia dyrygenta", LocationCategory.WORKSPACE,
        "Adres prywatny — udostępniany indywidualnie", None, None,
        "Praca nad partiami solowymi i konsultacje. Maks. 4 osoby.",
    ),
    "retired": LocationSpec(
        "Sala prób — stara siedziba", LocationCategory.REHEARSAL_ROOM,
        "Hoża 42, 00-516 Warszawa", Decimal("52.223300"), Decimal("21.013900"),
        "Umowa najmu wygasła — zachowane dla historii projektów.",
        is_active=False,
    ),
}

# Polish first names paired with their vocative form (used in personalised
# greetings) and the grammatical salutation the greeting engine renders.
FEMALE_NAMES = [
    ("Anna", "Anno"), ("Maria", "Mario"), ("Katarzyna", "Katarzyno"),
    ("Magdalena", "Magdaleno"), ("Agnieszka", "Agnieszko"), ("Joanna", "Joanno"),
    ("Zofia", "Zofio"), ("Julia", "Julio"), ("Aleksandra", "Aleksandro"),
    ("Natalia", "Natalio"), ("Barbara", "Barbaro"), ("Ewa", "Ewo"),
    ("Hanna", "Hanno"), ("Karolina", "Karolino"), ("Marta", "Marto"),
    ("Weronika", "Weroniko"),
]
MALE_NAMES = [
    ("Jan", "Janie"), ("Piotr", "Piotrze"), ("Krzysztof", "Krzysztofie"),
    ("Andrzej", "Andrzeju"), ("Tomasz", "Tomaszu"), ("Paweł", "Pawle"),
    ("Marcin", "Marcinie"), ("Michał", "Michale"), ("Jakub", "Jakubie"),
    ("Wojciech", "Wojciechu"), ("Marek", "Marku"), ("Adam", "Adamie"),
    ("Grzegorz", "Grzegorzu"), ("Łukasz", "Łukaszu"), ("Filip", "Filipie"),
    ("Bartosz", "Bartoszu"),
]
# -ski/-ska stems (gender-inflected) and invariant surnames.
SKI_SURNAMES = [
    "Kowalsk", "Wiśniewsk", "Kamińsk", "Lewandowsk", "Zielińsk", "Szymańsk",
    "Dąbrowsk", "Kozłowsk", "Jankowsk", "Wojciechowsk", "Kwiatkowsk", "Krajewsk",
]
FLAT_SURNAMES = [
    "Nowak", "Wójcik", "Kowalczyk", "Woźniak", "Mazur", "Krawczyk", "Kaczmarek",
    "Zając", "Król", "Wróbel", "Adamczyk", "Pawlak", "Michalak", "Sikora",
]

# Diacritic → ASCII for e-mail local parts.
_PL_ASCII = str.maketrans({
    "ł": "l", "ą": "a", "ć": "c", "ę": "e", "ń": "n",
    "ó": "o", "ś": "s", "ź": "z", "ż": "z",
})

# Which divisi a singer of a given fach can be cast into.
VOICE_LINES_FOR: dict[str, list[str]] = {
    VoiceType.SOPRANO: [VoiceLine.SOPRANO_1, VoiceLine.SOPRANO_2],
    VoiceType.MEZZO: [VoiceLine.SOPRANO_2, VoiceLine.ALTO_1],
    VoiceType.ALTO: [VoiceLine.ALTO_1, VoiceLine.ALTO_2],
    VoiceType.COUNTERTENOR: [VoiceLine.ALTO_2, VoiceLine.TENOR_1],
    VoiceType.TENOR: [VoiceLine.TENOR_1, VoiceLine.TENOR_2],
    VoiceType.BARITONE: [VoiceLine.BASS_1, VoiceLine.TENOR_2],
    VoiceType.BASS: [VoiceLine.BASS_1, VoiceLine.BASS_2],
}
# Plausible vocal ranges (bottom, top) per fach.
RANGE_FOR: dict[str, tuple[str, str]] = {
    VoiceType.SOPRANO: ("C4", "C6"), VoiceType.MEZZO: ("A3", "A5"),
    VoiceType.ALTO: ("F3", "F5"), VoiceType.COUNTERTENOR: ("G3", "E5"),
    VoiceType.TENOR: ("C3", "B4"), VoiceType.BARITONE: ("A2", "G4"),
    VoiceType.BASS: ("E2", "E4"),
}

FEMALE_VOICES = [VoiceType.SOPRANO, VoiceType.SOPRANO, VoiceType.MEZZO, VoiceType.ALTO, VoiceType.ALTO]
MALE_VOICES = [
    VoiceType.TENOR, VoiceType.TENOR, VoiceType.BARITONE,
    VoiceType.BASS, VoiceType.BASS, VoiceType.COUNTERTENOR,
]


class ComposerSpec(NamedTuple):
    first_name: str
    last_name: str
    birth: str
    death: str
    nationality: str
    period: str
    aliases: tuple[str, ...] = ()
    # Wikidata QIDs are the real, stable ones where a well-known figure has one;
    # MusicBrainz ids are synthesised deterministically below, because a seeded
    # dataset must never imply a lookup that never happened.
    wikidata_qid: str = ""
    enriched: bool = False


COMPOSERS: tuple[ComposerSpec, ...] = (
    ComposerSpec("Wolfgang Amadeus", "Mozart", "1756", "1791", "Austrian", EpochChoices.CLASSICAL,
                 ("W.A. Mozart",), "Q254", enriched=True),
    ComposerSpec("Johann Sebastian", "Bach", "1685", "1750", "German", EpochChoices.BAROQUE,
                 ("J.S. Bach", "Bach, Johann Sebastian"), "Q1339", enriched=True),
    ComposerSpec("Arvo", "Pärt", "1935", "", "Estonian", EpochChoices.CONTEMPORARY,
                 ("Arvo Part",), enriched=True),
    ComposerSpec("Wacław", "z Szamotuł", "c. 1524", "c. 1560", "Polish", EpochChoices.RENAISSANCE,
                 ("Wacław z Szamotuł", "Venceslaus Samotulinus")),
    ComposerSpec("Eric", "Whitacre", "1970", "", "American", EpochChoices.CONTEMPORARY),
    ComposerSpec("Henryk Mikołaj", "Górecki", "1933", "2010", "Polish", EpochChoices.CONTEMPORARY,
                 ("H.M. Górecki",), enriched=True),
    ComposerSpec("Gregorio", "Allegri", "1582", "1652", "Italian", EpochChoices.BAROQUE),
    ComposerSpec("Felix", "Mendelssohn", "1809", "1847", "German", EpochChoices.ROMANTIC,
                 ("Felix Mendelssohn Bartholdy",)),
    ComposerSpec("Stanisław", "Moniuszko", "1819", "1872", "Polish", EpochChoices.ROMANTIC),
    ComposerSpec("Morten", "Lauridsen", "1943", "", "American", EpochChoices.CONTEMPORARY),
    ComposerSpec("Anton", "Bruckner", "1824", "1896", "Austrian", EpochChoices.ROMANTIC),
    ComposerSpec("Michael", "Praetorius", "1571", "1621", "German", EpochChoices.RENAISSANCE),
    ComposerSpec("Maurice", "Duruflé", "1902", "1986", "French", EpochChoices.MODERN_20),
    ComposerSpec("", "Anonim", "", "", "Polish", EpochChoices.FOLK, ("Tradycyjna",)),
)


class PieceSpec(NamedTuple):
    title: str
    composer: str
    epoch: str
    # ISO 639-1 (or a '+'-joined bilingual set) — the canonical form every
    # writer of `Piece.language` funnels through, and what the UI localizes.
    language: str
    voicing: str
    opus: str
    key: str
    year: int
    duration: int
    text_source: str
    lyrics: str
    ipa: str
    movements: tuple[str, ...] = ()
    arranger: str = ""
    # (voice label, chromatic index 0=C…11=B, octave) — top voice first.
    pitches: tuple[tuple[str, int, int], ...] = ()


PIECES: tuple[PieceSpec, ...] = (
    PieceSpec(
        "Ave verum corpus", "Mozart", EpochChoices.CLASSICAL, "la", "SATB", "K. 618",
        "D-dur", 1791, 210, "Hymn eucharystyczny",
        "Ave verum corpus, natum de Maria Virgine", "ˈaː.ve ˈveː.rum ˈkor.pus",
        pitches=(("S", 9, 4), ("A", 6, 4), ("T", 2, 4), ("B", 2, 3)),
    ),
    PieceSpec(
        "Magnificat", "Bach", EpochChoices.BAROQUE, "la", "SSATB", "BWV 243",
        "D-dur", 1723, 1680, "Łk 1, 46–55",
        "Magnificat anima mea Dominum", "maˈɲiː.fi.kat ˈaː.ni.ma ˈmeː.a",
        movements=("Magnificat", "Et exsultavit", "Quia respexit", "Omnes generationes", "Fecit potentiam"),
        pitches=(("S I", 6, 5), ("S II", 2, 5), ("A", 9, 4), ("T", 6, 4), ("B", 2, 3)),
    ),
    PieceSpec(
        "Bogoroditse Devo", "Pärt", EpochChoices.CONTEMPORARY, "cu", "SATB", "",
        "", 1990, 110, "Modlitwa maryjna",
        "Bogoroditse Devo, raduisia", "bɐ.ɡɐˈro.dʲɪ.tsɛ ˈdʲe.vɐ",
        pitches=(("S", 4, 5), ("A", 11, 4), ("T", 7, 4), ("B", 4, 3)),
    ),
    PieceSpec(
        "Już się zmierzcha", "z Szamotuł", EpochChoices.RENAISSANCE, "pl", "SATB", "",
        "", 1556, 180, "Pieśń wieczorna",
        "Już się zmierzcha, idzie noc", "ˈju ɕɛ ˈzmjɛʐ.xa",
        pitches=(("S", 5, 5), ("A", 0, 5), ("T", 8, 4), ("B", 5, 3)),
    ),
    PieceSpec(
        "Sleep", "Whitacre", EpochChoices.CONTEMPORARY, "en", "SSAATTBB", "",
        "", 2000, 330, "Tekst: Charles Anthony Silvestri",
        "The evening hangs beneath the moon", "ðə ˈiːv.nɪŋ hæŋz",
        pitches=(("S I", 4, 5), ("S II", 0, 5), ("A", 9, 4), ("T", 4, 4), ("B", 9, 2)),
    ),
    PieceSpec(
        "Totus Tuus", "Górecki", EpochChoices.CONTEMPORARY, "la", "SATB", "Op. 60",
        "", 1987, 540, "Akt zawierzenia Maryi",
        "Totus Tuus sum, Maria", "ˈtoː.tus ˈtuː.us sum maˈriː.a",
        pitches=(("S", 7, 5), ("A", 2, 5), ("T", 11, 4), ("B", 7, 3)),
    ),
    PieceSpec(
        "Miserere mei, Deus", "Allegri", EpochChoices.BAROQUE, "la", "SSATB SATB", "",
        "g-moll", 1638, 720, "Ps 51",
        "Miserere mei, Deus", "mi.zeˈreː.re ˈmeː.i ˈdeː.us",
        pitches=(("S", 7, 4), ("A", 3, 4), ("T", 10, 3), ("B", 7, 2)),
    ),
    PieceSpec(
        "Verleih uns Frieden", "Mendelssohn", EpochChoices.ROMANTIC, "de", "SATB", "",
        "", 1831, 300, "Tekst: Martin Luther",
        "Verleih uns Frieden gnädiglich", "fɛɐ̯ˈlaɪ̯ ʊns ˈfʁiː.dn̩",
        pitches=(("S", 0, 5), ("A", 8, 4), ("T", 5, 4), ("B", 0, 3)),
    ),
    PieceSpec(
        "Modlitwa", "Moniuszko", EpochChoices.ROMANTIC, "pl", "SATB", "",
        "", 1860, 240, "Pieśń religijna",
        "Ojcze z niebios, Boże, Panie", "ˈɔj.t͡ʂɛ z ˈɲɛ.bjɔs",
        pitches=(("S", 2, 5), ("A", 9, 4), ("T", 6, 4), ("B", 2, 3)),
    ),
    PieceSpec(
        "O magnum mysterium", "Lauridsen", EpochChoices.CONTEMPORARY, "la", "SATB", "",
        "D-dur", 1994, 360, "Responsorium na Boże Narodzenie",
        "O magnum mysterium", "o ˈmaɡ.num misˈteː.ri.um",
        pitches=(("S", 9, 4), ("A", 6, 4), ("T", 2, 4), ("B", 2, 3)),
    ),
    PieceSpec(
        "Locus iste", "Bruckner", EpochChoices.ROMANTIC, "la", "SATB", "WAB 23",
        "C-dur", 1869, 180, "Graduał na poświęcenie kościoła",
        "Locus iste a Deo factus est", "ˈlo.kus ˈis.te a ˈde.o",
        pitches=(("S", 0, 5), ("A", 7, 4), ("T", 4, 4), ("B", 0, 3)),
    ),
    PieceSpec(
        "In dulci jubilo", "Praetorius", EpochChoices.RENAISSANCE, "de+la", "SATB", "",
        "F-dur", 1607, 150, "Kolęda makaroniczna (XIV w.)",
        "In dulci jubilo, nun singet und seid froh", "ɪn ˈdʊl.t͡si juˈbiː.lo",
        arranger="M. Brzózka",
        pitches=(("S", 5, 5), ("A", 0, 5), ("T", 9, 4), ("B", 5, 3)),
    ),
    PieceSpec(
        "Ubi caritas", "Duruflé", EpochChoices.MODERN_20, "la", "SATB", "Op. 10 nr 1",
        "", 1960, 180, "Antyfona z liturgii Wielkiego Czwartku",
        "Ubi caritas et amor, Deus ibi est", "ˈu.bi ˈka.ri.tas ɛt ˈa.mor",
        pitches=(("S", 5, 5), ("A", 0, 5), ("T", 8, 4), ("B", 5, 3)),
    ),
    PieceSpec(
        "Oj, chmielu, chmielu", "Anonim", EpochChoices.FOLK, "pl", "SATB", "",
        "a-moll", 1900, 130, "Polska pieśń weselna",
        "Oj, chmielu, chmielu, ty bujne ziele", "ɔj ˈxmjɛ.lu ˈxmjɛ.lu",
        arranger="M. Brzózka",
        pitches=(("S", 9, 4), ("A", 4, 4), ("T", 0, 4), ("B", 9, 2)),
    ),
)

# pl/en singable-vs-literal translations, plus a credited translator where one
# would realistically appear on a concert card.
TRANSLATIONS: dict[str, tuple[tuple[str, str, bool, str], ...]] = {
    "Ave verum corpus": (
        ("pl", "Witaj, prawdziwe Ciało, zrodzone z Maryi Dziewicy", False, "ks. T. Karyłowski"),
        ("en", "Hail, true Body, born of the Virgin Mary", False, ""),
    ),
    "Bogoroditse Devo": (
        ("pl", "Bogurodzico Dziewico, raduj się", True, "M. Brzózka"),
        ("en", "Rejoice, O Virgin Mother of God", False, ""),
    ),
    "O magnum mysterium": (
        ("pl", "O wielka tajemnico i przedziwny sakramencie", False, ""),
    ),
    "Locus iste": (
        ("pl", "Miejsce to zostało uczynione przez Boga", False, ""),
    ),
    "Ubi caritas": (
        ("pl", "Gdzie miłość wzajemna i dobroć, tam znajdziesz Boga żywego", True, "ks. W. Danielski"),
        ("fr", "Là où sont la charité et l'amour, Dieu est présent", False, ""),
    ),
    "In dulci jubilo": (
        ("pl", "W słodkim weselu śpiewajcie i radujcie się", False, ""),
    ),
    "Verleih uns Frieden": (
        ("pl", "Racz nam dać pokój, Panie, w naszych czasach", False, ""),
    ),
}

PROGRAM_NOTES: dict[str, str] = {
    "Sleep": (
        "Whitacre napisał „Sleep” pierwotnie do wiersza Roberta Frosta; po sporze o prawa "
        "autorskie powstał nowy tekst Silvestriego. Gęste, ośmiogłosowe współbrzmienia budują "
        "obraz powolnego zapadania w sen."
    ),
    "Totus Tuus": (
        "Hołd Góreckiego dla Jana Pawła II, napisany na jego trzecią pielgrzymkę do Polski "
        "w 1987 roku. Hipnotyczne powtórzenia imienia Maryi wyrastają wprost z zawołania "
        "z papieskiego herbu."
    ),
    "Miserere mei, Deus": (
        "Przez blisko dwa stulecia partytura „Miserere” nie opuszczała Kaplicy Sykstyńskiej. "
        "Legenda o czternastoletnim Mozarcie, który zapisał ją z pamięci po jednym wysłuchaniu, "
        "mówi mniej o jego pamięci niż o tym, jak pilnie strzeżony był ten utwór."
    ),
    "Locus iste": (
        "Graduał na poświęcenie kaplicy w katedrze w Linzu. Cztery minuty, w których Bruckner "
        "mówi o świętości miejsca wyłącznie środkami harmonii — bez jednego słowa ponad tekst "
        "liturgiczny."
    ),
}


class EditionSpec(NamedTuple):
    publisher: str
    editor: str
    year: int
    license_type: str
    copies_owned: int | None = None
    ingestion: str = IngestionStatus.READY


# Licence status drives export gating and watermarking, so the seed deliberately
# spans the whole spectrum: public-domain reprints of the old repertoire, bought
# physical copies for the living composers, one publisher digital licence and two
# editions nobody has triaged yet (which the policy treats as protected).
EDITIONS: dict[str, EditionSpec] = {
    "Ave verum corpus": EditionSpec("Bärenreiter", "H. Beck", 1996, ScoreLicenseType.PUBLIC_DOMAIN),
    "Magnificat": EditionSpec("Carus", "U. Wolf", 2003, ScoreLicenseType.PUBLIC_DOMAIN),
    "Bogoroditse Devo": EditionSpec("Universal Edition", "", 1990, ScoreLicenseType.UNKNOWN),
    "Już się zmierzcha": EditionSpec("PWM", "M. Perz", 1988, ScoreLicenseType.PUBLIC_DOMAIN),
    "Sleep": EditionSpec("Walton Music", "", 2002, ScoreLicenseType.LICENSED_COPIES, copies_owned=24),
    "Totus Tuus": EditionSpec("PWM", "", 1987, ScoreLicenseType.PUBLISHER_DIGITAL),
    "Miserere mei, Deus": EditionSpec("IMSLP", "", 2009, ScoreLicenseType.PUBLIC_DOMAIN),
    "Verleih uns Frieden": EditionSpec("Carus", "R. Wehner", 2009, ScoreLicenseType.PUBLIC_DOMAIN),
    "Modlitwa": EditionSpec("PWM", "", 1998, ScoreLicenseType.PUBLIC_DOMAIN),
    "O magnum mysterium": EditionSpec(
        "Peermusic", "", 1994, ScoreLicenseType.LICENSED_COPIES, copies_owned=16,
    ),
    "Locus iste": EditionSpec("IMSLP", "", 2011, ScoreLicenseType.PUBLIC_DOMAIN),
    "In dulci jubilo": EditionSpec("IMSLP", "", 2014, ScoreLicenseType.PUBLIC_DOMAIN),
    # Mid-review: the AI has run and is waiting for the conductor in the ingestion cockpit.
    "Ubi caritas": EditionSpec(
        "Durand", "", 1960, ScoreLicenseType.UNKNOWN, ingestion=IngestionStatus.AWAITING,
    ),
    # A scan the pipeline could not read — the failure state the cockpit must surface.
    "Oj, chmielu, chmielu": EditionSpec(
        "Skan archiwalny", "", 1975, ScoreLicenseType.PUBLIC_DOMAIN, ingestion=IngestionStatus.FAILED,
    ),
}


class ProjectSpec(NamedTuple):
    title: str
    status: str
    # Days from "now" — negative for concerts already played.
    days: int
    location: str
    conductor: int
    programme: tuple[str, ...]
    density: str = ScorePackage.Density.CONCERT
    package_status: str = ScorePackage.Status.IDLE
    # Local wall-clock start. Everything the app renders is a moment someone has
    # to be somewhere, so a dataset seeded at 15:39 would make every screen lie
    # about what an evening concert looks like.
    hour: int = 19
    minute: int = 0
    # Carries the unpublished announcement queue. Exactly one project should, so
    # the review sheet has something waiting without every live project nagging.
    holds_announcements: bool = False


# When rehearsals start, in the venue's own local time.
REHEARSAL_HOUR = 18
REHEARSAL_MINUTE = 30


PROJECTS: tuple[ProjectSpec, ...] = (
    ProjectSpec(
        "Festiwal Muzyki Dawnej — Wratislavia", Project.Status.COMPLETED, -45, "church", 1,
        ("Już się zmierzcha", "In dulci jubilo", "Miserere mei, Deus", "Magnificat"),
        package_status=ScorePackage.Status.READY,
    ),
    ProjectSpec(
        "Koncert Pasyjny „Miserere”", Project.Status.COMPLETED, -12, "philharmonic", 0,
        ("Miserere mei, Deus", "Ubi caritas", "Verleih uns Frieden", "Totus Tuus"),
        package_status=ScorePackage.Status.READY,
    ),
    ProjectSpec(
        "Msza św. w intencji Fundacji", Project.Status.ACTIVE, 6, "church", 0,
        ("Locus iste", "Ave verum corpus", "Ubi caritas", "Totus Tuus", "Modlitwa"),
        density=ScorePackage.Density.MASS, package_status=ScorePackage.Status.READY,
        hour=12,
    ),
    ProjectSpec(
        "Koncert Wiosenny „Lux Aeterna”", Project.Status.ACTIVE, 18, "philharmonic", 0,
        ("O magnum mysterium", "Sleep", "Bogoroditse Devo", "Totus Tuus", "Ave verum corpus"),
        package_status=ScorePackage.Status.BUILDING, holds_announcements=True,
    ),
    ProjectSpec(
        "Nagranie albumu a cappella", Project.Status.ACTIVE, 9, "studio", 0,
        ("Bogoroditse Devo", "Sleep", "O magnum mysterium", "Locus iste", "Ubi caritas"),
        package_status=ScorePackage.Status.QUEUED,
        hour=10,
    ),
    ProjectSpec(
        "Kolędy i pastorałki", Project.Status.DRAFT, 75, "church", 1,
        ("In dulci jubilo", "O magnum mysterium", "Modlitwa"),
        package_status=ScorePackage.Status.FAILED,
    ),
    ProjectSpec(
        "Trasa letnia — Kraków", Project.Status.DRAFT, 130, "krakow", 0,
        ("Oj, chmielu, chmielu", "Już się zmierzcha", "Modlitwa", "Sleep"),
    ),
    ProjectSpec(
        "Koncert charytatywny — Wigilia dla samotnych", Project.Status.CANCELLED, 30, "philharmonic", 1,
        ("Ave verum corpus", "Locus iste"), hour=17,
    ),
)

# The Mass project's programme, by position: a liturgy names each piece by its
# moment in the rite, not by its opus number. The moment is the typed slot — the
# section heading and the printed role line derive from it — so the only thing
# left to seed beside it is the performers line, which is genuinely per concert.
MASS_ITEM_SLOTS: tuple[tuple[str, str], ...] = (
    ("entrance", ""),
    ("offertory", "Sopran solo: A. Kowalska"),
    ("communion", "Organy: P. Organista"),
    ("thanksgiving", ""),
    ("recessional", ""),
)

KNOWLEDGE_BASE: tuple[tuple[str, str, str, tuple[str, ...], str, tuple[str, ...]], ...] = (
    ("Regulamin i statut", "regulamin", DocumentIconKey.SCROLL_TEXT,
     (AppRole.ARTIST, AppRole.MANAGER, AppRole.CREW),
     "Dokumenty założycielskie fundacji i regulamin zespołu.",
     ("Statut Fundacji VoctFoundation", "Regulamin zespołu — wersja 2026")),
    ("Garderoba i stroje", "garderoba", DocumentIconKey.SHIRT,
     (AppRole.ARTIST, AppRole.MANAGER),
     "Wytyczne dotyczące strojów koncertowych i ich pielęgnacji.",
     ("Strój koncertowy — wytyczne", "Pielęgnacja i przechowywanie fraka")),
    ("Logistyka tras", "logistyka", DocumentIconKey.MAP_PIN,
     (AppRole.ARTIST, AppRole.MANAGER, AppRole.CREW),
     "Plany podróży, noclegi i harmonogramy tras koncertowych.",
     ("Trasa letnia 2026 — plan podróży", "Rozliczenie kosztów dojazdu")),
    ("Bezpieczeństwo", "bezpieczenstwo", DocumentIconKey.SHIELD,
     (AppRole.ARTIST, AppRole.MANAGER, AppRole.CREW),
     "Procedury BHP i kontakty alarmowe.",
     ("Procedura ewakuacji — sale koncertowe", "Kontakty alarmowe")),
    ("Onboarding", "onboarding", DocumentIconKey.GRADUATION_CAP,
     (AppRole.ARTIST,),
     "Przewodnik dla nowych członków zespołu.",
     ("Pierwsze kroki w zespole", "Jak czytać plan prób")),
    ("Techniczne — realizacja", "technika", DocumentIconKey.MIC_2,
     (AppRole.CREW, AppRole.MANAGER),
     "Ridery techniczne, plany sceny i ustawienia nagłośnienia.",
     ("Rider techniczny — chór 28 osób", "Plan sceny — Filharmonia Narodowa")),
)


def _ascii(value: str) -> str:
    """Lowercase ASCII slug suitable for an e-mail local part."""
    return value.translate(_PL_ASCII).lower()


def _slug(value: str) -> str:
    """ASCII, filesystem-safe stem for generated file names."""
    return "_".join(_ascii(value).replace(",", " ").replace("—", " ").split())


def _surname(is_female: bool) -> str:
    if random.random() < 0.55:
        stem = random.choice(SKI_SURNAMES)
        return stem + ("a" if is_female else "i")
    return random.choice(FLAT_SURNAMES)


def _synthetic_uuid(kind: str, key: str) -> uuid.UUID:
    """Stable, obviously-local identifier for a field that would normally hold an
    external one (MusicBrainz). Derived from the value rather than random so a
    re-seed does not churn the row, and namespaced so it can never collide with a
    real identifier that later arrives from the enrichment pipeline."""
    return uuid.uuid5(uuid.NAMESPACE_URL, f"voctmanager-seed://{kind}/{key}")


def _at_local_time(moment: datetime, hour: int, minute: int = 0) -> datetime:
    """Snap a moment to a wall-clock time in the ensemble's own timezone. Offsets
    are counted in days from "now", so without this every seeded concert would
    start at whatever o'clock the seeder happened to run.

    Handed back in UTC — the same shape the ORM returns on re-read. Anything that
    hashes a datetime's `isoformat()` (the score package's staleness signal does)
    would otherwise see the offset-bearing local value and the stored UTC one as
    two different inputs.
    """
    local = moment.astimezone(ZoneInfo(TZ)).replace(
        hour=hour, minute=minute, second=0, microsecond=0,
    )
    return local.astimezone(UTC)


def _lines_from_voicing(voicing: str) -> list[str]:
    """Parse a compact voicing label (e.g. 'SSAATTBB') into VoiceLine codes."""
    buckets = {
        "S": [VoiceLine.SOPRANO_1, VoiceLine.SOPRANO_2, VoiceLine.SOPRANO_3],
        "A": [VoiceLine.ALTO_1, VoiceLine.ALTO_2, VoiceLine.ALTO_3],
        "T": [VoiceLine.TENOR_1, VoiceLine.TENOR_2, VoiceLine.TENOR_3],
        "B": [VoiceLine.BASS_1, VoiceLine.BASS_2, VoiceLine.BASS_3],
    }
    seen = {"S": 0, "A": 0, "T": 0, "B": 0}
    lines: list[str] = []
    for char in voicing.upper():
        if char in buckets and seen[char] < 3 and buckets[char][seen[char]] not in lines:
            lines.append(buckets[char][seen[char]])
            seen[char] += 1
    return lines or [VoiceLine.SOPRANO_1, VoiceLine.ALTO_1, VoiceLine.TENOR_1, VoiceLine.BASS_1]


# --------------------------------------------------------------------------- #
# Placeholder media generators (only used when --no-media is NOT passed)       #
# --------------------------------------------------------------------------- #

def _placeholder_pdf(title: str, pages: int = 1) -> bytes:
    """Build a tiny, structurally-valid PDF whose every page carries a title line."""
    safe = title.replace("(", "").replace(")", "").encode("latin-1", "replace")
    page_count = max(1, pages)

    # Object ids: 1 catalog, 2 pages tree, 3 font, then a (page, content) pair each.
    kids = " ".join(f"{4 + i * 2} 0 R" for i in range(page_count))
    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{kids}] /Count {page_count} >>".encode(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    for index in range(page_count):
        content_id = 5 + index * 2
        stream = (
            b"BT /F1 18 Tf 60 780 Td (" + safe + b") Tj ET\n"
            b"BT /F1 11 Tf 60 60 Td (" + f"str. {index + 1} / {page_count}".encode() + b") Tj ET"
        )
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>".encode()
        )
        objects.append(
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"
        )

    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_pos = len(out)
    size = len(objects) + 1
    out += f"xref\n0 {size}\n".encode() + b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += b"trailer\n" + f"<< /Size {size} /Root 1 0 R >>\n".encode()
    out += b"startxref\n" + str(xref_pos).encode() + b"\n%%EOF"
    return bytes(out)


def _placeholder_wav(seconds: int = 1, rate: int = 8000) -> bytes:
    """A short silent mono 16-bit WAV — enough for the Songbook voice-mixer to load."""
    pcm = b"\x00\x00" * (seconds * rate)
    fmt = struct.pack("<4sIHHIIHH", b"fmt ", 16, 1, 1, rate, rate * 2, 2, 16)
    data = struct.pack("<4sI", b"data", len(pcm)) + pcm
    header = struct.pack("<4sI4s", b"RIFF", 4 + len(fmt) + len(data), b"WAVE")
    return header + fmt + data


# Gradient pairs sampled from the Ethereal palette (gold, sage, amethyst, incense,
# ink) so generated avatars sit inside the design system rather than beside it.
_AVATAR_GRADIENTS: tuple[tuple[tuple[int, int, int], tuple[int, int, int]], ...] = (
    ((201, 162, 39), (138, 154, 123)),
    ((122, 106, 155), (201, 162, 39)),
    ((138, 154, 123), (43, 42, 38)),
    ((191, 167, 143), (122, 106, 155)),
    ((43, 42, 38), (138, 154, 123)),
)


def _placeholder_avatar(key: str, initials: str, size: int) -> bytes:
    """A deterministic gradient render with the member's initials, encoded exactly
    like AvatarService does (square WebP) so the two are indistinguishable to
    every reader of the field."""
    index = int(hashlib.sha256(key.encode()).hexdigest(), 16) % len(_AVATAR_GRADIENTS)
    top, bottom = _AVATAR_GRADIENTS[index]

    image = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(image)
    for y in range(size):
        ratio = y / max(size - 1, 1)
        draw.line(
            [(0, y), (size, y)],
            fill=tuple(round(a + (b - a) * ratio) for a, b in zip(top, bottom, strict=True)),
        )
    font = ImageFont.load_default(size=max(10, size // 3))
    draw.text((size / 2, size / 2), initials, font=font, fill=(247, 245, 240), anchor="mm")

    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=82, method=6)
    return buffer.getvalue()


def _web_push_key(seed: str, length: int) -> str:
    """Base64url material of the right shape for a Web Push subscription key."""
    material = hashlib.sha512(seed.encode()).digest() * 2
    return base64.urlsafe_b64encode(material[:length]).decode().rstrip("=")


class Command(BaseCommand):
    help = "Generates a rich, realistic test dataset spanning every VoctManager domain."

    quiet: bool
    with_media: bool
    now: datetime
    locations: dict[str, Location]
    managers: list[User]
    crew_user: User
    composers: dict[str, Composer]
    pieces: dict[str, Piece]
    conductors: list[Artist]
    artists: list[Artist]
    collaborators: list[Collaborator]
    projects: list[Project]

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--artists", type=int, default=28, help="Number of active singers to generate.")
        parser.add_argument("--seed", type=int, default=2026, help="RNG seed for a reproducible dataset.")
        parser.add_argument("--clear", action="store_true", help="Hard-wipe previously-seeded data first.")
        parser.add_argument("--no-media", action="store_true", help="Skip generating placeholder files.")
        parser.add_argument("--quiet", action="store_true", help="Only print the final summary.")

    # ----------------------------------------------------------------- #
    # Orchestration                                                     #
    # ----------------------------------------------------------------- #
    def handle(self, *args: Any, **opts: Any) -> None:
        random.seed(opts["seed"])
        self.quiet = opts["quiet"]
        self.with_media = not opts["no_media"]
        self.now = timezone.now()

        media_note = "with placeholder media" if self.with_media else "metadata only (--no-media)"
        self._log(f"Seeding VoctManager ({media_note}). Password hashing may take a moment...",
                  self.style.WARNING)

        if opts["clear"]:
            self._clear()

        with transaction.atomic():
            self.locations = self._seed_locations()
            self.managers, self.crew_user = self._seed_staff_accounts()
            self.composers = self._seed_composers()
            self.pieces = self._seed_repertoire()
            self.conductors = self._seed_conductors()
            self.artists = self._seed_singers(opts["artists"])
            self._seed_archived_singers()
            self.collaborators = self._seed_collaborators()
            self._seed_knowledge_base()
            self.projects = self._seed_projects()
            self._seed_score_markup()
            self._seed_messaging()
            self._seed_payments()
            self._seed_notifications()

        self._print_summary()

    def _log(self, message: str, style: Callable[[str], str] | None = None) -> None:
        if self.quiet:
            return
        self.stdout.write(style(message) if style else message)

    # ----------------------------------------------------------------- #
    # 0. Reset (optional)                                               #
    # ----------------------------------------------------------------- #
    def _clear(self) -> None:
        """Best-effort hard reset of seeded data, deepest children first."""
        self._log("0. Clearing previously-seeded data...", self.style.WARNING)

        # Ordered child → parent to satisfy RESTRICT/PROTECT foreign keys.
        ordered: list[type[Any]] = [
            Notification, NotificationPreference, PushDevice, PendingAnnouncement,
            ChannelMessage, ChannelMembership, ProjectChannel,
            ThreadReadState, Message, Thread,
            Donation, PatronLead,
            Document, DocumentCategory,
            Attendance, PieceReadiness, ProjectPieceCasting, CrewAssignment,
            ProgramItem, Rehearsal, Participation, ScorePackage, Project,
            Collaborator,
            ProgramNote, Recording, Translation, Movement,
            ScoreAccessLog, Annotation, ScoreEdition, Track,
            PieceVoiceRequirement, ProvenanceRecord,
        ]
        for model in ordered:
            self._wipe(model)

        # Artists must drop before the auth users they reference; conductors are
        # the projects' SET_NULL target, already cleared above.
        self._wipe(Artist)
        self._wipe(Piece)
        self._wipe(Composer)
        Location.objects.filter(name__in=[spec.name for spec in LOCATIONS.values()]).delete()
        User.objects.filter(email__endswith=f"@{SEED_DOMAIN}").delete()

    @staticmethod
    def _wipe(model: type[Any]) -> None:
        manager = getattr(model, "all_objects", model.objects)
        queryset = manager.all()
        # Soft-delete querysets re-route .delete() to a flag flip — use the real purge.
        (queryset.hard_delete() if hasattr(queryset, "hard_delete") else queryset.delete())

    # ----------------------------------------------------------------- #
    # 1. Logistics                                                      #
    # ----------------------------------------------------------------- #
    def _seed_locations(self) -> dict[str, Location]:
        self._log("1. Locations (every category, incl. one retired venue)...")
        locations: dict[str, Location] = {}
        for key, spec in LOCATIONS.items():
            location, _ = Location.objects.get_or_create(
                name=spec.name,
                defaults={
                    "category": spec.category,
                    "formatted_address": spec.address,
                    "latitude": spec.latitude,
                    "longitude": spec.longitude,
                    "timezone": TZ,
                    "internal_notes": spec.notes,
                    "google_place_id": spec.place_id or None,
                    "is_active": spec.is_active,
                },
            )
            locations[key] = location
        return locations

    # ----------------------------------------------------------------- #
    # 2. Management + crew accounts                                     #
    # ----------------------------------------------------------------- #
    def _seed_staff_accounts(self) -> tuple[list[User], User]:
        self._log("2. Staff accounts (admin, production manager, technical crew)...")

        admin = User.objects.filter(username="admin").first()
        if admin is None:
            admin = User.objects.create_superuser("admin", f"admin@{SEED_DOMAIN}", "admin123")
        admin.first_name, admin.last_name = "Jan", "Kapelmistrz"
        admin.save()
        self._ensure_profile(
            admin, AppRole.MANAGER, phone="+48 600 100 100",
            vocative="Janie", salutation=UserProfile.Salutation.MASCULINE,
            digest_hour=8, activated=True,
        )

        manager = User.objects.filter(username="manager").first()
        if manager is None:
            manager = User.objects.create_user(
                "manager", f"manager@{SEED_DOMAIN}", "manager123",
                first_name="Helena", last_name="Zarządca",
            )
        self._ensure_profile(
            manager, AppRole.MANAGER, phone="+48 600 100 200",
            vocative="Heleno", salutation=UserProfile.Salutation.FEMININE,
            digest_hour=7, activated=True,
        )

        # The crew role gates its own slice of the knowledge base and never owns an
        # Artist row — the one account shape that proves the three roles are distinct.
        crew = User.objects.filter(username="crew").first()
        if crew is None:
            crew = User.objects.create_user(
                "crew", f"crew@{SEED_DOMAIN}", "crew123",
                first_name="Igor", last_name="Realizator",
            )
        self._ensure_profile(
            crew, AppRole.CREW, phone="+48 600 100 400",
            vocative="Igorze", salutation=UserProfile.Salutation.MASCULINE,
            digest_enabled=False, activated=True,
        )

        for user, initials in ((admin, "JK"), (manager, "HZ"), (crew, "IR")):
            self._attach_avatar(user, initials)

        return [admin, manager], crew

    def _ensure_profile(
        self,
        user: User,
        role: str,
        *,
        phone: str = "",
        vocative: str = "",
        salutation: str = UserProfile.Salutation.NEUTRAL,
        language: str = UserProfile.LanguageChoices.POLISH,
        digest_enabled: bool = True,
        digest_hour: int = 8,
        activated: bool = True,
        welcomed: bool = True,
    ) -> UserProfile:
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.timezone = TZ
        profile.language = language
        profile.salutation = salutation
        profile.digest_enabled = digest_enabled
        profile.digest_hour = digest_hour
        if phone:
            profile.phone_number = phone
        if vocative:
            profile.first_name_vocative = vocative
        if activated:
            # Consent is stamped once, at activation — so an account that has never
            # been activated must not carry it.
            profile.terms_accepted_at = profile.terms_accepted_at or (self.now - timedelta(days=120))
            profile.terms_accepted_version = TERMS_VERSION
            profile.notifications_seen_at = self.now - timedelta(hours=random.randint(2, 72))
            if welcomed:
                profile.welcome_seen_at = profile.welcome_seen_at or (self.now - timedelta(days=118))
        profile.save()
        return profile

    def _attach_avatar(self, user: User, initials: str) -> None:
        """Give the account both avatar renders, matching AvatarService's contract."""
        if not self.with_media:
            return
        profile = getattr(user, "profile", None)
        if profile is None or profile.avatar:
            return
        key = user.email or str(user.pk)
        profile.avatar.save("avatar.webp", ContentFile(_placeholder_avatar(key, initials, 512)), save=False)
        profile.avatar_thumb.save(
            "avatar_thumb.webp", ContentFile(_placeholder_avatar(key, initials, 96)), save=False
        )
        profile.save(update_fields=["avatar", "avatar_thumb", "updated_at"])

    # ----------------------------------------------------------------- #
    # 3. Archive — composers                                            #
    # ----------------------------------------------------------------- #
    def _seed_composers(self) -> dict[str, Composer]:
        self._log("3. Composers...")
        composers: dict[str, Composer] = {}
        for spec in COMPOSERS:
            composer, _ = Composer.objects.get_or_create(
                first_name=spec.first_name, last_name=spec.last_name,
                defaults={
                    "birth_year": spec.birth,
                    "death_year": spec.death,
                    "nationality": spec.nationality,
                    "period": spec.period,
                    "aliases": list(spec.aliases),
                    "wikidata_qid": spec.wikidata_qid,
                    "mbid": _synthetic_uuid("composer", spec.last_name) if spec.enriched else None,
                    "bio": (
                        f"{spec.first_name} {spec.last_name}".strip()
                        + f" — {spec.nationality} composer ({spec.birth or '?'}–{spec.death or '…'})."
                    ),
                },
            )
            composers[spec.last_name] = composer
        return composers

    # ----------------------------------------------------------------- #
    # 4. Archive — repertoire                                           #
    # ----------------------------------------------------------------- #
    def _seed_repertoire(self) -> dict[str, Piece]:
        self._log("4. Repertoire (pieces, movements, translations, recordings, editions, tracks)...")
        pieces: dict[str, Piece] = {}

        for spec in PIECES:
            piece, created = Piece.objects.get_or_create(
                title=spec.title,
                defaults={
                    "composer": self.composers.get(spec.composer),
                    "arranger": spec.arranger,
                    "epoch": spec.epoch,
                    "language": spec.language,
                    "voicing": spec.voicing,
                    "opus_catalog": spec.opus,
                    "musical_key": spec.key,
                    "composition_year": spec.year,
                    "estimated_duration": spec.duration,
                    "text_source": spec.text_source,
                    "lyrics_original": spec.lyrics,
                    "lyrics_ipa": spec.ipa,
                    "starting_pitches": [
                        {"voice": voice, "note": note, "octave": octave}
                        for voice, note, octave in spec.pitches
                    ],
                    "mbid_work": _synthetic_uuid("work", spec.title),
                    "description": f"{spec.voicing} · {spec.language} · {spec.text_source}",
                },
            )
            pieces[spec.title] = piece
            if not created:
                continue
            self._seed_piece_relations(piece, spec)
            if self.with_media:
                self._seed_piece_media(piece, spec)

        return pieces

    def _seed_piece_relations(self, piece: Piece, spec: PieceSpec) -> None:
        """Voice requirements, movements, translations, recordings and notes."""
        for line in _lines_from_voicing(spec.voicing):
            PieceVoiceRequirement.objects.get_or_create(
                piece=piece, voice_line=line, defaults={"quantity": random.randint(2, 6)},
            )

        for order_index, title in enumerate(spec.movements):
            Movement.objects.get_or_create(
                piece=piece, order_index=order_index,
                defaults={
                    "title": title,
                    "tempo_marking": random.choice(["Adagio", "Andante", "Allegro", "Largo", "Vivace"]),
                    "duration_seconds": random.randint(120, 360),
                    "voicing_override": spec.voicing if order_index == 0 else "",
                    # Publisher front matter, then one opening per movement — this is
                    # what the cockpit's page-trim suggestion is derived from.
                    "starts_on_page": 3 + order_index * 4,
                },
            )

        for language, text, singable, translator in TRANSLATIONS.get(spec.title, ()):
            Translation.objects.get_or_create(
                piece=piece, movement=None, target_language=language,
                defaults={"text": text, "is_singable": singable, "translator": translator},
            )

        Recording.objects.get_or_create(
            source=RecordingSource.SPOTIFY, external_id=f"spf-{_synthetic_uuid('spf', spec.title).hex[:12]}",
            defaults={
                "piece": piece, "url": "https://open.spotify.com/track/seed",
                "performer": "The Sixteen", "year": 2014,
                "duration_seconds": spec.duration, "is_featured": True,
            },
        )
        Recording.objects.get_or_create(
            source=RecordingSource.YOUTUBE, external_id=f"ytb-{_synthetic_uuid('ytb', spec.title).hex[:11]}",
            defaults={
                "piece": piece, "url": "https://www.youtube.com/watch?v=seed",
                "performer": "Voces8", "year": 2019, "duration_seconds": spec.duration,
            },
        )

        note = PROGRAM_NOTES.get(spec.title)
        if note:
            ProgramNote.objects.get_or_create(
                piece=piece, project=None, language="pl",
                defaults={
                    "content": note, "is_approved": True,
                    "target_tone": "accessible", "word_count_target": 120,
                },
            )

    def _seed_piece_media(self, piece: Piece, spec: PieceSpec) -> None:
        """Attach the piece's default score edition and per-section rehearsal tracks."""
        edition_spec = EDITIONS.get(spec.title)
        if edition_spec and not piece.editions.exists():
            pages = 4 + len(spec.movements) * 4
            pdf = _placeholder_pdf(f"{piece.title} — {edition_spec.publisher}", pages=pages)
            failed = edition_spec.ingestion == IngestionStatus.FAILED
            awaiting = edition_spec.ingestion == IngestionStatus.AWAITING
            edition = ScoreEdition(
                piece=piece,
                original_filename=f"{_slug(piece.title)}.pdf",
                page_count=pages,
                publisher=edition_spec.publisher,
                editor_name=edition_spec.editor,
                edition_year=edition_spec.year,
                is_default=True,
                license_type=edition_spec.license_type,
                copies_owned=edition_spec.copies_owned,
                sha256=hashlib.sha256(pdf).hexdigest(),
                uploaded_by=self.managers[0],
                ingestion_status=edition_spec.ingestion,
                ingestion_cost_cents=0 if failed else random.randint(18, 74),
                ingestion_cost_cents_lifetime=random.randint(74, 210),
                ingestion_progress=IngestionProgress.PROGRAM_NOTE if awaiting else "",
                ingestion_run_started_at=self.now - timedelta(hours=random.randint(2, 400)),
                ingestion_error=(
                    "Nie znaleziono warstwy tekstowej — skan wymaga OCR przed ponowną analizą."
                    if failed else ""
                ),
            )
            edition.pdf_file.save(edition.original_filename, ContentFile(pdf), save=False)
            edition.save()
            if not failed:
                self._seed_provenance(piece, edition)

        if not piece.tracks.exists():
            wav = _placeholder_wav()
            for line in _lines_from_voicing(spec.voicing)[:4]:
                track = Track(piece=piece, voice_part=line)
                track.audio_file.save(f"{_slug(piece.title)}_{line}.wav", ContentFile(wav), save=False)
                track.save()

    def _seed_provenance(self, piece: Piece, edition: ScoreEdition) -> None:
        """Attribution rows behind the "AI-suggested vs. verified" badges. Written
        directly rather than through `archive.services.provenance` so the seeder
        keeps its independence from the ingestion pipeline."""
        from django.contrib.contenttypes.models import ContentType

        content_type = ContentType.objects.get_for_model(Piece)
        attributions: tuple[tuple[str, str, str, float, str], ...] = (
            ("lyrics_original", ProvenanceSource.AI_SONNET, "claude-sonnet-4-6", 0.94, "score-read/v7"),
            ("lyrics_ipa", ProvenanceSource.AI_SONNET, "claude-sonnet-4-6", 0.81, "score-read/v7"),
            ("composition_year", ProvenanceSource.MUSICBRAINZ, str(piece.mbid_work or ""), 1.0, ""),
            ("musical_key", ProvenanceSource.MANUAL, self.managers[0].email, 1.0, ""),
        )
        for field_name, source, reference, confidence, prompt_version in attributions:
            ProvenanceRecord.objects.get_or_create(
                content_type=content_type, object_id=piece.pk, field_name=field_name,
                defaults={
                    "source": source,
                    "source_reference": reference[:200],
                    "confidence": confidence,
                    "prompt_version": prompt_version,
                    "model_version": reference if source.startswith("AI") else "",
                },
            )
        ProvenanceRecord.objects.get_or_create(
            content_type=ContentType.objects.get_for_model(ScoreEdition),
            object_id=edition.pk, field_name="page_count",
            defaults={
                "source": ProvenanceSource.AI_HAIKU,
                "source_reference": "claude-haiku-4-5",
                "confidence": 1.0,
                "prompt_version": "pdf-extract/v3",
                "model_version": "claude-haiku-4-5",
            },
        )

    # ----------------------------------------------------------------- #
    # 5. Conductors                                                     #
    # ----------------------------------------------------------------- #
    def _seed_conductors(self) -> list[Artist]:
        self._log("5. Conductors...")
        admin = self.managers[0]
        # The principal conductor IS the admin (Chief Conductor) — one account,
        # two roles, which is exactly how a small ensemble runs.
        principal = Artist.all_objects.filter(email=f"admin@{SEED_DOMAIN}").first()
        if principal is None:
            principal = Artist.objects.create(
                user=admin, first_name=admin.first_name, last_name=admin.last_name,
                email=f"admin@{SEED_DOMAIN}", voice_type=VoiceType.CONDUCTOR,
                phone_number="+48 600 100 100", sight_reading_skill=5,
            )

        guest_email = f"guest.conductor@{SEED_DOMAIN}"
        guest = Artist.all_objects.filter(email=guest_email).first()
        if guest is None:
            guest = Artist.objects.create(
                first_name="Maria", last_name="Brzózka", email=guest_email,
                voice_type=VoiceType.CONDUCTOR, phone_number="+48 600 100 300",
                sight_reading_skill=5,
            )
        return [principal, guest]

    # ----------------------------------------------------------------- #
    # 6. Singers                                                        #
    # ----------------------------------------------------------------- #
    def _seed_singers(self, count: int) -> list[Artist]:
        self._log(f"6. Singers + profiles ({count}, incl. accounts still awaiting activation)...")
        artists: list[Artist] = []
        for index in range(count):
            # Every fifth singer was invited but has not set a password yet — the
            # roster's "invited" state, which is `has_usable_password()`, never
            # `is_active`.
            pending = index % 5 == 4
            artist = self._build_singer(index, f"singer{index:02d}@{SEED_DOMAIN}", pending=pending)
            artists.append(artist)
        return artists

    def _seed_archived_singers(self) -> None:
        """Two singers who have left. Archiving moves `is_active`, `is_deleted` and
        the account's login gate together — a row shown as archived while still able
        to sign in is the state this must never produce."""
        for index in range(2):
            email = f"alumnus{index:02d}@{SEED_DOMAIN}"
            if Artist.all_objects.filter(email=email).exists():
                continue
            artist = self._build_singer(90 + index, email, pending=False)
            artist.is_active = False
            artist.save(update_fields=["is_active", "updated_at"])
            artist.delete()
            if artist.user is not None:
                artist.user.is_active = False
                artist.user.save(update_fields=["is_active"])

    def _build_singer(self, index: int, email: str, *, pending: bool) -> Artist:
        existing = Artist.all_objects.filter(email=email).first()
        if existing is not None:
            return existing

        is_female = index % 2 == 0
        pool = FEMALE_NAMES if is_female else MALE_NAMES
        # Identity is derived from the index, not the RNG, so re-runs map to the
        # same rows even if earlier (skipped) sections leave the RNG at a different
        # position — keeping the seed idempotent.
        first, vocative = pool[(index // 2) % len(pool)]
        last = _surname(is_female)
        voice = random.choice(FEMALE_VOICES if is_female else MALE_VOICES)
        phone = f"+48 {random.randint(500, 799)} {random.randint(100, 999)} {random.randint(100, 999)}"

        user = User.objects.create_user(
            username=email, email=email,
            password=None if pending else "password123",
            first_name=first, last_name=last,
        )
        if pending:
            user.is_active = False
            user.save(update_fields=["is_active"])

        # A handful of members read the app in another language — the fastest way
        # to catch copy that only ever got written in Polish.
        language = UserProfile.LanguageChoices.POLISH
        if index == 3:
            language = UserProfile.LanguageChoices.ENGLISH
        elif index == 7:
            language = UserProfile.LanguageChoices.FRENCH

        profile = self._ensure_profile(
            user, AppRole.ARTIST,
            phone=phone,
            vocative=vocative,
            salutation=UserProfile.Salutation.FEMININE if is_female else UserProfile.Salutation.MASCULINE,
            language=language,
            digest_enabled=False,
            activated=not pending,
            # A couple of activated members have not opened the app yet, so the
            # one-time welcome moment has something to greet.
            welcomed=index % 9 != 2,
        )
        profile.clothing_size = random.choice([
            ClothingSizeChoices.S, ClothingSizeChoices.M,
            ClothingSizeChoices.L, ClothingSizeChoices.XL,
        ])
        profile.shoe_size = str(random.randint(37, 41) if is_female else random.randint(41, 46))
        profile.height_cm = random.randint(158, 180) if is_female else random.randint(170, 195)
        # One address the ESP has told us to stop writing to.
        profile.email_undeliverable = index == 11
        profile.save()

        if index < 8:
            self._attach_avatar(user, f"{first[0]}{last[0]}")

        bottom, top = RANGE_FOR[voice]
        return Artist.objects.create(
            user=user, first_name=first, last_name=last, email=email,
            voice_type=voice, phone_number=phone,
            sight_reading_skill=random.randint(2, 5),
            vocal_range_bottom=bottom, vocal_range_top=top,
            activation_email_sent_at=(self.now - timedelta(days=random.randint(1, 9))) if pending else None,
        )

    # ----------------------------------------------------------------- #
    # 7. Collaborators (crew)                                           #
    # ----------------------------------------------------------------- #
    def _seed_collaborators(self) -> list[Collaborator]:
        self._log("7. Collaborators (technical crew)...")
        data: tuple[tuple[str, str, str, str], ...] = (
            ("Tomasz", "Dźwięk", Collaborator.Specialty.SOUND, "SoundCraft Studio"),
            ("Marek", "Światło", Collaborator.Specialty.LIGHT, "LumenFX"),
            ("Katarzyna", "Logistyk", Collaborator.Specialty.LOGISTICS, "EventMasters"),
            ("Paweł", "Organista", Collaborator.Specialty.INSTRUMENT, ""),
            ("Anna", "Wizual", Collaborator.Specialty.VISUALS, "Projekcje AV"),
            ("Robert", "Stroiciel", Collaborator.Specialty.OTHER, "Fortepiany Serwis"),
        )
        crew: list[Collaborator] = []
        for position, (first, last, specialty, company) in enumerate(data):
            # The piano tuner is booked by phone and has no e-mail — the nullable
            # column exists for exactly this case.
            email = None if position == len(data) - 1 else f"{_ascii(first)}.{_ascii(last)}@{SEED_DOMAIN}"
            lookup = (
                Collaborator.all_objects.filter(email=email)
                if email
                else Collaborator.all_objects.filter(first_name=first, last_name=last)
            )
            collaborator = lookup.first()
            if collaborator is None:
                collaborator = Collaborator.objects.create(
                    first_name=first, last_name=last, email=email, specialty=specialty,
                    company_name=company,
                    phone_number=f"+48 {random.randint(500, 799)} {random.randint(100000, 999999)}",
                )
            crew.append(collaborator)
        return crew

    # ----------------------------------------------------------------- #
    # 8. Knowledge Base                                                 #
    # ----------------------------------------------------------------- #
    def _seed_knowledge_base(self) -> None:
        self._log("8. Knowledge Base (categories + role-gated documents)...")
        for order, (name, slug, icon, roles, description, titles) in enumerate(KNOWLEDGE_BASE, start=1):
            category, _ = DocumentCategory.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": name, "icon_key": icon, "allowed_roles": list(roles),
                    "order": order, "description": description,
                },
            )
            if not self.with_media or category.documents.exists():
                continue
            pdf = _placeholder_pdf(f"{name} — dokument (placeholder)", pages=2)
            for position, title in enumerate(titles, start=1):
                document = Document(
                    category=category, title=title, description=description,
                    file_size_bytes=len(pdf), mime_type="application/pdf",
                    uploaded_by=self.managers[0], order=position,
                    # The onboarding guide's second sheet is management-only: the
                    # per-document override exists so one file can be narrower than
                    # its category without splitting the category in two.
                    allowed_roles=[AppRole.MANAGER] if slug == "onboarding" and position == 2 else [],
                )
                document.file.save(f"{slug}_{position}.pdf", ContentFile(pdf), save=False)
                document.save()

    # ----------------------------------------------------------------- #
    # 9. Projects (the centrepiece)                                     #
    # ----------------------------------------------------------------- #
    def _seed_projects(self) -> list[Project]:
        self._log("9. Projects: programmes, score books, casting, rehearsals, attendance, readiness...")
        projects: list[Project] = []
        for spec in PROJECTS:
            location = self.locations[spec.location]
            when = _at_local_time(self.now + timedelta(days=spec.days), spec.hour, spec.minute)
            call_time = when - timedelta(hours=3)
            is_soon = 0 < spec.days <= 7
            project, created = Project.objects.get_or_create(
                title=spec.title,
                defaults={
                    "date_time": when, "call_time": call_time, "status": spec.status,
                    # The seed's Mass is the only liturgical fixture; the kind is
                    # what makes its programme show an order of service rather
                    # than a running order.
                    "event_kind": (
                        Project.EventKind.MASS
                        if spec.density == ScorePackage.Density.MASS
                        else Project.EventKind.CONCERT
                    ),
                    "location": location, "timezone": location.timezone,
                    "conductor": self.conductors[spec.conductor],
                    "description": "Pełna obsługa logistyczna: catering, garderoby, transport.",
                    "dress_code_male": "Frak, biała muszka",
                    "dress_code_female": "Czarna suknia chóralna",
                    "spotify_playlist_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
                    "run_sheet": self._run_sheet(call_time, when),
                    # The upcoming-event reminder is a one-shot claim; only a concert
                    # already inside the reminder window can carry the stamp.
                    "reminder_sent_at": (self.now - timedelta(days=1)) if is_soon else None,
                },
            )
            projects.append(project)
            if created:
                self._populate_project(project, spec, when)
        return projects

    @staticmethod
    def _run_sheet(call_time: datetime, start: datetime) -> list[dict[str, str]]:
        def fmt(value: datetime) -> str:
            return value.strftime("%H:%M")

        return [
            {"time": fmt(call_time), "task": "Przyjazd i przygotowanie", "location": "Garderoby"},
            {"time": fmt(call_time + timedelta(minutes=30)), "task": "Próba akustyczna", "location": "Scena"},
            {"time": fmt(call_time + timedelta(hours=1, minutes=30)), "task": "Rozśpiewanie",
             "location": "Sala prób"},
            {"time": fmt(call_time + timedelta(hours=2)), "task": "Catering", "location": "Foyer"},
            {"time": fmt(start), "task": "POCZĄTEK KONCERTU", "location": "Scena"},
        ]

    def _populate_project(self, project: Project, spec: ProjectSpec, when: datetime) -> None:
        is_done = spec.status == Project.Status.COMPLETED
        is_draft = spec.status == Project.Status.DRAFT
        is_cancelled = spec.status == Project.Status.CANCELLED

        participations = self._seed_participations(project, spec, when)
        confirmed = [p for p in participations if p.status == Participation.Status.CONFIRMED]

        self._seed_crew_assignments(project, when, is_done=is_done, is_draft=is_draft)
        self._seed_programme(project, spec)
        self._seed_casting_and_readiness(project, spec, confirmed)
        self._seed_rehearsals(project, spec, participations, confirmed, when)
        self._seed_score_package(project, spec)

        if not is_cancelled:
            # The membership-sync signal has already created the channel for every
            # confirmed participation; only the manager seats and the copy are ours.
            self._seed_channel(project)

        if spec.holds_announcements:
            self._seed_announcement_queue(project, spec, participations)

    # --- A) participations -------------------------------------------- #
    def _seed_participations(
        self, project: Project, spec: ProjectSpec, when: datetime
    ) -> list[Participation]:
        cast_size = min(len(self.artists), 12 if spec.status == Project.Status.DRAFT else 18)
        invited = random.sample(self.artists, k=cast_size)
        participations: list[Participation] = []
        for artist in invited:
            if spec.status == Project.Status.COMPLETED:
                status, paid = Participation.Status.CONFIRMED, True
            elif spec.status == Project.Status.DRAFT:
                status, paid = Participation.Status.INVITED, False
            elif spec.status == Project.Status.CANCELLED:
                status, paid = Participation.Status.CONFIRMED, False
            else:  # ACTIVE — mostly confirmed, a few still deciding or out.
                status = random.choices(
                    [Participation.Status.CONFIRMED, Participation.Status.INVITED,
                     Participation.Status.DECLINED],
                    weights=[78, 15, 7], k=1,
                )[0]
                paid = False
            participations.append(Participation.objects.create(
                artist=artist, project=project, status=status,
                fee=random.choice([200, 250, 300, 400]),
                is_paid=paid, paid_at=(when + timedelta(days=2)) if paid else None,
            ))
        return participations

    # --- B) crew ------------------------------------------------------- #
    def _seed_crew_assignments(
        self, project: Project, when: datetime, *, is_done: bool, is_draft: bool
    ) -> None:
        for collaborator in random.sample(self.collaborators, k=3):
            CrewAssignment.objects.create(
                collaborator=collaborator, project=project,
                status=CrewAssignment.Status.INVITED if is_draft else CrewAssignment.Status.CONFIRMED,
                fee=1000, is_paid=is_done, paid_at=(when + timedelta(days=2)) if is_done else None,
                role_description=f"Obsługa: {collaborator.get_specialty_display()}",
            )

    # --- C) programme + score-book cockpit overrides -------------------- #
    def _seed_programme(self, project: Project, spec: ProjectSpec) -> None:
        titles = [title for title in spec.programme if title in self.pieces]
        is_mass = spec.density == ScorePackage.Density.MASS
        for order, title in enumerate(titles, start=1):
            piece = self.pieces[title]
            item, _ = ProgramItem.objects.get_or_create(
                project=project, piece=piece,
                defaults={
                    "order": order,
                    "is_encore": order == len(titles) and spec.status != Project.Status.DRAFT,
                    # Trimming the publisher's front matter is the first thing a
                    # conductor does in the build cockpit, so the seed shows it done.
                    "pdf_page_start": 3 if piece.movements.exists() else None,
                },
            )
            if not is_mass or order > len(MASS_ITEM_SLOTS):
                continue
            slot, performers = MASS_ITEM_SLOTS[order - 1]
            item.liturgical_slot = slot
            item.performers = performers
            # A liturgy prints only the text and its translation; the meta strip and
            # programme notes belong to a concert card, not to a Mass sheet.
            item.card_elements = ["eyebrow", "text", "translation"]
            item.hide_source_page_numbers = True
            if order == len(MASS_ITEM_SLOTS):
                item.note_override = "Utwór wykonywany podczas procesji wyjścia — bez oklasków."
            item.save()

    # --- C') micro-casting + practice readiness ------------------------ #
    def _seed_casting_and_readiness(
        self, project: Project, spec: ProjectSpec, confirmed: Sequence[Participation]
    ) -> None:
        is_done = spec.status == Project.Status.COMPLETED
        is_draft = spec.status == Project.Status.DRAFT
        titles = [title for title in spec.programme if title in self.pieces]

        for title in titles:
            piece = self.pieces[title]
            for index, participation in enumerate(confirmed):
                line = random.choice(VOICE_LINES_FOR[participation.artist.voice_type])
                ProjectPieceCasting.objects.get_or_create(
                    participation=participation, piece=piece,
                    defaults={
                        "voice_line": line,
                        "gives_pitch": line == VoiceLine.SOPRANO_1 and index == 0,
                        "notes": "Wejście solowe w t. 34" if index == 1 else "",
                    },
                )
                if is_done:
                    readiness = PieceReadiness.Status.READY
                elif is_draft:
                    readiness = PieceReadiness.Status.NOT_STARTED
                else:
                    readiness = random.choices(
                        [PieceReadiness.Status.READY, PieceReadiness.Status.IN_PROGRESS,
                         PieceReadiness.Status.NOT_STARTED],
                        weights=[45, 40, 15], k=1,
                    )[0]
                PieceReadiness.objects.get_or_create(
                    participation=participation, piece=piece, defaults={"status": readiness},
                )

    # --- D) rehearsals + attendance ------------------------------------ #
    def _seed_rehearsals(
        self,
        project: Project,
        spec: ProjectSpec,
        participations: Sequence[Participation],
        confirmed: Sequence[Participation],
        when: datetime,
    ) -> None:
        if spec.status == Project.Status.COMPLETED:
            moments = [when - timedelta(days=days) for days in (21, 14, 7, 3)]
        elif spec.status == Project.Status.DRAFT:
            moments = [when - timedelta(days=5)]
        elif spec.status == Project.Status.CANCELLED:
            moments = []
        else:  # ACTIVE — two already held, one still ahead.
            moments = [
                self.now - timedelta(days=7),
                self.now - timedelta(days=2),
                when - timedelta(days=3),
            ]

        for position, raw_moment in enumerate(moments, start=1):
            moment = _at_local_time(raw_moment, REHEARSAL_HOUR, REHEARSAL_MINUTE)
            is_last = position == len(moments)
            rehearsal = Rehearsal.objects.create(
                project=project, date_time=moment, location=self.locations["rehearsal"],
                timezone=TZ,
                focus=("Próba generalna w strojach" if is_last else f"Praca nad repertuarem (część {position})"),
                # An optional extra session proves the invitation copy marks the
                # exception rather than repeating "obligatory" on every line.
                is_mandatory=position != 2 or len(moments) < 3,
                reminder_sent_at=(moment - timedelta(days=1)) if moment < self.now else None,
            )
            # A sectional is called for named singers only; everything else is plenary,
            # and a rehearsal with no named invitees reaches the whole cast.
            sectional = position == 2 and len(confirmed) > 6
            rehearsal.invited_participations.set(list(confirmed[:6]) if sectional else list(participations))
            if moment < self.now:
                for participation in confirmed:
                    self._record_attendance(rehearsal, participation)

    def _record_attendance(self, rehearsal: Rehearsal, participation: Participation) -> None:
        status = random.choices(
            [Attendance.Status.PRESENT, Attendance.Status.LATE,
             Attendance.Status.EXCUSED, Attendance.Status.ABSENT],
            weights=[80, 10, 6, 4], k=1,
        )[0]
        Attendance.objects.get_or_create(
            rehearsal=rehearsal, participation=participation,
            defaults={
                "status": status,
                "minutes_late": random.randint(5, 20) if status == Attendance.Status.LATE else None,
                "excuse_note": "Korek na trasie" if status == Attendance.Status.EXCUSED else "",
            },
        )

    # --- E) score package (the concert book) ---------------------------- #
    def _seed_score_package(self, project: Project, spec: ProjectSpec) -> None:
        """One package per project, in the build state its lifecycle implies. A
        READY package owns a real file on `project.score_pdf` — the two must never
        disagree, so without media every package stays IDLE."""
        status = spec.package_status
        if not self.with_media and status == ScorePackage.Status.READY:
            status = ScorePackage.Status.IDLE

        is_mass = spec.density == ScorePackage.Density.MASS
        package, created = ScorePackage.objects.get_or_create(
            project=project,
            defaults={
                "density_mode": spec.density,
                "duplex_mode": is_mass,
                "translation_language": "pl",
                "card_default_elements": (
                    ["eyebrow", "text", "translation"] if is_mass
                    else ["eyebrow", "meta", "text", "translation", "note"]
                ),
                "status": status,
                "error": (
                    "Brak wydania PDF dla utworu „Modlitwa” — dodaj nuty i uruchom budowanie ponownie."
                    if status == ScorePackage.Status.FAILED else ""
                ),
            },
        )
        if not created or status != ScorePackage.Status.READY:
            return

        pdf = _placeholder_pdf(f"{project.title} — książka nutowa", pages=24)
        project.score_pdf.save(f"{_slug(project.title)}_ksiazka.pdf", ContentFile(pdf), save=False)
        project.save(update_fields=["score_pdf", "updated_at"])

        package.page_count = 24
        package.generated_at = self.now - timedelta(days=4)
        package.build_version = 2
        package.source_hash = ScorePackageService.compute_source_hash(project, package)
        if spec.status == Project.Status.COMPLETED:
            # The book left the building: singers downloaded it, so a rebuild would
            # now silently replace what is already in their folders.
            package.distributed_at = self.now - timedelta(days=3)
            self._seed_score_access_log(project, package)
        if is_mass:
            # A programme edited after the last build — the staleness badge needs a
            # package whose stored hash no longer matches its inputs.
            package.source_hash = hashlib.sha256(b"stale-inputs").hexdigest()
        package.save(update_fields=[
            "page_count", "generated_at", "build_version", "source_hash", "distributed_at", "updated_at",
        ])

    def _seed_score_access_log(self, project: Project, package: ScorePackage) -> None:
        """The due-diligence trail a publisher audit would ask for: who received a
        watermarked copy of the binder, and which numbered copy it was."""
        recipients = [
            participation.artist.user
            for participation in Participation.objects.filter(
                project=project, status=Participation.Status.CONFIRMED,
            ).select_related("artist__user")
            if participation.artist.user_id
        ]
        for copy_number, user in enumerate(recipients, start=1):
            ScoreAccessLog.objects.create(
                user=user, project=project, build_version=package.build_version,
                copy_number=copy_number, was_watermarked=True,
            )
        # A manager's own serve consumes no copy number: nothing stamped leaves.
        for manager in self.managers:
            ScoreAccessLog.objects.create(
                user=manager, project=project, build_version=package.build_version,
                copy_number=None, was_watermarked=False,
            )

    # --- F) project channel -------------------------------------------- #
    def _seed_channel(self, project: Project) -> None:
        channel = ProjectChannel.objects.filter(project=project).first()
        if channel is None or channel.messages.exists():
            return

        for manager in self.managers:
            ChannelMembership.objects.get_or_create(
                channel=channel, user=manager,
                defaults={"role": ChannelRole.MANAGER, "push_enabled": True},
            )

        announcements: tuple[tuple[User, str, bool], ...] = (
            (self.managers[0],
             "Witajcie w kanale projektu! Tu znajdziecie wszystkie ważne informacje.", True),
            (self.managers[1],
             "Próba generalna w stroju koncertowym — pamiętajcie o obuwiu.", False),
            (self.managers[0],
             "Nuty są już w zakładce Materiały. Partie altów poprawione po wczorajszej próbie.", False),
        )
        last_at = None
        for position, (sender, body, pinned) in enumerate(announcements):
            last_at = self.now - timedelta(hours=len(announcements) - position)
            message = ChannelMessage.objects.create(
                channel=channel, sender=sender, body=body, is_pinned=pinned,
            )
            ChannelMessage.objects.filter(pk=message.pk).update(created_at=last_at)
        if last_at is not None:
            ProjectChannel.objects.filter(pk=channel.pk).update(last_message_at=last_at)

        # Read pointers spread across the message history, so the channel list has
        # both read and unread rows to render.
        memberships = list(ChannelMembership.objects.filter(channel=channel, role=ChannelRole.MEMBER)[:8])
        for position, membership in enumerate(memberships):
            if position % 3 == 0:
                continue
            membership.last_read_at = self.now - timedelta(hours=position % 4)
            membership.push_enabled = position % 2 == 0
            membership.save(update_fields=["last_read_at", "push_enabled", "updated_at"])

    # --- G) announcement queue ----------------------------------------- #
    def _seed_announcement_queue(
        self, project: Project, spec: ProjectSpec, participations: Sequence[Participation]
    ) -> None:
        """Changes made to a live project that the cast has not been told about yet.

        Rows are per *field*, which is what lets the review sheet drop one line
        without discarding the rest, and a row about a time the cast has to keep is
        URGENT on its own regardless of the baseline.
        """
        rehearsal = Rehearsal.objects.filter(project=project).order_by("-date_time").first()
        personal = next(
            (p for p in participations
             if p.status == Participation.Status.CONFIRMED and p.artist.user_id),
            None,
        )
        piece = self.pieces[spec.programme[0]]
        moment = build_event_time_metadata(
            project.date_time, project.timezone, fallback_timezone=DEFAULT_EVENT_TIMEZONE,
        )
        project_meta: dict[str, Any] = {
            "project_id": str(project.id),
            "project_name": project.title,
            "location": project.location.name if project.location else "",
            **moment,
        }

        rows: list[dict[str, Any]] = [
            {
                "subject_type": AnnouncementSubject.PROJECT, "subject_id": str(project.id),
                "kind": AnnouncementKind.CHANGED,
                "notification_type": NotificationType.PROJECT_UPDATED,
                "level": NotificationLevel.URGENT, "metadata": project_meta,
                "change_field": "date_time",
                "change_old": (project.date_time - timedelta(minutes=30)).strftime("%d.%m.%Y %H:%M"),
                "change_new": project.date_time.strftime("%d.%m.%Y %H:%M"),
            },
            {
                "subject_type": AnnouncementSubject.PROJECT, "subject_id": str(project.id),
                "kind": AnnouncementKind.CHANGED,
                "notification_type": NotificationType.PROJECT_UPDATED,
                "level": NotificationLevel.INFO, "metadata": project_meta,
                "change_field": "dress_code",
                "change_old": "Frak, biała muszka",
                "change_new": "Frak, biała muszka · Czarna suknia chóralna",
            },
        ]
        if rehearsal is not None:
            rows.append({
                "subject_type": AnnouncementSubject.REHEARSAL, "subject_id": str(rehearsal.id),
                "kind": AnnouncementKind.CREATED,
                "notification_type": NotificationType.REHEARSAL_SCHEDULED,
                "level": NotificationLevel.INFO,
                "metadata": self._rehearsal_metadata(project, rehearsal),
                "change_field": "", "change_old": None, "change_new": None,
            })
        if personal is not None:
            rows.append({
                "recipient_id": personal.artist.user_id,
                "subject_type": AnnouncementSubject.CASTING, "subject_id": str(piece.id),
                "kind": AnnouncementKind.CHANGED,
                "notification_type": NotificationType.PIECE_CASTING_UPDATED,
                "level": NotificationLevel.INFO,
                "metadata": {
                    **project_meta,
                    "piece_id": str(piece.id), "piece_title": piece.title,
                    "voice_line": VoiceLine.SOPRANO_1,
                },
                "change_field": "voice_line",
                "change_old": VoiceLine.SOPRANO_2, "change_new": VoiceLine.SOPRANO_1,
            })

        for row in rows:
            PendingAnnouncement.objects.create(project=project, **row)

        # The queue has been sitting long enough for the safety net to have fired
        # once; the stamp is a cooldown, so a later urgent change can still break through.
        Project.objects.filter(pk=project.pk).update(
            announcement_nudged_at=self.now - timedelta(hours=20),
        )

    # ----------------------------------------------------------------- #
    # 10. Archive — conductor markup                                    #
    # ----------------------------------------------------------------- #
    def _seed_score_markup(self) -> None:
        """Annotation layers on a rehearsed score: what the choir sees, what only
        the maestro sees, and one singer's private pencil marks."""
        if not self.with_media or Annotation.objects.exists():
            return
        self._log("10. Score markup (shared / conductor / personal annotation layers)...")

        edition = ScoreEdition.objects.filter(
            piece__title="Miserere mei, Deus", is_default=True,
        ).first()
        if edition is None:
            return

        conductor_user = self.managers[0]
        singer = next((artist.user for artist in self.artists if artist.user_id), None)

        layers: tuple[tuple[str, str, dict[str, Any], str, int, User | None], ...] = (
            ("shared", AnnotationType.HIGHLIGHT,
             {"paths": [[[0.12, 0.31], [0.62, 0.31]]], "width": 0.02}, "#C9A227AA", 2, conductor_user),
            ("shared", AnnotationType.COMMENT,
             {"x": 0.66, "y": 0.34, "text": "Oddech wszyscy razem — po „Deus”.",
              "display": "pin", "scale": 1.0}, "#7A6A9BFF", 2, conductor_user),
            ("shared", AnnotationType.STAMP,
             {"x": 0.48, "y": 0.62, "symbol": "breath", "scale": 1.2}, "#1B1A17FF", 3, conductor_user),
            ("conductor", AnnotationType.FREEHAND,
             {"paths": [[[0.20, 0.44], [0.28, 0.40], [0.36, 0.47], [0.44, 0.41]]], "width": 0.005},
             "#B3261EFF", 1, conductor_user),
            ("conductor", AnnotationType.STAMP,
             {"x": 0.82, "y": 0.18, "symbol": "fermata", "scale": 1.4}, "#1B1A17FF", 4, conductor_user),
            ("personal", AnnotationType.COMMENT,
             {"x": 0.24, "y": 0.71, "text": "Tu zawsze spóźniam wejście.",
              "display": "inline", "scale": 0.9}, "#8A9A7BFF", 2, singer),
        )
        for layer_name, annotation_type, payload, color, page, author in layers:
            if author is None:
                continue
            Annotation.objects.create(
                edition=edition, page_number=page, annotation_type=annotation_type,
                payload=payload, color=color, layer_name=layer_name, created_by=author,
            )

        # Two single-edition serves alongside the binder trail seeded with the book.
        if singer is not None:
            ScoreAccessLog.objects.create(
                user=singer, edition=edition, copy_number=1, was_watermarked=True,
            )
        ScoreAccessLog.objects.create(
            user=conductor_user, edition=edition, copy_number=None, was_watermarked=False,
        )

    # ----------------------------------------------------------------- #
    # 11. Messaging (1:1 threads)                                       #
    # ----------------------------------------------------------------- #
    def _seed_messaging(self) -> None:
        if Thread.objects.exists():
            return
        self._log("11. Messaging threads (artist <-> management)...")
        admin, manager = self.managers
        active_project = next(
            (p for p in self.projects if p.status == Project.Status.ACTIVE), self.projects[0]
        )

        # (subject, status, assignee, context, script) — `assignee=None` is the
        # shared intake queue every manager can see until one claims it.
        scripts: tuple[tuple[str, str, User | None, str, tuple[tuple[bool, str], ...]], ...] = (
            ("Prośba o nieobecność na próbie", ThreadStatus.RESOLVED, manager, ThreadContextType.GENERAL, (
                (True, "Dzień dobry, czy mogę być zwolniony z najbliższej próby? Mam egzamin."),
                (False, "Oczywiście, usprawiedliwiamy nieobecność. Powodzenia na egzaminie!"),
                (True, "Bardzo dziękuję!"),
            )),
            ("Pytanie o strój na koncert", ThreadStatus.OPEN, admin, ThreadContextType.PROJECT, (
                (True, "Czy na koncert wiosenny obowiązuje długa suknia, czy spódnica do kolan?"),
                (False, "Długa suknia chóralna, zgodnie z dress code projektu."),
            )),
            ("Zwrot kosztów dojazdu", ThreadStatus.OPEN, None, ThreadContextType.GENERAL, (
                (True, "Jak rozliczyć bilety na trasę do Krakowa?"),
            )),
            ("Nuty do nowego utworu", ThreadStatus.RESOLVED, admin, ThreadContextType.GENERAL, (
                (True, "Nie widzę partii altu do „Sleep” w aplikacji."),
                (False, "Już wgrana — odśwież zakładkę Śpiewnik."),
                (True, "Działa, dzięki!"),
            )),
            ("Rezygnacja z sezonu letniego", ThreadStatus.ARCHIVED, manager, ThreadContextType.GENERAL, (
                (True, "Niestety w wakacje wyjeżdżam na cały lipiec."),
                (False, "Dziękujemy za wcześniejszą informację — wracamy do rozmowy we wrześniu."),
            )),
        )
        singers = [artist for artist in self.artists if artist.user_id][:len(scripts)]

        for artist, (subject, status, assignee, context, lines) in zip(singers, scripts, strict=False):
            thread = Thread.objects.create(
                artist=artist, subject=subject, assignee=assignee, status=status,
                context_type=context,
                context_id=active_project.id if context == ThreadContextType.PROJECT else None,
            )
            last_at = self.now
            for offset, (from_artist, body) in enumerate(lines):
                last_at = self.now - timedelta(days=2) + timedelta(hours=offset)
                sender = artist.user if from_artist else assignee
                message = Message.objects.create(thread=thread, sender=sender, body=body)
                Message.objects.filter(pk=message.pk).update(created_at=last_at)
            Thread.objects.filter(pk=thread.pk).update(last_message_at=last_at)

            # Management has read it; the artist has read up to their own last line.
            if assignee is not None:
                ThreadReadState.objects.update_or_create(
                    thread=thread, user=assignee, defaults={"last_read_at": last_at},
                )
            if artist.user is not None:
                ThreadReadState.objects.update_or_create(
                    thread=thread, user=artist.user,
                    defaults={"last_read_at": last_at - timedelta(hours=1)},
                )

    # ----------------------------------------------------------------- #
    # 12. Payments (donations + patron leads)                           #
    # ----------------------------------------------------------------- #
    def _seed_payments(self) -> None:
        if Donation.objects.exists():
            return
        self._log("12. Payments (donations + patron leads)...")
        statuses = (
            [DonationStatus.SETTLED] * 14 + [DonationStatus.PENDING] * 3 + [DonationStatus.FAILED] * 2
        )
        random.shuffle(statuses)
        for index, status in enumerate(statuses):
            currency = random.choices(
                [DonationCurrency.PLN, DonationCurrency.EUR], weights=[80, 20], k=1
            )[0]
            donation = Donation.objects.create(
                email=f"donor{index}@example.com",
                amount=Decimal(random.choice([20, 50, 50, 100, 100, 250, 500])),
                currency=currency, status=status,
                # A pending payment has not come back from the gateway yet, so it
                # cannot carry a gateway-side identifier.
                axepta_payment_id=(
                    None if status == DonationStatus.PENDING else f"AXP-{uuid.uuid4().hex[:16]}"
                ),
            )
            Donation.objects.filter(pk=donation.pk).update(
                created_at=self.now - timedelta(days=random.randint(1, 180)),
            )

        leads: tuple[tuple[str, str, str, str], ...] = (
            ("Krzysztof", "Mecenas", PatronLeadStatus.ACTIVE, "Stałe zlecenie 200 zł/mies. od marca."),
            ("Agata", "Dobrodziej", PatronLeadStatus.CONTACTED, "Oddzwonić w przyszłym tygodniu."),
            ("Piotr", "Fundator", PatronLeadStatus.NEW, ""),
            ("Maria", "Wspierająca", PatronLeadStatus.ARCHIVED, "Zrezygnowała — zmiana sytuacji."),
        )
        for first, last, status_code, note in leads:
            PatronLead.objects.create(
                first_name=first, last_name=last,
                email=f"{_ascii(first)}.{_ascii(last)}@example.com",
                status=status_code, note=note,
            )

    # ----------------------------------------------------------------- #
    # 13. Notifications                                                 #
    # ----------------------------------------------------------------- #
    def _seed_notifications(self) -> None:
        if Notification.objects.exists():
            return
        self._log("13. Notifications (inbox, announcement nudge, push devices, preferences)...")

        showcase = next(
            (p for p in self.projects if p.status == Project.Status.ACTIVE), self.projects[0]
        )
        self._seed_invitation_inbox(showcase)
        self._seed_artist_inbox(showcase)
        self._seed_manager_inbox(showcase)
        self._seed_push_devices()
        self._seed_notification_preferences()

    def _project_metadata(self, project: Project) -> dict[str, Any]:
        """The shared, language-neutral spine of every project notification —
        every surface localizes it at render time, so no prose is stored."""
        return {
            "project_id": str(project.id),
            "project_name": project.title,
            "location": project.location.name if project.location else "",
            **build_event_time_metadata(
                project.date_time, project.timezone, fallback_timezone=DEFAULT_EVENT_TIMEZONE,
            ),
        }

    def _seed_invitation_inbox(self, project: Project) -> None:
        """Real invitation payloads, built by the same composer publication uses —
        rehearsal roster, programme and the reader's own voice lines included."""
        context = build_invitation_context(project)
        participations = (
            Participation.objects.filter(project=project)
            .select_related("artist", "project", "project__location", "project__conductor")
        )
        for participation in participations:
            user_id = participation.artist.user_id
            if not user_id:
                continue
            answered = participation.status != Participation.Status.INVITED
            notification = Notification.objects.create(
                recipient_id=user_id,
                notification_type=NotificationType.PROJECT_INVITATION,
                level=NotificationLevel.INFO,
                metadata=build_invitation_metadata(participation, context),
                is_read=answered,
                read_at=self.now - timedelta(days=2) if answered else None,
            )
            self._backdate(notification, days=3)

    def _rehearsal_metadata(self, project: Project, rehearsal: Rehearsal | None) -> dict[str, Any]:
        """A rehearsal notification is about the rehearsal's own moment and venue —
        inheriting the concert's would send the cast to the hall on the wrong day."""
        return {
            **self._project_metadata(project),
            "rehearsal_id": str(rehearsal.id) if rehearsal else str(uuid.uuid4()),
            "location": rehearsal.location.name if rehearsal and rehearsal.location
            else self.locations["rehearsal"].name,
            "focus": (rehearsal.focus if rehearsal else "") or "Sekcja I — intonacja",
            **(
                build_event_time_metadata(
                    rehearsal.date_time, rehearsal.timezone,
                    fallback_timezone=DEFAULT_EVENT_TIMEZONE,
                )
                if rehearsal
                else {}
            ),
        }

    def _seed_artist_inbox(self, project: Project) -> None:
        """Three items per singer, drawn from the types their day actually produces."""
        meta = self._project_metadata(project)
        rehearsal = Rehearsal.objects.filter(
            project=project, date_time__gte=self.now,
        ).order_by("date_time").first()
        rehearsal_meta = self._rehearsal_metadata(project, rehearsal)
        moved_from = (
            (rehearsal.date_time - timedelta(minutes=30)).strftime("%d.%m.%Y %H:%M")
            if rehearsal else ""
        )
        moved_to = rehearsal.date_time.strftime("%d.%m.%Y %H:%M") if rehearsal else ""

        for position, artist in enumerate(self.artists):
            if not artist.user_id:
                continue
            piece = random.choice(list(self.pieces.values()))
            # Language-neutral VoiceLine CODE (e.g. "B1") — never a rendered label.
            voice_code = random.choice(VOICE_LINES_FOR.get(artist.voice_type, [VoiceLine.SOPRANO_1]))
            templates: list[tuple[str, str, dict[str, Any], bool]] = [
                (NotificationType.REHEARSAL_SCHEDULED, NotificationLevel.INFO,
                 rehearsal_meta, random.random() < 0.5),
                (NotificationType.REHEARSAL_UPDATED, NotificationLevel.WARNING,
                 {**rehearsal_meta, "changes": [
                     {"field": "date_time", "old": moved_from, "new": moved_to},
                     {"field": "location", "old": self.locations["retired"].name,
                      "new": self.locations["rehearsal"].name},
                 ]}, False),
                (NotificationType.PIECE_CASTING_ASSIGNED, NotificationLevel.INFO,
                 {**meta, "piece_id": str(piece.id), "piece_title": piece.title,
                  "voice_line": voice_code}, False),
                (NotificationType.MATERIAL_UPLOADED, NotificationLevel.INFO,
                 {"piece_id": str(piece.id), "piece_title": piece.title,
                  "material_kind": random.choice(["score", "recording"]),
                  "composer_name": str(piece.composer) if piece.composer_id else None},
                 random.random() < 0.5),
                (NotificationType.MESSAGE_RECEIVED, NotificationLevel.INFO,
                 {"title": "Zmiana godziny próby", "sender_name": "Jan Kapelmistrz",
                  "snippet": "Cześć! Przesuwamy czwartkową próbę na 19:30.",
                  "thread_id": str(uuid.uuid4())}, False),
                (NotificationType.PROJECT_REMINDER, NotificationLevel.INFO, meta, False),
            ]
            for notification_type, level, metadata, is_read in random.sample(templates, k=3):
                notification = Notification.objects.create(
                    recipient_id=artist.user_id, notification_type=notification_type,
                    level=level, metadata=metadata, is_read=is_read,
                    read_at=self.now if is_read else None,
                )
                self._backdate(notification, days=6)

            # A briefing is what publication sends a reader with several pieces of
            # news at once; a reader with exactly one gets that item's own message.
            if position % 7 == 0:
                self._seed_briefing(artist.user_id, project, meta, piece, voice_code)

        # The two ends of an absence request, and the contract that follows a yes.
        for artist in self.artists[:3]:
            if not artist.user_id:
                continue
            Notification.objects.create(
                recipient_id=artist.user_id, notification_type=NotificationType.ABSENCE_APPROVED,
                level=NotificationLevel.INFO, is_read=True, read_at=self.now,
                metadata=rehearsal_meta,
            )
            Notification.objects.create(
                recipient_id=artist.user_id, notification_type=NotificationType.CONTRACT_ISSUED,
                level=NotificationLevel.WARNING,
                metadata={**meta, "contract_id": str(uuid.uuid4())},
            )

        cancelled = next((p for p in self.projects if p.status == Project.Status.CANCELLED), None)
        if cancelled is not None:
            for artist in self.artists[:6]:
                if artist.user_id:
                    Notification.objects.create(
                        recipient_id=artist.user_id,
                        notification_type=NotificationType.PROJECT_CANCELLED,
                        level=NotificationLevel.WARNING,
                        metadata=self._project_metadata(cancelled),
                    )

    def _seed_briefing(
        self, user_id: int, project: Project, meta: dict[str, Any], piece: Piece, voice_code: str
    ) -> None:
        rehearsal = Rehearsal.objects.filter(project=project).order_by("date_time").first()
        items: list[dict[str, Any]] = [
            {
                "subject_type": AnnouncementSubject.CASTING,
                "kind": AnnouncementKind.CHANGED,
                "metadata": {
                    "piece_title": piece.title, "voice_line": voice_code,
                    "changes": [{"field": "voice_line", "old": VoiceLine.SOPRANO_2, "new": voice_code}],
                },
            },
            {
                "subject_type": AnnouncementSubject.PROJECT,
                "kind": AnnouncementKind.CHANGED,
                "metadata": {"changes": [
                    {"field": "location", "old": "Bazylika Świętego Krzyża", "new": "Filharmonia Narodowa"},
                ]},
            },
        ]
        if rehearsal is not None:
            items.insert(1, {
                "subject_type": AnnouncementSubject.REHEARSAL,
                "kind": AnnouncementKind.CREATED,
                "metadata": {
                    "location": self.locations["rehearsal"].name,
                    "focus": rehearsal.focus,
                    **build_event_time_metadata(
                        rehearsal.date_time, rehearsal.timezone,
                        fallback_timezone=DEFAULT_EVENT_TIMEZONE,
                    ),
                },
            })
        Notification.objects.create(
            recipient_id=user_id, notification_type=NotificationType.PROJECT_BRIEFING,
            level=NotificationLevel.INFO,
            metadata={
                **meta,
                "note": "Dwie zmiany naraz — przepraszam za zamieszanie.",
                "items": items,
            },
        )

    def _seed_manager_inbox(self, project: Project) -> None:
        meta = self._project_metadata(project)
        rehearsal = Rehearsal.objects.filter(
            project=project, date_time__gte=self.now,
        ).order_by("date_time").first()
        rehearsal_meta = self._rehearsal_metadata(project, rehearsal)
        sample_name = (
            f"{self.artists[0].first_name} {self.artists[0].last_name}"
            if self.artists else "Anna Kowalska"
        )
        artist_id = str(self.artists[0].id) if self.artists else ""
        pending_count = PendingAnnouncement.objects.filter(published_at__isnull=True).count()
        cast_count = Participation.objects.filter(
            project=project, status=Participation.Status.CONFIRMED,
        ).count()

        alerts: tuple[tuple[str, str, dict[str, Any]], ...] = (
            (NotificationType.PARTICIPATION_RESPONSE, NotificationLevel.INFO,
             {**meta, "artist_name": sample_name, "artist_id": artist_id,
              "status": Participation.Status.CONFIRMED}),
            (NotificationType.PARTICIPATION_RESPONSE, NotificationLevel.WARNING,
             {**meta, "artist_name": "Piotr Nowak", "status": Participation.Status.DECLINED}),
            (NotificationType.ATTENDANCE_SUBMITTED, NotificationLevel.INFO,
             {**rehearsal_meta, "artist_name": sample_name, "artist_id": artist_id,
              "status": Attendance.Status.LATE, "minutes_late": 10}),
            (NotificationType.ABSENCE_REQUESTED, NotificationLevel.INFO,
             {**rehearsal_meta, "artist_name": sample_name,
              "excuse_note": "Egzamin na uczelni — wracam na próbę generalną."}),
            (NotificationType.MESSAGE_RECEIVED, NotificationLevel.INFO,
             {"title": "Pytanie o nuty", "sender_name": sample_name,
              "snippet": "Czy mogę prosić o wersję na alt?", "thread_id": str(uuid.uuid4())}),
            (NotificationType.CHANNEL_MESSAGE, NotificationLevel.INFO,
             {**meta, "sender_name": sample_name,
              "channel_id": str(getattr(ProjectChannel.objects.filter(project=project).first(), "id", ""))}),
            # The safety net: a live project holding changes nobody has been told about.
            (NotificationType.ANNOUNCEMENT_PENDING, NotificationLevel.WARNING,
             {**meta, "change_count": pending_count or 4,
              "recipient_count": cast_count, "waiting_hours": 20}),
        )
        for notification_type, level, metadata in alerts:
            notification = Notification.objects.create(
                recipient=self.managers[0], notification_type=notification_type,
                level=level, metadata=metadata, is_read=False,
            )
            self._backdate(notification, days=2)

        # A broadcast from the office, and the one alert that is not about a project.
        Notification.objects.create(
            recipient=self.managers[1], notification_type=NotificationType.CUSTOM_ADMIN_MESSAGE,
            level=NotificationLevel.INFO,
            metadata={
                "title": "Rozliczenie honorariów za marzec",
                "sender_name": "Zarząd Fundacji",
                "message": "Przelewy poszły w piątek. Potwierdzenia w zakładce Dokumenty.",
                "cta_label": "Otwórz dokumenty", "cta_url": "/panel/hub",
            },
        )
        Notification.objects.create(
            recipient=self.crew_user, notification_type=NotificationType.SYSTEM_ALERT,
            level=NotificationLevel.WARNING,
            metadata={
                "title": "Przerwa techniczna w niedzielę",
                "message": "Panel będzie niedostępny 22.03 między 2:00 a 4:00.",
                "cta_url": "/panel",
            },
        )

    def _backdate(self, notification: Notification, *, days: int) -> None:
        """`created_at` is auto-stamped, so the inbox would otherwise be one flat
        block — spread it so ordering, grouping and the 'new since seen' badge all
        have something to work with."""
        Notification.objects.filter(pk=notification.pk).update(
            created_at=self.now - timedelta(
                days=random.randint(0, days), hours=random.randint(0, 23),
            ),
        )

    def _seed_push_devices(self) -> None:
        subscribers: list[User] = [self.managers[0], self.crew_user]
        subscribers += [artist.user for artist in self.artists[:4] if artist.user is not None]
        for position, user in enumerate(subscribers):
            seed = f"{user.pk}:{position}"
            PushDevice.objects.get_or_create(
                registration_token=f"https://fcm.googleapis.com/fcm/send/{_web_push_key(seed, 24)}",
                defaults={
                    "user": user,
                    "device_type": DeviceType.WEB,
                    "p256dh_key": _web_push_key(f"p256dh:{seed}", 65),
                    "auth_key": _web_push_key(f"auth:{seed}", 16),
                    # One stale subscription: delivery failures invalidate tokens,
                    # and the sender has to skip them rather than retry forever.
                    "is_active": position != 2,
                },
            )

    def _seed_notification_preferences(self) -> None:
        """Rows only where a reader has moved a switch — an untouched preference is
        the absence of a row, resolved from the delivery policy defaults."""
        overrides: tuple[tuple[User, str, bool, bool], ...] = (
            (self.managers[1], NotificationType.REHEARSAL_REMINDER, False, True),
            (self.managers[1], NotificationType.CHANNEL_MESSAGE, False, True),
            (self.managers[1], NotificationType.ATTENDANCE_SUBMITTED, False, False),
            (self.managers[0], NotificationType.ANNOUNCEMENT_PENDING, True, True),
        )
        artist_users = [artist.user for artist in self.artists[:3] if artist.user_id]
        for user in artist_users:
            if user is None:
                continue
            overrides += (
                (user, NotificationType.MATERIAL_UPLOADED, False, False),
                (user, NotificationType.PROJECT_INVITATION, True, True),
            )
        for user, notification_type, email_enabled, push_enabled in overrides:
            NotificationPreference.objects.get_or_create(
                user=user, notification_type=notification_type,
                defaults={"email_enabled": email_enabled, "push_enabled": push_enabled},
            )

    # ----------------------------------------------------------------- #
    # Summary                                                           #
    # ----------------------------------------------------------------- #
    def _print_summary(self) -> None:
        rows: list[tuple[str, object]] = [
            ("Locations", Location.objects.count()),
            ("Users", User.objects.count()),
            ("Avatars", UserProfile.objects.exclude(avatar="").count()),
            ("Composers", Composer.objects.count()),
            ("Pieces", Piece.objects.count()),
            ("Movements", Movement.objects.count()),
            ("Translations", Translation.objects.count()),
            ("Recordings", Recording.objects.count()),
            ("Program notes", ProgramNote.objects.count()),
            ("Score editions", ScoreEdition.objects.count()),
            ("Annotations", Annotation.objects.count()),
            ("Provenance records", ProvenanceRecord.objects.count()),
            ("Score access logs", ScoreAccessLog.objects.count()),
            ("Audio tracks", Track.objects.count()),
            ("Documents", Document.objects.count()),
            ("Artists (active)", Artist.objects.exclude(voice_type=VoiceType.CONDUCTOR).count()),
            ("Artists (archived)", Artist.all_objects.filter(is_deleted=True).count()),
            ("Conductors", Artist.objects.filter(voice_type=VoiceType.CONDUCTOR).count()),
            ("Collaborators", Collaborator.objects.count()),
            ("Projects", Project.objects.count()),
            ("Score packages", ScorePackage.objects.count()),
            ("Program items", ProgramItem.objects.count()),
            ("Participations", Participation.objects.count()),
            ("Castings", ProjectPieceCasting.objects.count()),
            ("Readiness rows", PieceReadiness.objects.count()),
            ("Rehearsals", Rehearsal.objects.count()),
            ("Attendances", Attendance.objects.count()),
            ("Threads / messages", f"{Thread.objects.count()} / {Message.objects.count()}"),
            ("Channels / messages", f"{ProjectChannel.objects.count()} / {ChannelMessage.objects.count()}"),
            ("Donations / leads", f"{Donation.objects.count()} / {PatronLead.objects.count()}"),
            ("Notifications", Notification.objects.count()),
            ("Pending announcements", PendingAnnouncement.objects.count()),
            ("Push devices / prefs",
             f"{PushDevice.objects.count()} / {NotificationPreference.objects.count()}"),
        ]
        self.stdout.write(self.style.SUCCESS("\n[OK] Database seeded successfully.\n"))
        for label, value in rows:
            self.stdout.write(f"   {label:<22} {value}")
        self.stdout.write(self.style.SUCCESS(
            "\n>> Log in as:  admin / admin123   (also  manager / manager123, crew / crew123)"
        ))
