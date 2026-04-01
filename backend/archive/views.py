# archive/views.py
# ==========================================
# Archive API ViewSets (Controllers)
# ==========================================
import json
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response

from .models import Composer, Piece, Track, PieceVoiceRequirement
from .serializers import ComposerSerializer, PieceSerializer, TrackSerializer, PieceVoiceRequirementSerializer
from .dtos import PieceWriteDTO, VoiceRequirementDTO
from .exceptions import ArchiveDomainException
from . import services

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS: return True
        return bool(request.user and request.user.is_superuser)

class ComposerViewSet(viewsets.ModelViewSet):
    queryset = Composer.objects.all()
    serializer_class = ComposerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

class PieceViewSet(viewsets.ModelViewSet):
    queryset = Piece.objects.select_related('composer').prefetch_related('tracks', 'voice_requirements').all()
    serializer_class = PieceSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def _parse_requirements_to_dtos(self, raw_data) -> list[VoiceRequirementDTO] | None:
        """Helper to parse multipart/form-data JSON strings into DTOs."""
        if raw_data is None: return None
        
        if isinstance(raw_data, str):
            try:
                parsed_data = json.loads(raw_data)
            except json.JSONDecodeError:
                parsed_data = []
        else:
            parsed_data = raw_data

        return [
            VoiceRequirementDTO(voice_line=req.get('voice_line'), quantity=int(req.get('quantity', 1)))
            for req in parsed_data if req.get('voice_line')
        ]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        req_dtos = self._parse_requirements_to_dtos(request.data.get('requirements_data'))

        dto = PieceWriteDTO(
            title=vd.get('title'),
            composer_id=vd.get('composer').id if vd.get('composer') else None,
            arranger=vd.get('arranger'),
            language=vd.get('language'),
            estimated_duration=vd.get('estimated_duration'),
            voicing=vd.get('voicing', ''),
            description=vd.get('description', ''),
            lyrics_original=vd.get('lyrics_original'),
            lyrics_translation=vd.get('lyrics_translation'),
            reference_recording_youtube=vd.get('reference_recording_youtube'),
            reference_recording_spotify=vd.get('reference_recording_spotify'),
            composition_year=vd.get('composition_year'),
            epoch=vd.get('epoch'),
            voice_requirements=req_dtos
        )

        try:
            piece = services.create_piece(dto=dto, sheet_music_file=vd.get('sheet_music'))
        except ArchiveDomainException as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(self.get_serializer(piece).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        req_dtos = self._parse_requirements_to_dtos(request.data.get('requirements_data'))

        dto = PieceWriteDTO(
            title=vd.get('title', instance.title),
            composer_id=vd.get('composer').id if 'composer' in vd and vd.get('composer') else (instance.composer_id if not 'composer' in vd else None),
            arranger=vd.get('arranger', instance.arranger),
            language=vd.get('language', instance.language),
            estimated_duration=vd.get('estimated_duration', instance.estimated_duration),
            voicing=vd.get('voicing', instance.voicing),
            description=vd.get('description', instance.description),
            lyrics_original=vd.get('lyrics_original', instance.lyrics_original),
            lyrics_translation=vd.get('lyrics_translation', instance.lyrics_translation),
            reference_recording_youtube=vd.get('reference_recording_youtube', instance.reference_recording_youtube),
            reference_recording_spotify=vd.get('reference_recording_spotify', instance.reference_recording_spotify),
            composition_year=vd.get('composition_year', instance.composition_year),
            epoch=vd.get('epoch', instance.epoch),
            voice_requirements=req_dtos
        )

        update_sheet_music = 'sheet_music' in vd

        try:
            piece = services.update_piece(
                piece=instance, 
                dto=dto, 
                sheet_music_file=vd.get('sheet_music'), 
                update_sheet_music=update_sheet_music
            )
        except ArchiveDomainException as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(self.get_serializer(piece).data)

class TrackViewSet(viewsets.ModelViewSet):
    queryset = Track.objects.select_related('piece').all()
    serializer_class = TrackSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'voice_part']
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

class PieceVoiceRequirementViewSet(viewsets.ModelViewSet):
    queryset = PieceVoiceRequirement.objects.all()
    serializer_class = PieceVoiceRequirementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]