"""
Drop legacy Piece fields that have been superseded by sub-entities:

  - sheet_music                  → ScoreEdition.pdf_file (many editions per piece)
  - ingestion_status             → ScoreEdition.ingestion_status (per-edition only)
  - lyrics_translation           → Translation model (one row per target_language)
  - reference_recording_youtube  → Recording model (source='YTB')
  - reference_recording_spotify  → Recording model (source='SPF')

Refactor decision: the per-Piece copies were write-only fallbacks that drifted
out of sync with the canonical sub-entity rows. Single source of truth wins.
The app is pre-launch — no production data to preserve.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('archive', '0014_scoreedition_piece_nullable'),
    ]

    operations = [
        migrations.RemoveField(model_name='piece', name='sheet_music'),
        migrations.RemoveField(model_name='piece', name='ingestion_status'),
        migrations.RemoveField(model_name='piece', name='lyrics_translation'),
        migrations.RemoveField(model_name='piece', name='reference_recording_youtube'),
        migrations.RemoveField(model_name='piece', name='reference_recording_spotify'),
    ]
