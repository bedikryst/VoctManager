"""
@file score_protection.py
@description Single source of truth for licensed-score protection policy. Answers
    two questions the whole system keys off:
      1. May this edition leave the app as a raw file?  (`can_export`)
      2. What does a served access look like — clean or personally watermarked —
         and what copy number does it carry?  (`record_edition_access` /
         `record_binder_access`, which also append the audit trail).
    Pure domain + ORM only (no PDF/WeasyPrint deps) so serializers, the materials
    read model and both download choke points can all import it without dragging
    in the renderer. The watermark *rendering* lives in
    roster.infrastructure.score_watermark; this module only decides and records.
@architecture Enterprise SaaS 2026
@module archive/score_protection
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from django.db import transaction
from django.db.models import Max

from archive.models import ScoreAccessLog, ScoreEdition

# Joins the watermark footer segments. A wide middle dot reads as a divider on a
# printed page without looking like punctuation inside a name.
_FOOTER_SEPARATOR = "  ·  "


def user_is_manager(user) -> bool:
    """Manager check mirroring roster's score-access gate (profile flag only), so
    export rights and download access can never disagree about who a manager is."""
    profile = getattr(user, "profile", None)
    return bool(profile is not None and profile.is_manager)


def can_export(edition: ScoreEdition, *, is_manager: bool) -> bool:
    """Whether this edition may leave the app as a raw file (download / share /
    open-in-browser).

    Public domain → always. Protected (LICENSED_COPIES / PUBLISHER_DIGITAL /
    UNKNOWN) → managers only, as the licence holders; choristers get the in-app,
    watermarked view instead. The frontend never decides this — it renders the
    bool the API computes here."""
    if not edition.is_license_protected:
        return True
    return is_manager


def copy_holder_name(user) -> str:
    """Human name printed in the watermark footer. Deliberately never the email
    or the login (RODO — the file is printed and left on music stands): full
    name, then the linked Artist's name, then empty rather than leak an identifier."""
    getter = getattr(user, "get_full_name", None)
    full = (getter() or "").strip() if callable(getter) else ""
    if full:
        return full
    artist = getattr(user, "artist_profile", None)
    if artist is not None:
        name = f"{artist.first_name} {artist.last_name}".strip()
        if name:
            return name
    return ""


def build_watermark_footer(
    *,
    copy_number: int | None,
    holder_name: str,
    context_label: str,
    when: datetime,
) -> str:
    """Compose the per-page footer: 'Egzemplarz nr N · Imię Nazwisko · Koncert ·
    data'. Polish literal to match the deterministic Polish score book (single
    tenant). Segments that are absent are simply dropped."""
    parts: list[str] = []
    if copy_number is not None:
        parts.append(f"Egzemplarz nr {copy_number}")
    if holder_name:
        parts.append(holder_name)
    if context_label:
        parts.append(context_label)
    parts.append(when.strftime("%d.%m.%Y"))
    return _FOOTER_SEPARATOR.join(parts)


@dataclass(frozen=True)
class ServeDecision:
    """How a single served access should be delivered."""

    watermark: bool          # stamp the served bytes with the personal footer?
    copy_number: int | None  # per-recipient sequence for the footer + audit


def _resolve_copy_number(scope_qs, user) -> int:
    """The copy number for this recipient within a scope: reuse the one already
    assigned to them (a re-download keeps the same printed number), otherwise the
    next free sequence value. Wrapped in the caller's transaction."""
    existing = (
        scope_qs.filter(user=user, copy_number__isnull=False)
        .order_by("created_at")
        .values_list("copy_number", flat=True)
        .first()
    )
    if existing is not None:
        return int(existing)
    current_max = scope_qs.aggregate(m=Max("copy_number"))["m"] or 0
    return int(current_max) + 1


def _clean_user(user):
    return user if getattr(user, "is_authenticated", False) else None


@transaction.atomic
def record_edition_access(user, edition: ScoreEdition, *, is_manager: bool) -> ServeDecision:
    """Log a single-edition download and decide how to serve it. Protected + a
    non-manager → watermark with a stable per-recipient copy number; everything
    else → a clean serve (still logged, copy_number null)."""
    watermark = edition.is_license_protected and not is_manager
    scoped_user = _clean_user(user)
    copy_number: int | None = None
    if watermark:
        scope = ScoreAccessLog.objects.filter(edition=edition, build_version__isnull=True)
        copy_number = _resolve_copy_number(scope, scoped_user)
    ScoreAccessLog.objects.create(
        user=scoped_user,
        edition=edition,
        copy_number=copy_number,
        was_watermarked=watermark,
    )
    return ServeDecision(watermark=watermark, copy_number=copy_number)


@transaction.atomic
def record_binder_access(
    user,
    project,
    *,
    build_version: int | None,
    protected: bool,
    is_manager: bool,
) -> ServeDecision:
    """Log a score-book binder download and decide how to serve it. ``protected``
    is 'any bound edition is licensed', computed by the caller (roster owns the
    programme). Numbering is scoped to (project, build_version): a fresh build is
    a new print run and re-arms the sequence."""
    watermark = protected and not is_manager
    scoped_user = _clean_user(user)
    copy_number: int | None = None
    if watermark:
        scope = ScoreAccessLog.objects.filter(project=project, build_version=build_version)
        copy_number = _resolve_copy_number(scope, scoped_user)
    ScoreAccessLog.objects.create(
        user=scoped_user,
        project=project,
        build_version=build_version,
        copy_number=copy_number,
        was_watermarked=watermark,
    )
    return ServeDecision(watermark=watermark, copy_number=copy_number)


__all__ = [
    "ServeDecision",
    "build_watermark_footer",
    "can_export",
    "copy_holder_name",
    "record_binder_access",
    "record_edition_access",
    "user_is_manager",
]
