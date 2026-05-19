"""
Make ScoreEdition.piece nullable so conductors can upload PDFs before
the AI has identified which work the score represents. The Workflow A
pipeline (resolve_composer_and_piece task) assigns piece downstream.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('archive', '0013_remove_annotation_archive_ann_is_dele_idx_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='scoreedition',
            name='piece',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name='editions',
                to='archive.piece',
                verbose_name='Piece',
            ),
        ),
    ]
