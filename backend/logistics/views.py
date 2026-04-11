from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Location
from .serializers import (
    LocationSerializer, 
    LocationCreateSerializer, 
    LocationUpdateSerializer
)
from .dtos import LocationCreateDTO, LocationUpdateDTO
from .services import LogisticsService

class LocationViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing logistics locations.
    Enforces Service Layer architecture.
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Admin can potentially see all, but for general logistics we filter active
        return Location.objects.filter(is_active=True)

    def get_serializer_class(self):
        if self.action == 'create':
            return LocationCreateSerializer
        if self.action in ['update', 'partial_update']:
            return LocationUpdateSerializer
        return LocationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        dto = LocationCreateDTO(**serializer.validated_data)
        location = LogisticsService.create_location(dto)
        
        output_serializer = LocationSerializer(location)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        dto = LocationUpdateDTO(**serializer.validated_data)
        location = LogisticsService.update_location(instance.id, dto)

        output_serializer = LocationSerializer(location)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete implementation. Does not remove record from DB.
        """
        instance = self.get_object()
        
        # We reuse update to set is_active to False
        dto = LocationUpdateDTO(
            name=instance.name,
            category=instance.category,
            formatted_address=instance.formatted_address,
            latitude=instance.latitude,
            longitude=instance.longitude,
            internal_notes=instance.internal_notes,
            is_active=False
        )
        LogisticsService.update_location(instance.id, dto)
        
        return Response(status=status.HTTP_204_NO_CONTENT)