"""File type detection adapter for upload validation."""


class FileTypeDetectionUnavailableError(RuntimeError):
    """Raised when libmagic is not installed on the host operating system."""


def detect_mime_from_buffer(buffer: bytes) -> str:
    try:
        import magic
    except (ImportError, OSError) as exc:
        raise FileTypeDetectionUnavailableError(
            "libmagic is not available. Install the host-level file type detection library."
        ) from exc

    return magic.from_buffer(buffer, mime=True)
