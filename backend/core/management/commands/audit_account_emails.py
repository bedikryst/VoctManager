"""
@file audit_account_emails.py
@description Pre-flight check for making the account e-mail a real, enforced
    identifier. Reports every way the current data would violate that rule:
    case-insensitive duplicates across accounts, blank addresses, and roster rows
    whose e-mail has drifted from the account they are linked to.
@architecture Enterprise SaaS 2026
@module core/management/commands/audit_account_emails
"""

from collections import defaultdict
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Audits account e-mails for the conditions that a case-insensitive "
        "uniqueness constraint would reject. Read-only unless --fix-drift."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--fix-drift",
            action="store_true",
            help=(
                "Repair roster rows whose e-mail drifted from their linked "
                "account, by copying the account's address onto the Artist. The "
                "account is the identity, so it wins. Never touches duplicates — "
                "those need a human decision about which account survives."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        duplicates = self._report_duplicates()
        self._report_blanks()
        drifted = self._report_drift()

        if options["fix_drift"] and drifted:
            self._fix_drift(drifted)

        self.stdout.write("")
        if duplicates:
            raise CommandError(
                f"{len(duplicates)} duplicate address group(s) must be resolved by hand "
                f"before a uniqueness constraint can be applied. Nothing was changed."
            )
        self.stdout.write(self.style.SUCCESS(
            "No case-insensitive duplicates — a unique constraint on lower(email) will apply cleanly."
        ))

    # -- checks -------------------------------------------------------------

    def _report_duplicates(self) -> list[tuple[str, list[Any]]]:
        """Accounts colliding once case is disregarded. Authentication resolves
        with `email__iexact` and takes the first match, so a collision here means
        sign-in already picks between them arbitrarily."""
        buckets: dict[str, list[Any]] = defaultdict(list)
        for user in User.objects.exclude(email="").order_by("date_joined"):
            buckets[user.email.strip().casefold()].append(user)

        groups = [(email, rows) for email, rows in buckets.items() if len(rows) > 1]

        self.stdout.write(self.style.MIGRATE_HEADING("Case-insensitive duplicate addresses"))
        if not groups:
            self.stdout.write("  none")
            return groups

        for email, rows in groups:
            self.stdout.write(self.style.ERROR(f"  {email} — {len(rows)} accounts:"))
            for user in rows:
                self.stdout.write(
                    f"      id={user.pk}  {user.email!r}  active={user.is_active}  "
                    f"activated={user.has_usable_password()}  joined={user.date_joined:%Y-%m-%d}  "
                    f"artist={'yes' if hasattr(user, 'artist_profile') else 'no'}"
                )
        return groups

    def _report_blanks(self) -> list[Any]:
        """Accounts with no address at all. They cannot sign in (authentication is
        e-mail-based) and a uniqueness constraint would collapse them together
        unless it tolerates blanks."""
        rows = list(User.objects.filter(email="").order_by("pk"))

        self.stdout.write(self.style.MIGRATE_HEADING("Accounts with a blank address"))
        if not rows:
            self.stdout.write("  none")
        for user in rows:
            self.stdout.write(self.style.WARNING(
                f"  id={user.pk}  username={user.get_username()!r}  "
                f"staff={user.is_staff}  active={user.is_active}"
            ))
        return rows

    def _report_drift(self) -> list[Any]:
        """Roster rows whose e-mail no longer matches the account they belong to
        — the divergence a roster-side edit used to create silently."""
        from roster.models import Artist

        drifted = [
            artist
            for artist in Artist.all_objects.select_related("user").exclude(user=None)
            # `exclude(user=None)` already narrows this at runtime; the walrus keeps
            # the type checker in step without a second query.
            if (account := artist.user) is not None
            and artist.email.strip().casefold() != account.email.strip().casefold()
        ]

        self.stdout.write(self.style.MIGRATE_HEADING("Roster rows drifted from their account"))
        if not drifted:
            self.stdout.write("  none")
        for artist in drifted:
            account_email = artist.user.email if artist.user else ""
            self.stdout.write(self.style.WARNING(
                f"  artist={artist.pk}  roster={artist.email!r}  account={account_email!r}"
            ))
        return drifted

    # -- repair -------------------------------------------------------------

    def _fix_drift(self, drifted: list[Any]) -> None:
        from roster.models import Artist

        for artist in drifted:
            artist.email = artist.user.email
        Artist.all_objects.bulk_update(drifted, ["email"])
        self.stdout.write(self.style.SUCCESS(
            f"  → realigned {len(drifted)} roster row(s) to their account address"
        ))

    # Deliberately no --fix for duplicates. Merging two accounts means deciding
    # which one keeps the concert history, the messages and the notifications,
    # and that is not a decision a script may take.
