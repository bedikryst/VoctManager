# Generated migration — Web Push (VAPID) fields for PushDevice

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0005_alter_notification_notification_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='pushdevice',
            name='p256dh_key',
            field=models.TextField(
                blank=True,
                null=True,
                help_text='ECDH public key for Web Push payload encryption. WEB device type only.',
            ),
        ),
        migrations.AddField(
            model_name='pushdevice',
            name='auth_key',
            field=models.CharField(
                blank=True,
                max_length=255,
                null=True,
                help_text='Auth secret for Web Push payload encryption. WEB device type only.',
            ),
        ),
    ]
