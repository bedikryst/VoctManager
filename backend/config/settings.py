"""
# ==========================================
# Django Core Settings
# ==========================================
Enterprise configuration for VoctManager.
Strictly typed environment variables via django-environ.
"""

from pathlib import Path
import environ
import sentry_sdk
from datetime import timedelta

# Base directory path
BASE_DIR = Path(__file__).resolve().parent.parent

# --- ENVIRONMENT CONFIGURATION (FAIL-FAST) ---
env = environ.Env(
    # Set default types and values
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ['localhost']),
    CORS_ALLOWED_ORIGINS=(list, ['http://localhost:5173']),
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
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
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
LANGUAGE_CODE = 'en-us'
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
        'user': '300/minute'
    }
}

# --- SWAGGER / OPENAPI SETTINGS ---
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
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# --- CELERY & REDIS ---
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://redis:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://redis:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# --- EMAIL (ANYMAIL) ---
ANYMAIL = {
    "RESEND_API_KEY": env("RESEND_API_KEY", default=""),
}
EMAIL_BACKEND = "anymail.backends.resend.EmailBackend" if env("RESEND_API_KEY", default="") else "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="VoctManager <noreply@voctensemble.com>")

# --- BUSINESS LOGIC DEFAULTS ---
DEFAULT_ARTIST_PASSWORD = env('DEFAULT_ARTIST_PASSWORD', default='secure_password123')

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
            'level': 'WARNING', # Zmiana na DEBUG pokaże logi SQL w konsoli
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