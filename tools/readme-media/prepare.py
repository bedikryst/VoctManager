"""
@file prepare.py
@description Stages the seeded dev database for the camera. Runs inside the web
container through `manage.py shell` (see shots.mjs), after `seed_db --seed 2026`.

The seed gives every score edition a blank placeholder PDF, which makes the
music stand read as an empty page with marks floating on it. This swaps the
showcase piece's edition for a real engraving (Mutopia Project, CC BY 4.0,
credited in the README) and moves the seeded marks onto its single page, over
the staves they would plausibly annotate. Layers, colours and authors stay as
the seed wrote them. The same piece's audio takes are one-second placeholders;
they become three minutes of silence, so the practice player reads a real length. Safe to run before every take: the engraving is swapped
once, the marks are laid out again and anything a recorded take drew is removed.

It also prints the ids the takes navigate to, on one `READMEMEDIA {json}` line.

`READMEMEDIA_LANG` (default `pl`) sets the interface language of the two
accounts the scripts sign in as. After login the profile's language overrides
the browser's, so this is the only switch that takes; shots.mjs resets it to
Polish when an English pass ends.
"""

import hashlib
import json
import os
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import transaction

from archive.models import Annotation, IngestionStatus, ScoreEdition, Track
from core.models import UserProfile
from finance.models import FundingSource
from roster.models import Artist, Participation, Project, Rehearsal

SCORE_PATH = Path("/tmp/readme-media-score.pdf")
SILENCE_PATH = Path("/tmp/readme-media-silence.mp3")
SILENCE_NAME = "readme-media-silence.mp3"
SHOWCASE_PIECE = "Ave verum corpus"
SHOWCASE_PREFIX = "Msza"

# Normalised page positions (0..1 from the top-left) for the seeded marks, keyed
# by the mark's layer and type in the order the seed wrote them.
POSITIONS: dict[tuple[str, str], list[dict[str, object]]] = {
    ("shared", "ST"): [{"x": 0.635, "y": 0.089}, {"x": 0.17, "y": 0.222}],
    ("shared", "CM"): [{"x": 0.675, "y": 0.385}],
    ("leader", "CM"): [{"x": 0.40, "y": 0.300}],
    ("leader", "ST"): [{"x": 0.577, "y": 0.352}],
    ("conductor", "FH"): [
        {"paths": [[[0.77, 0.149], [0.82, 0.154], [0.88, 0.151], [0.93, 0.147]]]},
    ],
    # Inline notes are drawn centred on their anchor, so they sit mid-page.
    ("conductor", "CM"): [{"x": 0.36, "y": 0.700}],
    ("personal", "FH"): [{"paths": [[[0.66, 0.426], [0.72, 0.429], [0.78, 0.425]]]}],
    ("personal", "ST"): [{"x": 0.628, "y": 0.231}],
    ("personal", "CM"): [{"x": 0.62, "y": 0.745}],
}


def stage_score() -> ScoreEdition:
    edition = ScoreEdition.objects.get(piece__title=SHOWCASE_PIECE, is_default=True)
    data = SCORE_PATH.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    with transaction.atomic():
        if edition.sha256 != digest:
            edition.pdf_file.save("ave_verum_corpus_mutopia.pdf", ContentFile(data), save=False)
            edition.page_count = 1
            edition.sha256 = digest
            edition.publisher = "Mutopia Project"
            edition.editor_name = "Carl Reinecke"
            edition.save()
        # The seed's marks each own a slot; anything past the slots was left
        # by an earlier recorded take and goes, so every take starts alike.
        taken: dict[tuple[str, str], int] = {}
        for mark in Annotation.objects.filter(edition=edition).order_by("created_at"):
            key = (mark.layer_name, mark.annotation_type)
            slots = POSITIONS.get(key, [])
            index = taken.get(key, 0)
            taken[key] = index + 1
            if index >= len(slots):
                mark.delete()
                continue
            mark.page_number = 1
            mark.payload = {**mark.payload, **slots[index]}
            mark.save(update_fields=["page_number", "payload", "updated_at"])
    return edition


def stage_audio(edition: ScoreEdition) -> None:
    """The showcase piece's practice and tempo giusto takes, lengthened to the
    piece's own three minutes so the player does not read "0:01"."""
    data = SILENCE_PATH.read_bytes()
    for track in Track.objects.filter(piece_id=edition.piece_id).exclude(original_filename=SILENCE_NAME):
        track.audio_file.save(f"{track.voice_part.lower()}_{SILENCE_NAME}", ContentFile(data), save=False)
        track.original_filename = SILENCE_NAME
        track.save(update_fields=["audio_file", "original_filename", "updated_at"])


def ids(edition: ScoreEdition) -> dict[str, object]:
    showcase = Project.objects.get(title__startswith=SHOWCASE_PREFIX)
    rehearsals = list(Rehearsal.objects.filter(project=showcase).order_by("date_time"))
    planned = next(r for r in rehearsals if r.plan_items.exists() and r.plan_announced_at)
    cast = Participation.objects.filter(project=showcase).select_related("artist__user")
    # A tenor or bass: the plan's last piece is sung without T and B, so his
    # evening ends early and the rehearsal page shows his own part. `my_plan_window`
    # is computed for the signed-in reader only, so the take logs in as him. The
    # seed leaves every ninth singer (index % 9 == 2) on the full-screen welcome,
    # and singers 03 and 07 read the app in English and French.
    def signs_in_cleanly(artist: Artist) -> bool:
        user = artist.user
        if user is None or not user.is_active or not user.has_usable_password():
            return False
        local = user.email.split("@")[0]
        if not local.startswith("singer"):
            return False
        index = int(local.removeprefix("singer"))
        return index % 9 != 2 and index not in (3, 7)

    low_voices = sorted(
        (p for p in cast if p.artist.voice_type in ("TEN", "BAR", "BAS") and signs_in_cleanly(p.artist)),
        key=lambda p: (p.artist.voice_type != "TEN", not p.is_section_leader),
    )
    tenor = low_voices[0].artist
    projects = {
        key: str(Project.objects.get(title__icontains=needle).id)
        for key, needle in (
            ("closed", "Wratislavia"),
            ("paid", "Pasyjny"),
            ("draft", "Nagranie"),
            ("solos", "Lux Aeterna"),
        )
    }
    # The piece the recorded ingest take catalogued, once it has run: the
    # newest edition the pipeline finished and nobody has approved yet.
    ingested = (
        ScoreEdition.objects.filter(ingestion_status=IngestionStatus.AWAITING, uploaded_by__isnull=False)
        .exclude(piece__isnull=True)
        .order_by("-created_at")
        .first()
    )
    # The login form takes an e-mail. `seed_db --clear` keeps an existing
    # superuser, so the address is read back rather than assumed.
    admin = get_user_model().objects.get(username="admin")
    language = os.environ.get("READMEMEDIA_LANG", "pl")
    UserProfile.objects.filter(user__in=[admin, tenor.user]).update(language=language)
    return {
        "admin_email": admin.email,
        "showcase": str(showcase.id),
        "planned_rehearsal": str(planned.id),
        "rehearsals": [str(r.id) for r in rehearsals],
        "tenor_artist": str(tenor.id),
        "tenor_email": tenor.user.email if tenor.user else "",
        "tenor_name": f"{tenor.first_name} {tenor.last_name}",
        "edition": str(edition.id),
        "piece": str(edition.piece_id),
        "projects": projects,
        # The autumn grant is the one still being drawn on: it funds the showcase.
        "grant": str(FundingSource.objects.get(status="AWARDED").id),
        "ingested_piece": str(ingested.piece_id) if ingested else None,
    }


showcase_edition = stage_score()
stage_audio(showcase_edition)
print("READMEMEDIA " + json.dumps(ids(showcase_edition)))
