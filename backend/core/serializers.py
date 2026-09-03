# core/serializers.py
# ==========================================
# Core Serializers & Field-Level Security
# Standard: Enterprise SaaS 2026
# ==========================================
import zoneinfo
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import FeedbackReport, UserProfile

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

    # Profile picture renders (absolute URLs; null when no avatar is set)
    avatar_url = serializers.SerializerMethodField()
    avatar_thumb_url = serializers.SerializerMethodField()

    # The EFFECTIVE capability, not the column. The desk admits staff whatever
    # the flag says (`user_can_edit_site_copy`), so reporting the raw boolean
    # would hide the door from exactly the account that built it: a developer
    # who never set the flag on themselves sees no way in and full access
    # behind the URL. One predicate, asked once, answered the same on both
    # sides.
    can_edit_site_copy = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            # RBAC Identity
            'role', 'is_manager', 'is_artist', 'is_crew',

            # Presence
            'avatar_url', 'avatar_thumb_url',

            # Preferences
            'phone_number', 'language', 'timezone', 'salutation',
            'clothing_size', 'shoe_size', 'height_cm',

            # Notification delivery. `email_notifications_enabled` is the master
            # switch over every operational e-mail, sitting above the per-type
            # ledger; it is writable so the settings tab can both take the offer
            # to mute e-mail and — the part that matters — undo it. Before it was
            # exposed, an ESP unsubscribe left a member opted out with no way back
            # inside the app.
            'digest_enabled', 'digest_hour', 'email_notifications_enabled',

            # Onboarding + one-time offers (read-only; stamped server-side via
            # their own actions)
            'welcome_seen_at', 'push_email_offer_seen_at',

            # Copy desk. The capability is granted from the admin and never by
            # the account itself; the visit stamp has its own POST action. Both
            # are here so the panel can decide whether to offer the way in at all.
            'can_edit_site_copy', 'copy_desk_seen_at',

            # Integrations
            'calendar_token'
        )
        # Critical Security: Users cannot escalate their own role or spoof tokens.
        # Everything listed here is server-authoritative — clients read these but
        # cannot set them, and none of them appear in UserPreferencesUpdateDTO
        # (which forbids extras, so echoing one back in a PATCH is a 400).
        # `can_edit_site_copy` is absent from this tuple and still unwritable:
        # it is a SerializerMethodField above, and DRF refuses to see a declared
        # field named here at all.
        read_only_fields = (
            'role', 'calendar_token', 'welcome_seen_at', 'push_email_offer_seen_at',
            'copy_desk_seen_at',
        )

    def _absolute_media_url(self, field) -> str | None:
        if not field:
            return None
        url = field.url
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url

    def get_can_edit_site_copy(self, obj: UserProfile) -> bool:
        # Imported here rather than at module scope: `copydesk` reads `core`'s
        # models, so a top-level import would close the circle at app load.
        from copydesk.permissions import user_can_edit_site_copy

        return user_can_edit_site_copy(obj.user)

    def get_avatar_url(self, obj: UserProfile) -> str | None:
        return self._absolute_media_url(obj.avatar)

    def get_avatar_thumb_url(self, obj: UserProfile) -> str | None:
        return self._absolute_media_url(obj.avatar_thumb)

    def validate_timezone(self, value: str) -> str:
        """
        Safely validates the timezone string against the server's IANA database.
        Prevents OS-dependent database constraints failure.
        """
        if value not in zoneinfo.available_timezones():
            raise serializers.ValidationError(
                f"Timezone '{value}' is not recognized by the server's tzdata."
            )
        return value


class UserMeSerializer(serializers.ModelSerializer):
    """
    Enterprise Aggregated Serializer.
    Combines core Auth Identity, Profile preferences, and Artist domain data into a single DTO.

    Names are read from the account and nowhere else. The roster row carries a
    copy, but it is a projection written from here — backfilling from it would
    hide the very drift that arrangement exists to prevent, and would show this
    screen a name its own PATCH cannot reach.
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

    def update(self, instance, validated_data):
        """
        Explicitly handles nested updates for the UserProfile entity.
        DRF ModelSerializers do not support nested object mutation natively.
        """
        profile_data = validated_data.pop('profile', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if profile_data and hasattr(instance, 'profile'):
            profile = instance.profile
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        return instance

    def get_voice_type(self, obj) -> str | None:
        """Safely resolves the domain-specific voice type."""
        artist_profile = getattr(obj, 'artist_profile', None)
        return artist_profile.voice_type if artist_profile else None

    def get_voice_type_display(self, obj) -> str:
        """Resolves the human-readable translation for the voice type."""
        artist_profile = getattr(obj, 'artist_profile', None)
        return artist_profile.get_voice_type_display() if artist_profile else "N/A"


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


#: Hard cap on the free-text body. Generous for a real account of what happened,
#: tight enough that a stuck client cannot post a novel.
MAX_FEEDBACK_BODY_LENGTH = 4000

#: Whitelist of accepted `context` keys → (type, max length). Anything absent
#: from this map is dropped: the blob is client-controlled, and an unbounded
#: JSON column is both a storage and a disclosure hazard.
_CONTEXT_SPEC: dict[str, tuple[type, int]] = {
    # Browser / device identification.
    'user_agent': (str, 400),
    'platform': (str, 120),
    # Geometry, as "WxH" strings — enough to tell a phone from a desktop and to
    # spot a layout fault that only exists at one size.
    'viewport': (str, 40),
    'screen': (str, 40),
    'pixel_ratio': (str, 12),
    # Session shape.
    'locale': (str, 12),
    'timezone': (str, 63),
    # 'standalone' means the report came from the installed PWA, where the SW
    # may be serving a stale build — the single most misleading failure mode.
    'display_mode': (str, 24),
    'connection': (str, 24),
    'online': (bool, 0),
    # Build identity. Without it, "already fixed" and "still broken" are
    # indistinguishable in the queue.
    'app_version': (str, 80),
    # Client clock at capture. Divergence from `created_at` marks a report that
    # sat in the offline queue — or a device with a wrong clock, which breaks
    # token refresh and is worth seeing.
    'captured_at': (str, 40),
    # Whatever the app last caught (error boundary, failed request).
    'last_error': (str, 2000),
}


class FeedbackReportSerializer(serializers.ModelSerializer):
    """
    Inbound in-app feedback. `reporter` is taken from the authenticated request
    and is never client-supplied; `status` and `note` belong to triage.

    `context` is a client-controlled JSON blob, so it is not stored as received:
    `validate_context` rebuilds it key by key against `_CONTEXT_SPEC`, dropping
    unknown keys and truncating long values. A new diagnostic field therefore
    needs an entry in that spec or it will silently never arrive.
    """

    class Meta:
        model = FeedbackReport
        fields = ('id', 'kind', 'body', 'route', 'context', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate_body(self, value: str) -> str:
        text = value.strip()
        if not text:
            raise serializers.ValidationError(_("Report cannot be empty."))
        return text[:MAX_FEEDBACK_BODY_LENGTH]

    def validate_route(self, value: str) -> str:
        return value.strip()[:300]

    def validate_context(self, value: Any) -> dict[str, Any]:
        # Typed `Any` deliberately: a JSONField accepts any JSON value, so a
        # client is free to send a list or a bare string here.
        if not isinstance(value, dict):
            return {}

        cleaned: dict[str, Any] = {}
        for key, (expected_type, max_length) in _CONTEXT_SPEC.items():
            if key not in value:
                continue
            raw = value[key]
            if expected_type is bool:
                if isinstance(raw, bool):
                    cleaned[key] = raw
                continue
            if raw is None:
                continue
            cleaned[key] = str(raw)[:max_length]

        return cleaned

    def create(self, validated_data: dict[str, Any]) -> FeedbackReport:
        request = self.context.get('request')
        reporter = getattr(request, 'user', None)
        return FeedbackReport.objects.create(
            reporter=reporter if reporter is not None and reporter.is_authenticated else None,
            **validated_data,
        )


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