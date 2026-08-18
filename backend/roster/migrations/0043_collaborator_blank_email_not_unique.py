"""Let a crew member exist without an e-mail — more than one of them.

The uniqueness rule read "unique among non-deleted rows whose e-mail is not
NULL", but the write path stores a missing address as '' rather than NULL, and
'' is a value: the second contactless collaborator collided with the first. The
constraint now excludes blank as well, and the rows already written as '' are
folded into NULL so the column keeps a single spelling of "absent".

Reverse only restores the old condition; the NULLs stay, being what the model
means by an empty address either way.
"""

from django.db import migrations, models


def blank_email_to_null(apps, schema_editor) -> None:
    Collaborator = apps.get_model('roster', 'Collaborator')
    Collaborator.objects.filter(email='').update(email=None)


class Migration(migrations.Migration):

    dependencies = [
        ('roster', '0042_participation_default_voice_line'),
    ]

    operations = [
        migrations.RunPython(blank_email_to_null, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name='collaborator',
            name='unique_active_collaborator_email',
        ),
        migrations.AddConstraint(
            model_name='collaborator',
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ('is_deleted', False),
                    ('email__isnull', False),
                    models.Q(('email', ''), _negated=True),
                ),
                fields=('email',),
                name='unique_active_collaborator_email',
            ),
        ),
    ]
