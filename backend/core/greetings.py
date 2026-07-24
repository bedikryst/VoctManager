"""
@file greetings.py
@description Resolves the name a member is addressed by in outgoing messages.
    One rule, one place: Polish inflects the vocative ("Krystianie"), the other
    supported languages address people in the nominative, and a missing vocative
    always falls back to the plain first name rather than to nothing. Six copies
    of that logic had drifted across `core` and `notifications` before this.
@architecture Enterprise SaaS 2026
@module core/greetings
"""

from typing import Any

__all__ = ["apply_vocative_rule", "resolve_vocative"]


def apply_vocative_rule(*, vocative: str, first_name: str, language: str) -> str:
    """Picks the form of address for `language` from a name and its vocative.

    Pure, so provisioning can call it before either value is persisted. Polish is
    the only supported language with a distinct vocative case; French and English
    address by the nominative, where a stored vocative would read as a typo.
    """
    if language == "pl" and vocative:
        return vocative
    return first_name


def resolve_vocative(user: Any, language: str) -> str:
    """The form of address for a persisted account.

    The vocative lives on `UserProfile`, so this works for managers and crew as
    well as singers — they have no Artist row, and reaching for one is exactly how
    they ended up greeted in the nominative.
    """
    profile = getattr(user, "profile", None)
    return apply_vocative_rule(
        vocative=getattr(profile, "first_name_vocative", "") or "",
        first_name=getattr(user, "first_name", "") or "",
        language=language,
    )
