"""
@file event_kind.py
@description What the ensemble is singing at, as the word a reader sees. The
    fact itself is ``Project.event_kind``; this is the one table that turns it
    into a noun, so the run sheet, the printed day card, the subscribed calendar
    and the push notification cannot name one evening three different things.
    Separate from ``liturgy`` on purpose: a concert has a kind too, and naming
    the event is not part of the order of the rite.
@architecture Enterprise SaaS 2026
@module roster/domain/event_kind
"""

from __future__ import annotations

from django.utils.functional import Promise
from django.utils.translation import pgettext_lazy

# Keys mirror ``Project.EventKind`` values. Plain strings rather than the enum
# because the domain may not import models (see ``roster/domain/__init__.py``),
# and because notification metadata carries the bare code anyway.
CONCERT = 'CONCERT'
MASS = 'MASS'
WEDDING = 'WEDDING'
OTHER = 'OTHER'

DEFAULT_EVENT_KIND = CONCERT

# The event named as the moment it is, for every surface that points at a clock
# and says what happens then: the downbeat row on the day's axis, the calendar
# entry's subject, the reminder that lands the evening before.
#
# Its own gettext context, and deliberately not the picker's labels: "Other
# event" answers "which of the four is this?", which is a question only the
# manager choosing the kind is asking. A singer reading "18:00 — Other event"
# on a run sheet is being answered a question they did not ask, so OTHER is
# simply "Event" here. The other three coincide with the picker's words, and
# the duplicate msgid is the price of the two vocabularies staying independent.
EVENT_MOMENT_LABELS: dict[str, Promise] = {
    CONCERT: pgettext_lazy('event moment', 'Concert'),
    MASS: pgettext_lazy('event moment', 'Mass'),
    WEDDING: pgettext_lazy('event moment', 'Wedding Mass'),
    OTHER: pgettext_lazy('event moment', 'Event'),
}


def event_moment_label(code: str | None) -> str:
    """The event's own name, resolved in the active language.

    An unknown or missing code reads as a concert: that is the model's default,
    and every row stored before the kind existed is one.
    """
    return str(EVENT_MOMENT_LABELS.get(code or '', EVENT_MOMENT_LABELS[DEFAULT_EVENT_KIND]))


__all__ = [
    "CONCERT",
    "DEFAULT_EVENT_KIND",
    "EVENT_MOMENT_LABELS",
    "MASS",
    "OTHER",
    "WEDDING",
    "event_moment_label",
]
