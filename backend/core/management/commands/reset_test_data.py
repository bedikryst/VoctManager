"""
@file reset_test_data.py
@description Wipes operational data ahead of a public test round, preserving the
    stores that are not reproducible: donations and patron leads, the knowledge
    base, and the superuser accounts that keep the panel reachable. Truncates at
    the SQL level on purpose — the ORM's `.delete()` on a soft-delete model only
    flips `is_deleted`, which leaves every row in place while looking like a
    successful wipe.
@architecture Enterprise SaaS 2026
@module core/management/commands/reset_test_data
"""

import shutil
from pathlib import Path
from typing import Any

from django.apps import apps
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

User = get_user_model()

# Apps whose tables are emptied whole. `core` is deliberately absent: it owns
# UserProfile, which must survive for the superusers that survive, so core's
# tables are named individually below.
WIPE_APP_LABELS = (
    "roster",
    "archive",
    "notifications",
    "messaging",
    "logistics",
    "admin",
    "sessions",
    "token_blacklist",
)

# Individually named because their app also owns tables that must survive.
WIPE_EXTRA_TABLES = ("core_feedback_report",)

# Never truncatable, whatever the app lists above evaluate to. Donations and
# patron leads are financial and consent records with no second copy; the
# knowledge base is hand-curated. A guard rather than a comment because the app
# lists are resolved dynamically, so a future model could otherwise drift in.
PROTECTED_APP_LABELS = frozenset({"payments", "documents", "auth", "contenttypes"})

# Media subtrees owned by the truncated tables. `documents/` is absent — it
# belongs to the knowledge base, which survives. `avatars/` is handled apart:
# it is keyed by UserProfile id, and the surviving superusers keep theirs.
WIPE_MEDIA_DIRS = ("audio_tracks", "score_editions", "project_scores")


class Command(BaseCommand):
    help = (
        "Empties operational data before a public test round. Keeps payments, the "
        "knowledge base, and superuser accounts. Destructive — requires confirmation."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--noinput",
            action="store_true",
            help="Skip the interactive confirmation. For scripted runs only.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be removed, touching nothing.",
        )
        parser.add_argument(
            "--keep-media",
            action="store_true",
            help=(
                "Leave uploaded files on disk. The rows referencing them are still "
                "truncated, so the files become orphans — use only to inspect them first."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        tables = self._resolve_tables()
        self._assert_no_protected_table(tables)
        self._assert_wipe_set_is_closed(tables)

        survivors = list(User.objects.filter(is_superuser=True).order_by("username"))
        if not survivors:
            raise CommandError(
                "No superuser account exists, so this wipe would leave the panel "
                "unreachable. Create one first, then re-run. Nothing was changed."
            )
        doomed = User.objects.exclude(is_superuser=True).count()

        self._report(tables, survivors, doomed, options["keep_media"])

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("\nDry run — nothing was changed."))
            return

        if not options["noinput"]:
            self.stdout.write("")
            answer = input("Type 'wipe' to proceed, anything else to abort: ")
            if answer.strip() != "wipe":
                self.stdout.write(self.style.WARNING("Aborted. Nothing was changed."))
                return

        with transaction.atomic():
            self._truncate(tables)
            # ORM, not SQL: deleting the accounts has to run Django's collector so
            # `Document.uploaded_by` is set to NULL and each account's UserProfile
            # cascades away. A raw DELETE would trip the foreign key instead.
            deleted, _ = User.objects.exclude(is_superuser=True).delete()

        self.stdout.write(self.style.SUCCESS(f"\nTruncated {len(tables)} table(s)."))
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} account-related row(s)."))

        if not options["keep_media"]:
            self._wipe_media(survivors)

        self.stdout.write(self.style.SUCCESS("\nDone. Verify with `manage.py migrate --check`."))

    # ----------------------------------------------------------------- #
    # Table resolution and safety interlocks                            #
    # ----------------------------------------------------------------- #
    def _resolve_tables(self) -> list[str]:
        """
        Table names for every model in the wipe apps, including the implicit
        through-tables of many-to-many fields, which own rows of their own and
        are missed by any hand-maintained list.
        """
        tables: set[str] = set(WIPE_EXTRA_TABLES)
        for label in WIPE_APP_LABELS:
            for model in apps.get_app_config(label).get_models(include_auto_created=True):
                tables.add(model._meta.db_table)

        existing = set(connection.introspection.table_names())
        return sorted(tables & existing)

    @staticmethod
    def _assert_no_protected_table(tables: list[str]) -> None:
        protected = {
            model._meta.db_table
            for label in PROTECTED_APP_LABELS
            for model in apps.get_app_config(label).get_models(include_auto_created=True)
        }
        leaked = sorted(set(tables) & protected)
        if leaked:
            raise CommandError(
                f"Refusing to run: protected table(s) reached the wipe list — {', '.join(leaked)}. "
                f"Nothing was changed."
            )

    @staticmethod
    def _assert_wipe_set_is_closed(tables: list[str]) -> None:
        """
        Fails when a surviving table has a foreign key into a doomed one.

        Postgres would reject the TRUNCATE for the same reason, but only after the
        transaction opened; checking first turns a database error into a readable
        one that names the offending column.
        """
        doomed = set(tables)
        offenders: list[str] = []
        for model in apps.get_models(include_auto_created=True):
            if model._meta.db_table in doomed:
                continue
            for field in model._meta.get_fields():
                if not (field.is_relation and getattr(field, "concrete", False)):
                    continue
                related = getattr(field, "related_model", None)
                if related is not None and related._meta.db_table in doomed:
                    offenders.append(
                        f"{model._meta.db_table}.{field.name} -> {related._meta.db_table}"
                    )
        if offenders:
            raise CommandError(
                "Refusing to run: surviving table(s) reference doomed ones, so the wipe "
                "would either fail or silently widen:\n  " + "\n  ".join(offenders)
            )

    # ----------------------------------------------------------------- #
    # Execution                                                         #
    # ----------------------------------------------------------------- #
    @staticmethod
    def _truncate(tables: list[str]) -> None:
        """
        Emptied through Django's own flush SQL, which on Postgres is a single
        `TRUNCATE a, b, ... RESTART IDENTITY` — one statement, so the order of the
        list is irrelevant, and the sequences behind the integer-keyed models go
        back to 1.

        `allow_cascade` stays False on purpose. It is the safety interlock: without
        it Postgres refuses the statement when anything outside the list holds a
        foreign key into it, instead of quietly widening the blast radius to tables
        meant to survive.
        """
        statements = connection.ops.sql_flush(
            no_style(), tables, reset_sequences=True, allow_cascade=False
        )
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)

    def _wipe_media(self, survivors: list[Any]) -> None:
        root = Path(settings.MEDIA_ROOT)
        removed = 0
        for name in WIPE_MEDIA_DIRS:
            target = root / name
            if target.is_dir():
                shutil.rmtree(target)
                removed += 1
                self.stdout.write(f"  removed media/{name}/")

        # Avatars are bucketed per UserProfile id, so the surviving superusers'
        # renders are kept and every other bucket goes.
        keep = {
            str(profile.id)
            for profile in (getattr(user, "profile", None) for user in survivors)
            if profile is not None
        }
        avatars = root / "avatars"
        if avatars.is_dir():
            for bucket in avatars.iterdir():
                if bucket.is_dir() and bucket.name not in keep:
                    shutil.rmtree(bucket)
                    removed += 1
        self.stdout.write(self.style.SUCCESS(f"Removed {removed} media director(ies)."))

    # ----------------------------------------------------------------- #
    # Reporting                                                         #
    # ----------------------------------------------------------------- #
    def _report(
        self, tables: list[str], survivors: list[Any], doomed: int, keep_media: bool
    ) -> None:
        self.stdout.write(self.style.WARNING(f"Tables to truncate ({len(tables)}):"))
        with connection.cursor() as cursor:
            for table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {connection.ops.quote_name(table)}")
                row = cursor.fetchone()
                count = row[0] if row else 0
                if count:
                    self.stdout.write(f"  {table:45} {count:>8} row(s)")

        self.stdout.write(self.style.SUCCESS("\nPreserved:"))
        for label in sorted(PROTECTED_APP_LABELS):
            for model in apps.get_app_config(label).get_models():
                # `all_objects` where the model has it: the soft-delete default
                # manager hides `is_deleted` rows, which would understate what is
                # actually being preserved. Untyped because the manager class
                # genuinely differs between soft-delete models and plain ones.
                manager: Any = getattr(model, "all_objects", model._default_manager)
                self.stdout.write(
                    f"  {model._meta.db_table:45} {manager.count():>8} row(s)"
                )
        self.stdout.write(f"  media/documents/{'':29} kept")
        if keep_media:
            self.stdout.write(self.style.WARNING("  all other media kept (--keep-media)"))

        self.stdout.write(self.style.WARNING(f"\nAccounts to delete: {doomed}"))
        self.stdout.write(self.style.SUCCESS(f"Superusers kept: {len(survivors)}"))
        for user in survivors:
            self.stdout.write(f"  {user.username} <{user.email}>")
