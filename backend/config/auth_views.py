"""
Cookie-based JWT authentication views.

SimpleJWT exposes its cookie configuration through the loosely-typed ``SIMPLE_JWT``
settings dict (django-stubs infers ``dict[str, object]``), so the small accessors below
read each value once with an explicit, checked type. ``_set_token_cookie`` then collapses
the previously-duplicated cookie-writing blocks into a single source of truth.
"""
from datetime import timedelta
from typing import Literal, cast

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.serializers import EmailTokenObtainPairSerializer

_SameSite = Literal['Lax', 'Strict', 'None'] | None


def _cookie_name(setting_key: str) -> str:
    return str(settings.SIMPLE_JWT[setting_key])


def _cookie_secure() -> bool:
    return bool(settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'])


def _cookie_samesite() -> _SameSite:
    return cast('_SameSite', settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'])


def _lifetime_seconds(setting_key: str) -> int:
    return int(cast('timedelta', settings.SIMPLE_JWT[setting_key]).total_seconds())


def _set_token_cookie(response: Response, *, cookie_key: str, token: str, lifetime_key: str) -> None:
    """Writes a single hardened JWT cookie using the shared SIMPLE_JWT configuration."""
    response.set_cookie(
        key=_cookie_name(cookie_key),
        value=token,
        httponly=True,
        secure=_cookie_secure(),
        samesite=_cookie_samesite(),
        max_age=_lifetime_seconds(lifetime_key),
    )


class CookieTokenObtainPairView(TokenObtainPairView):
    # SimpleJWT types TokenViewBase.serializer_class as a `None` sentinel meant to be
    # overridden; assigning the concrete serializer is the documented API.
    serializer_class = EmailTokenObtainPairSerializer  # type: ignore[assignment]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            _set_token_cookie(
                response, cookie_key='AUTH_COOKIE',
                token=response.data.get('access'), lifetime_key='ACCESS_TOKEN_LIFETIME',
            )
            _set_token_cookie(
                response, cookie_key='AUTH_COOKIE_REFRESH',
                token=response.data.get('refresh'), lifetime_key='REFRESH_TOKEN_LIFETIME',
            )
        return response


class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(_cookie_name('AUTH_COOKIE_REFRESH'))

        if not refresh_token:
            return Response(
                {'detail': 'Refresh token not found in cookies'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Safely copy request.data before injecting the cookie-sourced refresh token.
        mutable_data = request.data.copy() if hasattr(request.data, 'copy') else request.data
        mutable_data['refresh'] = refresh_token
        request._full_data = mutable_data

        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            _set_token_cookie(
                response, cookie_key='AUTH_COOKIE',
                token=response.data.get('access'), lifetime_key='ACCESS_TOKEN_LIFETIME',
            )

            # Honour refresh-token rotation when it is enabled in settings.
            if 'refresh' in response.data:
                _set_token_cookie(
                    response, cookie_key='AUTH_COOKIE_REFRESH',
                    token=response.data.get('refresh'), lifetime_key='REFRESH_TOKEN_LIFETIME',
                )

        return response


class LogoutView(APIView):
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(_cookie_name('AUTH_COOKIE_REFRESH'))

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        response = Response({'detail': 'Successfully logged out'}, status=status.HTTP_200_OK)
        response.delete_cookie(_cookie_name('AUTH_COOKIE'))
        response.delete_cookie(_cookie_name('AUTH_COOKIE_REFRESH'))

        return response
