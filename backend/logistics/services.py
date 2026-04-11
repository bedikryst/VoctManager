import logging
from uuid import UUID
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
    @transaction.atomic
    def create_location(dto: LocationCreateDTO) -> Location:
        """
        Creates a new location and automatically resolves its timezone 
        if valid coordinates are provided via Google Time Zone API.
        """
        resolved_timezone = "UTC"  # Safe default
        
        # 1. Attempt to auto-resolve timezone if coordinates exist
        if dto.latitude is not None and dto.longitude is not None:
            fetched_tz = GoogleMapsClient.get_timezone(float(dto.latitude), float(dto.longitude))
            if fetched_tz:
                resolved_timezone = fetched_tz
                logger.info(f"Auto-resolved timezone '{resolved_timezone}' for location '{dto.name}'")

        # 2. Persist to database
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
    @transaction.atomic
    def update_location(location_id: UUID, dto: LocationUpdateDTO) -> Location:
        """
        Updates an existing location. Re-evaluates timezone only if coordinates change.
        """
        location = Location.objects.get(id=location_id)
        
        # Check if coordinates changed and require a new timezone lookup
        coordinates_changed = (
            location.latitude != dto.latitude or 
            location.longitude != dto.longitude
        )

        location.name = dto.name
        location.category = dto.category
        location.formatted_address = dto.formatted_address
        location.latitude = dto.latitude
        location.longitude = dto.longitude
        location.internal_notes = dto.internal_notes
        location.is_active = dto.is_active

        if coordinates_changed and dto.latitude is not None and dto.longitude is not None:
            fetched_tz = GoogleMapsClient.get_timezone(float(dto.latitude), float(dto.longitude))
            if fetched_tz:
                location.timezone = fetched_tz
                logger.info(f"Updated timezone to '{fetched_tz}' for location '{location.name}'")

        location.save()
        return location