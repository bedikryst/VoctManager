"""
@file serializers.py
@description Request-boundary validation for the copy desk. Plain serializers
             throughout, never ModelSerializer: both tables carry conditional
             unique constraints, and DRF builds unique validators from those that
             read the condition's fields straight out of a PATCH payload and
             raise KeyError when a partial update omits them.
@architecture Enterprise SaaS 2026
@module copydesk/serializers
"""
from rest_framework import serializers

from .dtos import MAX_COMMENT_LENGTH, MAX_INGEST_ROWS, MAX_VALUE_LENGTH
from .models import ProposalStatus, SiteLocale


class ProposalWriteSerializer(serializers.Serializer):
    """An editor's change. `value` may legitimately be empty — clearing a field
    is an editorial decision, and refusing it would leave no way to propose one."""

    segment_id = serializers.UUIDField()
    value = serializers.CharField(
        allow_blank=True, trim_whitespace=False, max_length=MAX_VALUE_LENGTH,
    )
    comment = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=MAX_COMMENT_LENGTH,
    )
    status = serializers.ChoiceField(
        choices=[ProposalStatus.DRAFT, ProposalStatus.PROPOSED],
        default=ProposalStatus.PROPOSED,
    )


class ProposalReviewSerializer(serializers.Serializer):
    """A reviewer's verdict, optionally correcting the wording on the way through."""

    status = serializers.ChoiceField(
        choices=[ProposalStatus.ACCEPTED, ProposalStatus.REJECTED],
    )
    value = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False, max_length=MAX_VALUE_LENGTH,
    )
    comment = serializers.CharField(
        required=False, allow_blank=True, max_length=MAX_COMMENT_LENGTH,
    )


class SegmentIngestSerializer(serializers.Serializer):
    """The extractor's payload, as the envelope around it.

    Only the envelope is checked here — each row is then built through
    `SegmentUpsertDTO`, which forbids extra fields. That order matters: a row
    carrying a misspelled field name has to be a 400 naming the row, not a
    quietly dropped column that leaves the desk showing a label nobody wrote.

    `segments` is the `segments` array of `web/copydesk/segments.json` verbatim.
    Its `paths` sibling deliberately does not travel: it is where the apply
    script writes, not something the mirror can hold, and folding it into the
    rows is what the DTO's `extra="forbid"` exists to prevent.
    """

    segments = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
        max_length=MAX_INGEST_ROWS,
    )
    # Default ON: retirement is part of reconciling, not an extra. Switched off
    # for a deliberately partial payload, which is otherwise indistinguishable
    # from a page whose fields have all been deleted.
    prune = serializers.BooleanField(default=True)
    # What the payload was read from — a commit sha, or a sha plus a dirty
    # marker. Logged, never stored: the mirror describes a checkout, and when one
    # looks wrong the first question is which one.
    revision = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=200,
    )


class ProposalAppliedSerializer(serializers.Serializer):
    """What `apply-copy` reports it wrote, by proposal id.

    Ids rather than key+locale pairs, because the patch endpoint hands out ids
    and a pair does not identify WHICH of two competing accepted proposals was
    the one written into the file.
    """

    proposal_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=MAX_INGEST_ROWS,
    )


class SegmentQuerySerializer(serializers.Serializer):
    """The desk reads one page at a time, in one or more locale columns."""

    scope = serializers.CharField(max_length=120)
    locales = serializers.ListField(
        child=serializers.ChoiceField(choices=SiteLocale.choices),
        required=False,
        allow_empty=False,
        max_length=len(SiteLocale.choices),
    )
