# core/views.py
from django.contrib.auth import get_user_model
from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from .serializers import (
    UserMeSerializer, 
    ChangePasswordSerializer, 
    RequestEmailChangeSerializer
)
from .dtos import UserPreferencesUpdateDTO, UserPasswordChangeDTO, UserEmailChangeDTO
from .services import update_user_preferences, change_user_password, process_email_change
from .exceptions import InvalidCredentialsException, EmailAlreadyInUseException

User = get_user_model()

class CurrentUserRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    """Retrieves or updates the currently authenticated user's preferences."""
    serializer_class = UserMeSerializer
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        # Build DTO from validated data
        profile_data = serializer.validated_data.get('profile', {})
        dto = UserPreferencesUpdateDTO(
            first_name=serializer.validated_data.get('first_name', self.request.user.first_name),
            last_name=serializer.validated_data.get('last_name', self.request.user.last_name),
            phone_number=profile_data.get('phone_number'),
            language=profile_data.get('language', 'en'),
            timezone=profile_data.get('timezone', 'UTC')
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