"""
Settings entrypoint for static analysis.

The production settings module intentionally fails fast when mandatory secrets
are missing. Static analysis needs the same installed-app graph without reading
real credentials, so this module provides inert defaults before importing the
normal settings.
"""

import os

os.environ.setdefault("SECRET_KEY", "typecheck-only-secret-key")
os.environ.setdefault("AXEPTA_MERCHANT_ID", "typecheck")
os.environ.setdefault("AXEPTA_SERVICE_ID", "typecheck")
os.environ.setdefault("AXEPTA_TOKEN", "typecheck")
os.environ.setdefault("AXEPTA_MAC_KEY", "typecheck")
os.environ.setdefault("AXEPTA_API_URL", "https://example.invalid")

from .settings import *  # noqa: F403
