# core/authentication.py
"""
Custom JWT Authentication with Cookie Support.
@architecture Enterprise SaaS 2026 Security Standards.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings

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