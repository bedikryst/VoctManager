from dataclasses import dataclass
from typing import Optional
from decimal import Decimal

@dataclass(frozen=True)
class LocationCreateDTO:
    """
    Immutable DTO for creating a new Location.
    Follows standard SaaS 2026 strict typing validation.
    """
    name: str
    category: str
    formatted_address: str
    google_place_id: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    internal_notes: str = ""

@dataclass(frozen=True)
class LocationUpdateDTO:
    """
    Immutable DTO for updating an existing Location.
    """
    name: str
    category: str
    formatted_address: str
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    internal_notes: str = ""
    is_active: bool = True