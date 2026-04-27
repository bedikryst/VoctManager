from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('roster', '0018_project_conductor'),
    ]

    operations = [
        migrations.AddField(
            model_name='artist',
            name='first_name_vocative',
            field=models.CharField(
                blank=True,
                help_text="Polish vocative form, e.g. 'Krystianie' for 'Krystian'. Used in personalized greetings and emails.",
                max_length=50,
                verbose_name='First Name (Vocative)',
            ),
        ),
    ]
