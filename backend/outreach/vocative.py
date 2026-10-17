# outreach/vocative.py
# ==========================================
# Outreach — the Polish vocative of a first name, for a letter's greeting
# ==========================================
"""
A Polish letter greets its reader in the vocative: "Dzień dobry, Anno", never "Dzień dobry,
Anna". The list stores the name as the reader typed it, usually in the nominative, so the
greeting declines it here.

Declension is decided by the ending alone, and only for endings whose vocative is regular
enough to be certain. Anything else comes back exactly as typed, which is the greeting the
list gave before this module existed: a name left in the nominative reads as plain, a wrongly
declined one reads as a mistake. For the same reason a name that already ends the way a
vocative does ("Anno", "Kasiu", "Krystianie") is left alone, so a reader who typed the form
they want to be called by gets that form.

Only a single word made of letters is declined. "Anna Maria", "Jean-Luc" or a name with a
digit in it are returned untouched rather than guessed at.
"""

#: Endings that already read as a vocative, or that Polish leaves unchanged in the vocative
#: (Jerzy, Antoni).
_UNCHANGED = ('o', 'u', 'e', 'i', 'y')

#: Diminutives on a softened consonant take -u: Kasia, Zosia, Józia, Dzidzia.
_SOFT_DIMINUTIVES = ('sia', 'zia', 'cia', 'dzia')

#: Masculine stems that decline with a fleeting e: Marek → Marku, Paweł → Pawle,
#: Kacper → Kacprze, Aleksander → Aleksandrze. Longest first.
_FLEETING_E = (
    ('ciek', 'ćku'),
    ('siek', 'śku'),
    ('ander', 'andrze'),
    ('cper', 'cprze'),
    ('eł', 'le'),
)

#: Masculine endings and the vocative that replaces them. Longest first, so `sz` is decided
#: before `z` and `st` before `t`.
_MASCULINE = (
    ('szcz', 'szczu'),
    ('sz', 'szu'),
    ('cz', 'czu'),
    ('rz', 'rzu'),
    ('dż', 'dżu'),
    ('ch', 'chu'),
    ('st', 'ście'),
    ('ś', 'siu'),
    ('ł', 'le'),
    ('r', 'rze'),
    ('t', 'cie'),
    ('d', 'dzie'),
    ('ż', 'żu'),
    ('j', 'ju'),
    ('k', 'ku'),
    ('g', 'gu'),
    ('l', 'lu'),
    ('n', 'nie'),
    ('m', 'mie'),
    ('w', 'wie'),
    ('f', 'fie'),
    ('p', 'pie'),
    ('b', 'bie'),
    ('s', 'sie'),
    ('z', 'zie'),
)

_VOWELS = frozenset('aąeęioóuy')

#: Women's names that end in a consonant. Polish does not decline them, and the masculine
#: rules below would: "Miriam" would become "Miriamie". Not exhaustive; a name added here is
#: one a reader's greeting has shown to need it.
_FEMININE_INDECLINABLE = frozenset({
    'abigail', 'agnes', 'astrid', 'carmen', 'dagmar', 'doris', 'ellen', 'elisabeth',
    'elizabeth', 'esther', 'helen', 'ingrid', 'iris', 'jasmin', 'judith', 'karin', 'kristin',
    'lilian', 'margit', 'mercedes', 'miriam', 'nikol', 'rachel', 'ruth', 'rut', 'sigrid',
    'vivien', 'yasmin',
})


def _feminine(word: str) -> str:
    """The vocative of a name ending in -a."""
    lower = word.lower()
    if lower.endswith(_SOFT_DIMINUTIVES):
        return word[:-1] + 'u'
    # Ania, Hania, Sonia are diminutives; Melania, Stefania take -o like any full name.
    if lower.endswith('nia') and len(lower) <= 5:
        return word[:-1] + 'u'
    # Ola, Ela, Ula, Ala; Kamila and Izabela take -o.
    if lower.endswith('la') and len(lower) <= 3:
        return word[:-1] + 'u'
    # Maja, Kaja; Łucja and Felicja, with a consonant before the j, take -o.
    if lower.endswith('ja') and len(lower) >= 3 and lower[-3] in _VOWELS:
        return word[:-1] + 'u'
    return word[:-1] + 'o'


def _masculine(word: str) -> str:
    """The vocative of a name ending in a consonant, or the name itself when unsure."""
    lower = word.lower()
    # A fleeting e before -k: Marek, Jacek, Franciszek, Bartek. Henryk keeps its vowel.
    if lower.endswith('ek') and len(lower) >= 4 and lower[-3] not in _VOWELS:
        for ending, vocative in _FLEETING_E:
            if lower.endswith(ending):
                return word[: -len(ending)] + vocative
        return word[:-2] + 'ku'
    for ending, vocative in _FLEETING_E:
        if lower.endswith(ending):
            return word[: -len(ending)] + vocative
    for ending, vocative in _MASCULINE:
        if lower.endswith(ending):
            return word[: -len(ending)] + vocative
    return word


def polish_vocative(name: str) -> str:
    """
    `name` in the Polish vocative, or `name` unchanged when its form is not certain.

    Case is kept: the stem is the reader's own, and the new ending follows a name typed in
    capitals.
    """
    word = name.strip()
    if not word or not word.isalpha():
        return name
    lower = word.lower()
    if lower.endswith(_UNCHANGED) or lower in _FEMININE_INDECLINABLE:
        return word
    declined = _feminine(word) if lower.endswith('a') else _masculine(word)
    return declined.upper() if word.isupper() else declined
