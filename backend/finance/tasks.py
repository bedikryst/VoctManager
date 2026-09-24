"""
@file tasks.py
@description A project's contracts as one ZIP, built in the background. It packs
             the live contracts only — issued or signed, never annulled — each
             rendered from its row, so every file prints its number and frozen
             amount; a fee nobody has contracted yet has no paper to pack. The
             archive lands under MEDIA_ROOT/finance/, which nginx serves to
             nobody (`internal`): it leaves the server only through the
             manager-only download view, never as a public media URL.
@architecture Enterprise SaaS 2026
@module finance/tasks
"""
import io
import zipfile
from datetime import timedelta
from typing import Any

from celery import shared_task
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db.models import QuerySet
from django.utils import timezone

from .infrastructure.documents import contract_filename, render_contract_pdf
from .models import Contract, ContractStatus

EXPORT_ROOT = "finance/exports"

# How long a packed archive waits for its download before a newer one clears it.
EXPORT_TTL = timedelta(hours=1)

# The task's result when the project has nothing to pack; the client owns the words.
NO_CONTRACTS = "no_contracts"


def export_folder(project_id: str) -> str:
    return f"{EXPORT_ROOT}/{project_id}"


def export_path(project_id: str, task_id: str) -> str:
    """Where a task's archive lives. Derived from the two ids on both sides — the
    task writing it and the view serving it — so neither trusts a path handed
    over through the result backend."""
    return f"{export_folder(project_id)}/{task_id}.zip"


def live_contracts(project_id: str) -> QuerySet[Contract]:
    return (
        Contract.objects.filter(cost_item__budget__project_id=project_id)
        .exclude(status=ContractStatus.ANNULLED)
        .order_by("payee_name", "number")
    )


def _clear_stale_exports(project_id: str) -> None:
    """A new archive clears the project's archives older than `EXPORT_TTL`, so
    the folder does not grow with every click. A younger one may be another
    manager's, packed a moment ago and about to be downloaded, so it stays."""
    folder = export_folder(project_id)
    try:
        _, files = default_storage.listdir(folder)
    except FileNotFoundError:
        return
    cutoff = timezone.now() - EXPORT_TTL
    for name in files:
        path = f"{folder}/{name}"
        try:
            if default_storage.get_modified_time(path) < cutoff:
                default_storage.delete(path)
        except FileNotFoundError:
            continue


@shared_task(bind=True)
def generate_contracts_zip_task(self, project_id: str) -> dict[str, Any]:
    contracts = list(live_contracts(project_id))
    if not contracts:
        return {"project_id": project_id, "error_code": NO_CONTRACTS}

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for contract in contracts:
            archive.writestr(contract_filename(contract), render_contract_pdf(contract))

    _clear_stale_exports(project_id)
    default_storage.save(export_path(project_id, self.request.id), ContentFile(buffer.getvalue()))
    return {"project_id": project_id, "count": len(contracts)}
