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

  • logistics  — Locations (concert halls, church, studio, rehearsal room, tour stop)
  • core/IAM   — superuser + a second manager, per-user UserProfiles (RBAC, sizes, diet)
  • roster     — singers (full voice spectrum), conductors, collaborators (crew),
                 projects in every lifecycle state, participations (paid/unpaid),
                 crew assignments, concert programmes, micro-casting (divisi),
                 rehearsals + attendance history, per-piece practice readiness
  • archive    — composers + repertoire enriched with opus/key/text-source/IPA,
                 multi-movement works, voice requirements, translations,
                 reference recordings, program notes, audio tracks + score editions
  • documents  — Knowledge-Base categories + role-gated documents
  • messaging  — 1:1 artist↔management threads and per-project group channels
  • payments   — donations (settled/pending/failed) + recurring-patron leads
  • notifications — per-user inbox items, push devices, delivery preferences

Flags:
  --artists N    number of singers to generate (default 28)
  --seed N       RNG seed for a reproducible dataset (default 2026)
  --clear        hard-wipe previously-seeded data before re-seeding
  --no-media     skip generating placeholder files (audio tracks, score
                 editions, knowledge-base documents, project score PDFs)
  --quiet        only print the final summary

Login after seeding:  admin / admin123   (and  manager / manager123)
"""

import hashlib
import random
import struct
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

# Archive
from archive.models import (
    Composer,
    EpochChoices,
    IngestionStatus,
    Movement,
    Piece,
    PieceVoiceRequirement,
    ProgramNote,
    Recording,
    RecordingSource,
    ScoreEdition,
    Track,
    Translation,
)

# Core
from core.constants import AppRole, ClothingSizeChoices, DietaryChoices, VoiceLine
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
    DeviceType,
    Notification,
    NotificationLevel,
    NotificationPreference,
    NotificationType,
    PushDevice,
)

# Payments
from payments.models import Donation, DonationCurrency, DonationStatus, PatronLead, PatronLeadStatus

# Roster
from roster.models import (
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
    VoiceType,
)

User = get_user_model()

SEED_DOMAIN = "voctmanager.test"
TZ = "Europe/Warsaw"

# name, category, formatted address, latitude, longitude, internal notes
LOCATION_DATA = {
    "philharmonic": ("Filharmonia Narodowa", LocationCategory.CONCERT_HALL,
                     "Jasna 5, 00-013 Warszawa", Decimal("52.236000"), Decimal("21.010300"),
                     "Wejście dla artystów od ul. Sienkiewicza. Garderoby na poziomie -1."),
    "church": ("Bazylika Świętego Krzyża", LocationCategory.CHURCH,
               "Krakowskie Przedmieście 3, 00-047 Warszawa", Decimal("52.238900"), Decimal("21.016600"),
               "Akustyka: ok. 4s pogłosu. Ustawienie chóru na chórze organowym."),
    "studio": ("Studio Koncertowe S1 Polskiego Radia", LocationCategory.OTHER,
               "Woronicza 17, 00-999 Warszawa", Decimal("52.186900"), Decimal("21.007000"),
               "Sesja nagraniowa — cisza absolutna między ujęciami. Reżyserka na zapleczu."),
    "rehearsal": ("Sala prób — Dom Muzyka", LocationCategory.REHEARSAL_ROOM,
                  "Złota 9, 00-019 Warszawa", Decimal("52.231000"), Decimal("21.005000"),
                  "Kod do drzwi: 1903#. Fortepian nastrojony, pulpity w szafie."),
    "krakow": ("Filharmonia im. K. Szymanowskiego", LocationCategory.CONCERT_HALL,
               "Zwierzyniecka 1, 31-103 Kraków", Decimal("50.058800"), Decimal("19.932000"),
               "Przystanek trasy letniej. Nocleg: hotel 600 m od sali."),
}
SEEDED_LOCATION_NAMES = [row[0] for row in LOCATION_DATA.values()]

# --------------------------------------------------------------------------- #
# Static reference data                                                        #
# --------------------------------------------------------------------------- #

# Polish first names paired with their vocative form (used in personalised greetings).
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
VOICE_LINES_FOR = {
    VoiceType.SOPRANO: [VoiceLine.SOPRANO_1, VoiceLine.SOPRANO_2],
    VoiceType.MEZZO: [VoiceLine.SOPRANO_2, VoiceLine.ALTO_1],
    VoiceType.ALTO: [VoiceLine.ALTO_1, VoiceLine.ALTO_2],
    VoiceType.COUNTERTENOR: [VoiceLine.ALTO_2, VoiceLine.TENOR_1],
    VoiceType.TENOR: [VoiceLine.TENOR_1, VoiceLine.TENOR_2],
    VoiceType.BARITONE: [VoiceLine.BASS_1, VoiceLine.TENOR_2],
    VoiceType.BASS: [VoiceLine.BASS_1, VoiceLine.BASS_2],
}
# Plausible vocal ranges (bottom, top) per fach.
RANGE_FOR = {
    VoiceType.SOPRANO: ("C4", "C6"), VoiceType.MEZZO: ("A3", "A5"),
    VoiceType.ALTO: ("F3", "F5"), VoiceType.COUNTERTENOR: ("G3", "E5"),
    VoiceType.TENOR: ("C3", "B4"), VoiceType.BARITONE: ("A2", "G4"),
    VoiceType.BASS: ("E2", "E4"),
}

FEMALE_VOICES = [VoiceType.SOPRANO, VoiceType.SOPRANO, VoiceType.MEZZO, VoiceType.ALTO, VoiceType.ALTO]
MALE_VOICES = [VoiceType.TENOR, VoiceType.TENOR, VoiceType.BARITONE, VoiceType.BASS, VoiceType.BASS, VoiceType.COUNTERTENOR]


def _ascii(value: str) -> str:
    """Lowercase ASCII slug suitable for an e-mail local part."""
    return value.translate(_PL_ASCII).lower()


def _surname(is_female: bool) -> str:
    if random.random() < 0.55:
        stem = random.choice(SKI_SURNAMES)
        return stem + ("a" if is_female else "i")
    return random.choice(FLAT_SURNAMES)


# --------------------------------------------------------------------------- #
# Placeholder media generators (only used when --no-media is NOT passed)       #
# --------------------------------------------------------------------------- #

def _placeholder_pdf(title: str) -> bytes:
    """Build a tiny, structurally-valid single-page PDF carrying a title line."""
    safe = title.replace("(", "").replace(")", "").encode("latin-1", "replace")
    stream = b"BT /F1 20 Tf 60 780 Td (" + safe + b") Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
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


class Command(BaseCommand):
    help = "Generates a rich, realistic test dataset spanning every VoctManager domain."

    def add_arguments(self, parser):
        parser.add_argument("--artists", type=int, default=28, help="Number of singers to generate.")
        parser.add_argument("--seed", type=int, default=2026, help="RNG seed for a reproducible dataset.")
        parser.add_argument("--clear", action="store_true", help="Hard-wipe previously-seeded data first.")
        parser.add_argument("--no-media", action="store_true", help="Skip generating placeholder files.")
        parser.add_argument("--quiet", action="store_true", help="Only print the final summary.")

    # ----------------------------------------------------------------- #
    # Orchestration                                                     #
    # ----------------------------------------------------------------- #
    def handle(self, *args, **opts):
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
            self.managers = self._seed_managers()
            composers = self._seed_composers()
            self.pieces = self._seed_repertoire(composers)
            self.conductors = self._seed_conductors()
            self.artists = self._seed_artists(opts["artists"])
            self.collaborators = self._seed_collaborators()
            if self.with_media:
                self._seed_documents()
            self.projects = self._seed_projects()
            self._seed_messaging()
            self._seed_payments()
            self._seed_notifications()

        self._print_summary()

    def _log(self, message, style=None):
        if self.quiet:
            return
        self.stdout.write(style(message) if style else message)

    # ----------------------------------------------------------------- #
    # 0. Reset (optional)                                               #
    # ----------------------------------------------------------------- #
    def _clear(self):
        """Best-effort hard reset of seeded data, deepest children first."""
        self._log("0. Clearing previously-seeded data...", self.style.WARNING)

        # Ordered child → parent to satisfy RESTRICT/PROTECT foreign keys.
        ordered = [
            Notification, NotificationPreference, PushDevice,
            ChannelMessage, ChannelMembership, ProjectChannel,
            ThreadReadState, Message, Thread,
            Donation, PatronLead,
            Document, DocumentCategory,
            Attendance, PieceReadiness, ProjectPieceCasting, CrewAssignment,
            ProgramItem, Rehearsal, Participation, Project,
            Collaborator,
            ProgramNote, Recording, Translation, Movement, ScoreEdition, Track,
            PieceVoiceRequirement,
        ]
        for model in ordered:
            self._wipe(model)

        # Artists must drop before the auth users they reference; conductors are
        # the projects' SET_NULL target, already cleared above.
        self._wipe(Artist)
        self._wipe(Piece)
        self._wipe(Composer)
        Location.objects.filter(name__in=SEEDED_LOCATION_NAMES).delete()
        User.objects.filter(email__endswith=f"@{SEED_DOMAIN}").delete()

    @staticmethod
    def _wipe(model):
        manager = getattr(model, "all_objects", model.objects)
        queryset = manager.all()
        # Soft-delete querysets re-route .delete() to a flag flip — use the real purge.
        (queryset.hard_delete() if hasattr(queryset, "hard_delete") else queryset.delete())

    # ----------------------------------------------------------------- #
    # 1. Logistics                                                      #
    # ----------------------------------------------------------------- #
    def _seed_locations(self):
        self._log("1. Locations (halls, church, studio, rehearsal, tour stop)...")
        locations = {}
        for key, (name, category, address, lat, lng, notes) in LOCATION_DATA.items():
            loc, _ = Location.objects.get_or_create(
                name=name,
                defaults={
                    "category": category, "formatted_address": address,
                    "latitude": lat, "longitude": lng, "timezone": TZ,
                    "internal_notes": notes,
                },
            )
            locations[key] = loc
        return locations

    # ----------------------------------------------------------------- #
    # 2. Management accounts                                            #
    # ----------------------------------------------------------------- #
    def _seed_managers(self):
        self._log("2. Management accounts (admin + production manager)...")

        admin = User.objects.filter(username="admin").first()
        if admin is None:
            admin = User.objects.create_superuser("admin", f"admin@{SEED_DOMAIN}", "admin123")
        admin.first_name, admin.last_name = "Jan", "Kapelmistrz"
        admin.save()
        self._ensure_profile(admin, AppRole.MANAGER, phone="+48 600 100 100")

        manager = User.objects.filter(username="manager").first()
        if manager is None:
            manager = User.objects.create_user(
                "manager", f"manager@{SEED_DOMAIN}", "manager123",
                first_name="Helena", last_name="Zarządca",
            )
        self._ensure_profile(manager, AppRole.MANAGER, phone="+48 600 100 200")

        return [admin, manager]

    def _ensure_profile(self, user, role, phone=""):
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.timezone = TZ
        profile.language = UserProfile.LanguageChoices.POLISH
        if phone:
            profile.phone_number = phone
        profile.save()
        return profile

    # ----------------------------------------------------------------- #
    # 3. Archive — composers & repertoire                               #
    # ----------------------------------------------------------------- #
    def _seed_composers(self):
        self._log("3. Composers...")
        data = [
            ("Wolfgang Amadeus", "Mozart", "1756", "1791", "Austrian", EpochChoices.CLASSICAL,
             ["W.A. Mozart"]),
            ("Johann Sebastian", "Bach", "1685", "1750", "German", EpochChoices.BAROQUE,
             ["J.S. Bach", "Bach, Johann Sebastian"]),
            ("Arvo", "Pärt", "1935", "", "Estonian", EpochChoices.CONTEMPORARY, ["Arvo Part"]),
            ("Wacław", "z Szamotuł", "c. 1524", "c. 1560", "Polish", EpochChoices.RENAISSANCE,
             ["Wacław z Szamotuł", "Venceslaus Samotulinus"]),
            ("Eric", "Whitacre", "1970", "", "American", EpochChoices.CONTEMPORARY, []),
            ("Henryk Mikołaj", "Górecki", "1933", "2010", "Polish", EpochChoices.CONTEMPORARY,
             ["H.M. Górecki"]),
            ("Gregorio", "Allegri", "1582", "1652", "Italian", EpochChoices.BAROQUE, []),
            ("Felix", "Mendelssohn", "1809", "1847", "German", EpochChoices.ROMANTIC,
             ["Felix Mendelssohn Bartholdy"]),
            ("Stanisław", "Moniuszko", "1819", "1872", "Polish", EpochChoices.ROMANTIC, []),
            ("Morten", "Lauridsen", "1943", "", "American", EpochChoices.CONTEMPORARY, []),
        ]
        composers = {}
        for first, last, birth, death, nationality, period, aliases in data:
            comp, _ = Composer.objects.get_or_create(
                first_name=first, last_name=last,
                defaults={
                    "birth_year": birth, "death_year": death, "nationality": nationality,
                    "period": period, "aliases": aliases,
                    "bio": f"{first} {last} — {nationality} composer ({birth}–{death or '…'}).",
                },
            )
            composers[last] = comp
        return composers

    def _seed_repertoire(self, composers):
        self._log("4. Repertoire (pieces, movements, requirements, translations, recordings)...")
        # title, composer, epoch, language, voicing, opus, key, year, duration(s), text source,
        # lyrics incipit, IPA incipit, [movement titles]
        data = [
            ("Ave verum corpus", "Mozart", EpochChoices.CLASSICAL, "Latin", "SATB", "K. 618",
             "D major", 1791, 210, "Hymn eucharystyczny",
             "Ave verum corpus, natum de Maria Virgine", "ˈaː.ve ˈveː.rum ˈkor.pus", []),
            ("Magnificat", "Bach", EpochChoices.BAROQUE, "Latin", "SSATB", "BWV 243",
             "D major", 1723, 1680, "Łk 1, 46–55",
             "Magnificat anima mea Dominum", "maˈɲiː.fi.kat ˈaː.ni.ma ˈmeː.a",
             ["Magnificat", "Et exsultavit", "Quia respexit", "Omnes generationes", "Fecit potentiam"]),
            ("Bogoroditse Devo", "Pärt", EpochChoices.CONTEMPORARY, "Church Slavonic", "SATB", "",
             "", 1990, 110, "Modlitwa maryjna",
             "Bogoroditse Devo, raduisia", "bɐ.ɡɐˈro.dʲɪ.tsɛ ˈdʲe.vɐ", []),
            ("Już się zmierzcha", "z Szamotuł", EpochChoices.RENAISSANCE, "Polish", "SATB", "",
             "", 1556, 180, "Pieśń wieczorna",
             "Już się zmierzcha, idzie noc", "ˈju ɕɛ ˈzmjɛʐ.xa", []),
            ("Sleep", "Whitacre", EpochChoices.CONTEMPORARY, "English", "SSAATTBB", "",
             "", 2000, 330, "Tekst: Charles Anthony Silvestri",
             "The evening hangs beneath the moon", "ðə ˈiːv.nɪŋ hæŋz", []),
            ("Totus Tuus", "Górecki", EpochChoices.CONTEMPORARY, "Latin", "SATB", "Op. 60",
             "", 1987, 540, "Akt zawierzenia Maryi",
             "Totus Tuus sum, Maria", "ˈtoː.tus ˈtuː.us sum maˈriː.a", []),
            ("Miserere mei, Deus", "Allegri", EpochChoices.BAROQUE, "Latin", "SSATB SATB", "",
             "G minor", 1638, 720, "Ps 51",
             "Miserere mei, Deus", "mi.zeˈreː.re ˈmeː.i ˈdeː.us", []),
            ("Verleih uns Frieden", "Mendelssohn", EpochChoices.ROMANTIC, "German", "SATB", "",
             "", 1831, 300, "Tekst: Martin Luther",
             "Verleih uns Frieden gnädiglich", "fɛɐ̯ˈlaɪ̯ ʊns ˈfʁiː.dn̩", []),
            ("Modlitwa", "Moniuszko", EpochChoices.ROMANTIC, "Polish", "SATB", "",
             "", 1860, 240, "Pieśń religijna",
             "Ojcze z niebios, Boże, Panie", "ˈɔj.t͡ʂɛ z ˈɲɛ.bjɔs", []),
            ("O magnum mysterium", "Lauridsen", EpochChoices.CONTEMPORARY, "Latin", "SATB", "",
             "D major", 1994, 360, "Responsorium na Boże Narodzenie",
             "O magnum mysterium", "o ˈmaɡ.num misˈteː.ri.um", []),
        ]

        translations_for = {
            "Ave verum corpus": [
                ("pl", "Witaj, prawdziwe Ciało, zrodzone z Maryi Dziewicy", True),
                ("en", "Hail, true Body, born of the Virgin Mary", False),
            ],
            "Bogoroditse Devo": [
                ("pl", "Bogurodzico Dziewico, raduj się", True),
                ("en", "Rejoice, O Virgin Mother of God", False),
            ],
            "O magnum mysterium": [
                ("pl", "O wielka tajemnico i przedziwny sakramencie", False),
            ],
        }
        notes_for = {
            "Sleep": "Whitacre napisał „Sleep” pierwotnie do wiersza Roberta Frosta; po sporze "
                     "o prawa autorskie powstał nowy tekst Silvestriego. Gęste, ośmiogłosowe "
                     "współbrzmienia budują obraz zapadania w sen.",
            "Totus Tuus": "Hołd Góreckiego dla Jana Pawła II, napisany na jego trzecią pielgrzymkę "
                          "do Polski w 1987 roku. Hipnotyczne powtórzenia imienia Maryi.",
        }

        pieces = []
        for (title, comp_last, epoch, lang, voicing, opus, key, year, dur, text_source,
             lyrics, ipa, movements) in data:
            piece, created = Piece.objects.get_or_create(
                title=title,
                defaults={
                    "composer": composers.get(comp_last), "epoch": epoch, "language": lang,
                    "voicing": voicing, "opus_catalog": opus, "musical_key": key,
                    "composition_year": year, "estimated_duration": dur, "text_source": text_source,
                    "lyrics_original": lyrics, "lyrics_ipa": ipa,
                    "description": f"{voicing} · {lang} · {text_source}",
                },
            )
            pieces.append(piece)
            if not created:
                continue

            # Voice requirements derived from the compact voicing string.
            for line in self._lines_from_voicing(voicing):
                PieceVoiceRequirement.objects.get_or_create(
                    piece=piece, voice_line=line, defaults={"quantity": random.randint(2, 6)}
                )

            # Movements (multi-movement works only).
            for order_index, mv_title in enumerate(movements):
                Movement.objects.get_or_create(
                    piece=piece, order_index=order_index,
                    defaults={
                        "title": mv_title,
                        "tempo_marking": random.choice(["Adagio", "Andante", "Allegro", "Largo"]),
                        "duration_seconds": random.randint(120, 360),
                    },
                )

            # Translations.
            for lang_code, text, singable in translations_for.get(title, []):
                Translation.objects.get_or_create(
                    piece=piece, movement=None, target_language=lang_code,
                    defaults={"text": text, "is_singable": singable},
                )

            # Reference recordings (data only — fictional external IDs).
            Recording.objects.get_or_create(
                source=RecordingSource.SPOTIFY, external_id=f"spf-{uuid.uuid4().hex[:12]}",
                defaults={
                    "piece": piece, "url": "https://open.spotify.com/track/seed",
                    "performer": "The Sixteen", "year": 2014,
                    "duration_seconds": dur, "is_featured": True,
                },
            )
            Recording.objects.get_or_create(
                source=RecordingSource.YOUTUBE, external_id=f"ytb-{uuid.uuid4().hex[:11]}",
                defaults={
                    "piece": piece, "url": "https://www.youtube.com/watch?v=seed",
                    "performer": "Voces8", "year": 2019, "duration_seconds": dur,
                },
            )

            # Program note (canonical, approved) for a couple of works.
            if title in notes_for:
                ProgramNote.objects.get_or_create(
                    piece=piece, project=None, language="pl",
                    defaults={
                        "content": notes_for[title], "is_approved": True,
                        "target_tone": "accessible", "word_count_target": 120,
                    },
                )

            if self.with_media:
                self._seed_piece_media(piece, voicing)

        return pieces

    def _seed_piece_media(self, piece, voicing):
        """Attach a default score edition and per-section rehearsal tracks."""
        if not piece.editions.exists():
            pdf = _placeholder_pdf(f"{piece.title} — score (placeholder)")
            edition = ScoreEdition(
                piece=piece, original_filename=f"{_ascii(piece.title).replace(' ', '_')}.pdf",
                page_count=random.randint(2, 16),
                publisher=random.choice(["Bärenreiter", "Carus", "PWM", "IMSLP"]),
                edition_year=random.randint(1990, 2022), is_default=True,
                sha256=hashlib.sha256(pdf).hexdigest(),
                uploaded_by=self.managers[0], ingestion_status=IngestionStatus.READY,
            )
            edition.pdf_file.save(f"{edition.original_filename}", ContentFile(pdf), save=False)
            edition.save()

        if not piece.tracks.exists():
            wav = _placeholder_wav()
            for line in self._lines_from_voicing(voicing)[:4]:
                track = Track(piece=piece, voice_part=line)
                track.audio_file.save(
                    f"{_ascii(piece.title).replace(' ', '_')}_{line}.wav",
                    ContentFile(wav), save=False,
                )
                track.save()

    @staticmethod
    def _lines_from_voicing(voicing):
        """Parse a compact voicing label (e.g. 'SSAATTBB') into VoiceLine codes."""
        buckets = {
            "S": [VoiceLine.SOPRANO_1, VoiceLine.SOPRANO_2, VoiceLine.SOPRANO_3],
            "A": [VoiceLine.ALTO_1, VoiceLine.ALTO_2, VoiceLine.ALTO_3],
            "T": [VoiceLine.TENOR_1, VoiceLine.TENOR_2, VoiceLine.TENOR_3],
            "B": [VoiceLine.BASS_1, VoiceLine.BASS_2, VoiceLine.BASS_3],
        }
        seen = {"S": 0, "A": 0, "T": 0, "B": 0}
        lines = []
        for char in voicing.upper():
            if char in buckets and seen[char] < 3 and buckets[char][seen[char]] not in lines:
                lines.append(buckets[char][seen[char]])
                seen[char] += 1
        return lines or [VoiceLine.SOPRANO_1, VoiceLine.ALTO_1, VoiceLine.TENOR_1, VoiceLine.BASS_1]

    # ----------------------------------------------------------------- #
    # 5. Conductors                                                     #
    # ----------------------------------------------------------------- #
    def _seed_conductors(self):
        self._log("5. Conductors...")
        admin = self.managers[0]
        # Principal conductor IS the admin (Chief Conductor) — link an Artist record.
        principal = Artist.objects.filter(email=f"admin@{SEED_DOMAIN}").first()
        if principal is None:
            principal = Artist.objects.create(
                user=admin, first_name=admin.first_name, last_name=admin.last_name,
                email=f"admin@{SEED_DOMAIN}", voice_type=VoiceType.CONDUCTOR,
                phone_number="+48 600 100 100", sight_reading_skill=5,
            )

        guest_email = f"guest.conductor@{SEED_DOMAIN}"
        guest = Artist.objects.filter(email=guest_email).first()
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
    def _seed_artists(self, count):
        self._log(f"6. Singers + profiles ({count})...")
        artists = []
        for i in range(count):
            is_female = i % 2 == 0
            pool = FEMALE_NAMES if is_female else MALE_NAMES
            # Identity is derived from the index, not the RNG, so re-runs map to the
            # same rows even if earlier (skipped) sections leave the RNG at a different
            # position — keeping the seed idempotent.
            first, vocative = pool[(i // 2) % len(pool)]
            last = _surname(is_female)
            voice = random.choice(FEMALE_VOICES if is_female else MALE_VOICES)
            email = f"singer{i:02d}@{SEED_DOMAIN}"
            phone = f"+48 {random.randint(500, 799)} {random.randint(100, 999)} {random.randint(100, 999)}"

            artist = Artist.objects.filter(email=email).first()
            if artist:
                artists.append(artist)
                continue

            user = User.objects.create_user(
                username=email, email=email, password="password123",
                first_name=first, last_name=last,
            )
            profile = self._ensure_profile(user, AppRole.ARTIST, phone=phone)
            profile.dietary_preference = random.choices(
                [DietaryChoices.NONE, DietaryChoices.VEGE, DietaryChoices.VEGAN,
                 DietaryChoices.GF, DietaryChoices.LF],
                weights=[60, 15, 5, 10, 10], k=1,
            )[0]
            if profile.dietary_preference != DietaryChoices.NONE:
                profile.dietary_notes = random.choice(
                    ["Alergia na orzechy", "Bez papryki", "Alergia na owoce morza", ""]
                )
            profile.clothing_size = random.choice([
                ClothingSizeChoices.S, ClothingSizeChoices.M,
                ClothingSizeChoices.L, ClothingSizeChoices.XL,
            ])
            profile.shoe_size = str(random.randint(37, 41) if is_female else random.randint(41, 46))
            profile.height_cm = random.randint(158, 180) if is_female else random.randint(170, 195)
            profile.save()

            bottom, top = RANGE_FOR[voice]
            artist = Artist.objects.create(
                user=user, first_name=first, last_name=last, email=email,
                voice_type=voice, phone_number=phone, first_name_vocative=vocative,
                sight_reading_skill=random.randint(2, 5),
                vocal_range_bottom=bottom, vocal_range_top=top,
            )
            artists.append(artist)
        return artists

    # ----------------------------------------------------------------- #
    # 7. Collaborators (crew)                                           #
    # ----------------------------------------------------------------- #
    def _seed_collaborators(self):
        self._log("7. Collaborators (technical crew)...")
        data = [
            ("Tomasz", "Dźwięk", Collaborator.Specialty.SOUND, "SoundCraft Studio"),
            ("Marek", "Światło", Collaborator.Specialty.LIGHT, "LumenFX"),
            ("Katarzyna", "Logistyk", Collaborator.Specialty.LOGISTICS, "EventMasters"),
            ("Paweł", "Organista", Collaborator.Specialty.INSTRUMENT, ""),
            ("Anna", "Wizual", Collaborator.Specialty.VISUALS, "Projekcje AV"),
        ]
        crew = []
        for first, last, specialty, company in data:
            email = f"{_ascii(first)}.{_ascii(last)}@{SEED_DOMAIN}"
            collab, _ = Collaborator.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first, "last_name": last, "specialty": specialty,
                    "company_name": company,
                    "phone_number": f"+48 {random.randint(500, 799)} {random.randint(100000, 999999)}",
                },
            )
            crew.append(collab)
        return crew

    # ----------------------------------------------------------------- #
    # 8. Knowledge Base                                                 #
    # ----------------------------------------------------------------- #
    def _seed_documents(self):
        self._log("8. Knowledge Base (categories + documents)...")
        ALL = [AppRole.ARTIST, AppRole.MANAGER, AppRole.CREW]
        categories = [
            ("Regulamin i statut", "regulamin", DocumentIconKey.SCROLL_TEXT, ALL, 1,
             "Dokumenty założycielskie fundacji i regulamin zespołu."),
            ("Garderoba i stroje", "garderoba", DocumentIconKey.SHIRT, [AppRole.ARTIST, AppRole.MANAGER], 2,
             "Wytyczne dotyczące strojów koncertowych i ich pielęgnacji."),
            ("Logistyka tras", "logistyka", DocumentIconKey.MAP_PIN, ALL, 3,
             "Plany podróży, noclegi i harmonogramy tras koncertowych."),
            ("Bezpieczeństwo", "bezpieczenstwo", DocumentIconKey.SHIELD, ALL, 4,
             "Procedury BHP i kontakty alarmowe."),
            ("Onboarding", "onboarding", DocumentIconKey.GRADUATION_CAP, [AppRole.ARTIST], 5,
             "Przewodnik dla nowych członków zespołu."),
        ]
        pdf = _placeholder_pdf("VoctManager — dokument (placeholder)")
        for name, slug, icon, roles, order, description in categories:
            category, created = DocumentCategory.objects.get_or_create(
                slug=slug,
                defaults={"name": name, "icon_key": icon, "allowed_roles": list(roles),
                          "order": order, "description": description},
            )
            if not created or category.documents.exists():
                continue
            doc = Document(
                category=category, title=f"{name} — wersja 2026", description=description,
                file_size_bytes=len(pdf), mime_type="application/pdf",
                uploaded_by=self.managers[0], order=1,
            )
            doc.file.save(f"{slug}.pdf", ContentFile(pdf), save=False)
            doc.save()

    # ----------------------------------------------------------------- #
    # 9. Projects (the centrepiece)                                     #
    # ----------------------------------------------------------------- #
    def _seed_projects(self):
        self._log("9. Projects: programmes, casting, rehearsals, attendance, readiness...")
        # title, status, days_offset, location key, conductor index
        plan = [
            ("Festiwal Muzyki Dawnej — Wratislavia", Project.Status.COMPLETED, -45, "church", 1),
            ("Koncert Pasyjny „Miserere”", Project.Status.COMPLETED, -12, "philharmonic", 0),
            ("Koncert Wiosenny „Lux Aeterna”", Project.Status.ACTIVE, 18, "philharmonic", 0),
            ("Nagranie albumu a cappella", Project.Status.ACTIVE, 9, "studio", 0),
            ("Kolędy i pastorałki", Project.Status.DRAFT, 75, "church", 1),
            ("Trasa letnia — Kraków", Project.Status.DRAFT, 130, "krakow", 0),
        ]
        projects = []
        for title, status, days, loc_key, cond_idx in plan:
            location = self.locations[loc_key]
            when = self.now + timedelta(days=days)
            call_time = when - timedelta(hours=3)
            project, created = Project.objects.get_or_create(
                title=title,
                defaults={
                    "date_time": when, "call_time": call_time, "status": status,
                    "location": location, "timezone": location.timezone,
                    "conductor": self.conductors[cond_idx],
                    "description": "Pełna obsługa logistyczna: catering, garderoby, transport.",
                    "dress_code_male": "Frak, biała muszka", "dress_code_female": "Czarna suknia chóralna",
                    "spotify_playlist_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
                    "run_sheet": self._run_sheet(call_time, when),
                },
            )
            projects.append(project)
            if not created:
                continue
            self._populate_project(project, status, when)
        return projects

    @staticmethod
    def _run_sheet(call_time, start):
        def fmt(dt):
            return dt.strftime("%H:%M")
        return [
            {"time": fmt(call_time), "task": "Przyjazd i przygotowanie", "location": "Garderoby"},
            {"time": fmt(call_time + timedelta(minutes=30)), "task": "Próba akustyczna", "location": "Scena"},
            {"time": fmt(call_time + timedelta(hours=2)), "task": "Catering", "location": "Foyer"},
            {"time": fmt(start), "task": "POCZĄTEK KONCERTU", "location": "Scena"},
        ]

    def _populate_project(self, project, status, when):
        is_done = status == Project.Status.COMPLETED
        is_draft = status == Project.Status.DRAFT

        # --- A) participations ---
        invited = random.sample(self.artists, k=min(len(self.artists), 18 if not is_draft else 12))
        participations = []
        for artist in invited:
            if is_done:
                p_status, paid = Participation.Status.CONFIRMED, True
            elif is_draft:
                p_status, paid = Participation.Status.INVITED, False
            else:  # ACTIVE — mostly confirmed, a few pending / declined
                p_status = random.choices(
                    [Participation.Status.CONFIRMED, Participation.Status.INVITED, Participation.Status.DECLINED],
                    weights=[78, 15, 7], k=1,
                )[0]
                paid = False
            participation = Participation.objects.create(
                artist=artist, project=project, status=p_status,
                fee=random.choice([200, 250, 300, 400]),
                is_paid=paid, paid_at=(when + timedelta(days=2)) if paid else None,
            )
            participations.append(participation)

        confirmed = [p for p in participations if p.status == Participation.Status.CONFIRMED]

        # --- B) crew ---
        for collab in random.sample(self.collaborators, k=3):
            CrewAssignment.objects.create(
                collaborator=collab, project=project,
                status=CrewAssignment.Status.CONFIRMED if not is_draft else CrewAssignment.Status.INVITED,
                fee=1000, is_paid=is_done, paid_at=(when + timedelta(days=2)) if is_done else None,
                role_description=f"Obsługa: {collab.get_specialty_display()}",
            )

        # --- C) programme + micro-casting ---
        programme = random.sample(self.pieces, k=random.randint(3, 5))
        for order, piece in enumerate(programme, start=1):
            ProgramItem.objects.get_or_create(
                project=project, piece=piece,
                defaults={"order": order, "is_encore": order == len(programme)},
            )
            for idx, participation in enumerate(confirmed):
                line = random.choice(VOICE_LINES_FOR[VoiceType(participation.artist.voice_type)])
                ProjectPieceCasting.objects.get_or_create(
                    participation=participation, piece=piece,
                    defaults={
                        "voice_line": line,
                        "gives_pitch": line == VoiceLine.SOPRANO_1 and idx == 0,
                    },
                )
                # --- C') practice readiness (Songbook / heatmap) ---
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
                    participation=participation, piece=piece, defaults={"status": readiness}
                )

        # --- D) rehearsals + attendance ---
        if is_done:
            offsets = [when - timedelta(days=d) for d in (21, 14, 7, 3)]
        elif is_draft:
            offsets = [when - timedelta(days=5)]
        else:  # ACTIVE — two past (recorded) + one upcoming (invited only)
            offsets = [self.now - timedelta(days=7), self.now - timedelta(days=2), when - timedelta(days=3)]

        for i, rdate in enumerate(offsets, start=1):
            rehearsal = Rehearsal.objects.create(
                project=project, date_time=rdate, location=self.locations["rehearsal"],
                timezone=TZ, focus=f"Praca nad repertuarem (część {i})", is_mandatory=True,
            )
            rehearsal.invited_participations.set(participations)
            if rdate < self.now:  # only record attendance for rehearsals that already happened
                for participation in confirmed:
                    self._record_attendance(rehearsal, participation)

        # --- E) project channel announcements (channel auto-created by signal) ---
        self._seed_channel(project)

    def _record_attendance(self, rehearsal, participation):
        status = random.choices(
            [Attendance.Status.PRESENT, Attendance.Status.LATE,
             Attendance.Status.EXCUSED, Attendance.Status.ABSENT],
            weights=[80, 10, 6, 4], k=1,
        )[0]
        Attendance.objects.create(
            rehearsal=rehearsal, participation=participation, status=status,
            minutes_late=random.randint(5, 20) if status == Attendance.Status.LATE else None,
            excuse_note="Korek na trasie" if status == Attendance.Status.EXCUSED else "",
        )

    def _seed_channel(self, project):
        """The membership-sync signal creates the channel + MEMBER rows for confirmed
        participations. We only add MANAGER access and a few messages on top."""
        channel = ProjectChannel.objects.filter(project=project).first()
        if channel is None or channel.messages.exists():
            return
        for manager in self.managers:
            ChannelMembership.objects.get_or_create(
                channel=channel, user=manager,
                defaults={"role": ChannelRole.MANAGER, "push_enabled": True},
            )
        announcements = [
            (self.managers[0], "Witajcie w kanale projektu! Tu znajdziecie wszystkie ważne informacje.", True),
            (self.managers[1], "Próba generalna w stroju koncertowym — pamiętajcie o obuwiu.", False),
        ]
        last = None
        for i, (sender, body, pinned) in enumerate(announcements):
            last = self.now - timedelta(hours=len(announcements) - i)
            ChannelMessage.objects.create(channel=channel, sender=sender, body=body, is_pinned=pinned)
        if last:
            ProjectChannel.objects.filter(pk=channel.pk).update(last_message_at=last)

    # ----------------------------------------------------------------- #
    # 10. Messaging (1:1 threads)                                       #
    # ----------------------------------------------------------------- #
    def _seed_messaging(self):
        if Thread.objects.exists():
            return
        self._log("10. Messaging threads (artist <-> management)...")
        admin, manager = self.managers
        scripts = [
            ("Prośba o nieobecność na próbie", ThreadStatus.RESOLVED, manager, [
                (True, "Dzień dobry, czy mogę być zwolniony z najbliższej próby? Mam egzamin."),
                (False, "Oczywiście, usprawiedliwiamy nieobecność. Powodzenia na egzaminie!"),
                (True, "Bardzo dziękuję!"),
            ]),
            ("Pytanie o strój na koncert", ThreadStatus.OPEN, admin, [
                (True, "Czy na koncert wiosenny obowiązuje długa suknia, czy spódnica do kolan?"),
                (False, "Długa suknia chóralna, zgodnie z dress code projektu."),
            ]),
            ("Zwrot kosztów dojazdu", ThreadStatus.OPEN, manager, [
                (True, "Jak rozliczyć bilety na trasę do Krakowa?"),
            ]),
            ("Nuty do nowego utworu", ThreadStatus.RESOLVED, admin, [
                (True, "Nie widzę partii altu do „Sleep” w aplikacji."),
                (False, "Już wgrana — odśwież zakładkę Śpiewnik."),
                (True, "Działa, dzięki!"),
            ]),
        ]
        singers = [a for a in self.artists if a.user_id][:len(scripts)]
        for artist, (subject, status, assignee, lines) in zip(singers, scripts, strict=False):
            thread = Thread.objects.create(
                artist=artist, subject=subject, assignee=assignee, status=status,
                context_type=ThreadContextType.GENERAL,
            )
            last = self.now
            for offset, (from_artist, body) in enumerate(lines):
                last = self.now - timedelta(days=2) + timedelta(hours=offset)
                sender = artist.user if from_artist else assignee
                msg = Message.objects.create(thread=thread, sender=sender, body=body)
                Message.objects.filter(pk=msg.pk).update(created_at=last)
            Thread.objects.filter(pk=thread.pk).update(last_message_at=last)
            # Management has read it; the artist has read up to their own last line.
            ThreadReadState.objects.update_or_create(
                thread=thread, user=assignee, defaults={"last_read_at": last}
            )
            ThreadReadState.objects.update_or_create(
                thread=thread, user=artist.user, defaults={"last_read_at": last - timedelta(hours=1)}
            )

    # ----------------------------------------------------------------- #
    # 11. Payments (donations + patron leads)                           #
    # ----------------------------------------------------------------- #
    def _seed_payments(self):
        if Donation.objects.exists():
            return
        self._log("11. Payments (donations + patron leads)...")
        statuses = (
            [DonationStatus.SETTLED] * 10 + [DonationStatus.PENDING] * 3 + [DonationStatus.FAILED] * 2
        )
        random.shuffle(statuses)
        for i, status in enumerate(statuses):
            currency = random.choices([DonationCurrency.PLN, DonationCurrency.EUR], weights=[80, 20], k=1)[0]
            amount = Decimal(random.choice([20, 50, 50, 100, 100, 250, 500]))
            donation = Donation.objects.create(
                email=f"donor{i}@example.com", amount=amount, currency=currency, status=status,
                axepta_payment_id=(f"AXP-{uuid.uuid4().hex[:16]}" if status != DonationStatus.PENDING else None),
            )
            Donation.objects.filter(pk=donation.pk).update(
                created_at=self.now - timedelta(days=random.randint(1, 180))
            )

        leads = [
            ("Krzysztof", "Mecenas", PatronLeadStatus.ACTIVE, "Stałe zlecenie 200 zł/mies. od marca."),
            ("Agata", "Dobrodziej", PatronLeadStatus.CONTACTED, "Oddzwonić w przyszłym tygodniu."),
            ("Piotr", "Fundator", PatronLeadStatus.NEW, ""),
            ("Maria", "Wspierająca", PatronLeadStatus.ARCHIVED, "Zrezygnowała — zmiana sytuacji."),
        ]
        for first, last, lead_status, note in leads:
            PatronLead.objects.create(
                first_name=first, last_name=last,
                email=f"{_ascii(first)}.{_ascii(last)}@example.com", status=lead_status, note=note,
            )

    # ----------------------------------------------------------------- #
    # 12. Notifications                                                 #
    # ----------------------------------------------------------------- #
    def _seed_notifications(self):
        if Notification.objects.exists():
            return
        self._log("12. Notifications (inbox, push devices, preferences)...")
        from notifications.time_metadata import build_event_time_metadata
        from roster.models import DEFAULT_EVENT_TIMEZONE

        active_projects = [p for p in self.projects if p.status == Project.Status.ACTIVE]
        showcase = active_projects[0] if active_projects else self.projects[0]
        event_moment = build_event_time_metadata(
            showcase.date_time, showcase.timezone, fallback_timezone=DEFAULT_EVENT_TIMEZONE,
        )
        showcase_location = showcase.location.name if showcase.location_id else ""
        # Structured, language-neutral metadata — every surface localizes at render.
        meta = {
            "project_id": str(showcase.id),
            "project_name": showcase.title,
            "location": showcase_location,
            **event_moment,
        }
        invitation_meta = {**meta, "date_range": event_moment["starts_at_display"],
                           "inviter_name": "Zespół VoctManager"}
        rehearsal_meta = {**meta, "rehearsal_id": str(uuid.uuid4()), "focus": "Sekcja I — intonacja"}

        # Per-singer inbox: an invitation, a rehearsal heads-up, a casting note, a DM.
        for artist in self.artists:
            if not artist.user_id:
                continue
            piece = random.choice(self.pieces)
            # Language-neutral VoiceLine CODE (e.g. "B1") — never a rendered label.
            voice_code = random.choice(
                VOICE_LINES_FOR.get(artist.voice_type, [VoiceLine.SOPRANO_1])
            ).value
            casting_meta = {**meta, "piece_id": str(piece.id), "piece_title": piece.title,
                            "voice_line": voice_code}
            dm_meta = {"title": "Zmiana godziny próby", "sender_name": "Krystian (dyrygent)",
                       "snippet": "Cześć! Przesuwamy czwartkową próbę na 19:30.",
                       "thread_id": str(uuid.uuid4())}
            material_meta = {"piece_id": str(piece.id), "piece_title": piece.title,
                             "material_kind": random.choice(["score", "recording"]),
                             "composer_name": str(piece.composer) if piece.composer_id else None}
            templates = [
                (NotificationType.PROJECT_INVITATION, NotificationLevel.INFO, invitation_meta, False),
                (NotificationType.REHEARSAL_SCHEDULED, NotificationLevel.INFO, rehearsal_meta, random.random() < 0.5),
                (NotificationType.PIECE_CASTING_ASSIGNED, NotificationLevel.INFO, casting_meta, False),
                (NotificationType.MATERIAL_UPLOADED, NotificationLevel.INFO, material_meta, random.random() < 0.5),
                (NotificationType.MESSAGE_RECEIVED, NotificationLevel.INFO, dm_meta, False),
            ]
            for ntype, level, metadata, is_read in random.sample(templates, k=3):
                Notification.objects.create(
                    recipient=artist.user, notification_type=ntype, level=level,
                    metadata=metadata, is_read=is_read,
                    read_at=self.now if is_read else None,
                )

        # Manager alerts — structured roster signals (artist name + status codes).
        sample_name = (
            f"{self.artists[0].first_name} {self.artists[0].last_name}"
            if self.artists else "Anna Kowalska"
        )
        manager_alerts = [
            (NotificationType.PARTICIPATION_RESPONSE,
             {**meta, "artist_name": sample_name, "status": "CON"}),
            (NotificationType.ATTENDANCE_SUBMITTED,
             {**meta, "artist_name": sample_name, "status": "LATE", "minutes_late": 10}),
            (NotificationType.MESSAGE_RECEIVED,
             {"title": "Pytanie o nuty", "sender_name": sample_name,
              "snippet": "Czy mogę prosić o wersję na alt?", "thread_id": str(uuid.uuid4())}),
        ]
        for ntype, metadata in manager_alerts:
            Notification.objects.create(
                recipient=self.managers[0], notification_type=ntype,
                level=NotificationLevel.INFO, metadata=metadata, is_read=False,
            )

        # A couple of registered web push devices.
        for user in [self.managers[0], *[a.user for a in self.artists[:3] if a.user_id]]:
            PushDevice.objects.get_or_create(
                registration_token=f"webpush-{uuid.uuid4().hex}",
                defaults={"user": user, "device_type": DeviceType.WEB},
            )

        # Demonstrate granular delivery preferences for the production manager.
        for ntype, email_on in [(NotificationType.REHEARSAL_REMINDER, False),
                                (NotificationType.CHANNEL_MESSAGE, False)]:
            NotificationPreference.objects.get_or_create(
                user=self.managers[1], notification_type=ntype,
                defaults={"email_enabled": email_on, "push_enabled": True},
            )

    # ----------------------------------------------------------------- #
    # Summary                                                           #
    # ----------------------------------------------------------------- #
    def _print_summary(self):
        rows = [
            ("Locations", Location.objects.count()),
            ("Users", User.objects.count()),
            ("Composers", Composer.objects.count()),
            ("Pieces", Piece.objects.count()),
            ("Movements", Movement.objects.count()),
            ("Translations", Translation.objects.count()),
            ("Recordings", Recording.objects.count()),
            ("Score editions", ScoreEdition.objects.count()),
            ("Audio tracks", Track.objects.count()),
            ("Documents", Document.objects.count()),
            ("Artists (singers)", Artist.objects.exclude(voice_type=VoiceType.CONDUCTOR).count()),
            ("Conductors", Artist.objects.filter(voice_type=VoiceType.CONDUCTOR).count()),
            ("Collaborators", Collaborator.objects.count()),
            ("Projects", Project.objects.count()),
            ("Participations", Participation.objects.count()),
            ("Castings", ProjectPieceCasting.objects.count()),
            ("Readiness rows", PieceReadiness.objects.count()),
            ("Rehearsals", Rehearsal.objects.count()),
            ("Attendances", Attendance.objects.count()),
            ("Threads / messages", f"{Thread.objects.count()} / {Message.objects.count()}"),
            ("Channels / messages", f"{ProjectChannel.objects.count()} / {ChannelMessage.objects.count()}"),
            ("Donations / leads", f"{Donation.objects.count()} / {PatronLead.objects.count()}"),
            ("Notifications", Notification.objects.count()),
        ]
        self.stdout.write(self.style.SUCCESS("\n[OK] Database seeded successfully.\n"))
        for label, value in rows:
            self.stdout.write(f"   {label:<22} {value}")
        self.stdout.write(self.style.SUCCESS("\n>> Log in as:  admin / admin123   (or  manager / manager123)"))
