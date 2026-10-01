# outreach/reservations.py
# ==========================================
# Outreach — seat reservations for invited guests (the /rsvp page)
# Standard: Enterprise SaaS 2026
# ==========================================
import enum
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from django.db.models import Count, Exists, OuterRef, Q, QuerySet, Sum
from django.utils import timezone

from .models import ConcertReservation

WARSAW = ZoneInfo('Europe/Warsaw')

#: The most seats one reply may ask for. A larger party is a conversation, not a form, and the
#: page sends it to the office's address. `RSVP_MAX_SEATS` in `web/src/i18n/content/rsvp.ts` is
#: the same number for the stepper — move the two together.
MAX_SEATS_PER_REPLY = 10


@dataclass(frozen=True)
class ReservableConcert:
    """
    An evening that takes reservations. The form closes when the concert begins: a reply sent
    after that has no seat left to hold.
    """
    starts_at: datetime


#: Evenings the public form accepts, keyed by the corpus id the page sends
#: (`web/src/content/concerts.yaml`). The start time restates the corpus `date` + `time`, in
#: Warsaw, because the backend cannot read the site's content at runtime.
RESERVABLE_CONCERTS: dict[str, ReservableConcert] = {
    'pochwala-stworzenia': ReservableConcert(
        starts_at=datetime(2026, 10, 11, 13, 30, tzinfo=WARSAW),
    ),
}


class ReserveOutcome(enum.Enum):
    RECEIVED = 'RECEIVED'
    CLOSED = 'CLOSED'


@dataclass(frozen=True)
class GuestListTotals:
    """Who is coming (one per name), the seats they hold, and who has said they cannot."""
    coming: int
    seats: int
    declined: int


class ReservationService:

    @staticmethod
    def reserve(*, concert: str, full_name: str, seats: int) -> ReserveOutcome:
        """
        Records one reply; `seats == 0` is a decline. The caller has validated `concert`
        against the registry, so a missing key here is a programming error and raises.
        """
        evening = RESERVABLE_CONCERTS[concert]
        if timezone.now() >= evening.starts_at:
            return ReserveOutcome.CLOSED
        ConcertReservation.objects.create(
            concert=concert,
            full_name=full_name,
            seats=seats,
            concert_starts_at=evening.starts_at,
        )
        return ReserveOutcome.RECEIVED

    @staticmethod
    def with_superseded(queryset: QuerySet[ConcertReservation]) -> QuerySet[ConcertReservation]:
        """
        Marks every row a later reply under the same name has replaced. Only the rows left
        unmarked describe seats anyone is still expecting.
        """
        later = ConcertReservation.objects.filter(
            concert=OuterRef('concert'),
            name_key=OuterRef('name_key'),
            created_at__gt=OuterRef('created_at'),
        )
        return queryset.annotate(superseded=Exists(later))

    @classmethod
    def totals(cls, queryset: QuerySet[ConcertReservation]) -> GuestListTotals:
        """The register's heading, over the current replies in `queryset` — one per name."""
        # A `Q` rather than a keyword: the stubs know the model's fields, not this annotation.
        current = cls.with_superseded(queryset).filter(Q(superseded=False))
        counted = current.aggregate(
            coming=Count('pk', filter=Q(seats__gt=0)),
            declined=Count('pk', filter=Q(seats=0)),
            seats=Sum('seats'),
        )
        return GuestListTotals(
            coming=counted['coming'],
            seats=counted['seats'] or 0,
            declined=counted['declined'],
        )
