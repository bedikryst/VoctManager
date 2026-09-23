from __future__ import annotations

import uuid
from typing import Any

from django.urls import reverse
from rest_framework import serializers

from archive.models import (
    Composer,
    Piece,
    ProgramNote,
    Recording,
    ScoreEdition,
    Track,
    Translation,
)
from archive.score_protection import can_export as edition_can_export
from archive.score_protection import user_is_manager
from archive.services.voice_scope import requirements_for_edition, tracks_for_edition
from core.voice_labels import collapse_voice_labels
from roster.cast_order import casting_sort_key
from roster.domain.liturgy import ProgramItemPresentation, build_program_presentation
from roster.models import (
    Participation,
    PieceReadiness,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    VoiceType,
    castings_are_instrumental,
)
from roster.score_package_config import resolve_item_edition


def _item_line_labels(
    item: ProgramItem,
    bound_edition_id: uuid.UUID | None,
) -> dict[str, str]:
    """Voice code → display name for one programme item.

    The bound arrangement's divisi names the lines, widened by the seats
    actually filled on this project: a singer sitting on T2 of a piece that
    declares only T1 must not read "Tenor" next to "Tenor 2". Castings from the
    reader's OTHER projects are excluded — a different concert's divisi is none
    of this page's business.
    """
    piece = item.piece
    requirements = requirements_for_edition(
        getattr(piece, 'prefetched_voice_requirements', []), bound_edition_id,
    )
    tracks = tracks_for_edition(getattr(piece, 'prefetched_tracks', []), bound_edition_id)
    castings = [
        casting for casting in getattr(piece, 'scope_castings', [])
        if casting.participation.project_id == item.project_id
    ]
    return collapse_voice_labels({
        *(requirement.voice_line for requirement in requirements),
        *(casting.voice_line for casting in castings),
        *(track.voice_part for track in tracks),
    })


def _liturgy_map(
    ordered_program: list[ProgramItem],
) -> dict[uuid.UUID, ProgramItemPresentation]:
    """Resolve the whole programme's liturgical labels once per project, keyed by
    item, for the per-row serializer to look up."""
    return dict(
        zip(
            (item.pk for item in ordered_program),
            build_program_presentation(ordered_program),
            strict=True,
        )
    )


class ComposerSnippetSerializer(serializers.ModelSerializer):
    """Composer snippet for the artist-facing materials dashboard. Includes
    Score Compiler enrichments so the choir sees the biography/portrait when
    learning new repertoire."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Composer
        fields = (
            'id', 'first_name', 'last_name', 'full_name',
            'birth_year', 'death_year',
            'nationality', 'period', 'bio',
            'portrait_url', 'mbid', 'wikidata_qid',
        )

    def get_full_name(self, obj: Composer) -> str:
        return f"{obj.first_name} {obj.last_name}".strip()


class TranslationSnippetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Translation
        fields = ('id', 'target_language', 'text', 'is_singable')


class RecordingSnippetSerializer(serializers.ModelSerializer):
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = Recording
        fields = (
            'id', 'source', 'source_display', 'external_id', 'url',
            'performer', 'year', 'duration_seconds', 'is_featured',
        )


class ProgramNoteSnippetSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramNote
        fields = (
            'id', 'language', 'target_tone',
            'word_count_target', 'content', 'is_approved',
        )


class EditionSnippetSerializer(serializers.ModelSerializer):
    # NOT a bare /media/ URL: scores are the conductor's licensed/owned property,
    # so they are served only through the authenticated, status-aware download
    # view (`score-edition-download`). That re-checks access on every request, so
    # a bookmarked link dies the moment the chorister's projects close.
    pdf_file = serializers.SerializerMethodField()
    # Server-computed export permission: protected editions are in-app-only for
    # choristers (the downloaded file would be watermarked; open/share/download
    # are hidden). The frontend gates its buttons on this bool, never re-deriving.
    can_export = serializers.SerializerMethodField()

    class Meta:
        model = ScoreEdition
        fields = (
            'id', 'pdf_file', 'can_export', 'original_filename',
            'publisher', 'edition_year', 'editor_name',
            'page_count', 'is_default', 'license_type',
            'ingestion_status', 'created_at',
        )

    def get_pdf_file(self, obj: ScoreEdition) -> str | None:
        if not obj.pdf_file:
            return None
        url = reverse('score-edition-download', kwargs={'pk': obj.id})
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url

    def get_can_export(self, obj: ScoreEdition) -> bool:
        request = self.context.get('request')
        is_manager = user_is_manager(request.user) if request is not None else False
        return edition_can_export(obj, is_manager=is_manager)


class TrackSnippetSerializer(serializers.ModelSerializer):
    """One practice track. `description` is the manager's note to the singer
    ("od taktu 34, tempo 90"); the uploaded filename stays out of the payload —
    it is a manager's verification aid, not something a singer can act on.

    `kind` tells the client which surface plays the take: practice takes go
    into the mixer together, the tempo giusto take is heard on its own."""

    voice_part_display = serializers.SerializerMethodField()

    class Meta:
        model = Track
        fields = ('id', 'voice_part', 'voice_part_display', 'kind', 'audio_file', 'description')

    def get_voice_part_display(self, obj: Track) -> str:
        labels: dict[str, str] = self.context.get('line_labels', {})
        return labels.get(obj.voice_part) or obj.get_voice_part_display()


class CastingSnippetSerializer(serializers.ModelSerializer):
    """
    Snapshot of a single voice assignment.
    Expects context key 'artist_id' (uuid.UUID) to compute the 'is_me' flag
    without re-querying the database.
    """

    artist_id = serializers.UUIDField(source='participation.artist_id', read_only=True)
    artist_name = serializers.SerializerMethodField()
    voice_line_display = serializers.SerializerMethodField()
    is_me = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPieceCasting
        fields = (
            'id', 'artist_id', 'artist_name',
            'voice_line', 'voice_line_display',
            'gives_pitch', 'notes', 'is_me',
        )

    def get_artist_name(self, obj: ProjectPieceCasting) -> str:
        return f"{obj.participation.artist.first_name} {obj.participation.artist.last_name}"

    def get_voice_line_display(self, obj: ProjectPieceCasting) -> str:
        """Named inside this programme item's arrangement — see
        [ProgramItemMaterialsSerializer], which resolves the scope once."""
        labels: dict[str, str] = self.context.get('line_labels', {})
        return labels.get(obj.voice_line) or obj.get_voice_line_display()

    def get_is_me(self, obj: ProjectPieceCasting) -> bool:
        my_artist_id: uuid.UUID | None = self.context.get('artist_id')
        return my_artist_id is not None and obj.participation.artist_id == my_artist_id


class PieceMaterialsSerializer(serializers.Serializer):
    """
    Context-aware read-only serializer for a Piece in the materials tree.

    Avoids N+1 by reading exclusively from pre-fetched to_attr lists:
      piece.prefetched_tracks       — set by get_artist_materials_queryset()
      piece.scope_castings          — set by get_artist_materials_queryset()
      piece.prefetched_translations — set by get_artist_materials_queryset()
      piece.prefetched_recordings   — set by get_artist_materials_queryset()
      piece.prefetched_program_notes — set by get_artist_materials_queryset()
      piece.prefetched_editions     — set by get_artist_materials_queryset()
      piece.prefetched_voice_requirements — set by get_artist_materials_queryset()

    Required context keys:
      project_id        uuid.UUID  — slices scope_castings to this project only
      my_piece_castings list       — this artist's own castings (from participation)
      my_readiness_map  dict | None — piece_id → readiness status (this artist);
                        None withholds it, emitting `my_readiness: null` for every
                        piece. Null and NOT_STARTED are different answers: the
                        first says nobody but the singer may know, the second says
                        the singer has not started.
      artist_id         uuid.UUID  — propagated to CastingSnippetSerializer for is_me
      request           Request    — propagated to TrackSnippetSerializer for media URLs
      bound_edition_id  uuid.UUID | None — the arrangement this concert sings, set
                        by ProgramItemMaterialsSerializer; scopes tracks and names
                        the voice lines
      line_labels       dict       — voice code → display name inside that arrangement
      choir_marks_piece_ids set[uuid.UUID] — pieces on which this reader's leader
                        grant opens the choir's 'shared' marking layer (absent →
                        none); emitted as `may_mark_for_choir` per piece
      reader_sees_instrumental bool — whether an instrumental item's editions
                        and tracks reach this reader (absent → False): a player,
                        or whoever runs the evening through the materials door
    """

    def to_representation(self, piece: Piece) -> dict[str, Any]:
        project_id: uuid.UUID = self.context['project_id']
        my_piece_castings: list[ProjectPieceCasting] = self.context['my_piece_castings']
        my_readiness_map: dict[uuid.UUID, str] | None = self.context.get('my_readiness_map', {})
        bound_edition_id: uuid.UUID | None = self.context.get('bound_edition_id')
        choir_marks_piece_ids: set[uuid.UUID] = self.context.get('choir_marks_piece_ids', set())
        child_context: dict[str, Any] = {
            'artist_id': self.context.get('artist_id'),
            'request': self.context.get('request'),
            'line_labels': self.context.get('line_labels', {}),
        }

        scope_castings: list[ProjectPieceCasting] = getattr(piece, 'scope_castings', [])
        # Sorted here rather than in the prefetch: musical order is not the order
        # the codes sort in ('A1' before 'S1'), and the order inside a line is the
        # conductor's, which no SQL clause expresses. Unsorted, the singer's
        # divisi tab listed the lines themselves in whatever order the rows came
        # back in.
        project_castings = sorted(
            (c for c in scope_castings if c.participation.project_id == project_id),
            key=casting_sort_key,
        )
        my_casting: ProjectPieceCasting | None = next(
            (c for c in my_piece_castings if c.piece_id == piece.pk), None
        )

        # Once a project is completed/cancelled the chorister keeps the reference
        # passport (lyrics, IPA, recordings) but loses the rehearsal materials —
        # scores and practice tracks — so nothing licensed stays in the app.
        materials_locked: bool = self.context.get('materials_locked', False)
        # An item cast on players only is the organist's music, not the choir's:
        # the badge is a fact about the item and reaches every reader, the
        # withholding is a fact about the reader and only ever refuses a
        # non-player. One gate for editions and tracks, as `materials_locked`.
        is_instrumental = castings_are_instrumental(project_castings)
        materials_withheld = is_instrumental and not self.context.get(
            'reader_sees_instrumental', False,
        )
        withhold = materials_locked or materials_withheld
        editions = [] if withhold else EditionSnippetSerializer(
            getattr(piece, 'prefetched_editions', []), many=True, context=child_context,
        ).data
        # Another arrangement's guide tracks are kept away — that is how somebody
        # rehearses the wrong line — but the piece-wide ones stay, except on the
        # lines this edition re-recorded. A take made for one edition supplements
        # the common set; it does not retract it.
        tracks = [] if withhold else TrackSnippetSerializer(
            tracks_for_edition(getattr(piece, 'prefetched_tracks', []), bound_edition_id),
            many=True, context=child_context,
        ).data

        return {
            'id': str(piece.id),
            'title': piece.title,
            'composer': ComposerSnippetSerializer(piece.composer).data if piece.composer else None,
            'language': piece.language,
            'estimated_duration': piece.estimated_duration,
            'voicing': piece.voicing,
            'epoch': piece.epoch,
            'lyrics_original': piece.lyrics_original,
            'opus_catalog': piece.opus_catalog,
            'musical_key': piece.musical_key,
            'starting_pitches': piece.starting_pitches,
            'text_source': piece.text_source,
            'lyrics_ipa': piece.lyrics_ipa,
            'mbid_work': str(piece.mbid_work) if piece.mbid_work else None,
            'translations': TranslationSnippetSerializer(
                getattr(piece, 'prefetched_translations', []),
                many=True,
            ).data,
            'recordings': RecordingSnippetSerializer(
                getattr(piece, 'prefetched_recordings', []),
                many=True,
            ).data,
            'program_notes': ProgramNoteSnippetSerializer(
                getattr(piece, 'prefetched_program_notes', []),
                many=True,
            ).data,
            'editions': editions,
            'tracks': tracks,
            'is_instrumental': is_instrumental,
            'materials_withheld': materials_withheld,
            'castings': CastingSnippetSerializer(
                project_castings,
                many=True,
                context=child_context,
            ).data,
            'my_casting': CastingSnippetSerializer(
                my_casting,
                context=child_context,
            ).data if my_casting else None,
            'my_readiness': (
                None
                if my_readiness_map is None
                else my_readiness_map.get(piece.pk, PieceReadiness.Status.NOT_STARTED)
            ),
            # Whether this reader's pencil reaches the choir's layer on this
            # music — a leader's opt-in scope, never a manager's standing power
            # (the client already knows a manager writes everywhere).
            'may_mark_for_choir': piece.pk in choir_marks_piece_ids,
        }


class ProgramItemMaterialsSerializer(serializers.Serializer):
    """
    Thin wrapper around ProgramItem that forwards context to PieceMaterialsSerializer.

    The liturgical labels arrive pre-resolved under the ``liturgy`` context key:
    numbering a repeated slot needs the whole programme, and this serializer sees
    one row at a time.
    """

    def to_representation(self, item: ProgramItem) -> dict[str, Any]:
        presentation = self.context.get('liturgy', {}).get(item.pk)
        # Which arrangement this concert sings decides both which practice
        # tracks reach the singer and what their part is called. Resolved once
        # per item, here, because the piece serializer below sees a Piece and
        # has no way back to the programme row that pinned the edition.
        bound_edition = resolve_item_edition(item)
        bound_edition_id = bound_edition.pk if bound_edition else None
        piece_context = {
            **self.context,
            'bound_edition_id': bound_edition_id,
            'line_labels': _item_line_labels(item, bound_edition_id),
        }
        return {
            'order': item.order,
            'is_encore': item.is_encore,
            'liturgical_slot': item.liturgical_slot,
            'slot_label': presentation.slot_label if presentation else '',
            'section': presentation.section if presentation else '',
            'piece': PieceMaterialsSerializer(item.piece, context=piece_context).data,
        }


class ParticipationMaterialsSerializer(serializers.Serializer):
    """
    Root serializer for the Artist Materials Dashboard endpoint.

    Consumes the pre-fetched QuerySet produced by get_artist_materials_queryset().
    Builds the full data tree in Python using to_attr lists — zero additional DB queries.

    Optional context:
      readiness_visible bool — False emits `my_readiness: null` throughout, for a
                        manager previewing this tree. Pair it with
                        ``get_artist_materials_queryset(..., include_readiness=False)``
                        so the rows are never fetched in the first place.

    Carries no money. Contracts and settlement are a manager-side module, and a
    singer is told what they owe the music, never what the choir owes them — the
    figure reaches a person through a contract, not through the songbook. The
    same rule already governs `ParticipationBasicSerializer`, which excludes
    `fee` for every non-manager caller; this tree simply had to stop being the
    exception.

    Output shape:
      [{
        participation_id, participation_status, is_conducting, is_leading, is_managing,
        project: { id, title, date_time, status, location },
        program: [{ order, is_encore, piece: { ..., tracks, castings, my_casting } }]
      }]
    """

    def to_representation(self, participation: Participation) -> dict[str, Any]:
        project: Project = participation.project
        my_piece_castings: list[ProjectPieceCasting] = getattr(participation, 'my_piece_castings', [])
        my_readiness_entries: list[PieceReadiness] = getattr(participation, 'my_readiness_entries', [])
        ordered_program: list[ProgramItem] = getattr(project, 'ordered_program', [])

        # Withheld reads as null, never as an empty map: an absent prefetch would
        # otherwise render as "has not started a single piece", which is a claim
        # about the singer rather than a refusal to make one.
        readiness_visible: bool = self.context.get('readiness_visible', True)
        project_key = str(project.id)
        # Scores + practice tracks are withheld once the concert is over.
        materials_locked = project.status in (
            Project.Status.COMPLETED, Project.Status.CANCELLED,
        )
        # A player follows the whole evening, and a singer handed this
        # programme to run has the materials door open on every piece of it —
        # the same door `user_has_live_access_to_piece` opens for the download.
        # Both are refused nothing; `has_score_pdf` stays the choir's book.
        reader_sees_instrumental = (
            participation.artist.voice_type == VoiceType.INSTRUMENTALIST
            or project_key in self.context.get('materials_led_project_ids', set())
        )
        # A bound book that still carries an item now instrumental is not the
        # choir's book until it is rebuilt: the refused reader is not offered
        # it, exactly as the `score_pdf` endpoint would refuse them.
        book_withheld = (
            not reader_sees_instrumental
            and project_key in self.context.get('withheld_book_project_ids', set())
        )

        piece_context: dict[str, Any] = {
            'project_id': project.pk,
            'my_piece_castings': my_piece_castings,
            'my_readiness_map': (
                {entry.piece_id: entry.status for entry in my_readiness_entries}
                if readiness_visible
                else None
            ),
            'artist_id': participation.artist_id,
            'request': self.context.get('request'),
            'liturgy': _liturgy_map(ordered_program),
            'choir_marks_piece_ids': self.context.get('choir_marks_piece_ids', set()),
            'materials_locked': materials_locked,
            'reader_sees_instrumental': reader_sees_instrumental,
        }

        location = project.location
        location_data: dict[str, Any] | None = (
            {
                'id': str(location.id),
                'name': location.name,
                'category': location.category,
                'timezone': location.timezone,
            }
            if location else None
        )

        return {
            'participation_id': str(participation.id),
            'participation_status': participation.status,
            # This row belongs to a singer's own casting, not the podium — the
            # podium's rows come through LedProjectMaterialsSerializer.
            'is_conducting': False,
            # ...but a stand-in is usually singing in the programme they were
            # asked to take, so this row is where their delegation surfaces. Led
            # projects they are NOT cast in never reach this serializer at all.
            'is_leading': project_key in self.context.get('led_project_ids', set()),
            # A seat is a seat: a manager cast in the programme reads it as a
            # singer, with their own part and their own readiness. The
            # administrative claim belongs to the rows they have no seat in.
            'is_managing': False,
            'project': {
                'id': project_key,
                'title': project.title,
                'date_time': project.date_time,
                'status': project.status,
                'status_display': project.get_status_display(),
                'event_kind': project.event_kind,
                'location': location_data,
                # The songbook is where a singer goes for music, so it has to
                # know whether this concert has a bound book at all. Follows the
                # same gates as the pieces below it — a closed concert offers no
                # book, exactly as its score_pdf endpoint refuses one, and so
                # does a book awaiting a rebuild that would drop organ pages.
                'has_score_pdf': (
                    bool(project.score_pdf) and not materials_locked and not book_withheld
                ),
            },
            'program': ProgramItemMaterialsSerializer(
                ordered_program,
                many=True,
                context=piece_context,
            ).data,
        }


class LedProjectMaterialsSerializer(serializers.Serializer):
    """
    Root serializer for the "I run this one" slice of the materials dashboard: a
    project the reader leads but is not cast in.

    Emits the exact shape of ParticipationMaterialsSerializer (so the frontend
    renders one uniform tree) with no personal participation / casting /
    readiness, and the full project cast surfaced on every piece. Consumes the
    pre-fetched QuerySet produced by get_led_materials_projects() — zero
    additional DB queries.

    `is_conducting`, `is_leading` and `is_managing` are three different claims
    and the client acts on them differently: the podium is held by one person, a
    programme may also have been handed to a stand-in for a fortnight, and a
    manager reaches every programme by running the choir rather than any one
    concert. All three read the reader out of the context (`viewer_user_id`,
    `led_project_ids`, `viewer_is_manager`) rather than the request, so a
    manager's ``?artist=`` preview describes the member being previewed and not
    themselves.
    """

    def to_representation(self, project: Project) -> dict[str, Any]:
        ordered_program: list[ProgramItem] = getattr(project, 'ordered_program', [])

        piece_context: dict[str, Any] = {
            'project_id': project.pk,
            # The conductor has no participation, so no personal casting or
            # readiness — every piece shows the full cast, no "my part".
            'my_piece_castings': [],
            'my_readiness_map': {},
            'artist_id': None,
            'request': self.context.get('request'),
            'liturgy': _liturgy_map(ordered_program),
            'choir_marks_piece_ids': self.context.get('choir_marks_piece_ids', set()),
            # Same lifecycle gate as singers: scores + tracks are withheld once
            # the concert is over (they remain reachable through the manager
            # surfaces, which re-check access on every request).
            'materials_locked': project.status in (
                Project.Status.COMPLETED, Project.Status.CANCELLED,
            ),
            # Whoever runs the evening is refused nothing; the instrumental
            # badge still reaches them because it describes the item.
            'reader_sees_instrumental': True,
        }

        location = project.location
        location_data: dict[str, Any] | None = (
            {
                'id': str(location.id),
                'name': location.name,
                'category': location.category,
                'timezone': location.timezone,
            }
            if location else None
        )

        viewer_user_id = self.context.get('viewer_user_id')
        conductor = project.conductor
        project_key = str(project.id)
        # This slice holds two kinds of row and they must not be confused: one
        # programme handed to this person, and the whole season reaching them
        # because they run the choir. A manager's row is not a delegation, and
        # badging it as one would tell them they were asked to take an evening.
        is_leading = project_key in self.context.get('led_project_ids', set())
        return {
            'participation_id': None,
            'participation_status': None,
            'is_conducting': bool(
                conductor is not None
                and viewer_user_id is not None
                and conductor.user_id == viewer_user_id
            ),
            'is_leading': is_leading,
            'is_managing': not is_leading
            and self.context.get('viewer_is_manager', False),
            'project': {
                'id': project_key,
                'title': project.title,
                'date_time': project.date_time,
                'status': project.status,
                'status_display': project.get_status_display(),
                'event_kind': project.event_kind,
                'location': location_data,
                'has_score_pdf': bool(project.score_pdf)
                and not piece_context['materials_locked'],
            },
            'program': ProgramItemMaterialsSerializer(
                ordered_program,
                many=True,
                context=piece_context,
            ).data,
        }
