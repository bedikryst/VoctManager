"""Moves the Polish vocative from the choral profile to the account profile, and
widens the projected name columns to the account's own width.

The copy has to run in this file rather than in `core`, because it is the last
moment the source column still exists: `RemoveField` below drops it.
"""

from django.db import migrations, models


def copy_vocative_to_profile(apps, schema_editor):
    """Carries every stored vocative across to its account's profile.

    Rows whose account was detached by GDPR erasure have nothing to carry it to;
    the value dies with the removal, which is correct — a vocative only exists to
    address someone, and there is no longer anyone to address.
    """
    Artist = apps.get_model('roster', 'Artist')
    UserProfile = apps.get_model('core', 'UserProfile')

    pending = (
        Artist.objects.exclude(first_name_vocative='')
        .exclude(user__isnull=True)
        .values_list('user_id', 'first_name_vocative')
    )
    for user_id, vocative in pending:
        # An account without a profile row cannot happen through provisioning,
        # but a hand-made fixture can produce one; skip rather than fabricate.
        UserProfile.objects.filter(user_id=user_id).update(first_name_vocative=vocative)


def copy_vocative_back(apps, schema_editor):
    """Reverse: restore the choral-profile copy so the removal can be undone."""
    Artist = apps.get_model('roster', 'Artist')
    UserProfile = apps.get_model('core', 'UserProfile')

    stored = UserProfile.objects.exclude(first_name_vocative='').values_list(
        'user_id', 'first_name_vocative'
    )
    for user_id, vocative in stored:
        Artist.objects.filter(user_id=user_id).update(first_name_vocative=vocative)


class Migration(migrations.Migration):

    dependencies = [
        ('roster', '0034_alter_collaborator_phone_number'),
        # The destination column must exist before the copy runs.
        ('core', '0022_identity_vocative_moves_to_profile'),
    ]

    operations = [
        migrations.RunPython(copy_vocative_to_profile, copy_vocative_back),
        migrations.RemoveField(
            model_name='artist',
            name='first_name_vocative',
        ),
        migrations.AlterField(
            model_name='artist',
            name='first_name',
            field=models.CharField(max_length=150, verbose_name='First Name'),
        ),
        migrations.AlterField(
            model_name='artist',
            name='last_name',
            field=models.CharField(max_length=150, verbose_name='Last Name'),
        ),
    ]
