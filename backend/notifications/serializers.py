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
    """Validates incoming push device registration payload."""
    registration_token = serializers.CharField(min_length=10)
    device_type = serializers.CharField(default="WEB", max_length=50)

class NotificationPreferenceUpdateSerializer(serializers.Serializer):
    """Validates granular preference update payload."""
    notification_type = serializers.CharField(max_length=50)
    email_enabled = serializers.BooleanField(required=False, allow_null=True)
    push_enabled = serializers.BooleanField(required=False, allow_null=True)
    sms_enabled = serializers.BooleanField(required=False, allow_null=True)