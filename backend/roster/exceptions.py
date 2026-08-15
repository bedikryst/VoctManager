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

class ArtistMergeException(RosterDomainException):
    """Raised when two roster rows cannot be folded into one.

    A merge moves a person's whole history — participations, castings,
    attendance, conversations, the podium — and then retires the row it emptied,
    so every refusal here is a case where doing it would destroy something that
    cannot be reconstructed."""
    code = "artist_merge_rejected"
    default_message = "These two roster entries cannot be merged."

class ActivatedArtistMergeException(ArtistMergeException):
    """Raised when the row being absorbed has an activated account.

    A usable password means a human has signed in at that address: retiring the
    row would take their login away without telling them, and choosing which of
    two live accounts survives is an account decision, not a roster cleanup.
    Detach it the other way — merge the row nobody has signed into, or archive
    one account deliberately."""
    code = "artist_merge_activated"
    default_message = (
        "This entry has an activated account, so it cannot be absorbed into "
        "another one. Merge the entry nobody has signed in to."
    )

class AttendanceValidationException(RosterDomainException):
    pass

class ParticipationException(RosterDomainException):
    """Raised for invalid contractual or financial participation operations."""
    pass

class ProjectException(RosterDomainException):
    """Raised for invalid project lifecycle operations."""
    pass

class ProjectAlreadyPublishedException(ProjectException):
    """Raised when publication is attempted on a project that has already left
    DRAFT. Publication is the moment the cast is told the concert exists, so it
    happens exactly once — a second run would re-invite people who have already
    answered. Carries its own code so the client can say so rather than render a
    generic failure."""
    code = "project_already_published"
    default_message = "This project has already been published."

class ProjectUnpublishException(ProjectException):
    """Raised when a live project is sent back to DRAFT. Publication cannot be
    taken back — the cast has read the invitation — so a return to draft would
    only re-open the silence around a concert people are already preparing, and
    would strand whatever is waiting in the announcement queue. Ending a project
    is what CANCELLED is for."""
    code = "project_cannot_unpublish"
    default_message = "A published project cannot be turned back into a draft."

class CastingValidationException(RosterDomainException):
    """Raised when a piece casting assignment violates domain rules (e.g., non-confirmed participation)."""
    pass