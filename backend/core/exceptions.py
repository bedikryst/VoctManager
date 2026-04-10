# core/exceptions.py
# ==========================================
# Core Exceptions & Global Exception Handler
# Standard: Enterprise SaaS 2026 (RFC 7807)
# ==========================================
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from pydantic import ValidationError

from archive.exceptions import ArchiveDomainException
from roster.exceptions import RosterDomainException

logger = logging.getLogger(__name__)


# --- DOMAIN EXCEPTIONS ---

class CoreDomainException(Exception):
    """Base exception for all Core domain violations."""
    pass

class ProfileUpdateException(CoreDomainException):
    """Raised when profile update validation fails at the business logic level."""
    pass

class InvalidCredentialsException(CoreDomainException):
    """Raised when authentication verification fails (e.g., wrong current password)."""
    pass

class EmailAlreadyInUseException(CoreDomainException):
    """Raised when an attempt is made to claim an already registered email."""
    pass


# --- GLOBAL HANDLER ---

def enterprise_exception_handler(exc, context) -> Response | None:
    """
    Enterprise Global Exception Handler.
    Intercepts Pydantic, DRF, and Domain exceptions and formats them into RFC 7807.
    """
    request_path = context['request'].path

    # 1. Pydantic Validation Errors (DTO writes)
    if isinstance(exc, ValidationError):
        errors = []
        for error in exc.errors():
            field = ".".join([str(loc) for loc in error.get("loc", [])])
            errors.append({
                "field": field,
                "message": error.get("msg"),
                "type": error.get("type")
            })
            
        payload = {
            "type": "https://api.voctmanager.com/errors/unprocessable-entity",
            "title": "Validation Error",
            "status": status.HTTP_422_UNPROCESSABLE_ENTITY,
            "detail": "The request payload failed structural validation.",
            "instance": request_path,
            "validation_errors": errors
        }
        logger.warning(f"Pydantic Validation Error on {request_path}: {errors}")
        return Response(payload, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    # 2. Domain Logic Violations (Core, Roster, Archive)
    if isinstance(exc, (CoreDomainException, ArchiveDomainException, RosterDomainException)):
        payload = {
            "type": "https://api.voctmanager.com/errors/domain-rule-violation",
            "title": exc.__class__.__name__,
            "status": status.HTTP_400_BAD_REQUEST,
            "detail": str(exc),
            "instance": request_path
        }
        logger.warning(f"Domain Rule Broken on {request_path}: {str(exc)}")
        return Response(payload, status=status.HTTP_400_BAD_REQUEST)

    # 3. Standard DRF Exceptions (e.g., 401 Unauthorized, 403 Forbidden, 404 Not Found)
    response = exception_handler(exc, context)
    if response is not None:
        # Dynamic title based on HTTP status code
        title_map = {
            401: "Unauthorized",
            403: "Forbidden",
            404: "Not Found",
            429: "Too Many Requests"
        }
        title = title_map.get(response.status_code, "API Error")
        
        response.data = {
            "type": f"https://api.voctmanager.com/errors/http-{response.status_code}",
            "title": title,
            "status": response.status_code,
            "detail": "An error occurred while processing the request.",
            "instance": request_path,
            "errors": response.data # Zachowujemy oryginalne dane DRF (np. szczegóły z throttlingu)
        }
        return response

    # 4. Unhandled Server Exceptions (500) will bypass this and be handled by Django's default 500 handler
    return None