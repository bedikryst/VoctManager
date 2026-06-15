# backend/core/exceptions.py
import logging

from pydantic import ValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from archive.exceptions import ArchiveDomainException
from roster.exceptions import RosterDomainException

logger = logging.getLogger(__name__)

class CoreDomainException(Exception):
    pass

class ProfileUpdateException(CoreDomainException):
    pass

class InvalidCredentialsException(CoreDomainException):
    pass

class EmailAlreadyInUseException(CoreDomainException):
    pass

class InvalidImageException(CoreDomainException):
    """Raised when an uploaded avatar is missing, corrupt, or not a real image."""
    pass


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
            "detail": "The request payload failed structural validation.",
            "instance": request_path,
            "validation_errors": errors
        }
        logger.warning(f"Pydantic Validation Error on {request_path}: {errors}")
        return Response(payload, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    if isinstance(exc, (CoreDomainException, ArchiveDomainException, RosterDomainException)):
        payload = {
            "type": "/errors/domain-rule-violation",
            "title": exc.__class__.__name__,
            "status": status.HTTP_400_BAD_REQUEST,
            "detail": str(exc),
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
            "detail": "An error occurred while processing the request.",
            "instance": request_path,
            "errors": response.data 
        }
        return response

    return None
