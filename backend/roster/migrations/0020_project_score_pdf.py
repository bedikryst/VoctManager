# roster/migrations/0020_project_score_pdf.py
# ==========================================
# Migration: Add score_pdf field to Project
# Standard: Enterprise SaaS 2026
# ==========================================

import django.core.validators
import roster.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('roster', '0019_artist_first_name_vocative'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='score_pdf',
            field=models.FileField(
                blank=True,
                null=True,
                upload_to='project_scores/',
                validators=[
                    django.core.validators.FileExtensionValidator(['pdf']),
                    roster.models.validate_pdf_file_size,
                ],
                verbose_name='Score PDF',
                help_text='Main concert program PDF. In the future: auto-generated from piece sheets and analyzed by AI.',
            ),
        ),
    ]
