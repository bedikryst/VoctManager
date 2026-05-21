# core/request_utils.py
# ==========================================
# Typed helpers for DRF request objects
# Standard: Enterprise SaaS 2026
# ==========================================
from typing import TYPE_CHECKING, cast

from rest_framework.request import Request

if TYPE_CHECKING:
    from django.contrib.auth.models import User


def request_user(request: Request) -> "User":
    """
    Returns ``request.user`` narrowed to the concrete user model.

    Call sites must be guarded by ``IsAuthenticated`` (or an equivalent permission),
    so DRF's ``User | AnonymousUser`` typing can only ever resolve to the authenticated
    arm here. The cast records that invariant for the type checker without introducing a
    runtime branch.
    """
    return cast("User", request.user)
