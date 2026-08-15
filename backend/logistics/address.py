"""
@file address.py
@description Tidies a postal address as it enters the system.

Google Places answers `formatted_address` as free text assembled from whatever
components it holds, and it repeats itself: the observed shape is
``02-532, Rakowiecka 61, 02-532 Warszawa, Poland`` — the postal code once on its
own and once in front of the town. The field is free text by design (a private
rehearsal room has no Places record at all), so this does not parse an address:
it drops what the string already said, and leaves everything it does not
recognise exactly as it arrived.

**The country stays.** Dropping it is a *printing* decision — a Polish sheet for
a Polish ensemble does not need to say the concert is in Poland — and the stored
value is the canonical one: it is what a maps query is built from and what any
postal use would need. The call sheet's `_format_address` composes that removal
on top of this, so there is one implementation of "the same fragment twice" and
one place that knows which country goes without saying.
@architecture Enterprise SaaS 2026
@module logistics/address
"""

from __future__ import annotations

import re

_WHITESPACE = re.compile(r'\s+')


def address_parts(value: str | None) -> list[str]:
    """The address as its comma-separated parts, tidied and in original order.

    Two removals, both provable from the string alone: a part repeated verbatim,
    and a part that a later one already opens with (the bare postal code before
    ``02-532 Warszawa``). A part that merely *contains* another is left alone —
    "Warszawa" inside "Aleje Jerozolimskie, Warszawa" is not a repetition.
    """
    if not value:
        return []

    parts: list[str] = []
    for raw in value.split(','):
        part = _WHITESPACE.sub(' ', raw).strip()
        if part and part not in parts:
            parts.append(part)

    return [
        part
        for index, part in enumerate(parts)
        if not any(other.startswith(f'{part} ') for other in parts[index + 1:])
    ]


def normalize_address(value: str | None) -> str:
    """The tidied address, ready to store. Idempotent: normalizing an already
    normalized value returns it unchanged, which is what lets this run on every
    write without ever eroding what a human typed."""
    return ', '.join(address_parts(value))
