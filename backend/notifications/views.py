# notifications/views.py
from django.utils import timezone
from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request

from .models import Notification
from .serializers import (
    NotificationSerializer,
    PushDeviceRegisterSerializer,
    NotificationPreferenceUpdateSerializer
)
from .dtos import PushDeviceRegisterDTO, NotificationPreferenceUpdateDTO
from .services import PushDispatcherService, NotificationPreferenceService

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows notifications to be viewed and managed by the current user.
    Strictly filters querysets to the authenticated user's scope.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Ensure users can only access their own notifications."""
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request: Request) -> Response:
        """
        Highly optimized endpoint for the top-bar bell icon.
        Returns just the integer count to minimize payload size.
        """
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"unread_count": count}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='mark-read')
    def mark_read(self, request: Request, pk: str = None) -> Response:
        """Marks a specific notification as read."""
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['is_read', 'read_at', 'updated_at'])
        
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request: Request) -> Response:
        """Bulk action to clear the notification center."""
        self.get_queryset().filter(is_read=False).update(
            is_read=True, 
            read_at=timezone.now(),
            updated_at=timezone.now()
        )
        return Response({"status": "All notifications marked as read."}, status=status.HTTP_200_OK)


class PushDeviceViewSet(viewsets.ViewSet):
    """
    API endpoints for managing push notification devices.
    Strictly delegates business logic to PushDispatcherService.
    """
    permission_classes = [IsAuthenticated]

    def create(self, request: Request) -> Response:
        """Registers a new push notification token."""
        serializer = PushDeviceRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        dto = PushDeviceRegisterDTO(
            user_id=request.user.id,
            registration_token=serializer.validated_data['registration_token'],
            device_type=serializer.validated_data.get('device_type', 'WEB')
        )
        
        PushDispatcherService.register_device(dto)
        return Response(status=status.HTTP_201_CREATED)

    def destroy(self, request: Request, pk: str = None) -> Response:
        """
        Unregisters a push token. The token string is passed as the primary key.
        """
        PushDispatcherService.unregister_device(user_id=request.user.id, token=pk)
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationPreferenceAPIView(views.APIView):
    """
    API endpoint for granular mutation of notification preferences.
    Bound exclusively to the currently authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request) -> Response:
        """Updates specific notification channels based on notification_type."""
        serializer = NotificationPreferenceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        dto = NotificationPreferenceUpdateDTO(
            user_id=request.user.id,
            **serializer.validated_data
        )
        
        NotificationPreferenceService.update_preferences(dto)
        return Response(status=status.HTTP_200_OK)