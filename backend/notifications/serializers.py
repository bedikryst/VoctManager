# notifications/serializers.py
from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    """
    Enterprise serializer for system notifications.
    Read-only design from the client perspective to prevent payload tampering.
    """
    class Meta:
        model = Notification
        fields = [
            'id', 
            'notification_type', 
            'is_read', 
            'read_at', 
            'metadata', 
            'created_at',
            'level',
        ]
        read_only_fields = fields

class PushDeviceRegisterSerializer(serializers.Serializer):
    """Validates FCM token registration payload (iOS / Android)."""
    registration_token = serializers.CharField(min_length=10)
    device_type = serializers.CharField(default="WEB", max_length=50)


class WebPushSubscribeSerializer(serializers.Serializer):
    """Validates Web Push (VAPID) subscription payload from browser clients."""
    endpoint = serializers.URLField()
    p256dh_key = serializers.CharField(min_length=10)
    auth_key = serializers.CharField(min_length=10)

class NotificationPreferenceUpdateSerializer(serializers.Serializer):
    """Validates granular preference update payload."""
    notification_type = serializers.CharField(max_length=50)
    email_enabled = serializers.BooleanField(required=False, allow_null=True)
    push_enabled = serializers.BooleanField(required=False, allow_null=True)
    sms_enabled = serializers.BooleanField(required=False, allow_null=True)


class SendToArtistSerializer(serializers.Serializer):
    """Validates manager → artist direct message payload."""
    artist_id = serializers.UUIDField()
    title = serializers.CharField(max_length=120)
    message = serializers.CharField(max_length=2000)
    level = serializers.ChoiceField(choices=['INFO', 'WARNING', 'URGENT'], default='INFO')
    cta_url = serializers.URLField(required=False, allow_null=True, allow_blank=True, max_length=500)
    cta_label = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=80)