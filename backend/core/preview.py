# core/preview.py
# ==========================================
# Manager-side preview of a member's own view
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
from typing import TYPE_CHECKING, NamedTuple
from uuid import UUID

from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, PermissionDenied
from rest_framework.request import Request

from core.permissions import user_is_manager
from core.request_utils import request_user

if TYPE_CHECKING:
    from django.contrib.auth.models import User

logger = logging.getLogger(__name__)

# The manager names the member whose view they are asking about. Deliberately a
# query parameter and not a header: it belongs to the URL that produced the
# answer, so it is visible in logs, cannot be attached globally by a client-side
# interceptor, and gives the frontend cache a key that varies with it.
PREVIEW_QUERY_PARAM = 'artist'


class PreviewUnavailable(APIException):
    """409 raised when the named member exists but has no view to show."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = _("This member has no account yet, so there is nothing to preview.")
    default_code = 'preview_unavailable'


class PreviewTarget(NamedTuple):
    """Whose view is being read, and whether that is somebody other than the caller."""

    user: "User"
    is_preview: bool


def resolve_preview_target(request: Request) -> PreviewTarget:
    """
    The user whose artist-facing view this request is asking about.

    Without the parameter, the caller's own — every artist-facing read-model goes
    on working exactly as before. With it, the named member's, and only for a
    manager. This is the one gate the whole preview passes through: a second
    endpoint answering on looser terms is how a person ends up reading somebody
    else's schedule from a URL they guessed.

    Refuses rather than falling back, in every failure mode. A non-manager naming
    somebody else gets 403 and not their own timeline under a stranger's name — a
    silent substitution is a lie the caller has no way to detect. A member who
    never activated an account gets 409 rather than an empty view, because "they
    see nothing yet" is the true answer and an empty page does not say it.

    Only read-models honour the parameter; no write path reads it, so a preview
    cannot produce a write.
    """
    raw = request.query_params.get(PREVIEW_QUERY_PARAM)
    if not raw:
        return PreviewTarget(request_user(request), False)

    if not user_is_manager(request.user):
        raise PermissionDenied(_("Only a manager may look at another member's view."))

    # Local import: `roster` imports `core`, and this module is reached only from
    # view code, so keeping the dependency inside the call avoids inverting that
    # direction at import time.
    from roster.models import Artist

    try:
        artist_id = UUID(raw)
    except ValueError:
        raise NotFound(_("No such member.")) from None

    artist = Artist.objects.filter(pk=artist_id).select_related('user').first()
    if artist is None:
        raise NotFound(_("No such member."))
    if not artist.is_active:
        raise PreviewUnavailable(
            _("This member is archived, so they have no current view.")
        )
    if artist.user is None:
        raise PreviewUnavailable()

    # The audit trail for the feature. Nothing here is new exposure — a manager
    # reaches all of it through the manager surfaces already, and the one thing
    # that would have been (practice readiness) is withheld — but who looked at
    # whose view is worth being able to answer later.
    logger.info(
        "artist_preview: actor=%s target_artist=%s path=%s",
        request.user.pk,
        artist.pk,
        request.path,
    )
    return PreviewTarget(artist.user, True)
