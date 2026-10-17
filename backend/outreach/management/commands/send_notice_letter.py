"""
@file send_notice_letter.py
@description Sends one of the list's letters (`outreach/letters.py`) to the confirmed
    subscribers who have not had it. Without a flag it only reports who would get it, per
    language; `--to` writes to one subscriber as a test, `--preview` renders the letter to
    files and sends nothing.
@module outreach/management/commands/send_notice_letter
"""

import logging
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.template.loader import render_to_string

from outreach.letters import LETTERS, Letter, LetterService, letter_context

logger = logging.getLogger(__name__)

#: The first name a preview greets, per language — a preview shows the named salutation,
#: the longer of the two.
PREVIEW_NAMES = {"pl": "Anna", "en": "Anna", "fr": "Anne"}


class Command(BaseCommand):
    help = (
        "Sends a letter to every confirmed subscriber who has not had it. Reports only, "
        "unless --send, --to or --preview is given."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("letter", choices=sorted(LETTERS), help="The letter's slug.")
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument(
            "--send",
            action="store_true",
            help="Send to every confirmed subscriber who has not had this letter.",
        )
        mode.add_argument(
            "--to",
            metavar="EMAIL",
            help=(
                "Send to this one confirmed subscriber, even if they already had the letter: "
                "the test on your own address before --send. It counts as their delivery."
            ),
        )
        mode.add_argument(
            "--preview",
            metavar="DIR",
            help="Write the letter as HTML and text, one pair per language, into DIR. Sends nothing.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        letter = LETTERS[options["letter"]]

        if options["preview"]:
            self._preview(letter, Path(options["preview"]))
            return

        pending = LetterService.undelivered(letter)
        missing = LetterService.uncovered_locales(letter, LetterService.audience())
        if missing:
            raise CommandError(
                f"The letter has no copy in {', '.join(sorted(missing))}, which a confirmed "
                f"subscriber reads. Add it in outreach/letters.py before sending."
            )

        if options["to"]:
            self._send_test(letter, options["to"])
            return

        audience = LetterService.audience().count()
        by_locale = {
            locale: pending.filter(locale=locale).count() for locale in sorted(letter.copy)
        }
        self.stdout.write(
            f"{letter.slug}: {audience} confirmed, {audience - sum(by_locale.values())} already "
            f"have it, {sum(by_locale.values())} to send "
            f"({', '.join(f'{locale} {count}' for locale, count in by_locale.items())})."
        )

        if not options["send"]:
            self.stdout.write("Nothing sent. Add --send to send.")
            return

        sent = 0
        failed: list[str] = []
        for subscription in pending:
            try:
                LetterService.send(letter, subscription)
            except Exception:
                logger.exception("Letter %s to subscription %s failed.", letter.slug, subscription.id)
                failed.append(subscription.email)
                continue
            sent += 1

        self.stdout.write(self.style.SUCCESS(f"Sent {sent}."))
        if failed:
            # Nothing is recorded for these, so running the command again writes to them alone.
            raise CommandError(
                f"{len(failed)} failed, run again to retry them: {', '.join(failed)}"
            )

    def _send_test(self, letter: Letter, address: str) -> None:
        subscription = LetterService.audience().filter(email__iexact=address.strip()).first()
        if subscription is None:
            raise CommandError(
                f"{address} is not a confirmed subscriber. A test goes to a real row, so its "
                "unsubscribe and greeting links are the ones a reader gets."
            )
        LetterService.send(letter, subscription)
        self.stdout.write(self.style.SUCCESS(f"Sent to {subscription.email} ({subscription.locale})."))

    def _preview(self, letter: Letter, directory: Path) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        for locale in sorted(letter.copy):
            context = letter_context(
                letter,
                locale,
                name=PREVIEW_NAMES.get(locale, ""),
                unsubscribe_link="#unsubscribe",
                preferences_link="#preferences",
            )
            for extension in ("html", "txt"):
                target = directory / f"{letter.slug}.{locale}.{extension}"
                target.write_text(
                    render_to_string(f"emails/{letter.template_name}.{extension}", context),
                    encoding="utf-8",
                )
                self.stdout.write(str(target))
