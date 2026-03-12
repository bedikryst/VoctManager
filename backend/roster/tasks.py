import io
import zipfile
import weasyprint
from celery import shared_task
from django.template.loader import render_to_string
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from .models import Participation

@shared_task(bind=True)
def generate_project_zip_task(self, project_id):
    """
    Zadanie asynchroniczne Celery. Generuje pliki PDF, pakuje do ZIP 
    i zapisuje w domyślnym storage'u (np. folder media).
    """
    participations = Participation.objects.filter(project_id=project_id).select_related('artist', 'project')
    
    if not participations.exists():
        return {"error": "Brak artystów w tym projekcie."}

    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for p in participations:
            # Generowanie PDF
            html_string = render_to_string('roster/contract_pdf.html', {'participation': p})
            pdf_bytes = weasyprint.HTML(string=html_string).write_pdf()
            
            safe_last_name = p.artist.last_name.replace(' ', '_')
            filename = f"HR-{p.project.id}-UOG-SUB-{safe_last_name}.pdf"
            
            # Wpisanie do paczki ZIP w pamięci
            zip_file.writestr(filename, pdf_bytes)
            
    zip_buffer.seek(0)
    
    # Zapisanie pliku ZIP do katalogu media/exports/
    file_path = f"exports/Umowy_Koncert_{project_id}.zip"
    
    # Jeśli plik już istnieje (z poprzedniego generowania), usuwamy go, żeby zrobić miejsce na nowy
    if default_storage.exists(file_path):
        default_storage.delete(file_path)
        
    saved_path = default_storage.save(file_path, ContentFile(zip_buffer.read()))
    
    # Zwracamy URL, pod którym plik będzie dostępny do pobrania
    return {
        "download_url": default_storage.url(saved_path),
        "message": "Archiwum zostało wygenerowane pomyślnie."
    }