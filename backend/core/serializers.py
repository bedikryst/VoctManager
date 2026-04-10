# core/serializers.py
# ==========================================
# Core Serializers & Field-Level Security
# Standard: Enterprise SaaS 2026
# ==========================================
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import UserProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for nested user preferences and enterprise RBAC parameters.
    Implements Field-Level Security (FLS) to prevent privilege escalation via PATCH/PUT.
    """
    # Computed RBAC flags for frontend routing and UI rendering
    is_manager = serializers.BooleanField(read_only=True)
    is_artist = serializers.BooleanField(read_only=True)
    is_crew = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserProfile
        fields = (
            # RBAC Identity
            'role', 'is_manager', 'is_artist', 'is_crew',
            
            # Preferences
            'phone_number', 'language', 'timezone',
            'dietary_preference', 'dietary_notes', 
            'clothing_size', 'shoe_size', 'height_cm', 
            
            # Integrations
            'calendar_token'
        )
        # Critical Security: Users cannot escalate their own role or spoof tokens
        read_only_fields = ('role', 'calendar_token')


class UserMeSerializer(serializers.ModelSerializer):
    """
    Enterprise Aggregated Serializer.
    Combines core Auth Identity, Profile preferences, and Artist domain data into a single DTO.
    """
    profile = UserProfileSerializer(read_only=True)
    voice_type = serializers.SerializerMethodField()
    voice_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = (
            'id', 'email', 'first_name', 'last_name', 
            'profile', 'voice_type', 'voice_type_display'
        )
        read_only_fields = ('id', 'email', 'voice_type', 'voice_type_display')

    def get_voice_type(self, obj) -> str | None:
        """Safely resolves the domain-specific voice type."""
        artist_profile = getattr(obj, 'artist_profile', None)
        return artist_profile.voice_type if artist_profile else None

    def get_voice_type_display(self, obj) -> str:
        """Resolves the human-readable translation for the voice type."""
        artist_profile = getattr(obj, 'artist_profile', None)
        return artist_profile.get_voice_type_display() if artist_profile else "N/A"

    def to_representation(self, instance):
        """
        Data aggregation layer. Fallbacks to Artist profile details if core User identity is sparse.
        """
        data = super().to_representation(instance)
        
        # Fallback to Artist profile names if core User names are missing
        artist = getattr(instance, 'artist_profile', None)
        if artist:
            if not data.get('first_name'): 
                data['first_name'] = artist.first_name
            if not data.get('last_name'): 
                data['last_name'] = artist.last_name
            
            # Phone fallback strategy
            profile_data = data.get('profile', {})
            if profile_data and not profile_data.get('phone_number') and artist.phone_number:
                data['profile']['phone_number'] = artist.phone_number
                
        return data


class ChangePasswordSerializer(serializers.Serializer):
    """Strict validation for password changes enforcing current security policies."""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_new_password(self, value: str) -> str:
        validate_password(value)
        return value


class RequestEmailChangeSerializer(serializers.Serializer):
    """Validates the initiation of an email change process."""
    new_email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate_new_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value


class AccountDeletionSerializer(serializers.Serializer):
    """Strict validation for account deletion requiring re-authentication."""
    password = serializers.CharField(required=True, write_only=True)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Enterprise Identity Serializer.
    Explicitly defines email as the primary identification field for JWT generation.
    """
    email = serializers.EmailField()
    password = serializers.CharField(style={'input_type': 'password'}, write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'username' in self.fields:
            del self.fields['username']

    def validate(self, attrs: dict) -> dict:
        # Standardize email representation before payload generation
        attrs[User.USERNAME_FIELD] = attrs.get('email')
        return super().validate(attrs)