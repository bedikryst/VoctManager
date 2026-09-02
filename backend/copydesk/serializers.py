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

from .dtos import MAX_COMMENT_LENGTH, MAX_VALUE_LENGTH
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


class SegmentQuerySerializer(serializers.Serializer):
    """The desk reads one page at a time, in one or more locale columns."""

    scope = serializers.CharField(max_length=120)
    locales = serializers.ListField(
        child=serializers.ChoiceField(choices=SiteLocale.choices),
        required=False,
        allow_empty=False,
        max_length=len(SiteLocale.choices),
    )
