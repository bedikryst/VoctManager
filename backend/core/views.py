# core/views.py
# ==========================================
# Core Account & Identity Views
# Standard: Enterprise SaaS 2026
# ==========================================
from django.contrib.auth import get_user_model, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from pydantic import ValidationError
from rest_framework import generics, status, views
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle

from .avatar_service import AvatarService
from .dtos import (
    UserAccountActivationDTO,
    UserAccountDeletionDTO,
    UserEmailChangeDTO,
    UserPasswordChangeDTO,
    UserPasswordResetConfirmDTO,
    UserPasswordResetRequestDTO,
    UserPreferencesUpdateDTO,
)
from .exceptions import (
    EmailAlreadyInUseException,
    InvalidCredentialsException,
    InvalidImageException,
    format_pydantic_validation_errors,
)
from .ical_service import ICalGeneratorService
from .models import UserProfile
from .serializers import UserMeSerializer, UserProfileSerializer
from .services import UserIdentityService, UserPreferencesService

User = get_user_model()

class CSRFCookieView(views.APIView):
    """
    GET /api/v1/csrf/
    Ensures a CSRF cookie is set in the client browser for future mutative requests.
    """
    permission_classes = (AllowAny,)
    authentication_classes = ()

    @extend_schema(responses={204: None})
    def get(self, request, *args, **kwargs):
        # get_token forces Django to set the CSRF cookie in the response headers
        get_token(request)
        return Response(status=status.HTTP_204_NO_CONTENT)
    
class ActivateAccountView(views.APIView):
    """
    POST /api/v1/auth/activate/
    Public endpoint for finalizing invited account activation.
    """
    permission_classes = (AllowAny,)
    authentication_classes = ()

    @extend_schema(responses={200: dict, 400: dict, 403: dict})
    def post(self, request, *args, **kwargs):
        try:
            dto = UserAccountActivationDTO(**request.data)
            validate_password(dto.new_password)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as e:
            return Response(
                {"validation_errors": {"new_password": list(e.messages)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = UserIdentityService.activate_account_and_set_password(
                uidb64=dto.uidb64,
                token=dto.token,
                new_password=dto.new_password,
            )
            return Response(
                {
                    "detail": "Account activated successfully.",
                    "email": user.email,
                },
                status=status.HTTP_200_OK,
            )
        except InvalidCredentialsException as e:
            return Response(
                {"error_code": str(e), "message": "Activation link is invalid or expired."},
                status=status.HTTP_403_FORBIDDEN,
            )


class ActivationPreviewView(views.APIView):
    """
    GET /api/users/activate/preview/?uid=..&token=..
    Read-only: returns the invited member's display name for a valid activation
    link so the activation screen can greet them. The signed token is required,
    so it never leaks names to anyone without the invitation, and it is never
    consumed (activation still works afterwards).
    """
    permission_classes = (AllowAny,)
    authentication_classes = ()

    @extend_schema(responses={200: dict, 400: dict, 403: dict})
    def get(self, request, *args, **kwargs):
        uidb64 = request.query_params.get("uid") or request.query_params.get("uidb64") or ""
        token = request.query_params.get("token") or ""
        if not uidb64 or not token:
            return Response(
                {"error_code": "invalid_activation_link", "message": "Missing activation parameters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = UserIdentityService.get_activation_invitee(uidb64=uidb64, token=token)
            return Response(data, status=status.HTTP_200_OK)
        except InvalidCredentialsException as e:
            return Response(
                {"error_code": str(e), "message": "Activation link is invalid or expired."},
                status=status.HTTP_403_FORBIDDEN,
            )


class PasswordResetRequestView(views.APIView):
    """
    POST /api/users/password-reset/
    Public, enumeration-safe entry point: always answers 200 with an identical
    message whether or not an account exists, so it never reveals membership.
    Scoped throttle guards against using it to bomb a victim's inbox.
    """
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "password_reset"

    @extend_schema(responses={200: dict, 400: dict})
    def post(self, request, *args, **kwargs):
        try:
            dto = UserPasswordResetRequestDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        UserIdentityService.request_password_reset(dto.email)

        # Enumeration-safe: identical response regardless of account existence.
        return Response(
            {"detail": "If an account exists for this address, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(views.APIView):
    """
    POST /api/users/password-reset/confirm/
    Public endpoint that finalizes a password reset from a signed link.
    """
    permission_classes = (AllowAny,)
    authentication_classes = ()

    @extend_schema(responses={200: dict, 400: dict, 403: dict})
    def post(self, request, *args, **kwargs):
        try:
            dto = UserPasswordResetConfirmDTO(**request.data)
            validate_password(dto.new_password)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as e:
            return Response(
                {"validation_errors": {"new_password": list(e.messages)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = UserIdentityService.reset_password(
                uidb64=dto.uidb64,
                token=dto.token,
                new_password=dto.new_password,
            )
            return Response(
                {"detail": "Password reset successfully.", "email": user.email},
                status=status.HTTP_200_OK,
            )
        except InvalidCredentialsException as e:
            return Response(
                {"error_code": str(e), "message": "Reset link is invalid or expired."},
                status=status.HTTP_403_FORBIDDEN,
            )


class CurrentUserRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    """
    GET, PATCH /api/v1/users/me/
    Retrieves or updates the currently authenticated user's profile and preferences.
    """
    serializer_class = UserMeSerializer
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        """
        Retrieves the authenticated user.
        Note: Profile existence is assumed to be handled asynchronously via Signals 
        upon user creation. GET requests must remain idempotent.
        """
        return self.request.user

    @extend_schema(responses={200: UserMeSerializer, 400: dict})
    def update(self, request, *args, **kwargs):
        """
        Updates user preferences using strict Pydantic DTO validation before hitting the database.
        """
        try:
            profile = getattr(request.user, 'profile', None)
            profile_data = request.data.get('profile') or {}
            if not isinstance(profile_data, dict):
                return Response(
                    {"validation_errors": {"profile": ["Expected an object."]}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payload = {
                "first_name": request.data.get('first_name', request.user.first_name),
                "last_name": request.data.get('last_name', request.user.last_name),
                "phone_number": getattr(profile, 'phone_number', ''),
                "language": getattr(profile, 'language', 'en'),
                "timezone": getattr(profile, 'timezone', 'Europe/Warsaw'),
                "salutation": getattr(profile, 'salutation', 'N'),
                "dietary_preference": getattr(profile, 'dietary_preference', 'none'),
                "dietary_notes": getattr(profile, 'dietary_notes', ''),
                "clothing_size": getattr(profile, 'clothing_size', ''),
                "shoe_size": getattr(profile, 'shoe_size', ''),
                "height_cm": getattr(profile, 'height_cm', None),
                **profile_data,
            }
            # The DTO will automatically fail-fast if data is malformed
            dto = UserPreferencesUpdateDTO(**payload)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Delegate persistence to the Service Layer
        UserPreferencesService.update_user_preferences(request.user, dto)
        
        # Return the fully resolved and serialized user object
        return Response(self.get_serializer(self.get_object()).data, status=status.HTTP_200_OK)


class ChangePasswordView(views.APIView):
    """
    POST /api/v1/users/me/change-password/
    Secure endpoint for updating user credentials.
    """
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={204: None, 400: dict, 403: dict})
    def post(self, request, *args, **kwargs):
        try:
            dto = UserPasswordChangeDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            UserIdentityService.change_user_password(request.user, dto)
            # Prevent the user from being logged out by rotating the session hash
            update_session_auth_hash(request, request.user) 
            return Response(status=status.HTTP_204_NO_CONTENT)
        except InvalidCredentialsException as e:
            return Response(
                {"error_code": str(e), "message": "Invalid current password."}, 
                status=status.HTTP_403_FORBIDDEN
            )


class ChangeEmailRequestView(views.APIView):
    """
    POST /api/v1/users/me/change-email/
    Initiates the enterprise email change workflow.
    """
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={200: UserMeSerializer, 400: dict, 403: dict, 409: dict})
    def post(self, request, *args, **kwargs):
        try:
            payload = {
                "new_email": request.data.get('new_email'),
                "current_password": request.data.get('password')
            }
            dto = UserEmailChangeDTO(**payload)
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            updated_user = UserIdentityService.process_email_change(request.user, dto)
            return Response(UserMeSerializer(updated_user).data, status=status.HTTP_200_OK)
        except InvalidCredentialsException as e:
            return Response(
                {"error_code": str(e), "message": "Authentication failed."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        except EmailAlreadyInUseException as e:
            return Response(
                {"error_code": str(e), "message": "This email is already in use."}, 
                status=status.HTTP_409_CONFLICT
            )


class ExportUserDataView(views.APIView):
    """
    GET /api/v1/users/me/export-data/
    GDPR Right to Data Portability. 
    """
    permission_classes = (IsAuthenticated,)
    throttle_classes = [UserRateThrottle]

    @extend_schema(responses={200: dict})
    def get(self, request, *args, **kwargs):
        user = request.user
        # Maintain domain isolation: Serialize profile outside the service layer
        profile_data = UserProfileSerializer(user.profile).data if hasattr(user, 'profile') else {}
        
        export_data = UserPreferencesService.generate_gdpr_export(user, profile_data)

        response = JsonResponse(export_data, json_dumps_params={'indent': 2})
        response['Content-Disposition'] = f'attachment; filename="voctmanager_export_{user.id}.json"'
        return response


class RequestAccountDeletionView(views.APIView):
    """
    POST /api/v1/users/me/delete-account/
    GDPR Right to Erasure (Soft Delete Pattern) with mandatory re-authentication.
    Secured with strict rate limiting against brute-force attacks.
    """
    permission_classes = (IsAuthenticated,)
    throttle_classes = [UserRateThrottle]

    @extend_schema(responses={204: None, 400: dict, 403: dict})
    def post(self, request, *args, **kwargs):
        try:
            dto = UserAccountDeletionDTO(current_password=request.data.get('password'))
        except ValidationError as e:
            return Response({"validation_errors": format_pydantic_validation_errors(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            UserIdentityService.process_account_soft_deletion(request.user, dto)
            logout(request)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except InvalidCredentialsException as e:
            return Response(
                {"error_code": str(e), "message": "Authentication failed."}, 
                status=status.HTTP_403_FORBIDDEN
            )


class ResetCalendarTokenView(views.APIView):
    """
    POST /api/v1/users/me/reset-calendar-token/
    Regenerates the secret token, instantly invalidating the previous calendar URL.
    """
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={200: UserProfileSerializer})
    def post(self, request, *args, **kwargs):
        profile = UserPreferencesService.reset_calendar_token(request.user)
        return Response(UserProfileSerializer(profile).data, status=status.HTTP_200_OK)


class AvatarView(views.APIView):
    """
    POST   /api/v1/users/me/avatar/  — upload + process a new profile picture.
    DELETE /api/v1/users/me/avatar/  — remove the current picture.

    Accepts multipart form data under the field name `avatar`. The image is
    re-encoded server-side (see AvatarService); the raw upload is never stored.
    Returns the refreshed UserProfile so the client gets the new render URLs.
    """
    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)
    throttle_classes = [UserRateThrottle]

    def _profile_response(self, profile: UserProfile, request) -> Response:
        return Response(
            UserProfileSerializer(profile, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(request=None, responses={200: UserProfileSerializer, 400: dict})
    def post(self, request, *args, **kwargs):
        upload = request.FILES.get("avatar")
        if upload is None:
            return Response(
                {"error_code": "avatar_missing", "message": "No image file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = get_object_or_404(UserProfile, user=request.user)
        try:
            profile = AvatarService.set_avatar(profile, upload)
        except InvalidImageException as exc:
            return Response(
                {"error_code": str(exc), "message": "The uploaded file is not a valid image."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return self._profile_response(profile, request)

    @extend_schema(responses={200: UserProfileSerializer})
    def delete(self, request, *args, **kwargs):
        profile = get_object_or_404(UserProfile, user=request.user)
        profile = AvatarService.clear_avatar(profile)
        return self._profile_response(profile, request)


class CalendarFeedView(views.APIView):
    """
    GET /api/v1/calendar/<calendar_token>/feed.ics
    Public but unguessable endpoint generating a live RFC 5545 compliant iCalendar feed.
    """
    permission_classes = (AllowAny,)
    authentication_classes = () 

    @extend_schema(responses={200: str})
    def get(self, request, token, *args, **kwargs):
        profile = get_object_or_404(UserProfile, calendar_token=token)
        ics_content = ICalGeneratorService.generate_user_feed(profile.user)
        
        response = HttpResponse(ics_content, content_type='text/calendar; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="voctmanager_schedule.ics"'
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response
