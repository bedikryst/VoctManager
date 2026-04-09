# core/authentication.py
"""
Custom JWT Authentication with Cookie Support.
@architecture Enterprise SaaS 2026 Security Standards.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings

User = get_user_model()

class EmailAuthBackend(ModelBackend):
    """
    Enterprise Identity: Enables authentication via Email instead of the default UUID username.
    Performs secure, case-insensitive email matching and handles legacy ghost-account duplicates.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        email = kwargs.get('email') or username
        if not email:
            return None
            
        try:
            user = User.objects.filter(email__iexact=email, is_active=True).first()
            
            if not user:
                raise User.DoesNotExist
                
        except User.DoesNotExist:
            User().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
    
class CookieJWTAuthentication(JWTAuthentication):
    """
    Enterprise JWT Authentication.
    Prioritizes httpOnly cookies to mitigate XSS attacks, while maintaining 
    an Authorization header fallback for machine-to-machine (M2M) and Swagger integrations.
    """

    def authenticate(self, request):
        # 1. Extract token from secure httpOnly cookie
        raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])

        # 2. Fallback to standard Authorization header
        if not raw_token:
            header = self.get_header(request)
            if header is None:
                return None
            
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None

        # 3. Validate and resolve user entity
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token