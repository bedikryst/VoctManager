# archive/exceptions.py
# ==========================================
# Archive Domain Exceptions
# ==========================================
"""
Domain-specific exceptions for the Archive module.
Strictly decoupled from HTTP framework logic (DRF).
"""

class ArchiveDomainException(Exception):
    """Base exception for all Archive domain violations."""
    pass

class PieceValidationException(ArchiveDomainException):
    """Raised when musical piece domain rules are violated."""
    pass

class TrackProcessingException(ArchiveDomainException):
    """Raised when audio track operations fail."""
    pass