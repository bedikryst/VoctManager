from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import UserProfile
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for nested user preferences."""
    class Meta:
        model = UserProfile
        fields = (
            'phone_number', 'language', 'timezone',
            'dietary_preference', 'dietary_notes', 
            'clothing_size', 'shoe_size', 'height_cm', 
            'calendar_token'
        )


class UserMeSerializer(serializers.ModelSerializer):
    """
    Enterprise Aggregated Serializer.
    Combines Auth, Profile (Core) and Artist (Roster) data into a single DTO.
    """
    profile = UserProfileSerializer()
    voice_type = serializers.SerializerMethodField()
    voice_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = (
            'id', 'email', 'first_name', 'last_name', 
            'profile', 'voice_type', 'voice_type_display'
        )
        read_only_fields = ('id', 'email', 'voice_type', 'voice_type_display')

    def get_voice_type(self, obj):
        if hasattr(obj, 'artist_profile'):
            return obj.artist_profile.voice_type
        return None

    def get_voice_type_display(self, obj):
        if hasattr(obj, 'artist_profile'):
            return obj.artist_profile.get_voice_type_display()
        return "N/A"

    def to_representation(self, instance):
        """
        Logic to ensure first_name and last_name are populated from Artist profile 
        if the core User fields are empty.
        """
        data = super().to_representation(instance)
        
        # Fallback to Artist profile names if User names are missing
        if hasattr(instance, 'artist_profile'):
            artist = instance.artist_profile
            if not data['first_name']: data['first_name'] = artist.first_name
            if not data['last_name']: data['last_name'] = artist.last_name
            
            # If phone in profile is empty, use phone from artist
            if not data['profile']['phone_number'] and artist.phone_number:
                data['profile']['phone_number'] = artist.phone_number
        
        return data


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
    
class AccountDeletionSerializer(serializers.Serializer):
    """Strict validation for account deletion requiring re-authentication."""
    password = serializers.CharField(required=True, write_only=True)

class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Enterprise Identity Serializer.
    Explicitly defines email as the primary identification field.
    """
    email = serializers.EmailField()
    password = serializers.CharField(style={'input_type': 'password'})

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'username' in self.fields:
            del self.fields['username']

    def validate(self, attrs):
        attrs[User.USERNAME_FIELD] = attrs.get('email')
        return super().validate(attrs)