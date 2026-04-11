from rest_framework import serializers
from .models import Location, LocationCategory

class LocationSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for outputting Location data.
    """
    class Meta:
        model = Location
        fields = [
            "id", "name", "category", "google_place_id", 
            "formatted_address", "latitude", "longitude", 
            "timezone", "internal_notes", "is_active", 
            "created_at", "updated_at"
        ]
        read_only_fields = fields

class LocationCreateSerializer(serializers.Serializer):
    """
    Write-only serializer for creating a Location.
    Strictly mapped to LocationCreateDTO.
    """
    name = serializers.CharField(max_length=255)
    category = serializers.ChoiceField(choices=LocationCategory.choices)
    google_place_id = serializers.CharField(max_length=255, required=False, allow_null=True)
    formatted_address = serializers.CharField()
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    internal_notes = serializers.CharField(required=False, allow_blank=True, default="")

class LocationUpdateSerializer(serializers.Serializer):
    """
    Write-only serializer for updating a Location.
    Strictly mapped to LocationUpdateDTO.
    """
    name = serializers.CharField(max_length=255)
    category = serializers.ChoiceField(choices=LocationCategory.choices)
    formatted_address = serializers.CharField()
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    internal_notes = serializers.CharField(required=False, allow_blank=True, default="")
    is_active = serializers.BooleanField(default=True)