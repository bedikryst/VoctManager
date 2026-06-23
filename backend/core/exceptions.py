# backend/core/exceptions.py
import logging
import re

from pydantic import ValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from archive.exceptions import ArchiveDomainException
from roster.exceptions import RosterDomainException

logger = logging.getLogger(__name__)


class CoreDomainException(Exception):
    """Base for core domain-rule violations.

    Carries a stable machine ``code`` (snake_case) and a human
    ``default_message`` so the API envelope can always expose both: the client
    maps ``code`` to curated, localized copy and falls back to ``detail``.
    Intentionally does *not* override ``__init__``/``__str__`` — callers that
    read ``str(exc)`` keep their existing behaviour.
    """

    code = "domain_error"
    default_message = "This action is not allowed."


class ProfileUpdateException(CoreDomainException):
    code = "profile_update_failed"
    default_message = "Could not update the profile."


class InvalidCredentialsException(CoreDomainException):
    code = "invalid_credentials"
    default_message = "Invalid credentials."


class EmailAlreadyInUseException(CoreDomainException):
    code = "email_taken"
    default_message = "This email is already in use."


class InvalidImageException(CoreDomainException):
    """Raised when an uploaded avatar is missing, corrupt, or not a real image."""

    code = "invalid_image"
    default_message = "The uploaded file is not a valid image."


# HTTP statuses → stable snake_case codes the frontend can branch on without
# parsing prose. Anything unmapped falls back to ``http_<status>``.
_HTTP_CODE_MAP = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    406: "not_acceptable",
    409: "conflict",
    415: "unsupported_media_type",
    429: "rate_limited",
    500: "server_error",
    502: "bad_gateway",
    503: "service_unavailable",
}

_FIRST_CAP_RE = re.compile(r"(.)([A-Z][a-z]+)")
_ALL_CAP_RE = re.compile(r"([a-z0-9])([A-Z])")


def _snake_case(name: str) -> str:
    """`EmailAlreadyInUseException` -> `email_already_in_use`."""
    intermediate = _FIRST_CAP_RE.sub(r"\1_\2", name)
    snake = _ALL_CAP_RE.sub(r"\1_\2", intermediate).lower()
    return snake.removesuffix("_exception")


def _domain_error_code(exc: Exception) -> str:
    """Stable code for a domain exception: explicit ``code`` attr, else derived
    from the class name."""
    code = getattr(exc, "code", None)
    if isinstance(code, str) and code:
        return code
    return _snake_case(type(exc).__name__) or "domain_error"


def _http_error_code(status_code: int) -> str:
    return _HTTP_CODE_MAP.get(status_code, f"http_{status_code}")


def format_pydantic_validation_errors(exc: ValidationError) -> list[dict[str, str]]:
    """Returns client-safe Pydantic errors without echoing submitted values."""
    errors: list[dict[str, str]] = []
    for error in exc.errors(include_url=False, include_input=False, include_context=False):
        field = ".".join(str(loc) for loc in error.get("loc", []))
        errors.append({
            "field": field,
            "message": str(error.get("msg", "")),
            "type": str(error.get("type", "")),
        })
    return errors


def enterprise_exception_handler(exc, context) -> Response | None:
    request_path = context['request'].path

    if isinstance(exc, ValidationError):
        errors = format_pydantic_validation_errors(exc)

        payload = {
            "type": "/errors/unprocessable-entity",
            "title": "Validation Error",
            "status": status.HTTP_422_UNPROCESSABLE_ENTITY,
            "error_code": "validation_error",
            "detail": "The request payload failed structural validation.",
            "instance": request_path,
            "validation_errors": errors
        }
        logger.warning(f"Pydantic Validation Error on {request_path}: {errors}")
        return Response(payload, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    if isinstance(exc, (CoreDomainException, ArchiveDomainException, RosterDomainException)):
        # `str(exc)` is the caller's message; fall back to the class default so
        # `detail` is never empty (a stable, message-less domain error still
        # reads as a sentence on the client).
        detail = str(exc) or getattr(exc, "default_message", "") or "This action is not allowed."
        payload = {
            "type": "/errors/domain-rule-violation",
            "title": exc.__class__.__name__,
            "status": status.HTTP_400_BAD_REQUEST,
            "error_code": _domain_error_code(exc),
            "detail": detail,
            "instance": request_path
        }
        logger.warning(f"Domain Rule Broken on {request_path}: {exc!s}")
        return Response(payload, status=status.HTTP_400_BAD_REQUEST)

    response = exception_handler(exc, context)
    if response is not None:
        title_map = {
            401: "Unauthorized",
            403: "Forbidden",
            404: "Not Found",
            429: "Too Many Requests"
        }
        title = title_map.get(response.status_code, "API Error")

        response.data = {
            "type": f"/errors/http-{response.status_code}",
            "title": title,
            "status": response.status_code,
            "error_code": _http_error_code(response.status_code),
            "detail": "An error occurred while processing the request.",
            "instance": request_path,
            "errors": response.data
        }
        return response

    return None
