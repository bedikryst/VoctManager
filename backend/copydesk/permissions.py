"""
@file permissions.py
@description Who reaches the copy desk, and in which of its two modes. The
             capability to EDIT is a flag on the profile, deliberately not a
             fourth AppRole; the capability to REVIEW is staff, because a review
             ends in a commit.
@architecture Enterprise SaaS 2026
@module copydesk/permissions
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q, QuerySet
from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.views import APIView

User = get_user_model()

# Single source of truth for "who may edit the site's copy", in both directions —
# the predicate for a user and the filter for asking the database the same
# question. Staff is included for the same reason `user_is_manager` includes it:
# a staff account reaches the admin, where it can set this very flag on itself,
# so denying it here would protect nothing and produce a dead end.
EDITOR_QUERY_FILTER = Q(profile__can_edit_site_copy=True) | Q(is_staff=True)


def user_can_edit_site_copy(user: object) -> bool:
    """True for an account granted the copy-desk capability, and for staff."""
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_staff", False):
        return True
    profile = getattr(user, "profile", None)
    return bool(profile is not None and profile.can_edit_site_copy)


def user_is_copy_reviewer(user: object) -> bool:
    """True for the accounts that may accept or reject a proposal.

    Staff, and only staff. Accepting is not an opinion about wording — it is the
    decision to put a value into `concerts.yaml` and commit it, which needs the
    repository. Managership is the wrong test: an editor may well be a manager
    (§3 expects exactly that), and a manager who cannot commit would be offered
    a verdict they cannot carry out.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    return bool(getattr(user, "is_staff", False))


def copy_desk_reviewers() -> QuerySet:
    """The accounts a proposal digest is addressed to.

    Same rule as `user_is_copy_reviewer`, asked of the database. Inactive
    accounts are excluded: a disabled login cannot review anything, and mailing
    one is how a notification ends up in an abandoned inbox.
    """
    return User.objects.filter(is_staff=True, is_active=True)


class CanEditSiteCopy(permissions.BasePermission):
    """The desk itself: reading the corpus and proposing changes to it."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return user_can_edit_site_copy(getattr(request, "user", None))


class IsCopyReviewer(permissions.BasePermission):
    """Reviewer mode: accepting, rejecting, and reading the accepted patch."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return user_is_copy_reviewer(getattr(request, "user", None))
