from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import UserProfile

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for nested user preferences."""
    class Meta:
        model = UserProfile
        fields = ('phone_number', 'language', 'timezone')


class UserMeSerializer(serializers.ModelSerializer):
    """
    Aggregated view of the current authenticated user, combining Auth data 
    with their specific Profile preferences.
    """
    profile = UserProfileSerializer()
    
    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'profile')
        read_only_fields = ('id', 'email') # Email is changed via dedicated endpoint

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        
        # Update core user fields (first_name, last_name)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update or create nested profile
        if profile_data:
            UserProfile.objects.update_or_create(
                user=instance, 
                defaults=profile_data
            )
            
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    """Strict validation for password changes enforcing current security policies."""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class RequestEmailChangeSerializer(serializers.Serializer):
    """Validates the initiation of an email change process."""
    new_email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate_new_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value