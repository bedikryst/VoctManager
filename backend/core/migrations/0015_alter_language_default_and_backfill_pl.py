from django.db import migrations, models


def backfill_language_to_pl(apps, schema_editor):
    """
    The ensemble is Polish-resident, but `language` historically defaulted to 'en'
    while the client UI ran in Polish — so every server-sent notification (push,
    email, digest) arrived in English. Realign existing accounts with the language
    they actually use. A genuinely English/French user can switch once in Settings.
    """
    UserProfile = apps.get_model('core', 'UserProfile')
    updated = UserProfile.objects.filter(language='en').update(language='pl')
    if updated:
        print(f"\n[Migration] Realigned {updated} profile(s) from 'en' to 'pl'.")


def reverse_noop(apps, schema_editor):
    """Irreversible by design — the original 'en'/'pl' split is not recoverable."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0014_userprofile_email_undeliverable'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userprofile',
            name='language',
            field=models.CharField(
                choices=[('en', 'English'), ('pl', 'Polish'), ('fr', 'French')],
                default='pl',
                help_text=(
                    'Preferred language for the UI and for all outgoing notifications '
                    '(push, email, digest). Single source of truth — kept in sync with '
                    'the client UI language for authenticated users.'
                ),
                max_length=10,
            ),
        ),
        migrations.RunPython(backfill_language_to_pl, reverse_code=reverse_noop),
    ]
