"""
# ==========================================
# Django Core Settings
# ==========================================
Enterprise configuration for VoctManager.
Strictly typed environment variables via django-environ.
"""

import os
from datetime import timedelta
from pathlib import Path

import environ
import sentry_sdk

# Base directory path
BASE_DIR = Path(__file__).resolve().parent.parent

# --- ENVIRONMENT CONFIGURATION (FAIL-FAST) ---
env = environ.Env(
    # Set default types and values
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(
        list,
        [
            'localhost',
            '127.0.0.1',
            'web',
            'voctensemble.com',
            'www.voctensemble.com',
            'voctensemble.pl',
            'www.voctensemble.pl',
            'voctfoundation.pl',
            'www.voctfoundation.pl',
            'voctfoundation.com',
            'www.voctfoundation.com',
            'voctfoundation.org',
            'www.voctfoundation.org',
        ],
    ),
    CORS_ALLOWED_ORIGINS=(
        list,
        [
            'http://localhost',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'https://voctensemble.com',
            'https://www.voctensemble.com',
            'https://voctensemble.pl',
            'https://www.voctensemble.pl',
            'https://voctfoundation.pl',
            'https://www.voctfoundation.pl',
            'https://voctfoundation.com',
            'https://www.voctfoundation.com',
            'https://voctfoundation.org',
            'https://www.voctfoundation.org',
        ],
    ),
    DB_PORT=(str, '5432'),
    CONN_MAX_AGE=(int, 600)
)

# Take environment variables from .env file (if exists, e.g., in local dev)
environ.Env.read_env(BASE_DIR / '.env')

# --- SECURITY WARNINGS ---
# No default provided for SECRET_KEY. If missing, app throws ImproperlyConfigured exception.
SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env('ALLOWED_HOSTS')

# --- APPLICATION DEFINITION ---
INSTALLED_APPS = [
    'whitenoise.runserver_nostatic',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party packages
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'drf_spectacular',
    'django_filters',
    'anymail', 
    
    # Internal apps
    'core',
    'roster',
    'archive',
    'notifications',
    'messaging',
    'logistics',
    'documents',
    'payments',
]

# --- AUTHENTICATION BACKENDS ---
AUTHENTICATION_BACKENDS = [
    'core.authentication.EmailAuthBackend',     
    'django.contrib.auth.backends.ModelBackend',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    # Resolves the active language from the `Accept-Language` header (within the
    # supported LANGUAGES) so DRF's built-in error messages — and any gettext'd
    # domain copy — come back in the caller's language. Must sit after Session
    # and before Common (Django's required ordering).
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# --- DATABASE CONFIGURATION ---
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME', default='voct_db'),
        'USER': env('DB_USER', default='voct_user'),
        'PASSWORD': env('DB_PASSWORD', default=''),
        'HOST': env('DB_HOST', default='localhost'),
        'PORT': env('DB_PORT'),
        'CONN_MAX_AGE': env('CONN_MAX_AGE'),
        'CONN_HEALTH_CHECKS': True,
    }
}

# --- INTERNATIONALIZATION ---
LANGUAGE_CODE = 'pl'
LANGUAGES = [
    ('en', 'English'),
    ('pl', 'Polish'),
    ('fr', 'French'),
]
LOCALE_PATHS = [
    os.path.join(BASE_DIR, 'locale'), 
]
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# --- STATIC & MEDIA FILES ---
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'static'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# --- DJANGO REST FRAMEWORK CONFIGURATION ---
REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'core.exceptions.enterprise_exception_handler',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'core.authentication.CookieJWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '10/minute',
        'user': '300/minute',
        # Public password-reset requests send one e-mail to an arbitrary inbox
        # per hit, so the abuse surface is bombing a victim. Capped tight, but
        # loose enough for a legitimate retry or shared NAT.
        'password_reset': '5/hour',
        # Scoped limits for the public, unauthenticated payments endpoints.
        # 'donation_initiate' both writes a row and calls the gateway per hit;
        # kept generous enough for shared NAT (e.g. concert-venue Wi-Fi).
        'donation_initiate': '2000/hour',
        'donation_status': '60/minute',
        # The Mecenat form writes a row and sends one e-mail per hit; the e-mail
        # only ever reaches the foundation's own inbox, so the abuse surface is
        # inbox/DB flooding. Capped low, but loose enough for shared NAT.
        'patron_interest': '60/hour',
        # Read-only public aggregate (settled donations) behind a 60s response
        # cache; the limit only guards against deliberate cache-busting floods.
        'donation_progress': '60/minute',
    }
}

# --- SWAGGER / OPENAPI SETTINGS ---
EMAIL_LOGO_URL = "https://raw.githubusercontent.com/bedikryst/VoctManager/8555d59c255bdf4f9e24351ec9e98bb4171c222b/docs/assets/monogram_V.png"
SPECTACULAR_SETTINGS = {
    'TITLE': 'VoctManager API',
    'DESCRIPTION': 'Enterprise API for VoctEnsemble a cappella octet.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SECURITY': [{'jwtAuth': []}],
    'COMPONENT_SPLIT_REQUEST': True,
}

# --- JWT SETTINGS ---
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_REFRESH': 'refresh_token',
    'AUTH_COOKIE_SECURE': not DEBUG,
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SAMESITE': 'Lax',
    'BLACKLIST_AFTER_ROTATION': True,
}

# --- CORS & CSRF ---
CORS_ALLOWED_ORIGINS = env('CORS_ALLOWED_ORIGINS')
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env('CORS_ALLOWED_ORIGINS')
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# --- COOKIE SECURITY & CSRF DEFAULTS ---
# These ensure the SPA can read the CSRF token and cookies aren't leaked cross-site
CSRF_COOKIE_HTTPONLY = False
CSRF_USE_SESSIONS = False
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_DOMAIN = env('CSRF_COOKIE_DOMAIN', default=None) or None

# --- CELERY & REDIS ---
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://redis:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://redis:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# How far ahead of an event the automated reminder fires. The hourly beat sweep
# reminds each rehearsal/concert once, the first hour it enters this window.
REHEARSAL_REMINDER_LEAD_HOURS = env.int('REHEARSAL_REMINDER_LEAD_HOURS', default=24)
PROJECT_REMINDER_LEAD_HOURS = env.int('PROJECT_REMINDER_LEAD_HOURS', default=48)

# Scheduled tasks — requires the `celery beat` process to be running alongside
# the worker. Hourly sweeps: fail out abandoned PENDING donations; remind
# participants of upcoming rehearsals/concerts.
CELERY_BEAT_SCHEDULE = {
    'payments-expire-stale-pending-donations': {
        'task': 'payments.expire_stale_pending_donations',
        'schedule': timedelta(hours=1),
    },
    'roster-dispatch-due-reminders': {
        'task': 'roster.dispatch_due_reminders',
        'schedule': timedelta(hours=1),
    },
    # Hourly; each recipient's digest_hour gates the actual send to once a day.
    'notifications-send-digests': {
        'task': 'notifications.send_notification_digests',
        'schedule': timedelta(hours=1),
    },
}

# --- EMAIL (ANYMAIL) ---
ANYMAIL = {
    "RESEND_API_KEY": env("RESEND_API_KEY", default=""),
    # Svix signing secret (Resend dashboard → Webhooks) used by Anymail to verify
    # inbound tracking events before the bounce/complaint suppression runs.
    "RESEND_SIGNING_SECRET": env("RESEND_SIGNING_SECRET", default=""),
}
EMAIL_BACKEND = "anymail.backends.resend.EmailBackend" if env("RESEND_API_KEY", default="") else "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="VoctManager <noreply@voctensemble.com>")

# Public frontend origin (no trailing slash, no /panel) — used to resolve the
# SPA-relative deep-links produced by the message layer into absolute URLs for
# email clients. SITE_URL is the panel base (origin + /panel) consumed by the
# messaging service and the legacy email CTAs.
FRONTEND_URL = env("FRONTEND_URL", default="https://voctensemble.com").rstrip("/")
SITE_URL = env("SITE_URL", default=f"{FRONTEND_URL}/panel")

# Inbox pinged when a visitor submits the public Mecenat (patronage) form. The
# notification is deliberately content-free — no lead PII leaves the EU database —
# so the e-mail provider never processes the data subject's personal data.
PATRON_NOTIFICATION_EMAIL = env("PATRON_NOTIFICATION_EMAIL", default="krystian.bugalski@voctensemble.com")

# --- BUSINESS LOGIC DEFAULTS ---
DEFAULT_ARTIST_PASSWORD = env('DEFAULT_ARTIST_PASSWORD', default='secure_password123')

# --- AI / ANTHROPIC (Score Package Compiler) ---
# API key for Claude (Anthropic). The AI client wrapper raises if missing
# when first instantiated. Leave blank to disable ingestion features in dev.
ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', default='')

# Hard ceiling, in USD cents, the ingestion pipeline may spend per ScoreEdition
# PER RUN. Tasks check this BEFORE each Claude call and refuse to proceed once
# `ingestion_cost_cents` (this run) hits it. ~$0.30 covers a full v2 native-PDF
# run on a typical motet; the headroom absorbs a max_tokens escalation.
INGESTION_COST_CEILING_CENTS = env.int('INGESTION_COST_CEILING_CENTS', default=100)

# LIFETIME ceiling per ScoreEdition, in USD cents — across every (re)ingest.
# The per-run counter resets on reingest; this one never does. Stops a PDF that
# keeps getting re-processed from silently draining the account (the "it took
# $5 doing the same thing" failure mode).
INGESTION_LIFETIME_CEILING_CENTS = env.int('INGESTION_LIFETIME_CEILING_CENTS', default=500)

# Org-wide DAILY spend guard, in USD cents. Summed across all editions ingested
# in the current UTC day; new runs are refused once exceeded. A circuit breaker
# against a runaway loop or a bulk re-upload draining the API budget.
INGESTION_DAILY_BUDGET_CENTS = env.int('INGESTION_DAILY_BUDGET_CENTS', default=2000)

# Anthropic SDK transient-retry budget (429/5xx/overloaded/connection). The SDK
# backs off exponentially and honours `retry-after`; the Celery layer adds a far
# more patient tier on top. The generous request timeout suits a worker and also
# suppresses the SDK's large-max_tokens non-streaming guard.
ANTHROPIC_MAX_RETRIES = env.int('ANTHROPIC_MAX_RETRIES', default=4)
ANTHROPIC_REQUEST_TIMEOUT_SECONDS = env.float('ANTHROPIC_REQUEST_TIMEOUT_SECONDS', default=600.0)

# --- EXTERNAL DATA SOURCES (Score Package Compiler enrichment) ---
# MusicBrainz and Wikidata require no auth — only a polite User-Agent.
# MusicBrainz enforces this header; requests without it are rate-limited harder.
EXTERNAL_API_USER_AGENT = env(
    'EXTERNAL_API_USER_AGENT',
    default='VoctManager/1.0 ( https://voctensemble.com )',
)

# Spotify Web API — Client Credentials Flow only (no user auth needed for search).
SPOTIFY_CLIENT_ID = env('SPOTIFY_CLIENT_ID', default='')
SPOTIFY_CLIENT_SECRET = env('SPOTIFY_CLIENT_SECRET', default='')

# YouTube Data API v3 — Public API key from Google Cloud Console.
# Default tier: 10,000 quota units/day; one search.list call costs 100 units.
YOUTUBE_API_KEY = env('YOUTUBE_API_KEY', default='')

# --- CACHE (shared by external API clients) ---
# Redis-backed cache: reuses the same Redis instance Celery uses (DB 1 keeps
# the cache namespace separate from Celery's task queue on DB 0).
#
# The default cache URL is built from REDIS_PASSWORD + REDIS_HOST + REDIS_PORT
# rather than parsed from CELERY_BROKER_URL — this is more predictable across
# environments where the broker URL is mangled by docker-compose substitution
# or shell quoting, and it handles the common .env pattern where REDIS_PASSWORD
# is a standalone variable.
#
# Without this, in any environment with Redis auth enabled, Celery would
# connect fine while Django's cache layer would fail with
# `redis.exceptions.AuthenticationError: Authentication required`.
#
# Override with CACHE_URL explicitly in .env to point at a different Redis.
# Defensive: a literal-empty `CACHE_URL=` line in .env falls through to the
# default, since django-environ otherwise treats it as a valid empty string.
REDIS_PASSWORD = env('REDIS_PASSWORD', default='')
REDIS_HOST = env('REDIS_HOST', default='redis')
REDIS_PORT = env('REDIS_PORT', default='6379')

def _build_default_cache_url() -> str:
    auth = f':{REDIS_PASSWORD}@' if REDIS_PASSWORD else ''
    return f'redis://{auth}{REDIS_HOST}:{REDIS_PORT}/1'

CACHE_URL = env('CACHE_URL', default='').strip() or _build_default_cache_url()

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': CACHE_URL,
        'TIMEOUT': 60 * 60 * 24 * 30,  # 30 days default — external metadata changes slowly
        'KEY_PREFIX': 'voct',
    },
}

# --- OBSERVABILITY & LOGGING ---
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} [{name}:{lineno}] {message}',
            'style': '{',
        },
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s'
        }
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json' if not DEBUG else 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django.db.backends': {
            'level': 'WARNING', 
            'handlers': ['console'],
            'propagate': False,
        },
        'voctmanager': {
            'level': 'INFO',
            'handlers': ['console'],
            'propagate': False,
        }
    },
}

# --- SENTRY ---
sentry_dsn = env('SENTRY_DSN', default='')
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=0.2,
        profiles_sample_rate=0.2,
    )

# --- PRODUCTION SECURITY ---
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000 # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = True


# ==========================================
# EXTERNAL APIS & INTEGRATIONS
# ==========================================
# Google Maps Platform (Logistics, Geocoding, Time Zones)
GOOGLE_MAPS_BACKEND_KEY = env("GOOGLE_MAPS_BACKEND_KEY", default=None)

# --- AXEPTA BNP PARIBAS (Payments / Donations) ---
# Required, no defaults: missing credentials must fail fast at boot (see header).
AXEPTA_MERCHANT_ID = env('AXEPTA_MERCHANT_ID')
AXEPTA_SERVICE_ID = env('AXEPTA_SERVICE_ID')
AXEPTA_TOKEN = env('AXEPTA_TOKEN')
AXEPTA_MAC_KEY = env('AXEPTA_MAC_KEY')
AXEPTA_API_URL = env('AXEPTA_API_URL')
# Frontend page the donor lands on after a successful hosted payment; the
# donation UUID is merged into the query string by _build_return_url.
AXEPTA_RETURN_URL = env('AXEPTA_RETURN_URL', default='https://voctensemble.com/donation/status')
# Where the donor is sent on a declined / cancelled / abandoned payment. The
# landing page reveals the retry overlay off the `?donated=failure` param.
AXEPTA_FAILURE_RETURN_URL = env('AXEPTA_FAILURE_RETURN_URL', default='https://voctensemble.com/?donated=failure')
# Optional defence-in-depth: when non-empty, the Axepta webhook endpoint rejects
# any source IP not in this list. Leave empty to rely on signature verification
# alone (the canonical IP allowlist belongs at the nginx tier).
AXEPTA_WEBHOOK_ALLOWED_IPS = env.list('AXEPTA_WEBHOOK_ALLOWED_IPS', default=[])

# --- DONATION PROGRESS (public aggregate behind the landing vault) ---
# Campaign goal (PLN) reported by /api/payments/donations/progress/ so the
# landing's progress rail and the backend cannot drift apart.
DONATION_GOAL_PLN = env.int('DONATION_GOAL_PLN', default=20000)
# Conservative static rate used ONLY to fold (rare) EUR donations into the PLN
# progress total. Display approximation, not financial reporting — accounting
# uses the gateway settlement records, never this.
DONATION_EUR_TO_PLN_RATE = env('DONATION_EUR_TO_PLN_RATE', default='4.00')

FIREBASE_CREDENTIALS_PATH = os.getenv('FIREBASE_CREDENTIALS_PATH')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
NOTIFICATIONS_PUSH_ENABLED = True
NOTIFICATIONS_EMAIL_ENABLED = True
NOTIFICATIONS_SMS_ENABLED = False

# ---------------------------------------------------------------------------
# SCORE BOOK (concert score-package generator)
# ---------------------------------------------------------------------------
# Resident-ensemble name printed on the assembled score book's title page, TOC
# footer and piece cards, plus the document language used for print hyphenation
# and the template chrome. Kept in settings (not hard-coded in the builder) so a
# non-Polish org can rebrand without a code change.
SCORE_BOOK_ENSEMBLE_NAME = env('SCORE_BOOK_ENSEMBLE_NAME', default='VoctEnsemble')
SCORE_BOOK_LANG = env('SCORE_BOOK_LANG', default='pl')
