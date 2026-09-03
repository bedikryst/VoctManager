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
    CopyDeskAppliedView,
    CopyDeskContentsView,
    CopyDeskIngestView,
    CopyDeskMarkSeenView,
    CopyDeskNotifyView,
    CopyDeskPatchView,
    CopyDeskProposalDetailView,
    CopyDeskProposalsView,
    CopyDeskReviewView,
    CopyDeskSegmentsView,
)

urlpatterns = [
    path("contents/", CopyDeskContentsView.as_view(), name="copydesk-contents"),
    path("segments/", CopyDeskSegmentsView.as_view(), name="copydesk-segments"),
    # The extractor's door. Staff only, and the one write into the git mirror.
    path("segments/ingest/", CopyDeskIngestView.as_view(), name="copydesk-ingest"),
    path("proposals/", CopyDeskProposalsView.as_view(), name="copydesk-proposals"),
    # Ahead of the <uuid:pk> routes so neither is swallowed by a detail match.
    path("proposals/patch/", CopyDeskPatchView.as_view(), name="copydesk-patch"),
    path("proposals/applied/", CopyDeskAppliedView.as_view(), name="copydesk-applied"),
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
    # "I have finished" — the same digest the hourly beat raises, asked for early.
    # Never a submit: nothing is held back until it is called.
    path("notify/", CopyDeskNotifyView.as_view(), name="copydesk-notify"),
]
