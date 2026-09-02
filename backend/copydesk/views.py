"""
@file views.py
@description The copy desk API. Two audiences behind one route tree: an editor,
             who reads the corpus and proposes changes to it, and a reviewer, who
             settles those proposals and reads the patch that is waiting to be
             written into the repository.
@architecture Enterprise SaaS 2026
@module copydesk/views
"""
from __future__ import annotations

import logging
from uuid import UUID

from pydantic import ValidationError
from rest_framework import status, views
from rest_framework.request import Request
from rest_framework.response import Response

from core.request_utils import request_user

from .dtos import ProposalReviewDTO, ProposalWriteDTO
from .models import CopyProposal, ProposalStatus
from .permissions import CanEditSiteCopy, IsCopyReviewer, user_is_copy_reviewer
from .serializers import (
    ProposalReviewSerializer,
    ProposalWriteSerializer,
    SegmentQuerySerializer,
)
from .services import (
    CopyDeskService,
    ProposalClosedError,
    ProposalNotFoundError,
    SegmentNotFoundError,
)

logger = logging.getLogger(__name__)


def _validation_response(exc: ValidationError) -> Response:
    return Response(
        {"detail": "The submitted data is invalid.", "errors": exc.errors(include_url=False)},
        status=status.HTTP_400_BAD_REQUEST,
    )


class CopyDeskContentsView(views.APIView):
    """GET — the contents list: every page of the corpus with its counts.

    Answers "what have I already done", which was an explicit request: an editor
    returning to the desk sees a short index with what is new since their last
    visit, not the whole corpus again.
    """

    permission_classes = [CanEditSiteCopy]

    def get(self, request: Request) -> Response:
        summaries = CopyDeskService.scope_summaries(user=request_user(request))
        return Response({
            "scopes": [summary.model_dump(mode="json") for summary in summaries],
            "is_reviewer": user_is_copy_reviewer(request.user),
        })


class CopyDeskSegmentsView(views.APIView):
    """GET — one page of the desk, in reading order, with its proposals."""

    permission_classes = [CanEditSiteCopy]

    def get(self, request: Request) -> Response:
        serializer = SegmentQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        segments = CopyDeskService.segments_for_scope(
            scope=data["scope"],
            user=request_user(request),
            locales=data.get("locales"),
        )
        return Response({
            "segments": [segment.model_dump(mode="json") for segment in segments],
        })


class CopyDeskProposalsView(views.APIView):
    """POST — write (or revise) the caller's own open proposal for a segment."""

    permission_classes = [CanEditSiteCopy]

    def post(self, request: Request) -> Response:
        serializer = ProposalWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            dto = ProposalWriteDTO(**serializer.validated_data)
        except ValidationError as exc:
            return _validation_response(exc)

        try:
            proposal = CopyDeskService.save_proposal(
                dto=dto, author=request_user(request)
            )
        except SegmentNotFoundError:
            return Response(
                {"detail": "Segment not found."}, status=status.HTTP_404_NOT_FOUND
            )

        return Response({"id": str(proposal.id), "status": proposal.status})


class CopyDeskProposalDetailView(views.APIView):
    """DELETE — an editor withdraws their own open proposal."""

    permission_classes = [CanEditSiteCopy]

    def delete(self, request: Request, pk: UUID) -> Response:
        try:
            CopyDeskService.withdraw_proposal(
                proposal_id=pk, author=request_user(request)
            )
        except ProposalNotFoundError:
            return Response(
                {"detail": "Proposal not found."}, status=status.HTTP_404_NOT_FOUND
            )
        except ProposalClosedError:
            return Response(
                {"detail": "A settled proposal cannot be withdrawn."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CopyDeskReviewView(views.APIView):
    """POST — accept or reject one proposal.

    Accepting changes nothing on the public site. It marks a value as one the
    reviewer intends to commit; `apply-copy` writes it into the repository and
    it still arrives in front of a reader as an ordinary `git diff`.
    """

    permission_classes = [IsCopyReviewer]

    def post(self, request: Request, pk: UUID) -> Response:
        serializer = ProposalReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            dto = ProposalReviewDTO(**serializer.validated_data)
        except ValidationError as exc:
            return _validation_response(exc)

        try:
            proposal = CopyDeskService.review_proposal(
                proposal_id=pk, dto=dto, reviewer=request_user(request)
            )
        except ProposalNotFoundError:
            return Response(
                {"detail": "Proposal not found."}, status=status.HTTP_404_NOT_FOUND
            )
        except ProposalClosedError:
            return Response(
                {"detail": "This proposal has already been settled."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response({"id": str(proposal.id), "status": proposal.status})


class CopyDeskPatchView(views.APIView):
    """GET — everything accepted and not yet written into the repository.

    The input to `apply-copy` (stage C). Ordered oldest first so the script
    writes a segment's history in the order it was decided, and keyed by
    `key`+`locale` rather than by row id, because that pair is what the apply
    script addresses in the YAML.
    """

    permission_classes = [IsCopyReviewer]

    def get(self, request: Request) -> Response:
        proposals = (
            CopyProposal.objects.filter(
                status=ProposalStatus.ACCEPTED, applied_at__isnull=True
            )
            .select_related("segment")
            .order_by("reviewed_at")
        )
        return Response({
            "proposals": [
                {
                    "id": str(proposal.id),
                    "key": proposal.segment.key,
                    "locale": proposal.segment.locale,
                    "kind": proposal.segment.kind,
                    "value": proposal.value,
                    "source_hash": proposal.source_hash,
                }
                for proposal in proposals
            ],
        })


class CopyDeskMarkSeenView(views.APIView):
    """POST — stamp this visit, clearing the new-since-last-visit flags."""

    permission_classes = [CanEditSiteCopy]

    def post(self, request: Request) -> Response:
        CopyDeskService.mark_seen(user=request_user(request))
        return Response({"status": "seen"}, status=status.HTTP_200_OK)
