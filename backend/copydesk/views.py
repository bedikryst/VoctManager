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

from .dtos import ProposalReviewDTO, ProposalWriteDTO, SegmentUpsertDTO
from .models import CopyProposal, ProposalStatus
from .permissions import CanEditSiteCopy, IsCopyReviewer, user_is_copy_reviewer
from .serializers import (
    ProposalAppliedSerializer,
    ProposalReviewSerializer,
    ProposalWriteSerializer,
    SegmentIngestSerializer,
    SegmentQuerySerializer,
)
from .services import (
    CopyDeskService,
    ProposalClosedError,
    ProposalNotFoundError,
    SegmentNotFoundError,
    UnknownProposalsError,
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

    `base_value` is the mirror's PRE-IMAGE: the value the desk believes the
    repository currently holds for this segment. The apply script refuses any row
    whose file does not match it, which is the only way it can tell a patch it may
    write from one written against a tree that has since moved — a hand edit in
    `concerts.yaml`, or a mirror older than the checkout. Without it the script
    would overwrite in the dark, and the loss would be somebody's prose.
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
                    "base_value": proposal.segment.value,
                    "source_hash": proposal.source_hash,
                }
                for proposal in proposals
            ],
        })


class CopyDeskIngestView(views.APIView):
    """POST — the extractor's door into the mirror. Staff only.

    The seam §6c's third defect describes: `upsert_segments` is a Python
    classmethod, the extractor is a node script reading YAML in `web/`, and
    Postgres publishes no host port, so something has to carry one to the other.
    An endpoint rather than a management command because the loop then runs from
    the repository as one command (`npm run copy:sync`) on any machine with the
    checkout, exactly as `apply-copy` must already reach the database; a command
    fed over `docker compose exec -T` would couple the loop to a shell on the
    server, and on the developer's own Windows checkout that pipe is a known way
    to lose a UTF-8 payload silently.

    It does not break the rule that the desk's API never writes the mirror. That
    rule is about the EDITOR-facing routes — an editor's change is a proposal,
    always. This door is staff-only and its payload is derived from git.

    The "is the working tree clean" guard §6c asks for lives in the client, and
    can only live there: the server has no checkout to inspect. What it can do is
    record which revision the payload claimed, so a mirror that looks wrong can
    be traced to the tree it was built from.
    """

    permission_classes = [IsCopyReviewer]

    def post(self, request: Request) -> Response:
        serializer = SegmentIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        rows: list[SegmentUpsertDTO] = []
        for index, row in enumerate(data["segments"]):
            try:
                rows.append(SegmentUpsertDTO(**row))
            except ValidationError as exc:
                # Named by position: at ~1 300 rows an unlocated validation error
                # is a hunt, and the extractor writes them in a stable order.
                return Response(
                    {
                        "detail": f"Row {index} is not a segment the mirror can hold.",
                        "errors": exc.errors(include_url=False),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        logger.info(
            "[CopyDesk] Ingest of %d row(s) by UID:%s from revision %s",
            len(rows),
            getattr(request.user, "id", None),
            data["revision"] or "(unstated)",
        )
        result = CopyDeskService.upsert_segments(rows, prune=data["prune"])
        return Response(result.model_dump(mode="json"))


class CopyDeskAppliedView(views.APIView):
    """POST — `apply-copy` reports which accepted proposals reached the repository.

    Stamps `applied_at`, which takes them out of the patch, and carries each
    proposal's `source_hash` onto its segment, which is the only thing that ever
    writes that column and therefore the only reason the stale state can fire at
    all. Called after a real write: a dry run has nothing to report.
    """

    permission_classes = [IsCopyReviewer]

    def post(self, request: Request) -> Response:
        serializer = ProposalAppliedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = CopyDeskService.mark_applied(
                proposal_ids=serializer.validated_data["proposal_ids"],
                reviewer=request_user(request),
            )
        except UnknownProposalsError as exc:
            return Response(
                {
                    "detail": "No such proposal(s); nothing was stamped.",
                    "unknown": [str(value) for value in exc.ids],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(result.model_dump(mode="json"))


class CopyDeskMarkSeenView(views.APIView):
    """POST — stamp this visit, clearing the new-since-last-visit flags."""

    permission_classes = [CanEditSiteCopy]

    def post(self, request: Request) -> Response:
        CopyDeskService.mark_seen(user=request_user(request))
        return Response({"status": "seen"}, status=status.HTTP_200_OK)
