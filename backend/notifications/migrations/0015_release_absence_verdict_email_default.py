"""Release the absence-verdict rows that only ever held the old default.

``ABSENCE_APPROVED`` / ``ABSENCE_REJECTED`` left the "commitments" group for a
group of their own ("requests"), which flips their e-mail default from ON to OFF.
The reasoning is the group's: the reader filed the request in the app and comes
back to see how it went, so a verdict is the one commitment that does not need an
inbox.

The mechanics are migration 0014's, mirrored. ``NotificationRouter.route`` mints a
preference row on first delivery, seeded from the default of the day, so anyone
who has ever received a verdict already carries a stored row saying "e-mail on",
written by the system rather than chosen by them. Left alone, those users would be
pinned to the old default forever and shown a "customized" marker for a choice they
never made.

Only rows at the exact old default pair are dropped: e-mail on **and** push on.
A row saying (on, off) expresses a real decision about push and is left standing,
and the reader who genuinely wanted (on, on) here loses an opinion that was
indistinguishable from silence — the ordinary, accepted cost of moving a default.
Nothing else is touched, and no schema changes.

Reverse is a no-op by construction: with the old default restored, an absent row
reads exactly as the rows removed here did.
"""
from django.db import migrations

_ABSENCE_VERDICT_TYPES = ("ABSENCE_APPROVED", "ABSENCE_REJECTED")


def release_system_seeded_absence_rows(apps, schema_editor) -> None:
    NotificationPreference = apps.get_model("notifications", "NotificationPreference")
    NotificationPreference.objects.filter(
        notification_type__in=_ABSENCE_VERDICT_TYPES,
        email_enabled=True,
        push_enabled=True,
        is_deleted=False,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0014_release_casting_email_default"),
    ]

    operations = [
        migrations.RunPython(
            release_system_seeded_absence_rows,
            migrations.RunPython.noop,
        ),
    ]
