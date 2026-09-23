"""
@file views.py
@description The finance API under /api/finance/. Managers run the ledger, the
             expenses, the plan and the funding — the organisation's sources,
             each project's share of them and how lines and costs are split
             between them; the acts that undo a settled fact
             (reverting a payment, annulling a contract) and those that move the
             budget's standing (approve, reopen, close) are the board's. Every
             write answers with the whole budget, freshly computed, so the
             client never reconciles its copy row by row. Finance payloads
             appear nowhere else in the API, and the files — contracts rendered
             from their row, an expense's attachments, the reports, the
             kosztorys and the office's exports — are streamed to a manager,
             never left at a public media URL.
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
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import format_pydantic_validation_errors, make_error_response
from core.permissions import IsBoard, IsManager
from core.request_utils import client_payload, request_user
from documents.file_detection import FileTypeDetectionUnavailableError
from roster.infrastructure.document_generator import DocumentRenderDependencyError
from roster.models import Project

from .dtos import (
    AllocationSetDTO,
    BudgetLineDTO,
    BudgetLineUpdateDTO,
    ChargeCostsDTO,
    ContractHoursDTO,
    CostItemDetailsDTO,
    ExpenseDTO,
    ExpenseUpdateDTO,
    FeeBatchDTO,
    FundingSourceDTO,
    FundingSourceUpdateDTO,
    HistoryPageDTO,
    LedgerRangeDTO,
    LineOrderDTO,
    OneOffFeeDTO,
    PatronSummaryDTO,
    PayFeesDTO,
    ProjectFundingDTO,
    ProjectFundingUpdateDTO,
    ReasonDTO,
    ReportQueryDTO,
    SignContractDTO,
    SourceQueryDTO,
)
from .exceptions import AttachmentMissing, FinanceError, finance_error_response
from .infrastructure.documents import (
    bill_filename,
    contract_filename,
    contracts_zip_filename,
    render_bill_pdf,
    render_contract_pdf,
)
from .infrastructure.kosztorys_csv import kosztorys_csv, kosztorys_filename
from .infrastructure.ledger_csv import ledger_csv, project_ledger_filename, range_ledger_filename
from .infrastructure.reports import (
    board_report_filename,
    document_notes_filename,
    patron_report_filename,
    render_board_report_pdf,
    render_document_notes_pdf,
    render_patron_report_pdf,
)
from .models import BudgetLine, Contract, CostItem, CostKind, FinanceAttachment, FundingSource, ProjectFunding
from .serializers import (
    HistoryEventSerializer,
    PayableSerializer,
    ProjectMoneySerializer,
    ProjectRollupSerializer,
    SourceDetailSerializer,
    SourceSerializer,
)
from .services import sources
from .services.attachments import AttachmentService
from .services.budget import SEVERITY_PROBLEM, SEVERITY_WORK, BudgetService, ProjectMoney
from .services.contracts import ContractService
from .services.expenses import ExpenseService
from .services.funding import FundingService
from .services.history import HistoryService
from .services.ledger import LedgerService
from .services.plan import PlanService
from .services.reports import VARIANT_ACTUAL, VARIANT_PLAN
from .tasks import export_path, generate_contracts_zip_task

# A ZIP task that raised rather than returned; the client owns the words.
ZIP_FAILED = "zip_failed"

# The portfolio's payables list, one page at a time.
PAYABLES_DEFAULT_LIMIT = 50
PAYABLES_MAX_LIMIT = 200

CSV_CONTENT_TYPE = "text/csv; charset=utf-8"


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
        if isinstance(exc, FileTypeDetectionUnavailableError):
            return make_error_response(
                self.request,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                error_code="file_detection_unavailable",
                detail="File type detection is unavailable on the server.",
            )
        return super().handle_exception(exc)


class BoardAPIView(FinanceAPIView):
    permission_classes = [permissions.IsAuthenticated, IsBoard]


class ProjectBudgetView(FinanceAPIView):
    """GET projects/{project_id}/budget/ — status, summary, warnings and the
    ledger, including the unpriced rows computed from the roster. PATCH writes
    the patron report's opening sentences."""

    def get(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        BudgetService.get_or_create(project)
        return _budget_response(project)

    def patch(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = self.parse(request, PatronSummaryDTO)
        PlanService.set_patron_summary(project, dto.patron_summary)
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
    """POST cost-items/{id}/unpay/ — the board reverts a payment of a fee or an
    expense, with a reason."""

    def post(self, request: Request, pk: UUID) -> Response:
        item = get_object_or_404(CostItem.objects.select_related("budget__project"), pk=pk)
        dto = self.parse(request, ReasonDTO)
        LedgerService.unpay(item, reason=dto.reason, actor=request_user(request))
        return _budget_response(item.budget.project)


def _expense(project_id: UUID, pk: UUID) -> CostItem:
    return get_object_or_404(
        CostItem.objects.select_related("budget__project"),
        pk=pk, kind=CostKind.EXPENSE, budget__project_id=project_id,
    )


class ExpenseCollectionView(FinanceAPIView):
    """POST projects/{project_id}/expenses/ — a cost that is not a fee."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = self.parse(request, ExpenseDTO)
        ExpenseService.create(project, dto, actor=request_user(request))
        return _budget_response(project, status.HTTP_201_CREATED)


class ExpenseDetailView(FinanceAPIView):
    """PATCH | DELETE projects/{project_id}/expenses/{id}/."""

    def patch(self, request: Request, project_id: UUID, pk: UUID) -> Response:
        item = _expense(project_id, pk)
        dto = self.parse(request, ExpenseUpdateDTO)
        ExpenseService.update(item, dto, actor=request_user(request))
        return _budget_response(item.budget.project)

    def delete(self, request: Request, project_id: UUID, pk: UUID) -> Response:
        item = _expense(project_id, pk)
        ExpenseService.delete(item, actor=request_user(request))
        return _budget_response(item.budget.project)


class PayExpensesView(FinanceAPIView):
    """POST projects/{project_id}/expenses/pay/ — all or nothing, like fees."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = self.parse(request, PayFeesDTO)
        LedgerService.pay(project, dto, actor=request_user(request), kind=CostKind.EXPENSE)
        return _budget_response(project)


def _line(project_id: UUID, pk: UUID) -> BudgetLine:
    return get_object_or_404(
        BudgetLine.objects.select_related("budget__project"), pk=pk, budget__project_id=project_id,
    )


class LineCollectionView(FinanceAPIView):
    """POST projects/{project_id}/lines/ — a plan line, while the plan is open."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = self.parse(request, BudgetLineDTO)
        PlanService.create_line(project, dto, actor=request_user(request))
        return _budget_response(project, status.HTTP_201_CREATED)


class LineDetailView(FinanceAPIView):
    """PATCH | DELETE projects/{project_id}/lines/{id}/."""

    def patch(self, request: Request, project_id: UUID, pk: UUID) -> Response:
        line = _line(project_id, pk)
        dto = self.parse(request, BudgetLineUpdateDTO)
        PlanService.update_line(line, dto, actor=request_user(request))
        return _budget_response(line.budget.project)

    def delete(self, request: Request, project_id: UUID, pk: UUID) -> Response:
        line = _line(project_id, pk)
        PlanService.delete_line(line, actor=request_user(request))
        return _budget_response(line.budget.project)


class LineReorderView(FinanceAPIView):
    """POST projects/{project_id}/lines/reorder/ — every line, in its new order."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = self.parse(request, LineOrderDTO)
        PlanService.reorder(project, dto, actor=request_user(request))
        return _budget_response(project)


class LineChargeView(FinanceAPIView):
    """POST projects/{project_id}/lines/{id}/charge/ — charges the costs of the
    line's category that sit outside the plan to this line."""

    def post(self, request: Request, project_id: UUID, pk: UUID) -> Response:
        line = _line(project_id, pk)
        PlanService.charge_unplanned(line, actor=request_user(request))
        return _budget_response(line.budget.project)


class LineAllocationsView(FinanceAPIView):
    """PUT projects/{project_id}/lines/{id}/allocations/ — the plan's split of
    the line between sources, replacing what it had."""

    def put(self, request: Request, project_id: UUID, pk: UUID) -> Response:
        line = _line(project_id, pk)
        dto = self.parse(request, AllocationSetDTO)
        FundingService.set_line_allocations(line, dto, actor=request_user(request))
        return _budget_response(line.budget.project)


class CostAllocationsView(FinanceAPIView):
    """PUT cost-items/{id}/allocations/ — the sources a fee or an expense is
    charged to, replacing what it had."""

    def put(self, request: Request, pk: UUID) -> Response:
        item = get_object_or_404(CostItem.objects.select_related("budget__project"), pk=pk)
        dto = self.parse(request, AllocationSetDTO)
        FundingService.set_cost_allocations(item, dto, actor=request_user(request))
        return _budget_response(item.budget.project)


def _funding(project_id: UUID, pk: UUID) -> ProjectFunding:
    return get_object_or_404(
        ProjectFunding.objects.select_related("budget__project", "source"), pk=pk, budget__project_id=project_id,
    )


class FundingCollectionView(FinanceAPIView):
    """POST projects/{project_id}/fundings/ — puts a source on the project."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = self.parse(request, ProjectFundingDTO)
        FundingService.add_funding(project, dto, actor=request_user(request))
        return _budget_response(project, status.HTTP_201_CREATED)


class FundingDetailView(FinanceAPIView):
    """PATCH | DELETE projects/{project_id}/fundings/{id}/."""

    def patch(self, request: Request, project_id: UUID, pk: UUID) -> Response:
        funding = _funding(project_id, pk)
        dto = self.parse(request, ProjectFundingUpdateDTO)
        FundingService.update_funding(funding, dto, actor=request_user(request))
        return _budget_response(funding.budget.project)

    def delete(self, request: Request, project_id: UUID, pk: UUID) -> Response:
        funding = _funding(project_id, pk)
        FundingService.remove_funding(funding, actor=request_user(request))
        return _budget_response(funding.budget.project)


class FundingChargeView(FinanceAPIView):
    """POST projects/{project_id}/fundings/{id}/charge/ — what each named cost
    has left uncovered goes to this funding."""

    def post(self, request: Request, project_id: UUID, pk: UUID) -> Response:
        funding = _funding(project_id, pk)
        dto = self.parse(request, ChargeCostsDTO)
        FundingService.charge_costs(funding, dto, actor=request_user(request))
        return _budget_response(funding.budget.project)


def _source_payload(source: FundingSource) -> dict[str, Any]:
    return dict(SourceDetailSerializer(sources.detail(source)).data)


class FundingSourceCollectionView(FinanceAPIView):
    """GET funding-sources/ — every source with its figures across projects;
    POST — a new source, answered with its page."""

    def get(self, request: Request) -> Response:
        measures = sources.measure(sources.all_sources())
        return Response(SourceSerializer(list(measures.sources.values()), many=True).data)

    def post(self, request: Request) -> Response:
        dto = self.parse(request, FundingSourceDTO)
        source = FundingService.create_source(dto, actor=request_user(request))
        return Response(_source_payload(source), status=status.HTTP_201_CREATED)


class FundingSourceDetailView(FinanceAPIView):
    """GET | PATCH | DELETE funding-sources/{id}/ — the source's page: its
    rules, the projects it funds, every cost charged to it."""

    def get(self, request: Request, pk: UUID) -> Response:
        return Response(_source_payload(get_object_or_404(FundingSource, pk=pk)))

    def patch(self, request: Request, pk: UUID) -> Response:
        source = get_object_or_404(FundingSource, pk=pk)
        dto = self.parse(request, FundingSourceUpdateDTO)
        return Response(_source_payload(FundingService.update_source(source, dto, actor=request_user(request))))

    def delete(self, request: Request, pk: UUID) -> Response:
        source = get_object_or_404(FundingSource, pk=pk)
        FundingService.delete_source(source, actor=request_user(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


class BudgetApproveView(BoardAPIView):
    """POST projects/{project_id}/budget/approve/ — the board agrees the plan."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        PlanService.approve(project, actor=request_user(request))
        return _budget_response(project)


class BudgetReopenView(BoardAPIView):
    """POST projects/{project_id}/budget/reopen/ — one step back, with a reason."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = self.parse(request, ReasonDTO)
        PlanService.reopen(project, reason=dto.reason, actor=request_user(request))
        return _budget_response(project)


class BudgetCloseView(BoardAPIView):
    """POST projects/{project_id}/budget/close/ — the books are settled."""

    def post(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        PlanService.close(project, actor=request_user(request))
        return _budget_response(project)


class BudgetHistoryView(FinanceAPIView):
    """GET projects/{project_id}/history/?limit=&offset= — the budget's log,
    newest first."""

    def get(self, request: Request, project_id: UUID) -> Response:
        project = get_object_or_404(Project, pk=project_id)
        dto = HistoryPageDTO.model_validate(request.query_params.dict())
        budget = BudgetService.get_or_create(project)
        count, entries = HistoryService.page(budget, limit=dto.limit, offset=dto.offset)
        return Response({
            "count": count,
            "limit": dto.limit,
            "offset": dto.offset,
            "results": HistoryEventSerializer(entries, many=True).data,
        })


class AttachmentUploadView(FinanceAPIView):
    """POST attachments/ — multipart `cost_item` + `file`, for an expense."""

    parser_classes = [MultiPartParser]

    def post(self, request: Request) -> Response:
        upload = request.FILES.get("file")
        if upload is None:
            raise AttachmentMissing()
        try:
            item_id = UUID(str(request.data.get("cost_item", "")))
        except ValueError as exc:
            raise Http404 from exc
        item = get_object_or_404(CostItem.objects.select_related("budget__project"), pk=item_id)
        AttachmentService.add(item, upload, actor=request_user(request))
        return _budget_response(item.budget.project, status.HTTP_201_CREATED)


class AttachmentDetailView(FinanceAPIView):
    """GET attachments/{id}/ streams the file to a manager; DELETE removes it
    from its expense."""

    def _attachment(self, pk: UUID) -> FinanceAttachment:
        return get_object_or_404(
            FinanceAttachment.objects.select_related("cost_item__budget__project"),
            pk=pk, cost_item__is_deleted=False,
        )

    def get(self, request: Request, pk: UUID) -> FileResponse:
        attachment = self._attachment(pk)
        try:
            handle = attachment.file.open("rb")
        except (FileNotFoundError, OSError) as exc:
            raise Http404 from exc
        response = FileResponse(
            handle, as_attachment=True, filename=attachment.original_name, content_type=attachment.mime_type,
        )
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response

    def delete(self, request: Request, pk: UUID) -> Response:
        attachment = self._attachment(pk)
        AttachmentService.remove(attachment, actor=request_user(request))
        return _budget_response(attachment.cost_item.budget.project)


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


class ProjectLedgerCsvView(FinanceAPIView):
    """GET projects/{project_id}/export/ledger.csv — the project's counted fees,
    in the office's CSV."""

    def get(self, request: Request, project_id: UUID) -> FileResponse:
        project = get_object_or_404(Project, pk=project_id)
        data = ledger_csv([BudgetService.build(project)])
        return _download(data, project_ledger_filename(project), CSV_CONTENT_TYPE)


class KosztorysCsvView(FinanceAPIView):
    """GET projects/{project_id}/export/kosztorys-{plan,actual}.csv[?source=] —
    the kosztorys in the public-benefit layout, to type a grant's form from.
    ``variant`` is fixed per route."""

    variant = VARIANT_PLAN

    def get(self, request: Request, project_id: UUID) -> FileResponse:
        project = get_object_or_404(Project, pk=project_id)
        dto = SourceQueryDTO.model_validate(request.query_params.dict())
        data = kosztorys_csv(BudgetService.build(project), variant=self.variant, source_id=dto.source)
        return _download(data, kosztorys_filename(project, variant=self.variant), CSV_CONTENT_TYPE)


class KosztorysActualCsvView(KosztorysCsvView):
    variant = VARIANT_ACTUAL


class ReportPdfView(FinanceAPIView):
    """GET projects/{project_id}/report.pdf?audience=patron|board[&source=] —
    the patron report (no person, no single fee; `source` shows what that
    source's money covered) or the board's complete one."""

    def get(self, request: Request, project_id: UUID) -> FileResponse:
        project = get_object_or_404(Project, pk=project_id)
        dto = ReportQueryDTO.model_validate(request.query_params.dict())
        money = BudgetService.build(project)
        if dto.audience == "board":
            return _download(render_board_report_pdf(money), board_report_filename(project), "application/pdf")
        return _download(
            render_patron_report_pdf(money, source_id=dto.source), patron_report_filename(project), "application/pdf",
        )


class DocumentNotesPdfView(FinanceAPIView):
    """GET projects/{project_id}/document-notes.pdf[?source=] — the note for the
    back of every document charged to a source."""

    def get(self, request: Request, project_id: UUID) -> FileResponse:
        project = get_object_or_404(Project, pk=project_id)
        dto = SourceQueryDTO.model_validate(request.query_params.dict())
        data = render_document_notes_pdf(BudgetService.build(project), source_id=dto.source)
        return _download(data, document_notes_filename(project), "application/pdf")


class LedgerCsvView(FinanceAPIView):
    """GET export/ledger.csv?from=&to= — every counted fee whose cost date falls
    in the range, across projects: what the office books for a period."""

    def get(self, request: Request) -> FileResponse:
        dto = LedgerRangeDTO.model_validate(request.query_params.dict())
        projects = list(
            Project.objects.filter(
                budget__cost_items__incurred_on__range=(dto.date_from, dto.date_to),
                budget__cost_items__is_deleted=False,
            )
            .distinct()
            .order_by("date_time")
        )
        data = ledger_csv(BudgetService.build_many(projects), date_from=dto.date_from, date_to=dto.date_to)
        return _download(data, range_ledger_filename(dto.date_from, dto.date_to), CSV_CONTENT_TYPE)


def _bounded_int(raw: object, default: int, maximum: int) -> int:
    try:
        value = int(str(raw))
    except (TypeError, ValueError):
        return default
    return max(0, min(value, maximum))


class FinanceOverviewView(FinanceAPIView):
    """GET overview/ — every project's rollup (cancelled ones included: a
    cancellation has costs), every funding source with what it carries across
    projects and its deadlines, and the costs still owed, a page at a time
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
        measures = sources.measure(sources.all_sources())
        return Response({
            "projects": ProjectRollupSerializer(rollups, many=True).data,
            "sources": SourceSerializer(list(measures.sources.values()), many=True).data,
            "payables": {
                "count": payables.count(),
                "limit": limit,
                "offset": offset,
                "results": PayableSerializer(payables[offset:offset + limit], many=True).data,
            },
        })
