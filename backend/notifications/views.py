# notifications/views.py
import logging

from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from core.permissions import user_is_manager
from core.request_utils import request_user

from .delivery import PREFERENCE_GROUPS, default_channel_preferences
from .dtos import (
    CustomAdminMessageMetadata,
    NotificationCreateDTO,
    NotificationPreferenceUpdateDTO,
    NotificationReadReceiptMetadata,
    PushDeviceRegisterDTO,
    WebPushSubscribeDTO,
)
from .models import Notification, NotificationLevel, NotificationPreference, NotificationType
from .push_service import PushDispatcherService
from .serializers import (
    NotificationPreferenceBulkUpdateSerializer,
    NotificationPreferenceUpdateSerializer,
    NotificationSerializer,
    PushDeviceRegisterSerializer,
    SendToArtistSerializer,
    WebPushSubscribeSerializer,
)
from .services import NotificationPreferenceService

logger = logging.getLogger(__name__)

class NotificationCursorPagination(CursorPagination):
    """Cursor pagination for the bell feed. Keyed on ``-created_at`` so newly
    arriving notifications (the list is polled) never shift offsets and cause a
    skip/duplicate at a page boundary — the failure mode of page-number
    pagination over a live, prepend-heavy feed. The unread badge is served by a
    separate count endpoint, so omitting ``count`` here is intentional."""
    page_size = 20
    ordering = '-created_at'


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows notifications to be viewed and managed by the current user.
    Strictly filters querysets to the authenticated user's scope.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationCursorPagination

    def get_queryset(self):
        """Ensure users can only access their own notifications."""
        return Notification.objects.filter(recipient=request_user(self.request))

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request: Request) -> Response:
        """
        Counts for the top-bar bell. `unread_count` is the true per-item unread
        total (drives the in-panel header + "mark all read"). `new_count` is the
        "new since last seen" subset that drives the badge — it clears when the
        user opens the centre (see `mark-seen`) without touching read state.
        """
        unread_qs = self.get_queryset().filter(is_read=False)
        profile = getattr(request.user, 'profile', None)
        seen_at = getattr(profile, 'notifications_seen_at', None)
        new_qs = unread_qs.filter(created_at__gt=seen_at) if seen_at else unread_qs
        return Response(
            {"unread_count": unread_qs.count(), "new_count": new_qs.count()},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='mark-seen')
    def mark_seen(self, request: Request) -> Response:
        """
        Clears the "new since seen" bell badge by stamping the user's last-seen
        time. Deliberately does NOT mark notifications read — per-item read state
        is untouched, so the act-now signal and invitation resurfacing survive.
        """
        profile = getattr(request.user, 'profile', None)
        if profile is not None:
            profile.notifications_seen_at = timezone.now()
            profile.save(update_fields=['notifications_seen_at', 'updated_at'])
        return Response({"status": "seen"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='mark-read')
    def mark_read(self, request: Request, pk: str) -> Response:
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
                read_at=(notification.read_at or timezone.now()).isoformat(),
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
        if not user_is_manager(request.user):
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

        sender = request_user(request)
        sender_name = sender.get_full_name() or sender.email
        meta = CustomAdminMessageMetadata(
            title=data['title'],
            message=data['message'],
            sender_id=str(sender.id),
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
        user_id = request_user(request).id
        if 'endpoint' in request.data:
            web_serializer = WebPushSubscribeSerializer(data=request.data)
            web_serializer.is_valid(raise_exception=True)
            web_dto = WebPushSubscribeDTO(
                user_id=user_id,
                endpoint=web_serializer.validated_data['endpoint'],
                p256dh_key=web_serializer.validated_data['p256dh_key'],
                auth_key=web_serializer.validated_data['auth_key'],
            )
            PushDispatcherService.register_web_push(web_dto)
        else:
            fcm_serializer = PushDeviceRegisterSerializer(data=request.data)
            fcm_serializer.is_valid(raise_exception=True)
            fcm_dto = PushDeviceRegisterDTO(
                user_id=user_id,
                registration_token=fcm_serializer.validated_data['registration_token'],
                device_type=fcm_serializer.validated_data.get('device_type', 'WEB'),
            )
            PushDispatcherService.register_device(fcm_dto)

        return Response(status=status.HTTP_201_CREATED)

    def destroy(self, request: Request, pk: str) -> Response:
        """Unregisters a push subscription. pk is the endpoint URL or FCM token."""
        PushDispatcherService.unregister_device(user_id=str(request_user(request).id), token=pk)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def test_push(self, request: Request) -> Response:
        """
        Dispatches a one-shot test notification to all active devices of the
        current user. Used by Settings → Notifications to confirm the
        push pipeline end-to-end (browser permission → SW → backend → device).

        The two ways this fails are answered apart, because they ask different
        things of the caller: nothing registered (409 — the browser holds a
        subscription this account no longer has a row for, which re-subscribing
        fixes) versus registered and refused (502 — the push service rejected
        every send, which nothing in the UI can fix). `reason` carries that
        distinction to the client; `detail` stays a developer-facing string.
        """
        outcome = PushDispatcherService.send_test_push(user=request.user)
        if outcome.devices == 0:
            return Response(
                {"detail": "No active push devices for this user.", "reason": "no_devices"},
                status=status.HTTP_409_CONFLICT,
            )
        if outcome.delivered == 0:
            return Response(
                {
                    "detail": "Every registered device rejected the push.",
                    "reason": "undeliverable",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"delivered": outcome.delivered}, status=status.HTTP_200_OK)


class NotificationPreferenceAPIView(views.APIView):
    """
    API endpoint for granular mutation of notification preferences.
    Bound exclusively to the currently authenticated user.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request: Request) -> Response:
        """The settings ledger: the reader's groups, and the rows behind each one.

        A projection of ``notifications.delivery`` and nothing else — the group
        map, the visibility rules and the recommended baseline all live there, so
        the ledger cannot state a policy the router does not apply.

        Groups come in render order and carry the recommendation their single
        control targets. The rows stay a flat list keyed by type — that is still
        the storage granularity, and the "Szczegóły" disclosure writes at exactly
        that grain.
        """
        is_manager = user_is_manager(request.user)
        stored = {
            pref.notification_type: pref
            for pref in NotificationPreference.objects.filter(user=request_user(request))
        }

        groups: list[dict[str, object]] = []
        rows: list[dict[str, object]] = []

        # Every member of a group is visible by construction: a group *is* a
        # control, so the hidden types are exactly the ungrouped ones and the
        # boot-time coherence assert refuses any overlap. Filtering here again
        # would only cast doubt on an invariant that is already enforced.
        is_staff = bool(getattr(request.user, 'is_staff', False))

        for group in PREFERENCE_GROUPS:
            if group.manager_only and not is_manager:
                continue
            # A narrower audience than manager: the copy desk's reviewer is
            # whoever commits an accepted proposal, so every other manager would
            # be shown a switch over a notification they cannot receive.
            if group.staff_only and not is_staff:
                continue

            groups.append({
                "id": group.id,
                "manager_only": group.manager_only,
                # Every group has a control, and it may only promise what all of
                # its members share — which is what makes these the same values
                # each of its rows carries below.
                "recommended_email": group.email,
                "recommended_push": group.push,
            })

            for ntype in group.types:
                pref = stored.get(ntype)
                defaults = default_channel_preferences(ntype)
                # `recommended_*` carries the shared default contract to the client
                # so the settings UI can flag below-recommended rows and offer
                # Restore-recommended without re-deriving (and drifting from) it.
                rows.append({
                    "notification_type": ntype,
                    "group": group.id,
                    "label": str(NotificationType(ntype).label),
                    "email_enabled": pref.email_enabled if pref else defaults["email_enabled"],
                    "push_enabled": pref.push_enabled if pref else defaults["push_enabled"],
                    "recommended_email": defaults["email_enabled"],
                    "recommended_push": defaults["push_enabled"],
                })

        return Response({"groups": groups, "preferences": rows})
    
    def patch(self, request: Request, notification_type: str | None = None) -> Response:
        """Updates specific notification channels based on notification_type."""
        data = request.data.copy()
        if notification_type and 'notification_type' not in data:
            data['notification_type'] = notification_type

        serializer = NotificationPreferenceUpdateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        
        dto = NotificationPreferenceUpdateDTO(
            user_id=request_user(request).id,
            **serializer.validated_data
        )
        
        NotificationPreferenceService.update_preferences(dto)
        return Response(status=status.HTTP_200_OK)

    def put(self, request: Request) -> Response:
        """Applies a set of preference updates atomically (Restore-recommended)."""
        serializer = NotificationPreferenceBulkUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        NotificationPreferenceService.bulk_update_preferences(
            user_id=request_user(request).id,
            items=serializer.validated_data["preferences"],
        )
        return Response(status=status.HTTP_200_OK)
