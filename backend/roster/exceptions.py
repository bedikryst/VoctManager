# roster/exceptions.py
# ==========================================
# Roster Domain Exceptions
# ==========================================
"""
Domain-specific exceptions for the Roster module.
Strictly decoupled from HTTP framework logic (DRF).
"""

class RosterDomainException(Exception):
    """Base exception for all Roster domain violations.

    `default_message` backs the API envelope's `detail` when an instance is
    raised without an explicit message; the stable `error_code` is derived from
    the concrete subclass name by the core exception handler.
    """
    default_message = "This roster operation is not allowed."

class ArtistProvisioningException(RosterDomainException):
    pass

class AttendanceValidationException(RosterDomainException):
    pass

class ParticipationException(RosterDomainException):
    """Raised for invalid contractual or financial participation operations."""
    pass

class ProjectException(RosterDomainException):
    """Raised for invalid project lifecycle operations."""
    pass

class CastingValidationException(RosterDomainException):
    """Raised when a piece casting assignment violates domain rules (e.g., non-confirmed participation)."""
    pass