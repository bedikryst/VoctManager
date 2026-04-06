# roster/services.py
# ==========================================
# Roster Business Logic (Service Layer)
# ==========================================
from typing import Optional
from django.utils import timezone
from django.db import transaction
from django.contrib.auth.models import User
from django.conf import settings
import unicodedata

from .models import Artist, Project, Participation, ProgramItem, ProjectPieceCasting, Rehearsal
from .dtos import ArtistCreateDTO, AttendanceRecordDTO, ProjectBulkFeeDTO, ParticipationRestoreDTO
from .exceptions import ArtistProvisioningException, AttendanceValidationException, ParticipationException

def provision_artist_with_user_account(dto: ArtistCreateDTO) -> Artist:
    if User.objects.filter(email=dto.email).exists():
        raise ArtistProvisioningException(f"Account with email {dto.email} already exists.")
    raw_username = f"{dto.first_name[0].lower()}{dto.last_name.lower()}".replace(' ', '')
    base_username = unicodedata.normalize('NFKD', raw_username).encode('ASCII', 'ignore').decode('utf-8')
    
    username = base_username
    counter = 2
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1
        
    with transaction.atomic():
        user = User.objects.create(username=username, email=dto.email)
        user.set_password(getattr(settings, 'DEFAULT_ARTIST_PASSWORD', 'secure123')) 
        user.save()
        
        artist = Artist.objects.create(
            user=user, first_name=dto.first_name, last_name=dto.last_name, 
            email=dto.email, voice_type=dto.voice_type, phone_number=dto.phone_number,
            sight_reading_skill=dto.sight_reading_skill, vocal_range_bottom=dto.vocal_range_bottom,
            vocal_range_top=dto.vocal_range_top
        )
    return artist

def provision_project_creator_participation(project: Project, user: User) -> None:
    if hasattr(user, 'artist_profile'):
        Participation.objects.get_or_create(
            artist=user.artist_profile, project=project,
            defaults={'status': Participation.Status.CONFIRMED, 'fee': 0}
        )

def update_project_bulk_fee(dto: ProjectBulkFeeDTO) -> int:
    if dto.new_fee < 0:
        raise ParticipationException("Fee cannot be negative.")
    return Participation.objects.filter(project_id=dto.project_id).update(
        fee=dto.new_fee, updated_at=timezone.now()
    )

def handle_soft_deleted_participation(dto: ParticipationRestoreDTO) -> Optional[Participation]:
    deleted = Participation.all_objects.filter(artist_id=dto.artist_id, project_id=dto.project_id, is_deleted=True).first()
    if deleted:
        deleted.restore()
        return deleted
    return None

def cascade_delete_program_item(program_item: ProgramItem) -> None:
    with transaction.atomic():
        ProjectPieceCasting.objects.filter(
            piece=program_item.piece, participation__project=program_item.project
        ).delete() 
        program_item.delete()

def validate_attendance_write(dto: AttendanceRecordDTO) -> None:
    try:
        participation = Participation.objects.select_related('artist').get(id=dto.participation_id)
        rehearsal = Rehearsal.objects.prefetch_related('invited_participations').get(id=dto.rehearsal_id)
    except (Participation.DoesNotExist, Rehearsal.DoesNotExist):
        raise AttendanceValidationException("Record not found.")

    if participation.project_id != rehearsal.project_id:
        raise AttendanceValidationException("Project mismatch between participation and rehearsal.")

    if dto.is_superuser: return

    if participation.artist.user_id != dto.requesting_user_id:
        raise AttendanceValidationException("Can only record self-attendance.")

    invited_ids = set(rehearsal.invited_participations.values_list('id', flat=True))
    if invited_ids and participation.id not in invited_ids:
        raise AttendanceValidationException("Artist not invited to this rehearsal.")