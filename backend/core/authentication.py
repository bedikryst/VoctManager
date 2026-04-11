# core/authentication.py
"""
Custom JWT Authentication with Cookie Support.
@architecture Enterprise SaaS 2026 Security Standards.
"""

import logging
from typing import Optional, Tuple, Any

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import AbstractBaseUser
from django.http import HttpRequest
from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware

from rest_framework import exceptions
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import Token

User = get_user_model()
logger = logging.getLogger('voctmanager.security')

class CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request: HttpRequest, reason: str) -> str:
        # Return the failure reason instead of an HttpResponse
        return reason

class EmailAuthBackend(ModelBackend):
    """
    Enterprise Identity: Enables authentication via Email instead of the default UUID username.
    Performs secure, case-insensitive email matching and handles legacy ghost-account duplicates.
    Includes constant-time fallback to mitigate timing attacks.
    """
    def authenticate(self, request: HttpRequest, username: Optional[str] = None, password: Optional[str] = None, **kwargs: Any) -> Optional[AbstractBaseUser]:
        email = kwargs.get('email') or username
        if not email:
            return None
            
        try:
            user = User.objects.filter(email__iexact=email, is_active=True).first()
            
            if not user:
                raise User.DoesNotExist
                
        except User.DoesNotExist:
            # Mitigate timing attacks by running the password hasher anyway
            User().set_password(password)
            logger.warning(f"Failed login attempt: User not found or inactive for email: {email}")
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            logger.info(f"Successful login for user: {user.email}")
            return user
            
        logger.warning(f"Failed login attempt: Invalid password for user: {user.email}")
        return None
    
class CookieJWTAuthentication(JWTAuthentication):
    """
    Enterprise JWT Authentication.
    Prioritizes httpOnly cookies to mitigate XSS attacks, while maintaining 
    an Authorization header fallback for machine-to-machine (M2M) and Swagger integrations.
    """

    def enforce_csrf(self, request: Request) -> None:
        """
        Enforce CSRF validation for cookie-based authentication.
        Required since cookies are automatically sent by the browser.
        """
        def dummy_get_response(req: HttpRequest) -> None:
            return None

        check = CSRFCheck(dummy_get_response)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        
        if reason:
            logger.warning(f"CSRF validation failed: {reason} for path {request.path}")
            raise exceptions.PermissionDenied(f'CSRF Failed: {reason}')

    def authenticate(self, request: Request) -> Optional[Tuple[AbstractBaseUser, Token]]:
        raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])

        if not raw_token:
            header = self.get_header(request)
            if header is None:
                return None
            
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None
        else:
            # If the token came from a cookie, CSRF enforcement is strictly required.
            self.enforce_csrf(request)

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
