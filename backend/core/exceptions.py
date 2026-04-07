# core/exceptions.py
from rest_framework.views import exception_handler
from rest_framework.response import Response
from archive.exceptions import ArchiveDomainException
from roster.exceptions import RosterDomainException

def enterprise_exception_handler(exc, context) -> Response | None:
    response = exception_handler(exc, context)

    if response is not None:
        response.data = {
            "type": "https://api.voctmanager.com/errors/validation",
            "title": "Validation Error",
            "status": response.status_code,
            "detail": "Provided payload violates business rules.",
            "errors": response.data
        }
        return response

    if isinstance(exc, (ArchiveDomainException, RosterDomainException)):
        return Response({
            "type": "https://api.voctmanager.com/errors/domain_rule_violation",
            "title": exc.__class__.__name__,
            "status": 400,
            "detail": str(exc)
        }, status=400)

    return None