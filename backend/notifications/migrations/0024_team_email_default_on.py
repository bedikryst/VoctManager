"""Move the team group's e-mail default to ON, keeping each reader's routine mail.

The team reports (attendance, RSVPs, absence requests) now default to e-mail ON,
with the digest switch deciding its shape: one daily digest, or one e-mail per
event. For a reader with the digest on that is what already happens — the sweep
mails these types while no row says otherwise — so the ledger simply stops
misstating it. But ``NotificationRouter.route`` mints a row on first delivery,
seeded from the default of the day, and a WARNING report (a decline) or a push
toggle in settings got such a reader a row saying "e-mail off" that nobody
chose. The sweep drops a type as soon as that row exists, and under the new
default it would also read as "customized". Releasing such a row puts the type
back into that reader's digest, where it was before the row was minted.

Two steps, split by the digest switch:

- **Digest on**: rows at the exact old default pair (e-mail off, push on) are
  released, as in ``0014``. A row differing on push expresses a real decision
  and stays.
- **Digest off**: nothing is released, and a missing team row is created at the
  old default. With the digest off, e-mail ON means one e-mail per singer per
  rehearsal, which such a reader never had; their rows keep them where they are.
  Only managers receive these types, so only managers get the rows.

Reverse is a no-op by construction: with the old default restored, an absent
row reads as the released rows did, and a pinned row states that same default.
"""
from django.db import migrations

_TEAM_TYPES = ("PARTICIPATION_RESPONSE", "ATTENDANCE_SUBMITTED", "ABSENCE_REQUESTED")
# Mirrors ManagerNotificationHelper.notify_managers, the only emitter of these.
_MANAGER_ROLES = ("MANAGER", "ADMIN")


def release_and_pin_team_rows(apps, schema_editor) -> None:
    NotificationPreference = apps.get_model("notifications", "NotificationPreference")
    UserProfile = apps.get_model("core", "UserProfile")

    NotificationPreference.objects.filter(
        notification_type__in=_TEAM_TYPES,
        email_enabled=False,
        push_enabled=True,
        is_deleted=False,
        user_id__in=UserProfile.objects.filter(digest_enabled=True).values("user_id"),
    ).delete()

    digest_off_manager_ids = list(
        UserProfile.objects.filter(
            digest_enabled=False, role__in=_MANAGER_ROLES,
        ).values_list("user_id", flat=True)
    )
    existing = set(
        NotificationPreference.objects.filter(
            user_id__in=digest_off_manager_ids,
            notification_type__in=_TEAM_TYPES,
            is_deleted=False,
        ).values_list("user_id", "notification_type")
    )
    NotificationPreference.objects.bulk_create([
        NotificationPreference(
            user_id=user_id,
            notification_type=notification_type,
            email_enabled=False,
            push_enabled=True,
        )
        for user_id in digest_off_manager_ids
        for notification_type in _TEAM_TYPES
        if (user_id, notification_type) not in existing
    ])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0029_userprofile_pitch_notation"),
        ("notifications", "0023_pushdevice_delivery_health"),
    ]

    operations = [
        migrations.RunPython(
            release_and_pin_team_rows,
            migrations.RunPython.noop,
        ),
    ]
