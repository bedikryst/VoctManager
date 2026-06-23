# archive/exceptions.py
# ==========================================
# Archive Domain Exceptions
# ==========================================
"""
Domain-specific exceptions for the Archive module.
Strictly decoupled from HTTP framework logic (DRF).
"""

class ArchiveDomainException(Exception):
    """Base exception for all Archive domain violations.

    `default_message` backs the API envelope's `detail` when an instance is
    raised without an explicit message; the stable `error_code` is derived from
    the concrete subclass name by the core exception handler.
    """
    default_message = "This archive operation is not allowed."

class PieceValidationException(ArchiveDomainException):
    """Raised when musical piece domain rules are violated."""
    pass

class TrackProcessingException(ArchiveDomainException):
    """Raised when audio track operations fail."""
    pass