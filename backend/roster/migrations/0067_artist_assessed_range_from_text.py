"""
Moves the conductor's free-text range (`vocal_range_bottom/top`, SPN such as
`G2`) onto the MIDI assessment added by 0066. `0068` then drops the text.

The two old bounds become the tessitura pair, the one the assessment requires.
Nobody can tell whether they held a tessitura or a full range, so the conductor
re-checks every singer this touches.

A row that does not convert stops the migration: a value that is not one SPN
note, a note outside A0-C8, a lone bound, or a low bound not below the high.
Every such row is listed, archived ones included, and nothing is written.
Converting it to nothing would lose a conductor's verdict without a trace. The
new code no longer knows the text columns, so a refused row is corrected in
the database itself (`manage.py dbshell`, table `roster_artist`), then
`migrate` runs again.

The parser lives here, not in the app, so a later change to the app's pitch
code cannot change what this step did. `roster/test_vocal_range.py` loads this
module to test it.

Reversal writes the tessitura pair back as SPN. The extremes have no text
column to return to and are lost.
"""
import re

from django.db import migrations

MIDI_MIN = 21  # A0
MIDI_MAX = 108  # C8

# One note: a letter in either case, an optional `#` or `b`, an octave from -1
# to 9. `C4` is middle C, MIDI 60.
_SPN = re.compile(r"^([A-Ga-g])([#b]?)(-1|[0-9])$")
_PITCH_CLASS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
_ACCIDENTAL = {"": 0, "#": 1, "b": -1}
_SHARP_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")


def parse_spn(text):
    """The MIDI number of one SPN note, or None when `text` is not one."""
    match = _SPN.match(text.strip())
    if match is None:
        return None
    letter, accidental, octave = match.groups()
    return (int(octave) + 1) * 12 + _PITCH_CLASS[letter.upper()] + _ACCIDENTAL[accidental]


def midi_to_spn(midi):
    return f"{_SHARP_NAMES[midi % 12]}{midi // 12 - 1}"


def convert_pair(bottom, top):
    """(low, high) as MIDI, None when both are blank. Raises ValueError with the
    reason when the pair cannot become a tessitura."""
    bottom = (bottom or "").strip()
    top = (top or "").strip()
    if not bottom and not top:
        return None
    if not bottom or not top:
        raise ValueError("only one bound is set")
    low = parse_spn(bottom)
    high = parse_spn(top)
    if low is None or high is None:
        raise ValueError("not an SPN note")
    if not (MIDI_MIN <= low <= MIDI_MAX and MIDI_MIN <= high <= MIDI_MAX):
        raise ValueError("outside A0-C8")
    if low >= high:
        raise ValueError("the low bound is not below the high one")
    return low, high


def convert_rows(rows):
    """{pk: (low, high)} for every row of (pk, bottom, top) that holds a range.
    Checks every row before returning, and raises one error that lists each
    row it refused."""
    converted = {}
    refused = []
    for pk, bottom, top in rows:
        try:
            pair = convert_pair(bottom, top)
        except ValueError as exc:
            refused.append(f"  id={pk}: bottom={bottom!r}, top={top!r} ({exc})")
            continue
        if pair is not None:
            converted[pk] = pair
    if refused:
        raise RuntimeError(
            "roster/0067 cannot convert the conductor's vocal range to MIDI. Nothing was written. "
            "Correct or clear these values in table roster_artist (manage.py dbshell), then run "
            "migrate again:\n" + "\n".join(refused)
        )
    return converted


def forward(apps, schema_editor):
    Artist = apps.get_model('roster', 'Artist')
    # `_base_manager`: archived rows hold a verdict too.
    rows = Artist._base_manager.values_list('pk', 'vocal_range_bottom', 'vocal_range_top')
    for pk, (low, high) in convert_rows(rows).items():
        Artist._base_manager.filter(pk=pk).update(assessed_tessitura_low=low, assessed_tessitura_high=high)


def backward(apps, schema_editor):
    Artist = apps.get_model('roster', 'Artist')
    assessed = Artist._base_manager.filter(
        assessed_tessitura_low__isnull=False, assessed_tessitura_high__isnull=False,
    ).values_list('pk', 'assessed_tessitura_low', 'assessed_tessitura_high')
    for pk, low, high in assessed:
        Artist._base_manager.filter(pk=pk).update(
            vocal_range_bottom=midi_to_spn(low), vocal_range_top=midi_to_spn(high),
        )


class Migration(migrations.Migration):

    dependencies = [
        ('roster', '0066_artist_assessed_extreme_high_and_more'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
