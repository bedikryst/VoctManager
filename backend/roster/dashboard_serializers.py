from __future__ import annotations

import uuid
from typing import Any

from rest_framework import serializers

from archive.models import Composer, Piece, Track
from roster.models import Participation, ProjectPieceCasting, ProgramItem, Project


class ComposerSnippetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Composer
        fields = ('id', 'first_name', 'last_name', 'birth_year', 'death_year')


class TrackSnippetSerializer(serializers.ModelSerializer):
    voice_part_display = serializers.CharField(source='get_voice_part_display', read_only=True)

    class Meta:
        model = Track
        fields = ('id', 'voice_part', 'voice_part_display', 'audio_file')


class CastingSnippetSerializer(serializers.ModelSerializer):
    """
    Snapshot of a single voice assignment.
    Expects context key 'artist_id' (uuid.UUID) to compute the 'is_me' flag
    without re-querying the database.
    """

    artist_id = serializers.UUIDField(source='participation.artist_id', read_only=True)
    artist_name = serializers.SerializerMethodField()
    voice_line_display = serializers.CharField(source='get_voice_line_display', read_only=True)
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

    def get_is_me(self, obj: ProjectPieceCasting) -> bool:
        my_artist_id: uuid.UUID | None = self.context.get('artist_id')
        return my_artist_id is not None and obj.participation.artist_id == my_artist_id


class PieceMaterialsSerializer(serializers.Serializer):
    """
    Context-aware read-only serializer for a Piece in the materials tree.

    Avoids N+1 by reading exclusively from pre-fetched to_attr lists:
      piece.prefetched_tracks  — set by get_artist_materials_queryset()
      piece.scope_castings     — set by get_artist_materials_queryset()

    Required context keys:
      project_id        uuid.UUID  — slices scope_castings to this project only
      my_piece_castings list       — this artist's own castings (from participation)
      artist_id         uuid.UUID  — propagated to CastingSnippetSerializer for is_me
      request           Request    — propagated to TrackSnippetSerializer for media URLs
    """

    def to_representation(self, piece: Piece) -> dict[str, Any]:
        project_id: uuid.UUID = self.context['project_id']
        my_piece_castings: list[ProjectPieceCasting] = self.context['my_piece_castings']
        child_context: dict[str, Any] = {
            'artist_id': self.context.get('artist_id'),
            'request': self.context.get('request'),
        }

        scope_castings: list[ProjectPieceCasting] = getattr(piece, 'scope_castings', [])
        project_castings = [c for c in scope_castings if c.participation.project_id == project_id]
        my_casting: ProjectPieceCasting | None = next(
            (c for c in my_piece_castings if c.piece_id == piece.pk), None
        )

        request = self.context.get('request')
        sheet_music_url: str = (
            request.build_absolute_uri(piece.sheet_music.url)
            if request and piece.sheet_music
            else (piece.sheet_music.url if piece.sheet_music else '')
        )

        return {
            'id': str(piece.id),
            'title': piece.title,
            'composer': ComposerSnippetSerializer(piece.composer).data if piece.composer else None,
            'language': piece.language,
            'estimated_duration': piece.estimated_duration,
            'voicing': piece.voicing,
            'epoch': piece.epoch,
            'sheet_music': sheet_music_url,
            'lyrics_original': piece.lyrics_original,
            'lyrics_translation': piece.lyrics_translation,
            'reference_recording_youtube': piece.reference_recording_youtube,
            'reference_recording_spotify': piece.reference_recording_spotify,
            'tracks': TrackSnippetSerializer(
                getattr(piece, 'prefetched_tracks', []),
                many=True,
                context=child_context,
            ).data,
            'castings': CastingSnippetSerializer(
                project_castings,
                many=True,
                context=child_context,
            ).data,
            'my_casting': CastingSnippetSerializer(
                my_casting,
                context=child_context,
            ).data if my_casting else None,
        }


class ProgramItemMaterialsSerializer(serializers.Serializer):
    """
    Thin wrapper around ProgramItem that forwards context to PieceMaterialsSerializer.
    """

    def to_representation(self, item: ProgramItem) -> dict[str, Any]:
        return {
            'order': item.order,
            'is_encore': item.is_encore,
            'piece': PieceMaterialsSerializer(item.piece, context=self.context).data,
        }


class ParticipationMaterialsSerializer(serializers.Serializer):
    """
    Root serializer for the Artist Materials Dashboard endpoint.

    Consumes the pre-fetched QuerySet produced by get_artist_materials_queryset().
    Builds the full data tree in Python using to_attr lists — zero additional DB queries.

    Output shape:
      [{
        participation_id, participation_status, fee,
        project: { id, title, date_time, status, location },
        program: [{ order, is_encore, piece: { ..., tracks, castings, my_casting } }]
      }]
    """

    def to_representation(self, participation: Participation) -> dict[str, Any]:
        project: Project = participation.project
        my_piece_castings: list[ProjectPieceCasting] = getattr(participation, 'my_piece_castings', [])
        ordered_program: list[ProgramItem] = getattr(project, 'ordered_program', [])

        piece_context: dict[str, Any] = {
            'project_id': project.pk,
            'my_piece_castings': my_piece_castings,
            'artist_id': participation.artist_id,
            'request': self.context.get('request'),
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
            'fee': str(participation.fee) if participation.fee is not None else None,
            'project': {
                'id': str(project.id),
                'title': project.title,
                'date_time': project.date_time,
                'status': project.status,
                'status_display': project.get_status_display(),
                'location': location_data,
            },
            'program': ProgramItemMaterialsSerializer(
                ordered_program,
                many=True,
                context=piece_context,
            ).data,
        }
