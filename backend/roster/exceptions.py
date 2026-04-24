# roster/exceptions.py
# ==========================================
# Roster Domain Exceptions
# ==========================================
"""
Domain-specific exceptions for the Roster module.
Strictly decoupled from HTTP framework logic (DRF).
"""

class RosterDomainException(Exception):
    """Base exception for all Roster domain violations."""
    pass

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