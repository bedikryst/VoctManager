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