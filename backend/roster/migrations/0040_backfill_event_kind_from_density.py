"""Seed ``Project.event_kind`` from the one place the answer was already stored.

Before this field existed, the only record that a project was a Mass was the
score book's layout setting — a conductor who ticked "Mass" in the build cockpit
was stating a fact about the event, not only about the print. Reading it back is
the difference between the field arriving already true for those projects and
every existing Mass silently defaulting to CONCERT.

Deliberately one-directional: the reverse leaves ``event_kind`` alone, because
a value a manager set by hand afterwards must not be undone by a rollback.
"""

from django.db import migrations


def set_mass_kind_from_density(apps, schema_editor) -> None:
    Project = apps.get_model('roster', 'Project')
    Project.objects.filter(score_package__density_mode='MASS').update(event_kind='MASS')


class Migration(migrations.Migration):

    dependencies = [
        ('roster', '0039_programitem_liturgical_slot_project_event_kind_and_more'),
    ]

    operations = [
        migrations.RunPython(set_mass_kind_from_density, migrations.RunPython.noop),
    ]
