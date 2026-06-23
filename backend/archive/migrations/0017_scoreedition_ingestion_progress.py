# Generated for the Score Package Compiler live-progress feature.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('archive', '0016_alter_piece_lyrics_original'),
    ]

    operations = [
        migrations.AddField(
            model_name='scoreedition',
            name='ingestion_progress',
            field=models.CharField(
                blank=True,
                choices=[
                    ('extracting', 'Reading the PDF'),
                    ('identifying', 'Identifying title & composer'),
                    ('resolving', 'Matching against MusicBrainz & Wikidata'),
                    ('movements', 'Detecting movements'),
                    ('lyrics', 'Extracting lyrics, IPA & translations'),
                    ('program_note', 'Writing the programme note'),
                    ('recordings', 'Finding reference recordings'),
                ],
                help_text=(
                    'Fine-grained current pipeline step, for the live ingestion UI. '
                    'Blank when queued or finished.'
                ),
                max_length=20,
                verbose_name='Ingestion Progress Step',
            ),
        ),
    ]
