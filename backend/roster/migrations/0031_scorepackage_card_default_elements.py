# Generated for the score-book "unify card elements" change: the three
# per-card booleans (text/translation/programme-note) collapse into one
# ``card_default_elements`` list so the global default speaks the same element
# vocabulary as the per-item override.

from django.db import migrations, models

import roster.models


def forwards(apps, schema_editor):
    """Fold the legacy booleans into the element list, preserving each package's
    current choices (eyebrow + meta were always on)."""
    ScorePackage = apps.get_model("roster", "ScorePackage")
    for package in ScorePackage.objects.all():
        elements = ["eyebrow", "meta"]
        if package.card_include_text:
            elements.append("text")
        if package.card_include_translation:
            elements.append("translation")
        if package.card_include_program_note:
            elements.append("note")
        package.card_default_elements = elements
        package.save(update_fields=["card_default_elements"])


def backwards(apps, schema_editor):
    """Best-effort reverse: re-derive the booleans from the element list."""
    ScorePackage = apps.get_model("roster", "ScorePackage")
    for package in ScorePackage.objects.all():
        elements = set(package.card_default_elements or [])
        package.card_include_text = "text" in elements
        package.card_include_translation = "translation" in elements
        package.card_include_program_note = "note" in elements
        package.save(update_fields=[
            "card_include_text",
            "card_include_translation",
            "card_include_program_note",
        ])


class Migration(migrations.Migration):

    dependencies = [
        ('roster', '0030_programitem_performers_programitem_translation'),
    ]

    operations = [
        migrations.AddField(
            model_name='scorepackage',
            name='card_default_elements',
            field=models.JSONField(
                default=roster.models.default_card_elements,
                help_text=(
                    'Book-wide default list of card element keys (metryka, tekst, '
                    'tłumaczenie, nota, obsada, części, IPA…). Every item\'s card '
                    'inherits this set unless it pins its own via ProgramItem.card_elements.'
                ),
                verbose_name='Card: Default Elements',
            ),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(model_name='scorepackage', name='card_include_text'),
        migrations.RemoveField(model_name='scorepackage', name='card_include_translation'),
        migrations.RemoveField(model_name='scorepackage', name='card_include_program_note'),
    ]
