import logging
from uuid import UUID
from decimal import Decimal
from typing import Optional
from django.db import transaction
from .models import Location
from .dtos import LocationCreateDTO, LocationUpdateDTO
from .infrastructure.google_maps_client import GoogleMapsClient

logger = logging.getLogger(__name__)

class LogisticsService:
    """
    Core business logic for global logistics operations.
    Views/Endpoints must ONLY interact with models through this service.
    """

    @staticmethod
    def create_location(dto: LocationCreateDTO) -> Location:
        """
        Creates a new location and automatically resolves its timezone.
        Network calls are intentionally kept OUTSIDE the database transaction block.
        """
        resolved_timezone = "UTC"
        
        # 1. Fetch timezone (Network HTTP call - outside DB transaction!)
        if dto.latitude is not None and dto.longitude is not None:
            fetched_tz = GoogleMapsClient.get_timezone(float(dto.latitude), float(dto.longitude))
            if fetched_tz:
                resolved_timezone = fetched_tz
                logger.info(f"Auto-resolved timezone '{resolved_timezone}' for location '{dto.name}'")

        # 2. Persist to database (Atomic DB lock starts here)
        with transaction.atomic():
            location = Location.objects.create(
                name=dto.name,
                category=dto.category,
                google_place_id=dto.google_place_id,
                formatted_address=dto.formatted_address,
                latitude=dto.latitude,
                longitude=dto.longitude,
                timezone=resolved_timezone,
                internal_notes=dto.internal_notes
            )
        
        return location

    @staticmethod
    def update_location(location_id: UUID, dto: LocationUpdateDTO) -> Location:
        """
        Updates an existing location. Re-evaluates timezone only if coordinates change.
        """
        location = Location.objects.get(id=location_id)
        
        def _to_decimal(val: Optional[Decimal]) -> Optional[Decimal]:
            return Decimal(str(val)) if val is not None else None

        coordinates_changed = (
            _to_decimal(location.latitude) != _to_decimal(dto.latitude) or 
            _to_decimal(location.longitude) != _to_decimal(dto.longitude)
        )

        resolved_timezone = location.timezone

        # 1. Fetch timezone if coordinates changed (Network call outside DB transaction)
        if coordinates_changed and dto.latitude is not None and dto.longitude is not None:
            fetched_tz = GoogleMapsClient.get_timezone(float(dto.latitude), float(dto.longitude))
            if fetched_tz:
                resolved_timezone = fetched_tz
                logger.info(f"Updated timezone to '{fetched_tz}' for location '{location.name}'")

        # 2. Persist changes
        with transaction.atomic():
            location.name = dto.name
            location.category = dto.category
            location.formatted_address = dto.formatted_address
            location.latitude = dto.latitude
            location.longitude = dto.longitude
            location.internal_notes = dto.internal_notes
            location.is_active = dto.is_active
            location.timezone = resolved_timezone
            location.save()

        return location

    @staticmethod
    def deactivate_location(location_id: UUID) -> Location:
        """
        Soft deletes a location so it cannot be used for new projects.
        """
        with transaction.atomic():
            location = Location.objects.get(id=location_id)
            location.is_active = False
            location.save(update_fields=['is_active', 'updated_at'])
            
        logger.info(f"Deactivated location '{location.name}' (ID: {location.id})")
        return location