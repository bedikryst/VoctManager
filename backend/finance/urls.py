# finance/urls.py
# ==========================================
# Finance — URL routing (mounted at /api/finance/)
# Standard: Enterprise SaaS 2026
# ==========================================
from django.urls import path

from .views import (
    AnnulContractView,
    ContractBillView,
    ContractHoursView,
    ContractPdfView,
    ContractsZipFileView,
    ContractsZipStatusView,
    CostItemDetailView,
    FinanceOverviewView,
    IssueContractView,
    OneOffFeeView,
    PayFeesView,
    ProjectBudgetView,
    ProjectContractsZipView,
    ProjectFeesView,
    SignContractView,
    UnpayView,
)

app_name = 'finance'

urlpatterns = [
    path('overview/', FinanceOverviewView.as_view(), name='overview'),
    path('projects/<uuid:project_id>/budget/', ProjectBudgetView.as_view(), name='project-budget'),
    path('projects/<uuid:project_id>/fees/', ProjectFeesView.as_view(), name='project-fees'),
    path('projects/<uuid:project_id>/fees/one-off/', OneOffFeeView.as_view(), name='project-fees-one-off'),
    path('projects/<uuid:project_id>/fees/pay/', PayFeesView.as_view(), name='project-fees-pay'),
    path('cost-items/<uuid:pk>/', CostItemDetailView.as_view(), name='cost-item-detail'),
    path('cost-items/<uuid:pk>/unpay/', UnpayView.as_view(), name='cost-item-unpay'),
    path('cost-items/<uuid:pk>/contract/', IssueContractView.as_view(), name='cost-item-contract'),
    path('contracts/<uuid:pk>/sign/', SignContractView.as_view(), name='contract-sign'),
    path('contracts/<uuid:pk>/hours/', ContractHoursView.as_view(), name='contract-hours'),
    path('contracts/<uuid:pk>/annul/', AnnulContractView.as_view(), name='contract-annul'),
    path('contracts/<uuid:pk>/pdf/', ContractPdfView.as_view(), name='contract-pdf'),
    path('contracts/<uuid:pk>/bill.pdf', ContractBillView.as_view(), name='contract-bill'),
    path('projects/<uuid:project_id>/contracts/zip/', ProjectContractsZipView.as_view(), name='project-contracts-zip'),
    path('contracts/zip/<uuid:task_id>/', ContractsZipStatusView.as_view(), name='contracts-zip-status'),
    path('contracts/zip/<uuid:task_id>/file/', ContractsZipFileView.as_view(), name='contracts-zip-file'),
]
