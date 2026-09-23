"""
Files kept with an expense: what may be stored, where, who may read it back,
and that a fee takes none.
"""
import shutil
import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from core.constants import AppRole
from documents.file_detection import FileTypeDetectionUnavailableError

from ..models import FinanceAction, FinanceAttachment, FinanceEvent
from .factories import make_project, make_seat, make_user, price

_MEDIA = tempfile.mkdtemp(prefix="vm_finance_attachments_test_")
_DETECT = "finance.services.attachments.detect_mime_from_buffer"
_PDF = b"%PDF-1.4\n%fake invoice\n"


def _upload(name: str = "faktura FV-12.pdf", content: bytes = _PDF) -> SimpleUploadedFile:
    return SimpleUploadedFile(name, content, content_type="application/octet-stream")


@override_settings(MEDIA_ROOT=_MEDIA)
class AttachmentTests(APITestCase):
    @classmethod
    def tearDownClass(cls) -> None:
        super().tearDownClass()
        shutil.rmtree(_MEDIA, ignore_errors=True)

    def setUp(self) -> None:
        self.manager = make_user()
        self.client.force_authenticate(self.manager)
        self.project = make_project()
        response = self.client.post(f"/api/finance/projects/{self.project.pk}/expenses/", {
            "category": "VENUE", "vendor_name": "Parafia", "document_type": "INVOICE", "cost_amount": "500",
        }, format="json")
        self.expense_id = response.json()["expenses"][0]["id"]

    def upload(self, cost_item: str, file: SimpleUploadedFile, mime: str = "application/pdf") -> Any:
        with patch(_DETECT, return_value=mime):
            return self.client.post("/api/finance/attachments/", {"cost_item": cost_item, "file": file},
                                    format="multipart")

    def test_a_pdf_is_kept_under_a_random_name_and_streamed_back_to_a_manager(self) -> None:
        response = self.upload(self.expense_id, _upload())

        self.assertEqual(response.status_code, 201, response.content)
        listed = response.json()["expenses"][0]["attachments"]
        self.assertEqual([(entry["original_name"], entry["mime_type"]) for entry in listed],
                         [("faktura FV-12.pdf", "application/pdf")])
        stored = FinanceAttachment.objects.get()
        stored_name = stored.file.name or ""
        self.assertRegex(stored_name, r"^finance/\d{4}/[0-9a-f]{32}\.pdf$")
        self.assertTrue((Path(_MEDIA) / stored_name).exists())

        download: Any = self.client.get(f"/api/finance/attachments/{stored.pk}/")
        self.assertEqual(download.status_code, 200)
        self.assertEqual(b"".join(download.streaming_content), _PDF)
        self.assertIn("attachment", download["Content-Disposition"])

        self.client.force_authenticate(make_user(role=AppRole.ARTIST))
        self.assertEqual(self.client.get(f"/api/finance/attachments/{stored.pk}/").status_code, 403)

    def test_a_fee_takes_no_file(self) -> None:
        fee = price(self.project, participation=make_seat(self.project), amount="300")

        response = self.upload(str(fee.pk), _upload())

        self.assertEqual(response.json()["error_code"], "attachment_not_allowed")

    def test_the_type_is_read_from_the_bytes_not_the_name(self) -> None:
        response = self.upload(self.expense_id, _upload("faktura.pdf", b"<html></html>"), mime="text/html")

        self.assertEqual(response.json()["error_code"], "attachment_type_not_allowed")
        self.assertFalse(FinanceAttachment.objects.exists())

    def test_a_file_past_the_limit_is_refused(self) -> None:
        with patch("finance.services.attachments.ATTACHMENT_MAX_BYTES", 10):
            response = self.upload(self.expense_id, _upload())

        self.assertEqual(response.json()["error_code"], "attachment_too_large")

    def test_a_server_without_type_detection_answers_503(self) -> None:
        with patch(_DETECT, side_effect=FileTypeDetectionUnavailableError("no libmagic")):
            response = self.client.post("/api/finance/attachments/", {"cost_item": self.expense_id,
                                                                      "file": _upload()}, format="multipart")

        self.assertEqual((response.status_code, response.json()["error_code"]), (503, "file_detection_unavailable"))

    def test_removing_a_file_takes_it_off_the_expense_and_logs_it(self) -> None:
        self.upload(self.expense_id, _upload())
        attachment = FinanceAttachment.objects.get()

        body = self.client.delete(f"/api/finance/attachments/{attachment.pk}/").json()

        self.assertEqual(body["expenses"][0]["attachments"], [])
        self.assertTrue(FinanceEvent.objects.filter(subject_id=attachment.pk, action=FinanceAction.REMOVED).exists())
        self.assertEqual(self.client.get(f"/api/finance/attachments/{attachment.pk}/").status_code, 404)
