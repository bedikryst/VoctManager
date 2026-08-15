"""
@file normalize_location_addresses.py
@description Applies `logistics.address.normalize_address` to addresses already
    stored. Every write path normalizes from now on, so this is only for rows
    imported before that — chiefly the Places shape that repeats the postal code
    (`02-532, Rakowiecka 61, 02-532 Warszawa, Poland`).
@architecture Enterprise SaaS 2026
@module logistics/management/commands/normalize_location_addresses
"""

from typing import Any

from django.core.management.base import BaseCommand

from logistics.address import normalize_address
from logistics.models import Location


class Command(BaseCommand):
    help = (
        "Reports stored venue addresses that repeat a fragment, and rewrites "
        "them with --apply. Read-only by default: an address is a thing a human "
        "typed or approved, so the diff gets read before it is taken."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Persist the normalized addresses. Without it, nothing is written.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        # Inactive venues too: a soft-deleted location is still printed on every
        # sheet already issued for the concerts it held.
        pending: list[tuple[Location, str]] = []
        for location in Location.objects.all().order_by("name"):
            normalized = normalize_address(location.formatted_address)
            if normalized != location.formatted_address:
                pending.append((location, normalized))

        for location, normalized in pending:
            self.stdout.write(f"{location.name}")
            self.stdout.write(f"  - {location.formatted_address}")
            self.stdout.write(self.style.SUCCESS(f"  + {normalized}"))

        if not pending:
            self.stdout.write(self.style.SUCCESS("Every stored address is already normalized."))
            return

        if not options["apply"]:
            self.stdout.write("")
            self.stdout.write(
                f"{len(pending)} address(es) would change. Re-run with --apply to write them."
            )
            return

        for location, normalized in pending:
            location.formatted_address = normalized
            location.save(update_fields=["formatted_address", "updated_at"])

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"{len(pending)} address(es) normalized."))
