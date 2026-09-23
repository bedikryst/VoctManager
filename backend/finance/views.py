"""
@file views.py
@description The finance API under /api/finance/. Managers run the ledger;
             the acts that undo a settled fact (reverting a payment, annulling a
             contract) are the board's. Every write answers with the whole
             budget, freshly computed, so the client never reconciles its copy
             row by row. Finance payloads appear nowhere else in the API, and
             the documents — rendered from the contract row — are streamed to a
             manager, never left at a public media URL.
@architecture Enterprise SaaS 2026
@module finance/views
"""
import io
from typing import Any
from uuid import UUID

from celery.result import AsyncResult
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.urls import reverse
from pydantic import BaseModel, ValidationError
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import format_pydantic_validation_errors, make_error_response
from core.permissions import IsBoard, IsManager
from core.request_utils import client_payload, request_user
from roster.infrastructure.document_generator import DocumentRenderDependencyError
from roster.models import Project

from .dtos import (
    ContractHoursDTO,
    CostItemDetailsDTO,
    FeeBatchDTO,
    OneOffFeeDTO,
    PayFeesDTO,
    ReasonDTO,
    SignContractDTO,
)
from .exceptions import FinanceError, finance_error_response
from .infrastructure.documents import (
    bill_filename,
    contract_filename,
    contracts_zip_filename,
    render_bill_pdf,
    render_contract_pdf,
)
from .models import Contract, CostItem, CostKind
from .serializers import PayableSerializer, ProjectMoneySerializer, ProjectRollupSerializer
from .services.budget import SEVERITY_PROBLEM, SEVERITY_WORK, BudgetService, ProjectMoney
from .services.contracts import ContractService
from .services.ledger import LedgerService
from .tasks import export_path, generate_contracts_zip_task

# A ZIP task that raised rather than returned; the client owns the words.
ZIP_FAILED = "zip_failed"

# The portfolio's payables list, one page at a time.
PAYABLES_DEFAULT_LIMIT = 50
PAYABLES_MAX_LIMIT = 200


def _invalid(request: Request, exc: ValidationError) -> Response:
    return make_error_response(
        request,
        status_code=status.HTTP_400_BAD_REQUEST,
        error_code="validation_error",
        detail="The submitted data is invalid.",
        validation_errors=format_pydantic_validation_errors(exc),
    )


def _money_payload(money: ProjectMoney) -> dict[str, Any]:
    return dict(ProjectMoneySerializer(money).data)


def _budget_response(project: Project, status_code: int = status.HTTP_200_OK) -> Response:
    return Response(_money_payload(BudgetService.build(project)), status=status_code)


class FinanceAPIView(APIView):
    """Manager-only unless a view says otherwise; parses its DTO and renders its
    refusals the same way everywhere."""

    permission_classes = [permissions.IsAuthenticated, IsManager]

    def parse[DTO: BaseModel](self, request: Request, dto_class: type[DTO]) -> DTO:
        return dto_class(**client_payload(request.data))

    def handle_exception(self, exc: Exception) -> Response:
        if isinstance(exc, FinanceError):
            return finance_error_response(self.request, exc)
        if isinstance(exc, ValidationError):
            return _invalid(self.request, exc)
        if isinstance(exc, DocumentRenderDependencyError):
            return make_error_response(
                self.request,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                error_code="pdf_renderer_unavailable",
                detail="PDF rendering is temporarily unavailable on the server.",
            )
        return super().handle_exception(exc)


class BoardAPIView(FinanceAPIView):
    permission_classes = [permissions.IsAuthenticated, IsBoard]


class ProjectBudgetView(FinanceAPIView):
    """GET projects/{project_id}/budget/ — status, summary, warnings and the
    ledger, including the unpriced rows computed from the roster."""

    def get(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        BudgetService.get_or_create(project)
        return _budget_response(project)


class ProjectFeesView(FinanceAPIView):
    """PATCH projects/{project_id}/fees/ — one atomic pricing batch."""

    def patch(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = self.parse(request, FeeBatchDTO)
        LedgerService.apply_fee_batch(project, dto, actor=request_user(request))
        return _budget_response(project)


class OneOffFeeView(FinanceAPIView):
    """POST projects/{project_id}/fees/one-off/ — a payee with no roster record."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = self.parse(request, OneOffFeeDTO)
        LedgerService.create_one_off(project, dto, actor=request_user(request))
        return _budget_response(project, status.HTTP_201_CREATED)


class PayFeesView(FinanceAPIView):
    """POST projects/{project_id}/fees/pay/ — all or nothing."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = self.parse(request, PayFeesDTO)
        LedgerService.pay(project, dto, actor=request_user(request))
        return _budget_response(project)


class CostItemDetailView(FinanceAPIView):
    """PATCH cost-items/{id}/ — bookkeeping details: due date, note, the vendor's
    document, and a one-off payee's name and side."""

    def patch(self, request: Request, pk: UUID) -> Response:
        item = get_object_or_404(CostItem.objects.select_related("budget__project"), pk=pk, kind=CostKind.FEE)
        dto = self.parse(request, CostItemDetailsDTO)
        LedgerService.update_details(item, dto, actor=request_user(request))
        return _budget_response(item.budget.project)


class UnpayView(BoardAPIView):
    """POST cost-items/{id}/unpay/ — the board reverts a payment, with a reason."""

    def post(self, request: Request, pk: UUID) -> Response:
        item = get_object_or_404(CostItem.objects.select_related("budget__project"), pk=pk, kind=CostKind.FEE)
        dto = self.parse(request, ReasonDTO)
        LedgerService.unpay(item, reason=dto.reason, actor=request_user(request))
        return _budget_response(item.budget.project)


class IssueContractView(FinanceAPIView):
    """POST cost-items/{id}/contract/ — DZIELO, ZLECENIE or VOLUNTEER."""

    def post(self, request: Request, pk: UUID) -> Response:
        item = get_object_or_404(CostItem.objects.select_related("budget__project"), pk=pk, kind=CostKind.FEE)
        ContractService.issue(item, actor=request_user(request))
        return _budget_response(item.budget.project, status.HTTP_201_CREATED)


def _contract(pk: UUID) -> Contract:
    return get_object_or_404(Contract.objects.select_related("cost_item__budget__project"), pk=pk)


class SignContractView(FinanceAPIView):
    """POST contracts/{id}/sign/ — the date on the paper and where the copy is."""

    def post(self, request: Request, pk: UUID) -> Response:
        contract = _contract(pk)
        dto = self.parse(request, SignContractDTO)
        ContractService.sign(contract, dto, actor=request_user(request))
        return _budget_response(contract.cost_item.budget.project)


class ContractHoursView(FinanceAPIView):
    """POST contracts/{id}/hours/ — a mandate's confirmed hours."""

    def post(self, request: Request, pk: UUID) -> Response:
        contract = _contract(pk)
        dto = self.parse(request, ContractHoursDTO)
        ContractService.confirm_hours(contract, dto.hours_confirmed, actor=request_user(request))
        return _budget_response(contract.cost_item.budget.project)


class AnnulContractView(BoardAPIView):
    """POST contracts/{id}/annul/ — the board annuls, with a reason."""

    def post(self, request: Request, pk: UUID) -> Response:
        contract = _contract(pk)
        dto = self.parse(request, ReasonDTO)
        ContractService.annul(contract, reason=dto.reason, actor=request_user(request))
        return _budget_response(contract.cost_item.budget.project)


def _download(data: bytes, filename: str, content_type: str) -> FileResponse:
    response = FileResponse(io.BytesIO(data), as_attachment=True, filename=filename, content_type=content_type)
    response["Access-Control-Expose-Headers"] = "Content-Disposition"
    return response


class ContractPdfView(FinanceAPIView):
    """GET contracts/{id}/pdf/ — the contract with its annexes, rendered from the
    row: its number, its frozen amount and payee."""

    def get(self, request: Request, pk: UUID) -> FileResponse:
        contract = _contract(pk)
        return _download(render_contract_pdf(contract), contract_filename(contract), "application/pdf")


class ContractBillView(FinanceAPIView):
    """GET contracts/{id}/bill.pdf — the bill for a dzieło or a zlecenie."""

    def get(self, request: Request, pk: UUID) -> FileResponse:
        contract = _contract(pk)
        return _download(render_bill_pdf(contract), bill_filename(contract), "application/pdf")


class ProjectContractsZipView(FinanceAPIView):
    """POST projects/{project_id}/contracts/zip/ — starts packing the project's
    live contracts; poll the status view with the returned `task_id`."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        task = generate_contracts_zip_task.delay(str(project.pk))
        return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)


def _zip_result(task_id: UUID) -> tuple[str, dict[str, Any]]:
    result = AsyncResult(str(task_id))
    data = result.result if result.state == "SUCCESS" and isinstance(result.result, dict) else {}
    return result.state, data


class ContractsZipStatusView(FinanceAPIView):
    """GET contracts/zip/{task_id}/ — `state` while it runs; on success the file's
    URL, on failure an `error_code` (`no_contracts` when there was nothing to
    pack). An unknown id reads as PENDING, which is Celery's answer for it."""

    def get(self, request: Request, task_id: UUID) -> Response:
        state, data = _zip_result(task_id)
        if state == "SUCCESS" and data.get("error_code"):
            return Response({"state": "FAILURE", "error_code": data["error_code"]})
        if state == "SUCCESS":
            return Response({
                "state": state,
                "count": data.get("count", 0),
                "file_url": reverse("finance:contracts-zip-file", kwargs={"task_id": task_id}),
            })
        if state == "FAILURE":
            return Response({"state": state, "error_code": ZIP_FAILED})
        return Response({"state": state})


class ContractsZipFileView(FinanceAPIView):
    """GET contracts/zip/{task_id}/file/ — the archive itself, streamed to a
    manager. The file sits where nginx will not serve it."""

    def get(self, request: Request, task_id: UUID) -> FileResponse:
        _, data = _zip_result(task_id)
        project_id = data.get("project_id")
        if not project_id or data.get("error_code"):
            raise Http404
        project = get_object_or_404(Project, pk=project_id)
        path = export_path(str(project.pk), str(task_id))
        if not default_storage.exists(path):
            raise Http404
        response = FileResponse(
            default_storage.open(path, "rb"),
            as_attachment=True,
            filename=contracts_zip_filename(project),
            content_type="application/zip",
        )
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response


def _bounded_int(raw: object, default: int, maximum: int) -> int:
    try:
        value = int(str(raw))
    except (TypeError, ValueError):
        return default
    return max(0, min(value, maximum))


class FinanceOverviewView(FinanceAPIView):
    """GET overview/ — every project's rollup (cancelled ones included: a
    cancellation has costs) and the fees still owed, a page at a time
    (``?limit=&offset=``)."""

    def get(self, request: Request) -> Response:
        projects = list(Project.objects.order_by("-date_time"))
        rollups = [
            {
                "project": money.project,
                "budget_status": money.budget_status,
                "summary": money.summary,
                "warning_counts": {
                    SEVERITY_WORK: sum(1 for w in money.warnings if w.severity == SEVERITY_WORK),
                    SEVERITY_PROBLEM: sum(1 for w in money.warnings if w.severity == SEVERITY_PROBLEM),
                },
            }
            for money in BudgetService.build_many(projects)
        ]
        limit = _bounded_int(request.query_params.get("limit"), PAYABLES_DEFAULT_LIMIT, PAYABLES_MAX_LIMIT) or 1
        offset = _bounded_int(request.query_params.get("offset"), 0, 1_000_000)
        payables = BudgetService.payables()
        return Response({
            "projects": ProjectRollupSerializer(rollups, many=True).data,
            "payables": {
                "count": payables.count(),
                "limit": limit,
                "offset": offset,
                "results": PayableSerializer(payables[offset:offset + limit], many=True).data,
            },
        })
