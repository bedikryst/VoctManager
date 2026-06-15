# roster/tasks.py
"""
Asynchronous background tasks for the Roster application.
Utilizes Celery and Redis to handle resource-intensive operations.
"""

import io
import zipfile

from celery import shared_task
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from .infrastructure.document_generator import DocumentGenerator
from .models import CrewAssignment, Participation


def _safe_segment(value: str) -> str:
    """Filesystem-safe filename fragment."""
    return value.replace(' ', '_').replace('/', '-').replace('\\', '-')


@shared_task(bind=True)
def generate_project_zip_task(self, project_id):
    """
    Generates PDF contracts for every cast member AND crew collaborator on a
    project, packages them into an in-memory ZIP archive, and saves the file to
    default storage. Returns the download URL upon completion.

    PDF rendering is delegated to ``DocumentGenerator`` so the binary artifacts
    match the single-contract endpoint exactly (the legacy inline render passed
    the wrong template context and produced blank contracts). WeasyPrint is
    imported lazily inside the generator, so this module stays importable on
    hosts without the native rendering libraries.
    """
    participations = (
        Participation.objects
        .filter(project_id=project_id, is_deleted=False)
        .select_related('artist', 'project')
        .order_by('artist__last_name')
    )
    crew = (
        CrewAssignment.objects
        .filter(project_id=project_id)
        .select_related('collaborator', 'project')
        .order_by('collaborator__last_name')
    )

    project = None
    first_participation = participations.first()
    if first_participation is not None:
        project = first_participation.project
    else:
        first_crew = crew.first()
        if first_crew is not None:
            project = first_crew.project

    if project is None:
        return {"error": "no_personnel_in_project"}

    safe_title = _safe_segment(project.title)
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for participation in participations:
            pdf_bytes = DocumentGenerator.generate_participation_contract_pdf(participation)
            artist = participation.artist
            safe_name = _safe_segment(f"{artist.last_name}_{artist.first_name}")
            zip_file.writestr(f"Umowa-{safe_title}-{safe_name}.pdf", pdf_bytes)

        for assignment in crew:
            pdf_bytes = DocumentGenerator.generate_crew_contract_pdf(assignment)
            collaborator = assignment.collaborator
            safe_name = _safe_segment(f"{collaborator.last_name}_{collaborator.first_name}")
            zip_file.writestr(f"Umowa-{safe_title}-EKIPA-{safe_name}.pdf", pdf_bytes)

    zip_buffer.seek(0)
    file_path = f"exports/Contracts_Project_{safe_title}.zip"

    # Cleanup previous generation to save storage space
    if default_storage.exists(file_path):
        default_storage.delete(file_path)

    saved_path = default_storage.save(file_path, ContentFile(zip_buffer.read()))

    return {
        "download_url": default_storage.url(saved_path),
        "message": "success",
    }
