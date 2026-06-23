# Score Package Compiler v2: lifetime cost tracking + consolidated-pipeline
# progress steps (native-PDF analysis + overload-wait state).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('archive', '0017_scoreedition_ingestion_progress'),
    ]

    operations = [
        migrations.AddField(
            model_name='scoreedition',
            name='ingestion_cost_cents_lifetime',
            field=models.PositiveIntegerField(
                default=0,
                help_text=(
                    'Cumulative AI cost across ALL ingestion runs of this edition, '
                    'in USD cents. Never reset — the true money spent on this PDF.'
                ),
                verbose_name='Ingestion Cost — lifetime (¢)',
            ),
        ),
        migrations.AlterField(
            model_name='scoreedition',
            name='ingestion_cost_cents',
            field=models.PositiveIntegerField(
                default=0,
                help_text=(
                    'AI cost of the CURRENT ingestion run, in USD cents. '
                    'Reset to 0 on every (re)ingest — enforces the per-run ceiling.'
                ),
                verbose_name='Ingestion Cost — this run (¢)',
            ),
        ),
        migrations.AlterField(
            model_name='scoreedition',
            name='ingestion_progress',
            field=models.CharField(
                blank=True,
                choices=[
                    ('preparing', 'Preparing the document'),
                    ('analyzing', 'Reading the score (AI)'),
                    ('resolving', 'Matching against MusicBrainz & Wikidata'),
                    ('persisting', 'Saving the results'),
                    ('program_note', 'Writing the programme note'),
                    ('recordings', 'Finding reference recordings'),
                    ('waiting_overload', 'AI service is busy — retrying shortly'),
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
