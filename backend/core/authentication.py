"""
Custom JWT Authentication with Cookie Support.
Enterprise 2026 Security Standards.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings

class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that checks for tokens in httpOnly cookies first,
    falling back to Authorization header for backward compatibility.
    """

    def authenticate(self, request):
        # 1. Najpierw szukamy tokena w bezpiecznym ciastku
        raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])

        # 2. Jeśli nie ma ciastka, sprawdzamy nagłówek (dla Postmana/Swaggera)
        if not raw_token:
            header = self.get_header(request)
            if header is None:
                return None
            
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None

        # 3. Walidacja wyciągniętego tokena i zwrócenie użytkownika
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token