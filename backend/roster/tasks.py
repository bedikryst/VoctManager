"""
Asynchronous background tasks for the Roster application.
Author: Krystian Bugalski

Utilizes Celery and Redis to handle resource-intensive operations
(like bulk PDF generation) outside the main request-response cycle.
"""

import io
import zipfile
import weasyprint
from celery import shared_task
from django.template.loader import render_to_string
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from .models import Participation, Project

__author__ = "Krystian Bugalski"

@shared_task(bind=True)
def generate_project_zip_task(self, project_id):
    """
    Generates PDF contracts for all participants in a given project,
    packages them into an in-memory ZIP archive, and saves the file 
    to the default storage. Returns the download URL upon completion.
    """
    # Optimized query to prevent N+1 issues during template rendering
    participations = Participation.objects.filter(project_id=project_id).select_related('artist', 'project')

    project = Project.objects.get(id=project_id)
    safe_title = project.title.replace(' ', '_').replace('/', '-')

    if not participations.exists():
        return {"error": "no_artists_in_project"}

    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for p in participations:
            html_string = render_to_string('contracts/contract_pdf.html', {'participation': p})
            pdf_bytes = weasyprint.HTML(string=html_string).write_pdf()
            
            safe_last_name = p.artist.last_name.replace(' ', '_')
            filename = f"HR-{safe_title}-UOG-SUB-{safe_last_name}.pdf"
            
            zip_file.writestr(filename, pdf_bytes)
            
    zip_buffer.seek(0)
    
    file_path = f"exports/Umowy_Koncert_{safe_title}.zip"
    
    # Cleanup previous generation if it exists to save storage space
    if default_storage.exists(file_path):
        default_storage.delete(file_path)
        
    saved_path = default_storage.save(file_path, ContentFile(zip_buffer.read()))
    
    return {
        "download_url": default_storage.url(saved_path),
        "message": "success"
    }