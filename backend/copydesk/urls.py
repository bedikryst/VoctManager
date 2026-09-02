"""
@file urls.py
@description Copy desk routes, mounted under /api/copydesk/. The panel's own
             route tree for this feature is `/redakcja/*` (a layout takeover, not
             a tab); these are the endpoints behind it.
@architecture Enterprise SaaS 2026
@module copydesk/urls
"""
from django.urls import path

from .views import (
    CopyDeskContentsView,
    CopyDeskMarkSeenView,
    CopyDeskPatchView,
    CopyDeskProposalDetailView,
    CopyDeskProposalsView,
    CopyDeskReviewView,
    CopyDeskSegmentsView,
)

urlpatterns = [
    path("contents/", CopyDeskContentsView.as_view(), name="copydesk-contents"),
    path("segments/", CopyDeskSegmentsView.as_view(), name="copydesk-segments"),
    path("proposals/", CopyDeskProposalsView.as_view(), name="copydesk-proposals"),
    # Ahead of the <uuid:pk> routes so neither is swallowed by a detail match.
    path("proposals/patch/", CopyDeskPatchView.as_view(), name="copydesk-patch"),
    path(
        "proposals/<uuid:pk>/",
        CopyDeskProposalDetailView.as_view(),
        name="copydesk-proposal-detail",
    ),
    path(
        "proposals/<uuid:pk>/review/",
        CopyDeskReviewView.as_view(),
        name="copydesk-proposal-review",
    ),
    path("mark-seen/", CopyDeskMarkSeenView.as_view(), name="copydesk-mark-seen"),
]
