# core/views.py
from django.contrib.auth import get_user_model, logout, update_session_auth_hash
from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from drf_spectacular.utils import extend_schema
from pydantic import ValidationError

from .ical_service import ICalGeneratorService
from .serializers import UserMeSerializer, UserProfileSerializer
from .dtos import UserPreferencesUpdateDTO, UserPasswordChangeDTO, UserEmailChangeDTO, UserAccountDeletionDTO
from .services import UserIdentityService, UserPreferencesService
from .exceptions import InvalidCredentialsException, EmailAlreadyInUseException
from .models import UserProfile

User = get_user_model()


class CurrentUserRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    """Retrieves or updates the currently authenticated user's preferences."""
    serializer_class = UserMeSerializer
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        user = self.request.user
        UserProfile.objects.get_or_create(user=user)
        return user

    def update(self, request, *args, **kwargs):
        # We bypass DRF Serializer validation for incoming writes and use strict Pydantic DTOs
        try:
            profile_data = request.data.get('profile', {})
            payload = {
                "first_name": request.data.get('first_name', request.user.first_name),
                "last_name": request.data.get('last_name', request.user.last_name),
                **profile_data
            }
            # The DTO will automatically fail-fast if data is malformed
            dto = UserPreferencesUpdateDTO(**payload)
        except ValidationError as e:
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)

        # Delegate to Service Layer
        UserPreferencesService.update_user_preferences(request.user, dto)
        
        # Return updated serialized object
        return Response(self.get_serializer(self.get_object()).data, status=status.HTTP_200_OK)


class ChangePasswordView(views.APIView):
    """Secure endpoint for updating user credentials."""
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={204: None})
    def post(self, request, *args, **kwargs):
        try:
            dto = UserPasswordChangeDTO(**request.data)
        except ValidationError as e:
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)

        try:
            UserIdentityService.change_user_password(request.user, dto)
            update_session_auth_hash(request, request.user) # Keeps the user logged in
            return Response(status=status.HTTP_204_NO_CONTENT)
        except InvalidCredentialsException as e:
            return Response({"error_code": str(e), "message": "Invalid current password."}, status=status.HTTP_403_FORBIDDEN)


class ChangeEmailRequestView(views.APIView):
    """Initiates an email change process."""
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={200: UserMeSerializer})
    def post(self, request, *args, **kwargs):
        try:
            # Map DRF incoming naming to Pydantic expectations if necessary
            payload = {
                "new_email": request.data.get('new_email'),
                "current_password": request.data.get('password')
            }
            dto = UserEmailChangeDTO(**payload)
        except ValidationError as e:
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)

        try:
            updated_user = UserIdentityService.process_email_change(request.user, dto)
            return Response(UserMeSerializer(updated_user).data, status=status.HTTP_200_OK)
        except InvalidCredentialsException as e:
            return Response({"error_code": str(e), "message": "Authentication failed."}, status=status.HTTP_403_FORBIDDEN)
        except EmailAlreadyInUseException as e:
            return Response({"error_code": str(e), "message": "This email is already in use."}, status=status.HTTP_409_CONFLICT)


class ExportUserDataView(views.APIView):
    """
    GET /api/v1/users/me/export-data/
    GDPR Right to Data Portability. 
    """
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={200: dict})
    def get(self, request, *args, **kwargs):
        user = request.user
        # We serialize the profile here to avoid pushing DRF logic into the Service Layer
        profile_data = UserProfileSerializer(user.profile).data if hasattr(user, 'profile') else {}
        
        export_data = UserPreferencesService.generate_gdpr_export(user, profile_data)

        response = JsonResponse(export_data, json_dumps_params={'indent': 2})
        response['Content-Disposition'] = f'attachment; filename="voctmanager_data_{user.id}.json"'
        return response


class RequestAccountDeletionView(views.APIView):
    """
    POST /api/v1/users/me/delete-account/
    GDPR Right to Erasure (Soft Delete Pattern) with mandatory re-authentication.
    Secured with rate limiting against brute-force attacks.
    """
    permission_classes = (IsAuthenticated,)
    throttle_classes = [UserRateThrottle]

    @extend_schema(responses={204: None})
    def post(self, request, *args, **kwargs):
        try:
            # Map the incoming 'password' field to the DTO's 'current_password'
            dto = UserAccountDeletionDTO(current_password=request.data.get('password'))
        except ValidationError as e:
            return Response({"validation_errors": e.errors()}, status=status.HTTP_400_BAD_REQUEST)

        try:
            UserIdentityService.process_account_soft_deletion(request.user, dto)
            logout(request)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except InvalidCredentialsException as e:
            return Response({"error_code": str(e), "message": "Authentication failed."}, status=status.HTTP_403_FORBIDDEN)


class ResetCalendarTokenView(views.APIView):
    """
    POST /api/v1/users/me/reset-calendar-token/
    Regenerates the secret token, instantly invalidating the old calendar URL.
    """
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={200: UserProfileSerializer})
    def post(self, request, *args, **kwargs):
        profile = UserPreferencesService.reset_calendar_token(request.user)
        return Response(UserProfileSerializer(profile).data, status=status.HTTP_200_OK)


class CalendarFeedView(views.APIView):
    """
    GET /api/v1/calendar/<calendar_token>/feed.ics
    Public but unguessable endpoint that generates a live RFC 5545 compliant iCalendar feed.
    """
    permission_classes = ()
    authentication_classes = () 

    @extend_schema(responses={200: str})
    def get(self, request, token, *args, **kwargs):
        profile = get_object_or_404(UserProfile, calendar_token=token)
        ics_content = ICalGeneratorService.generate_user_feed(profile.user)
        
        response = HttpResponse(ics_content, content_type='text/calendar; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="voctmanager_schedule.ics"'
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response