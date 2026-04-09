# core/views.py
from django.contrib.auth import get_user_model, logout
from django.http import JsonResponse
from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema
from django.utils import timezone
import uuid
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from backend.core.ical_service import ICalGeneratorService
from rest_framework.throttling import UserRateThrottle

from .serializers import (
    UserMeSerializer, 
    ChangePasswordSerializer, 
    RequestEmailChangeSerializer,
    UserProfileSerializer,
    AccountDeletionSerializer
)
from .dtos import UserPreferencesUpdateDTO, UserPasswordChangeDTO, UserEmailChangeDTO
from .services import update_user_preferences, change_user_password, process_email_change
from .exceptions import InvalidCredentialsException, EmailAlreadyInUseException
from .models import UserProfile
from django.contrib.auth import update_session_auth_hash

User = get_user_model()

class CurrentUserRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    """Retrieves or updates the currently authenticated user's preferences."""
    serializer_class = UserMeSerializer
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        user = self.request.user
        UserProfile.objects.get_or_create(user=user)
        return user

    def perform_update(self, serializer):
        # Build DTO from validated data
        profile_data = serializer.validated_data.get('profile', {})
        dto = UserPreferencesUpdateDTO(
            first_name=serializer.validated_data.get('first_name', self.request.user.first_name),
            last_name=serializer.validated_data.get('last_name', self.request.user.last_name),
            phone_number=profile_data.get('phone_number'),
            language=profile_data.get('language', 'en'),
            timezone=profile_data.get('timezone', 'UTC'),
            dietary_preference=profile_data.get('dietary_preference', self.request.user.profile.dietary_preference),
            dietary_notes=profile_data.get('dietary_notes', self.request.user.profile.dietary_notes),
            clothing_size=profile_data.get('clothing_size', self.request.user.profile.clothing_size),
            shoe_size=profile_data.get('shoe_size', self.request.user.profile.shoe_size),
            height_cm=profile_data.get('height_cm', self.request.user.profile.height_cm),
        )
        # Delegate to Service Layer
        update_user_preferences(self.request.user, dto)


class ChangePasswordView(views.APIView):
    """Secure endpoint for updating user credentials."""
    permission_classes = (IsAuthenticated,)
    serializer_class = ChangePasswordSerializer

    @extend_schema(responses={204: None})
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        dto = UserPasswordChangeDTO(
            old_password=serializer.validated_data['old_password'],
            new_password=serializer.validated_data['new_password']
        )

        try:
            change_user_password(request.user, dto)
            update_session_auth_hash(request, request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except InvalidCredentialsException as e:
            # We return the exact error code for the frontend to translate
            return Response(
                {"error_code": str(e), "message": "Invalid current password."}, 
                status=status.HTTP_403_FORBIDDEN
            )


class ChangeEmailRequestView(views.APIView):
    """Initiates an email change process."""
    permission_classes = (IsAuthenticated,)
    serializer_class = RequestEmailChangeSerializer

    @extend_schema(responses={200: UserMeSerializer})
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        dto = UserEmailChangeDTO(
            new_email=serializer.validated_data['new_email'],
            current_password=serializer.validated_data['password']
        )

        try:
            updated_user = process_email_change(request.user, dto)
            return Response(
                UserMeSerializer(updated_user).data, 
                status=status.HTTP_200_OK
            )
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
    Excludes internal managerial metrics (like sight_reading_skill) to prevent disputes.
    """
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={200: dict})
    def get(self, request, *args, **kwargs):
        user = request.user
        
        data = {
            "generated_at": timezone.now().isoformat(),
            "app_name": "VoctManager Enterprise",
            "account": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "date_joined": user.date_joined.isoformat(),
            },
            "preferences": UserProfileSerializer(user.profile).data if hasattr(user, 'profile') else {},
            "artist_profile": None
        }

        # Include ONLY safe Artist details
        if hasattr(user, 'artist_profile'):
            artist = user.artist_profile
            data["artist_profile"] = {
                "voice_type": artist.get_voice_type_display(),
                "phone_number": artist.phone_number,
                # NOTATKI DYRYGENTA ZOSTAŁY CELOWO POMINIĘTE W EKSPORCIE:
                # - vocal_range_bottom
                # - vocal_range_top
                # - sight_reading_skill
            }

        response = JsonResponse(data, json_dumps_params={'indent': 2})
        response['Content-Disposition'] = f'attachment; filename="voctmanager_data_{user.id}.json"'
        return response


class RequestAccountDeletionView(views.APIView):
    """
    POST /api/v1/users/me/delete-account/
    GDPR Right to Erasure (Soft Delete Pattern) with mandatory re-authentication.
    Secured with rate limiting against brute-force attacks.
    """
    permission_classes = (IsAuthenticated,)
    throttle_classes = [UserRateThrottle] # Ochrona Brute-Force (ustaw limit np. 5/min w settings.py)
    serializer_class = AccountDeletionSerializer

    @extend_schema(responses={204: None})
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        password = serializer.validated_data['password']

        # Zero Trust: Verify identity before destructive action
        if not user.check_password(password):
            raise InvalidCredentialsException("invalid_current_password")
        
        # Soft Delete - blocks login but keeps historical roster data intact
        user.is_active = False  
        user.save(update_fields=['is_active'])

        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)
    

class ResetCalendarTokenView(views.APIView):
    """
    POST /api/v1/users/me/reset-calendar-token/
    Regenerates the secret token, instantly invalidating the old calendar URL.
    """
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={200: UserProfileSerializer})
    def post(self, request, *args, **kwargs):
        profile = request.user.profile
        profile.calendar_token = uuid.uuid4()
        profile.save(update_fields=['calendar_token', 'updated_at'])
        return Response(UserProfileSerializer(profile).data, status=status.HTTP_200_OK)


class CalendarFeedView(views.APIView):
    """
    GET /api/v1/calendar/<calendar_token>/feed.ics
    Public but unguessable endpoint that generates a live RFC 5545 compliant iCalendar feed.
    """
    permission_classes = () # IMPORTANT: Public access required for Google/Apple Calendar
    authentication_classes = () 

    @extend_schema(responses={200: str}) # (Optional) describe for Swagger if needed
    def get(self, request, token, *args, **kwargs):
        # 1. Fetch user by secret token
        profile = get_object_or_404(UserProfile, calendar_token=token)
        
        # 2. Delegate business logic to service layer
        ics_content = ICalGeneratorService.generate_user_feed(profile.user)
        
        # 3. Return RFC compliant response
        response = HttpResponse(ics_content, content_type='text/calendar; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="voctmanager_schedule.ics"'
        # Ensure proxies don't cache this dynamic feed
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response