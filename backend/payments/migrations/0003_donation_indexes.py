# Generated for the payments security & tech-debt hardening pass (May 2026).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0002_donation_currency_alter_donation_amount'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='donation',
            index=models.Index(
                fields=['is_deleted', '-created_at'],
                name='payments_don_isdel_creat_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='donation',
            index=models.Index(
                fields=['status', '-created_at'],
                name='payments_don_status_creat_idx',
            ),
        ),
    ]
