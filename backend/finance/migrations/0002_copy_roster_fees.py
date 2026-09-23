"""
Copies the fees held on `Participation` and `CrewAssignment` into the ledger.

The copy itself lives in `finance.data_copy` so it is unit-tested against the
same code this migration runs. Reversing is a no-op: the copy is idempotent, and
unapplying `0001` drops the tables it filled.
"""
from django.db import migrations

from finance.data_copy import copy_roster_fees


def forwards(apps, schema_editor):
    copy_roster_fees(apps)


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
