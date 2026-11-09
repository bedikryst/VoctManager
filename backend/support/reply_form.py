"""
===============================================================================
Support Agent — Reply Form Checks
===============================================================================
Domain: Support
Description:
    Deterministic checks on two rules of the reply that the rubric judge does not
    see: it is written in the language of the report, and it shows neither the
    member's gender nor the agent's own.

    Language is told apart by words that exist in one language only and by Polish
    letters, Polish against English, which is all the reports hold. A text with no
    lead either way has no language, so a reply the check cannot place fails it.

    The gender patterns hold only forms that cannot be read another way: the
    second person past and conditional ("kliknąłeś", "chciałabyś"), "jesteś",
    "będziesz" or "zostaniesz" before a participle ("jesteś wpisany"), "Pan" and
    "Pani" as address, "sam" or "sama" beside a second-person verb, and the agent's
    own past ("przekazałem"). The last ending is shared by nouns in the
    instrumental ("z udziałem", "hasłem"); those nouns are listed and skipped, and
    a noun a run trips on belongs in that list, not in a looser pattern.

Standards: SaaS 2026, no network.
===============================================================================
"""
from __future__ import annotations

import re
from typing import Literal

Language = Literal['pl', 'en']

_WORD = re.compile(r'\w+')
_POLISH_LETTERS = frozenset('ąćęłńóśźż')
# Spellings both languages use ("to", "a", "i", "on", "do", "go", "ten") are left out of both lists.
_POLISH_WORDS = frozenset({
    'w', 'z', 'we', 'ze', 'na', 'się', 'nie', 'jest', 'są', 'ma', 'masz', 'możesz', 'że', 'żeby', 'jak', 'po',
    'czy', 'tak', 'ale', 'co', 'dla', 'od', 'tylko', 'już', 'też', 'gdy', 'przy', 'oraz', 'lub', 'albo', 'ta',
    'tym', 'tej', 'jeśli', 'ani', 'bo', 'jeszcze', 'więc',
})
_ENGLISH_WORDS = frozenset({
    'the', 'and', 'of', 'is', 'are', 'you', 'your', 'in', 'it', 'its', 'that', 'this', 'for', 'with', 'as', 'be',
    'can', 'or', 'not', 'if', 'have', 'has', 'from', 'at', 'by', 'an', 'will', 'there', 'when', 'what', 'which',
    'only', 'does', 'but',
})

_SECOND_PERSON_PAST = re.compile(r'\b\w+(?:łeś|łaś|łbyś|łabyś)\b', re.IGNORECASE)
_PARTICIPLE = re.compile(
    r'\b(?:jesteś|będziesz|zostaniesz)\s+\w+(?:ny|na|ony|ona|ty|ta|wy|wa|ien|ł|ła)\b', re.IGNORECASE,
)
_FORMAL_ADDRESS = re.compile(r'\b(?:Pan|Pana|Panu|Panem|Pani|Panią)\b')
_OWN_PAST = re.compile(r'\b\w+(?:łem|łam|łbym|łabym)\b', re.IGNORECASE)
_INSTRUMENTAL_ENDINGS = ('ołem', 'ółem')
_INSTRUMENTAL_NOUNS = frozenset({
    'udziałem', 'współudziałem', 'działem', 'podziałem', 'przydziałem', 'rozdziałem', 'materiałem', 'kanałem',
    'sygnałem', 'oryginałem', 'chorałem', 'finałem', 'interwałem', 'madrygałem', 'kapitałem', 'ideałem',
    'potencjałem', 'zapałem', 'upałem', 'kawałem', 'regałem', 'generałem', 'kryształem', 'rytuałem', 'kwartałem',
    'tytułem', 'podtytułem', 'artykułem', 'pyłem', 'tłem', 'światłem', 'hasłem', 'pomysłem', 'zmysłem',
    'krzesłem', 'masłem', 'przemysłem', 'namysłem', 'źródłem', 'godłem', 'mydłem', 'szkłem', 'piekłem', 'węzłem',
})
# "sam" agrees with whatever it follows, so it shows the member's gender only beside their own verb.
_CLAUSE_BREAK = re.compile(
    r'[.,;:!?()\n\N{EN DASH}\N{EM DASH}]|\s(?:i|a|ale|lecz|bo|gdy|kiedy|jeśli|jeżeli|że|który|która|które|oraz|albo|lub)\s',
    re.IGNORECASE,
)
_SECOND_PERSON_VERB = re.compile(r'\w+(?:esz|isz|ysz|asz)$', re.IGNORECASE)
_NOT_VERBS = frozenset({'nasz', 'wasz', 'afisz', 'klawisz'})


def language_of(text: str) -> Language | None:
    """The language with more words of its own in the text, or None when neither leads."""
    words = [word.lower() for word in _WORD.findall(text)]
    polish = sum(1 for word in words if word in _POLISH_WORDS or not _POLISH_LETTERS.isdisjoint(word))
    english = sum(1 for word in words if word in _ENGLISH_WORDS)
    if polish == english:
        return None
    return 'pl' if polish > english else 'en'


def in_language_of(reply: str, report: str) -> bool:
    """Whether the reply is in the report's language. A report with no lead puts no demand on it."""
    expected = language_of(report)
    return expected is None or language_of(reply) == expected


def gendered_forms(text: str) -> list[str]:
    """Each form in the text that shows the member's or the agent's gender."""
    found = [
        match.group(0)
        for pattern in (_SECOND_PERSON_PAST, _PARTICIPLE, _FORMAL_ADDRESS)
        for match in pattern.finditer(text)
    ]
    found += [match.group(0) for match in _OWN_PAST.finditer(text) if not _is_instrumental_noun(match.group(0))]
    found += _sam_beside_second_person(text)
    return found


def _is_instrumental_noun(word: str) -> bool:
    lowered = word.lower()
    return lowered in _INSTRUMENTAL_NOUNS or lowered.endswith(_INSTRUMENTAL_ENDINGS)


def _sam_beside_second_person(text: str) -> list[str]:
    """Clauses where "sam" comes right before the member's verb, or closes a clause that holds one."""
    found = []
    for clause in _CLAUSE_BREAK.split(text):
        words = _WORD.findall(clause)
        for index, word in enumerate(words):
            if word.lower() not in ('sam', 'sama'):
                continue
            following = words[index + 1] if index + 1 < len(words) else None
            if (following is not None and _is_second_person(following)) or (
                following is None and any(_is_second_person(earlier) for earlier in words[:index])
            ):
                found.append(clause.strip())
    return found


def _is_second_person(word: str) -> bool:
    return word.lower() not in _NOT_VERBS and _SECOND_PERSON_VERB.search(word) is not None
