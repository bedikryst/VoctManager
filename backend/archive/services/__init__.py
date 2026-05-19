"""
Archive services package.

Re-exports `ArchiveManagementService` so the existing import pattern in
`archive.views` (`from . import services; services.ArchiveManagementService.X`)
keeps working after the file `services.py` was promoted to a package.
"""

from archive.services.management import ArchiveManagementService

__all__ = ['ArchiveManagementService']
