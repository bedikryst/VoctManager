# notifications/views.py
import logging
from django.utils import timezone
from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request

from .models import Notification, NotificationPreference, NotificationType, NotificationLevel
from core.constants import AppRole
from .serializers import (
    NotificationSerializer,
    PushDeviceRegisterSerializer,
    WebPushSubscribeSerializer,
    NotificationPreferenceUpdateSerializer,
    SendToArtistSerializer,
)
from .dtos import (
    PushDeviceRegisterDTO,
    WebPushSubscribeDTO,
    NotificationPreferenceUpdateDTO,
    CustomAdminMessageMetadata,
    NotificationReadReceiptMetadata,
    NotificationCreateDTO,
)
from .services import NotificationPreferenceService
from .push_service import PushDispatcherService

logger = logging.getLogger(__name__)

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
        """Marks a specific notification as read. Dispatches read receipt for CUSTOM_ADMIN_MESSAGE."""
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['is_read', 'read_at', 'updated_at'])
            self._dispatch_read_receipt_if_applicable(notification)

        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    def _dispatch_read_receipt_if_applicable(self, notification: Notification) -> None:
        """
        Fires a NOTIFICATION_READ_RECEIPT to the original sender when a
        CUSTOM_ADMIN_MESSAGE is first read. Runs in the background via Celery.
        """
        if notification.notification_type != NotificationType.CUSTOM_ADMIN_MESSAGE:
            return
        meta = notification.metadata or {}
        sender_id = meta.get('sender_id')
        if not sender_id:
            return
        try:
            artist = notification.recipient
            artist_name = getattr(artist, 'get_full_name', lambda: artist.email)()
            receipt_meta = NotificationReadReceiptMetadata(
                artist_name=artist_name or artist.email,
                artist_id=str(artist.id),
                original_title=meta.get('title', ''),
                read_at=notification.read_at.isoformat(),
            )
            dto = NotificationCreateDTO(
                recipient_id=str(sender_id),
                notification_type=NotificationType.NOTIFICATION_READ_RECEIPT,
                level=NotificationLevel.INFO,
                metadata=receipt_meta,
            )
            from .services import NotificationService
            NotificationService.create_notification(dto)
        except Exception as exc:
            logger.error(f"[ReadReceipt] Failed to dispatch receipt for notification {notification.id}: {exc}", exc_info=True)

    @action(detail=False, methods=['post'], url_path='send-to-artist')
    def send_to_artist(self, request: Request) -> Response:
        """
        Manager-only endpoint to dispatch a direct CUSTOM_ADMIN_MESSAGE to a single artist.
        Resolves the artist's linked user account before dispatching.
        """
        user_role = getattr(request.user.profile, 'role', None) if hasattr(request.user, 'profile') else None
        is_manager = (user_role == AppRole.MANAGER) or request.user.is_staff
        if not is_manager:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        serializer = SendToArtistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            from roster.models import Artist
            artist = Artist.objects.select_related('user').get(id=data['artist_id'], is_deleted=False)
        except Artist.DoesNotExist:
            return Response({"detail": "Artist not found."}, status=status.HTTP_404_NOT_FOUND)

        if not artist.user_id:
            return Response({"detail": "Artist has no linked user account."}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        sender_name = request.user.get_full_name() or request.user.email
        meta = CustomAdminMessageMetadata(
            title=data['title'],
            message=data['message'],
            sender_id=str(request.user.id),
            sender_name=sender_name,
            level=data['level'],
            cta_url=data.get('cta_url') or None,
            cta_label=data.get('cta_label') or None,
        )
        dto = NotificationCreateDTO(
            recipient_id=str(artist.user_id),
            notification_type=NotificationType.CUSTOM_ADMIN_MESSAGE,
            level=data['level'],
            metadata=meta,
        )
        from .services import NotificationService
        NotificationService.create_notification(dto)
        return Response({"status": "dispatched"}, status=status.HTTP_201_CREATED)

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
    API endpoints for managing push notification subscriptions.
    Routes between VAPID (web) and FCM (mobile) based on payload shape.
    Strictly delegates business logic to PushDispatcherService.
    """
    permission_classes = [IsAuthenticated]

    def create(self, request: Request) -> Response:
        """
        Registers a push subscription.
        - Web Push (VAPID): payload contains endpoint + p256dh_key + auth_key
        - FCM (mobile): payload contains registration_token + device_type
        """
        if 'endpoint' in request.data:
            serializer = WebPushSubscribeSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            dto = WebPushSubscribeDTO(
                user_id=request.user.id,
                endpoint=serializer.validated_data['endpoint'],
                p256dh_key=serializer.validated_data['p256dh_key'],
                auth_key=serializer.validated_data['auth_key'],
            )
            PushDispatcherService.register_web_push(dto)
        else:
            serializer = PushDeviceRegisterSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            dto = PushDeviceRegisterDTO(
                user_id=request.user.id,
                registration_token=serializer.validated_data['registration_token'],
                device_type=serializer.validated_data.get('device_type', 'WEB'),
            )
            PushDispatcherService.register_device(dto)

        return Response(status=status.HTTP_201_CREATED)

    def destroy(self, request: Request, pk: str = None) -> Response:
        """Unregisters a push subscription. pk is the endpoint URL or FCM token."""
        PushDispatcherService.unregister_device(user_id=request.user.id, token=pk)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def test_push(self, request: Request) -> Response:
        """
        Dispatches a one-shot test notification to all active devices of the
        current user. Used by Settings → Notifications to confirm the
        push pipeline end-to-end (browser permission → SW → backend → device).
        """
        delivered = PushDispatcherService.send_test_push(user=request.user)
        if delivered == 0:
            return Response(
                {"detail": "No active push devices for this user."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response({"delivered": delivered}, status=status.HTTP_200_OK)


class NotificationPreferenceAPIView(views.APIView):
    """
    API endpoint for granular mutation of notification preferences.
    Bound exclusively to the currently authenticated user.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request) -> Response:
        """Returns the current user's notification preferences in a structured format."""
        user_role = getattr(request.user.profile, 'role', None) if hasattr(request.user, 'profile') else None
        is_manager = (user_role == AppRole.MANAGER) or request.user.is_staff

        MANAGER_ONLY = {
            NotificationType.PARTICIPATION_RESPONSE.value,
            NotificationType.ATTENDANCE_SUBMITTED.value,
            NotificationType.ABSENCE_REQUESTED.value,
        }

        DEFAULT_EMAIL_TRUE = {
            NotificationType.PROJECT_INVITATION.value,
            NotificationType.PROJECT_CANCELLED.value,
            NotificationType.REHEARSAL_SCHEDULED.value,
            NotificationType.REHEARSAL_UPDATED.value,
            NotificationType.REHEARSAL_CANCELLED.value,
        }

        DEFAULT_PUSH_FALSE = {
            NotificationType.PIECE_CASTING_ASSIGNED.value,
            NotificationType.CONTRACT_ISSUED.value,
        }

        prefs = {p.notification_type: p for p in NotificationPreference.objects.filter(user=request.user)}
        data = []
        for choice in NotificationType:
            if choice.value in MANAGER_ONLY and not is_manager:
                continue

            pref = prefs.get(choice.value)
            
            default_email = choice.value in DEFAULT_EMAIL_TRUE
            default_push = choice.value not in DEFAULT_PUSH_FALSE

            data.append({
                "notification_type": choice.value,
                "label": str(choice.label),
                "email_enabled": pref.email_enabled if pref else default_email,
                "push_enabled": pref.push_enabled if pref else default_push,
                "sms_enabled": pref.sms_enabled if pref else False,
            })
        return Response(data)
    
    def patch(self, request: Request, notification_type: str = None) -> Response:
        """Updates specific notification channels based on notification_type."""
        data = request.data.copy()
        if notification_type and 'notification_type' not in data:
            data['notification_type'] = notification_type

        serializer = NotificationPreferenceUpdateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        
        dto = NotificationPreferenceUpdateDTO(
            user_id=request.user.id,
            **serializer.validated_data
        )
        
        NotificationPreferenceService.update_preferences(dto)
        return Response(status=status.HTTP_200_OK)