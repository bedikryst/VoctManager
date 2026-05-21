import logging
from decimal import Decimal
from uuid import UUID

from django.db import transaction

from .dtos import LocationCreateDTO, LocationUpdateDTO
from .infrastructure.google_maps_client import GoogleMapsClient
from .models import Location

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
        fields_set = dto.model_fields_set
        
        def _to_decimal(val: Decimal | None) -> Decimal | None:
            return Decimal(str(val)) if val is not None else None

        new_latitude = dto.latitude if 'latitude' in fields_set else location.latitude
        new_longitude = dto.longitude if 'longitude' in fields_set else location.longitude

        coordinates_changed = (
            ('latitude' in fields_set or 'longitude' in fields_set)
            and (
                _to_decimal(location.latitude) != _to_decimal(new_latitude)
                or _to_decimal(location.longitude) != _to_decimal(new_longitude)
            )
        )

        resolved_timezone = location.timezone

        # 1. Fetch timezone if coordinates changed (Network call outside DB transaction)
        if coordinates_changed and new_latitude is not None and new_longitude is not None:
            fetched_tz = GoogleMapsClient.get_timezone(float(new_latitude), float(new_longitude))
            if fetched_tz:
                resolved_timezone = fetched_tz
                logger.info(f"Updated timezone to '{fetched_tz}' for location '{location.name}'")

        # 2. Persist changes
        with transaction.atomic():
            update_fields: set[str] = set()

            for field_name in (
                'name',
                'category',
                'formatted_address',
                'google_place_id',
                'latitude',
                'longitude',
                'internal_notes',
                'is_active',
            ):
                if field_name in fields_set:
                    setattr(location, field_name, getattr(dto, field_name))
                    update_fields.add(field_name)

            if coordinates_changed and location.timezone != resolved_timezone:
                location.timezone = resolved_timezone
                update_fields.add('timezone')

            if update_fields:
                update_fields.add('updated_at')
                location.save(update_fields=list(update_fields))

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
