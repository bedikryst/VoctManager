# roster/views.py
# ==========================================
# Roster API ViewSets (Controllers)
# ==========================================
"""
REST API Controllers for the Roster application.
@architecture Enterprise SaaS 2026

Strictly handles HTTP protocol parsing, role-based QuerySet routing, and Response formatting. 
Delegates ALL state-mutating business logic (CRUD operations triggering side-effects) 
to the Service Layer.
"""

import io
from celery.result import AsyncResult
from django.db.models import Q, Count
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, status
from rest_framework.permissions import IsAdminUser
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from core.constants import VoiceLine
from .tasks import generate_project_zip_task
from .infrastructure.document_generator import DocumentGenerator
from .dtos import ArtistCreateDTO, AttendanceRecordDTO, ProjectBulkFeeDTO, ParticipationRestoreDTO

from . import services

from .models import (
    Artist, CrewAssignment, Project, Participation, ProgramItem, 
    Rehearsal, Attendance, VoiceType, ProjectPieceCasting, Collaborator
)
from .serializers import (
    CollaboratorSerializer, CrewAssignmentSerializer, ArtistMeSerializer,
    ProgramItemSerializer, ProjectSerializer, RehearsalSerializer, 
    AttendanceSerializer, ProjectPieceCastingSerializer, ArtistBasicSerializer, 
    ArtistDetailedSerializer, ParticipationBasicSerializer, ParticipationDetailedSerializer, 
)

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        if request.method in permissions.SAFE_METHODS: return True
        return bool(request.user and request.user.is_superuser)


class ArtistViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = Artist.objects.select_related('user').all()
        return qs if user.is_superuser else qs.filter(user=user)
    
    def get_serializer_class(self):
        if self.request.user.is_superuser: return ArtistDetailedSerializer
        if self.action == 'me': return ArtistMeSerializer
        return ArtistBasicSerializer
    
    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        dto = ArtistCreateDTO(
            first_name=serializer.validated_data['first_name'],
            last_name=serializer.validated_data['last_name'],
            email=serializer.validated_data['email'],
            voice_type=serializer.validated_data['voice_type'],
            phone_number=serializer.validated_data.get('phone_number'),
            sight_reading_skill=serializer.validated_data.get('sight_reading_skill'),
            vocal_range_bottom=serializer.validated_data.get('vocal_range_bottom'),
            vocal_range_top=serializer.validated_data.get('vocal_range_top')
        )
        
        artist = services.provision_artist_with_user_account(dto)
        return Response(self.get_serializer(artist).data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def me(self, request) -> Response:
        artist = get_object_or_404(Artist, user=request.user)
        return Response(self.get_serializer(artist).data)


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']

    def get_queryset(self):
        user = self.request.user
        base_qs = Project.objects.prefetch_related('participations__artist', 'program_items__piece')
        if user.is_superuser: return base_qs.all()
        return base_qs.filter(participations__artist__user=user).distinct()
    
    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = services.create_project_with_creator(user=request.user, validated_data=serializer.validated_data)
        return Response(self.get_serializer(project).data, status=status.HTTP_201_CREATED)
    
    def perform_update(self, serializer) -> None:
        """Delegates project updates to the Service Layer to trigger notifications."""
        services.update_project(serializer.instance, serializer.validated_data)

    @action(detail=True, methods=['get'])
    def roster(self, request, pk=None) -> Response:
        project = self.get_object()
        participations = Participation.objects.filter(project=project).select_related('artist')
        roster_data = [
            {"id": p.artist.id, "name": f"{p.artist.first_name} {p.artist.last_name}", "voice_type": p.artist.get_voice_type_display()}
            for p in participations
        ]
        return Response(roster_data)
    
    @action(detail=True, methods=['get'])
    def export_call_sheet(self, request, pk=None) -> FileResponse:
        project = self.get_object()
        participations = Participation.objects.filter(project=project).select_related('artist').order_by('artist__last_name')
        crew = CrewAssignment.objects.filter(project=project).select_related('collaborator')
        program = ProgramItem.objects.filter(project=project).select_related('piece').order_by('order')
        
        pdf_bytes = DocumentGenerator.generate_call_sheet_pdf(project, participations, crew, program)
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        response = FileResponse(buffer, as_attachment=True, filename=f"CallSheet_{project.title.replace(' ', '_')}.pdf", content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def export_zaiks(self, request, pk=None) -> StreamingHttpResponse:
        project = self.get_object()
        program = ProgramItem.objects.filter(project=project).select_related('piece').order_by('order')

        response = StreamingHttpResponse(
            DocumentGenerator.generate_zaiks_csv_iterator(program),
            content_type='text/csv; charset=utf-8-sig'
        )
        response['Content-Disposition'] = f'attachment; filename="ZAiKS_{project.title.replace(" ", "_")}.csv"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def export_dtp(self, request, pk=None) -> HttpResponse:
        project = self.get_object()
        participations = Participation.objects.filter(project=project).select_related('artist').order_by('artist__last_name')
        content = DocumentGenerator.generate_dtp_export_text(project, participations)

        response = HttpResponse(content, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="Sklad_DTP_{project.title.replace(" ", "_")}.txt"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class ParticipationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated] 
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'artist', 'status']

    def get_queryset(self):
        user = self.request.user
        qs = Participation.objects.select_related('artist__user', 'artist', 'project').all()
        return qs if user.is_superuser else qs.filter(artist__user=user)

    def get_serializer_class(self):
        return ParticipationDetailedSerializer if self.request.user.is_superuser else ParticipationBasicSerializer
    
    def create(self, request, *args, **kwargs) -> Response:
        dto = ParticipationRestoreDTO(
            artist_id=request.data.get('artist'), 
            project_id=request.data.get('project')
        )
        restored = services.handle_soft_deleted_participation(dto)

        if restored:
            serializer = self.get_serializer(restored, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        participation = services.create_participation(serializer.validated_data)
        return Response(self.get_serializer(participation).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance) -> None:
        """Delegates participation deletion (removal from project) to the Service Layer."""
        services.delete_participation(instance)

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def contract(self, request, pk=None) -> FileResponse:
        participation = self.get_object()
        pdf_bytes = DocumentGenerator.generate_participation_contract_pdf(participation)
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        filename = f"HR-{participation.project.title}-UOG-SUB-{participation.artist.last_name.replace(' ', '_')}.pdf"
        response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=False, methods=['patch'], url_path='bulk-fee', permission_classes=[IsAdminUser])
    def bulk_fee(self, request) -> Response:
        try:
            dto = ProjectBulkFeeDTO(
                project_id=request.data.get('project_id'),
                new_fee=int(request.data.get('fee'))
            )
        except (ValueError, TypeError):
            raise ValidationError({"fee": "Invalid payload format. Must be an integer."})

        updated_count = services.update_project_bulk_fee(dto)
        return Response(
            {"detail": f"Successfully updated {updated_count} records.", "updated_count": updated_count}, 
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def request_project_zip(self, request) -> Response:
        project_id = request.data.get('project_id')
        if not project_id: raise ValidationError({"project_id": "This field is required."})
        task = generate_project_zip_task.delay(project_id)
        return Response({"task_id": task.id, "status": "processing"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def check_zip_status(self, request) -> Response:
        task_id = request.query_params.get('task_id')
        if not task_id: raise ValidationError({"task_id": "This field is required."})
        
        result = AsyncResult(task_id)
        if result.state == 'SUCCESS':
            task_data = result.result
            if "error" in task_data: return Response({"state": "FAILED", "error": task_data["error"]})
            return Response({"state": "SUCCESS", "file_url": task_data.get("download_url"), "message": task_data.get("message")})
        elif result.state == 'FAILURE':
            return Response({"state": "FAILED", "error": str(result.info)})
        return Response({"state": result.state})


class RehearsalViewSet(viewsets.ModelViewSet):
    serializer_class = RehearsalSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'invited_participations__artist']

    def get_queryset(self):
        user = self.request.user
        absent_annotation = Count('attendances', filter=Q(attendances__status__in=['ABSENT', 'EXCUSED']))
        qs = Rehearsal.objects.select_related('project').prefetch_related(
            'invited_participations', 'invited_participations__artist'
        ).annotate(absent_count=absent_annotation)

        if user.is_superuser: return qs
            
        return qs.filter(project__participations__artist__user=user).filter(
            Q(invited_participations__isnull=True) | Q(invited_participations__artist__user=user)
        ).distinct()

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invited = serializer.validated_data.pop('invited_participations', None)
        rehearsal = services.create_rehearsal(serializer.validated_data, invited_participations=invited)
        return Response(self.get_serializer(rehearsal).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs) -> Response:
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        invited = serializer.validated_data.pop('invited_participations', None)
        rehearsal = services.update_rehearsal(instance, serializer.validated_data, invited_participations=invited)
        return Response(self.get_serializer(rehearsal).data)

    def perform_destroy(self, instance) -> None:
        """Delegates rehearsal cancellation to trigger broadcast notifications."""
        services.delete_rehearsal(instance)


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['rehearsal', 'participation', 'rehearsal__project', 'participation__artist']

    def get_queryset(self):
        qs = Attendance.objects.select_related('rehearsal', 'rehearsal__project', 'participation', 'participation__artist', 'participation__artist__user')
        if self.request.user.is_superuser: return qs
        return qs.filter(participation__artist__user=self.request.user)

    def _execute_attendance_validation(self, serializer) -> None:
        participation = serializer.validated_data.get('participation', serializer.instance.participation if serializer.instance else None)
        rehearsal = serializer.validated_data.get('rehearsal', serializer.instance.rehearsal if serializer.instance else None)
        
        if participation is None or rehearsal is None:
            raise ValidationError("Attendance records require both participation and rehearsal.")

        dto = AttendanceRecordDTO(
            requesting_user_id=self.request.user.id,
            is_superuser=self.request.user.is_superuser,
            participation_id=str(participation.id),
            rehearsal_id=str(rehearsal.id)
        )
        services.validate_attendance_write(dto)

    def perform_create(self, serializer) -> None:
        self._execute_attendance_validation(serializer)
        serializer.save()
        
    def perform_update(self, serializer) -> None:
        self._execute_attendance_validation(serializer)
        if 'status' in serializer.validated_data:
            services.update_attendance_status(
                attendance=serializer.instance,
                new_status=serializer.validated_data['status'],
                is_admin=self.request.user.is_superuser
            )
        else:
            serializer.save()


class ProgramItemViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'piece']

    def get_queryset(self):
        return ProgramItem.objects.select_related('piece').all().order_by('order')
    
    def perform_destroy(self, instance) -> None:
        services.cascade_delete_program_item(instance)
    

class ProjectPieceCastingViewSet(viewsets.ModelViewSet):
    queryset = ProjectPieceCasting.objects.all()
    serializer_class = ProjectPieceCastingSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['piece', 'participation__project', 'participation']

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        casting = services.create_piece_casting(serializer.validated_data)
        return Response(self.get_serializer(casting).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer) -> None:
        """Delegates casting updates to trigger notifications."""
        services.update_piece_casting(serializer.instance, serializer.validated_data)

    def perform_destroy(self, instance) -> None:
        """Delegates casting removal to trigger notifications."""
        services.delete_piece_casting(instance)

class CollaboratorViewSet(viewsets.ModelViewSet):
    queryset = Collaborator.objects.all()
    serializer_class = CollaboratorSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class CrewAssignmentViewSet(viewsets.ModelViewSet):
    queryset = CrewAssignment.objects.all()
    serializer_class = CrewAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'collaborator'] 

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = services.create_crew_assignment(serializer.validated_data)
        return Response(self.get_serializer(assignment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def contract(self, request, pk=None) -> FileResponse:
        assignment = self.get_object()
        pdf_bytes = DocumentGenerator.generate_crew_contract_pdf(assignment)
        
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        
        filename = f"HR-{assignment.project.id}-CREW-{assignment.collaborator.last_name.replace(' ', '_')}.pdf"
        response = FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


@api_view(['GET'])
def get_voice_lines(request) -> Response:
    return Response([{"value": choice[0], "label": str(choice[1])} for choice in VoiceLine.choices])

@api_view(['GET'])
def get_voice_types(request) -> Response:
    return Response([{"value": choice[0], "label": str(choice[1])} for choice in VoiceType.choices])