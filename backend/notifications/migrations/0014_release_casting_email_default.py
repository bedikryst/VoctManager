"""Release the casting rows that only ever held the old default.

Casting moved into the "commitments" preference group, which flips its e-mail
default from OFF to ON. For a user who never touched it that is just a default
change — except that ``NotificationRouter.route`` mints a preference row on first
delivery, seeded from the default of the day. So anyone who has *ever* received a
casting notification already carries a stored row saying "e-mail off", written by
the system rather than chosen by them. Left alone, those users would be pinned to
the old default forever and shown a "customized" marker for a choice they never
made — precisely the group the change is for.

Only rows at the exact old default pair are dropped: e-mail off **and** push on.
A row saying (off, off) expresses a real decision about push and is left standing,
and the reader who genuinely wanted (off, on) for casting loses an opinion that
was indistinguishable from silence — the ordinary, accepted cost of moving a
default. Nothing else is touched, and no schema changes.

Reverse is a no-op by construction: with the old default restored, an absent row
reads exactly as the rows removed here did.
"""
from django.db import migrations

_CASTING_TYPES = ("PIECE_CASTING_ASSIGNED", "PIECE_CASTING_UPDATED")


def release_system_seeded_casting_rows(apps, schema_editor) -> None:
    NotificationPreference = apps.get_model("notifications", "NotificationPreference")
    NotificationPreference.objects.filter(
        notification_type__in=_CASTING_TYPES,
        email_enabled=False,
        push_enabled=True,
        is_deleted=False,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0013_alter_notification_notification_type_and_more"),
    ]

    operations = [
        migrations.RunPython(
            release_system_seeded_casting_rows,
            migrations.RunPython.noop,
        ),
    ]
