import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _

class LocationCategory(models.TextChoices):
    """
    Defines the standard categories for global choir logistics.
    """
    CONCERT_HALL = "CONCERT_HALL", _("Concert Hall")
    REHEARSAL_ROOM = "REHEARSAL_ROOM", _("Rehearsal Room")
    HOTEL = "HOTEL", _("Hotel")
    AIRPORT = "AIRPORT", _("Airport")
    TRANSIT_STATION = "TRANSIT_STATION", _("Transit Station")
    WORKSPACE = "WORKSPACE", _("Private Workspace")
    OTHER = "OTHER", _("Other")

class Location(models.Model):
    """
    Core entity representing a geographical or logical location.
    
    Architecture Note (Standard SaaS 2026):
    Follows a hybrid approach. It can be strongly linked to a Google Place
    via 'google_place_id' for automatic synchronization, or it can represent 
    a custom/private workspace (e.g., Conductor's living room) requiring manual coordinates.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    name = models.CharField(
        max_length=255, 
        help_text=_("Internal display name, e.g., 'National Philharmonic' or 'Conductor's Room'")
    )
    category = models.CharField(
        max_length=50, 
        choices=LocationCategory.choices,
        db_index=True
    )
    
    # --- Google Maps Platform Integration ---
    google_place_id = models.CharField(
        max_length=512, 
        null=True, 
        blank=True, 
        help_text=_("Unique identifier from Google Places API. Null for private/custom locations.")
    )
    formatted_address = models.TextField(
        help_text=_("Full official address or precise custom description.")
    )
    
    # --- Geolocation Data ---
    latitude = models.DecimalField(
        max_digits=9, 
        decimal_places=6, 
        null=True, 
        blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, 
        decimal_places=6, 
        null=True, 
        blank=True
    )
    
    # --- Timezone & Logistics ---
    timezone = models.CharField(
        max_length=100, 
        default="UTC",
        help_text=_("IANA timezone string, e.g., 'Europe/Warsaw'. Updated via external service.")
    )
    internal_notes = models.TextField(
        blank=True, 
        help_text=_("Internal logistics instructions, e.g., 'Gate code: 1234', 'Backstage entrance'.")
    )
    
    # --- State Management (Soft Delete) ---
    is_active = models.BooleanField(
        default=True,
        help_text=_("Designates whether this location is available for new projects. Use instead of deletion.")
    )
    
    # --- Audit Trail ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "logistics_location"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["category", "is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['google_place_id'],
                condition=models.Q(is_active=True) & models.Q(google_place_id__isnull=False),
                name='unique_active_google_place_id'
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_category_display()})"