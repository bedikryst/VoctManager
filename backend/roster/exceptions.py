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

class ActivationResendException(RosterDomainException):
    """Raised when an activation invite cannot be re-sent — the artist has no
    linked authentication account to activate (e.g. it was detached by GDPR
    erasure)."""
    pass

class ArtistEmailConflictException(RosterDomainException):
    """Raised when an artist's new e-mail already belongs to another roster entry
    or another account. Shares the `email_taken` code with provisioning, so the
    client lights up the same inline field error either way."""
    code = "email_taken"
    default_message = "This email is already in use."

class ActivatedEmailChangeException(RosterDomainException):
    """Raised when a manager tries to change the e-mail of a member who has
    already activated. Past activation the address is that person's sign-in
    credential, and moving it from the roster would silently take their account
    away from them — so the change belongs to them, in their own settings. Until
    activation it is only an invitation destination, and correcting a typo there
    is exactly how a lost invite gets rescued."""
    code = "artist_email_locked"
    default_message = (
        "This member has activated their account, so their sign-in address can "
        "only be changed by them, in their own settings."
    )

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