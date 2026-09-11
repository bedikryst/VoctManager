# outreach/urls.py
# ==========================================
# Outreach — URL routing
# Standard: Enterprise SaaS 2026
# ==========================================
from django.urls import path

from .views import (
    NoticeConfirmView,
    NoticeOneClickUnsubscribeView,
    NoticeSubscribeView,
    NoticeUnsubscribeView,
)

app_name = 'outreach'

urlpatterns = [
    path('notices/subscribe/', NoticeSubscribeView.as_view(), name='notice-subscribe'),
    path('notices/confirm/', NoticeConfirmView.as_view(), name='notice-confirm'),
    path('notices/unsubscribe/', NoticeUnsubscribeView.as_view(), name='notice-unsubscribe'),
    # The token travels in the PATH here, and only here: this is the URI a mail's
    # `List-Unsubscribe` header carries, and RFC 8058 leaves the request body to the
    # standard. The page's own client keeps posting the token to the route above.
    path(
        'notices/unsubscribe/<str:token>/',
        NoticeOneClickUnsubscribeView.as_view(),
        name='notice-unsubscribe-one-click',
    ),
]
