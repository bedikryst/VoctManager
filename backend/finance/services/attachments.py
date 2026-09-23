"""
@file attachments.py
@description Files kept with an expense: the vendor's invoice, a photographed
             receipt. The type is read from the file's own bytes, never from its
             name or the browser's word for it. Fees take no file: a signed
             contract or a bill carries a handwritten PESEL, and whether the app
             holds those is undecided (spec §4 Q6b).
@architecture Enterprise SaaS 2026
@module finance/services/attachments
"""
from django.contrib.auth.models import User
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction

from documents.file_detection import detect_mime_from_buffer

from ..exceptions import AttachmentNotAllowed, AttachmentTooLarge, AttachmentTypeNotAllowed
from ..models import ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES, CostItem, CostKind, FinanceAction, FinanceAttachment
from . import audit
from .budget import BudgetService

# Enough of the file for libmagic to recognise it.
_MAGIC_CHUNK_BYTES = 2048


class AttachmentService:
    @staticmethod
    def add(item: CostItem, upload: UploadedFile, *, actor: User | None) -> FinanceAttachment:
        """Raises `FileTypeDetectionUnavailableError` when the server cannot read
        file types at all — a server fault, not the manager's."""
        if item.kind != CostKind.EXPENSE:
            raise AttachmentNotAllowed()
        size = upload.size or 0
        if size > ATTACHMENT_MAX_BYTES:
            raise AttachmentTooLarge(params={"max_bytes": ATTACHMENT_MAX_BYTES})
        head = upload.read(_MAGIC_CHUNK_BYTES)
        upload.seek(0)
        mime_type = detect_mime_from_buffer(head)
        if mime_type not in ATTACHMENT_MIME_TYPES:
            raise AttachmentTypeNotAllowed(params={"mime_type": mime_type})

        with transaction.atomic():
            budget = BudgetService.lock(item.budget.project)
            BudgetService.assert_writable(budget)
            item = CostItem.objects.get(pk=item.pk)
            original_name = (upload.name or "plik").rsplit("/", 1)[-1][:255]
            attachment = FinanceAttachment(
                cost_item=item,
                original_name=original_name,
                mime_type=mime_type,
                size_bytes=size,
                uploaded_by=actor,
            )
            attachment.file.save(original_name, upload, save=False)
            attachment.save()
            audit.record(
                budget, actor=actor, subject=attachment, action=FinanceAction.CREATED,
                after={"cost_item": item.pk, "name": original_name, "size_bytes": size},
            )
            return attachment

    @staticmethod
    def remove(attachment: FinanceAttachment, *, actor: User | None) -> None:
        """The row leaves the expense; the file stays on disk with the rest of
        the accounting record, as a soft-deleted row does."""
        with transaction.atomic():
            budget = BudgetService.lock(attachment.cost_item.budget.project)
            BudgetService.assert_writable(budget)
            attachment = FinanceAttachment.objects.get(pk=attachment.pk)
            attachment.delete()
            audit.record(
                budget, actor=actor, subject=attachment, action=FinanceAction.REMOVED,
                before={"cost_item": attachment.cost_item_id, "name": attachment.original_name},
            )
