# core/request_utils.py
# ==========================================
# Typed helpers for DRF request objects
# Standard: Enterprise SaaS 2026
# ==========================================
from collections.abc import Collection, Mapping
from typing import TYPE_CHECKING, Any, cast

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


def client_payload(
    source: object, *, only: Collection[str] | None = None
) -> dict[str, Any]:
    """
    The client's half of a DTO payload: always a mapping, and — where ``only`` is
    given — only the fields the client is allowed to name.

    Splatting ``request.data`` straight into a DTO has two failure modes a
    stranger can reach with one curl. A body that is not a JSON object (an array,
    a bare string) raises ``TypeError: argument after ** must be a mapping``
    before any validator runs, which surfaces as a 500 where a 400 belongs. And
    where the view supplies arguments of its own beside the payload
    (``requesting_user_id``, ``is_manager`` — the values that decide *who is
    asking*), a caller naming one of them raises on the duplicate keyword. Neither
    is exploitable, because nothing is written either way; both are crashes.

    Unpacking semantics are preserved exactly, including the form-encoded case: a
    ``QueryDict`` splats to lists, and a DTO refusing a list is the same 400 it
    has always been.
    """
    if not isinstance(source, Mapping):
        return {}
    payload: dict[str, Any] = {**source}
    if only is None:
        return payload
    return {key: value for key, value in payload.items() if key in only}
