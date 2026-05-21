# core/authentication.py
"""
Custom JWT Authentication with Cookie Support.
@architecture Enterprise SaaS 2026 Security Standards.
"""

import logging
from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import AbstractBaseUser
from django.http import HttpRequest, HttpResponse
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import Token

if TYPE_CHECKING:
    from django.contrib.auth.models import User
else:
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
    def authenticate(
        self,
        request: HttpRequest | None,
        username: str | None = None,
        password: str | None = None,
        **kwargs: Any,
    ) -> "User | None":
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
        def dummy_get_response(req: HttpRequest) -> HttpResponse:
            return HttpResponse()

        check = CSRFCheck(dummy_get_response)
        check.process_request(request)
        # `dummy_get_response` stands in for the unused view callback; process_view only
        # inspects its (absent) `csrf_exempt` flag, mirroring DRF's own CSRF-check pattern.
        reason = check.process_view(request, dummy_get_response, (), {})

        if reason:
            logger.warning(f"CSRF validation failed: {reason} for path {request.path}")
            raise exceptions.PermissionDenied(f'CSRF Failed: {reason}')

    # simplejwt types the parent return with a constrained TypeVar (AbstractBaseUser | TokenUser)
    # that a concrete-model override cannot faithfully reproduce; the runtime contract is correct.
    def authenticate(self, request: Request) -> tuple[AbstractBaseUser, Token] | None:  # type: ignore[override]
        cookie_token = request.COOKIES.get(str(settings.SIMPLE_JWT['AUTH_COOKIE']))

        if cookie_token:
            # A cookie-borne token is attached automatically by the browser, so CSRF
            # enforcement is mandatory here. Normalize to bytes to match the header path.
            self.enforce_csrf(request)
            raw_token: bytes | None = cookie_token.encode()
        else:
            header = self.get_header(request)
            if not header:
                return None
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
