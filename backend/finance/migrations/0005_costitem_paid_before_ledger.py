"""
Adds `CostItem.paid_before_ledger` and marks the payments `0002` copied from the
roster, so the ledger does not ask for a contract of its own for a fee paid on
paper before it existed. The mark lives in `finance.data_copy`, next to the copy
it follows. Reversing drops the column, and the mark with it.
"""
from django.db import migrations, models

from finance.data_copy import mark_payments_before_ledger


def forwards(apps, schema_editor):
    mark_payments_before_ledger(apps)


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0004_funding_sources_allocations'),
    ]

    operations = [
        migrations.AddField(
            model_name='costitem',
            name='paid_before_ledger',
            field=models.BooleanField(default=False, verbose_name='Paid before the ledger'),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
