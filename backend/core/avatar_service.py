# core/avatar_service.py
# ==========================================
# Avatar Image Processing Service
# Standard: Enterprise SaaS 2026
# ==========================================
"""
Security-first avatar pipeline. The browser sends an already-cropped square
image, but we NEVER trust client output: every upload is decoded, verified,
re-encoded (which strips EXIF / embedded payloads), centre-cropped to a square,
and downscaled to two canonical WebP renders (full 512px + 96px thumbnail).

The original bytes never touch disk — only our re-encoded renders do — so a
malformed or hostile file cannot be served back to other choir members.
"""
from __future__ import annotations

import io
import logging
from typing import TYPE_CHECKING

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

from .exceptions import InvalidImageException

if TYPE_CHECKING:
    from django.core.files.uploadedfile import UploadedFile

    from .models import UserProfile

logger = logging.getLogger(__name__)

# Hard ceiling on the accepted upload (bytes). The browser crop keeps this small;
# the guard is purely defensive against oversized or decompression-bomb payloads.
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB

# Reject absurd pixel dimensions before Pillow allocates a full bitmap.
MAX_PIXELS = 6000 * 6000

AVATAR_SIZE = 512
THUMB_SIZE = 96
WEBP_QUALITY = 82

# Pillow modes that carry transparency; these are flattened onto white so the
# WebP render does not gain a black background.
_ALPHA_MODES = {"RGBA", "LA", "P"}


def _open_verified(upload: UploadedFile) -> Image.Image:
    """Decode + verify the upload is a real, sane raster image."""
    size = getattr(upload, "size", None)
    if size is not None and size > MAX_UPLOAD_BYTES:
        raise InvalidImageException("avatar_too_large")

    raw = upload.read()
    if not raw:
        raise InvalidImageException("avatar_empty")

    # verify() consumes the stream, so decode from a fresh buffer afterwards.
    try:
        Image.open(io.BytesIO(raw)).verify()
        image = Image.open(io.BytesIO(raw))
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImageException("avatar_invalid") from exc

    width, height = image.size
    if width * height > MAX_PIXELS:
        raise InvalidImageException("avatar_too_large")

    return image


def _to_square_render(image: Image.Image, size: int) -> ContentFile:
    """Centre-crop to a square, resize to `size`, flatten alpha, encode WebP."""
    # Honour EXIF orientation before we discard metadata, then drop the rest.
    image = ImageOps.exif_transpose(image)

    if image.mode in _ALPHA_MODES:
        image = image.convert("RGBA")
        background = Image.new("RGBA", image.size, (255, 255, 255, 255))
        image = Image.alpha_composite(background, image).convert("RGB")
    else:
        image = image.convert("RGB")

    # ImageOps.fit centre-crops to the target aspect (1:1) then resizes in one go.
    image = ImageOps.fit(image, (size, size), method=Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=6)
    buffer.seek(0)
    return ContentFile(buffer.read())


class AvatarService:
    """Stateless processing + persistence for user profile avatars."""

    @staticmethod
    def set_avatar(profile: UserProfile, upload: UploadedFile) -> UserProfile:
        """
        Validate + process `upload` into the full and thumbnail renders, replace
        any previous files, and persist. Returns the saved profile.
        """
        source = _open_verified(upload)

        full = _to_square_render(source, AVATAR_SIZE)
        thumb = _to_square_render(source, THUMB_SIZE)

        # Remove prior renders so storage does not accumulate orphans on replace.
        AvatarService._purge_files(profile)

        profile.avatar.save("avatar.webp", full, save=False)
        profile.avatar_thumb.save("avatar_thumb.webp", thumb, save=False)
        profile.save(update_fields=["avatar", "avatar_thumb", "updated_at"])

        logger.info("Avatar updated for profile %s", profile.id)
        return profile

    @staticmethod
    def clear_avatar(profile: UserProfile) -> UserProfile:
        """Remove both renders from storage and null the fields."""
        if not profile.avatar and not profile.avatar_thumb:
            return profile

        AvatarService._purge_files(profile)
        profile.avatar = None
        profile.avatar_thumb = None
        profile.save(update_fields=["avatar", "avatar_thumb", "updated_at"])

        logger.info("Avatar cleared for profile %s", profile.id)
        return profile

    @staticmethod
    def _purge_files(profile: UserProfile) -> None:
        for field in (profile.avatar, profile.avatar_thumb):
            if not field:
                continue
            try:
                field.delete(save=False)
            except OSError:
                logger.warning(
                    "Could not delete avatar file %s for profile %s",
                    getattr(field, "name", "?"),
                    profile.id,
                )
