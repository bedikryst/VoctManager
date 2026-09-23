"""
@file amount_words.py
@description An amount as a Polish document prints it: in figures ("1 500,00")
             and in words for the "słownie" line of a contract or a bill ("tysiąc
             pięćset złotych zero groszy"). Pure functions; Polish only, like the
             documents that use them.
@architecture Enterprise SaaS 2026
@module finance/infrastructure/amount_words
"""
from decimal import ROUND_HALF_UP, Decimal

_GROSZ = Decimal("0.01")

_UNITS = ("", "jeden", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem", "dziewięć")
_TEENS = (
    "dziesięć", "jedenaście", "dwanaście", "trzynaście", "czternaście",
    "piętnaście", "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście",
)
_TENS = (
    "", "", "dwadzieścia", "trzydzieści", "czterdzieści",
    "pięćdziesiąt", "sześćdziesiąt", "siedemdziesiąt", "osiemdziesiąt", "dziewięćdziesiąt",
)
_HUNDREDS = (
    "", "sto", "dwieście", "trzysta", "czterysta",
    "pięćset", "sześćset", "siedemset", "osiemset", "dziewięćset",
)

# (one, few, many): "1 tysiąc", "2 to 4 tysiące", "5+ tysięcy".
type Forms = tuple[str, str, str]

# Largest first. A ledger amount has ten digits with two decimals, so millions
# are the top scale it can reach.
_SCALES: tuple[tuple[int, Forms], ...] = (
    (1_000_000, ("milion", "miliony", "milionów")),
    (1_000, ("tysiąc", "tysiące", "tysięcy")),
)
_ZLOTY: Forms = ("złoty", "złote", "złotych")
_GROSZE: Forms = ("grosz", "grosze", "groszy")

# A group of thousands at or above this has no scale word to carry it.
_CEILING = 1_000_000_000

# U+00A0: a number is never broken across a line between its digit groups.
_GROUP_SEPARATOR = chr(0x00A0)


def plural_form(count: int, forms: Forms) -> str:
    """The Polish noun form a numeral governs: 1 takes the singular; a number
    ending in 2 to 4 takes the "few" form, except 12 to 14; everything else —
    0, 5 to 21, 25, 111 — takes the genitive plural."""
    if count == 1:
        return forms[0]
    if 2 <= count % 10 <= 4 and not 12 <= count % 100 <= 14:
        return forms[1]
    return forms[2]


def _below_thousand(number: int) -> list[str]:
    hundreds, rest = divmod(number, 100)
    tens, units = divmod(rest, 10)
    words = [_HUNDREDS[hundreds]]
    if tens == 1:
        words.append(_TEENS[units])
    else:
        words.extend((_TENS[tens], _UNITS[units]))
    return [word for word in words if word]


def number_to_words_pl(number: int) -> str:
    """A non-negative integer below a billion in Polish words. One thousand and
    one million are "tysiąc" and "milion", never "jeden tysiąc"."""
    if number < 0 or number >= _CEILING:
        raise ValueError(f"{number} is outside the range a ledger amount can take.")
    if number == 0:
        return "zero"
    words: list[str] = []
    rest = number
    for scale, forms in _SCALES:
        count, rest = divmod(rest, scale)
        if count == 0:
            continue
        if count > 1:
            words.extend(_below_thousand(count))
        words.append(plural_form(count, forms))
    words.extend(_below_thousand(rest))
    return " ".join(words)


def _to_grosz(amount: Decimal) -> Decimal:
    value = amount.quantize(_GROSZ, rounding=ROUND_HALF_UP)
    if value < 0:
        raise ValueError("A document amount cannot be negative.")
    return value


def amount_to_words_pl(amount: Decimal) -> str:
    """1500.50 reads "tysiąc pięćset złotych pięćdziesiąt groszy". Grosze are
    always spelled out, "zero groszy" included, so the line cannot be extended
    by hand after printing."""
    value = _to_grosz(amount)
    zlote = int(value)
    grosze = int((value - zlote) * 100)
    return (
        f"{number_to_words_pl(zlote)} {plural_form(zlote, _ZLOTY)} "
        f"{number_to_words_pl(grosze)} {plural_form(grosze, _GROSZE)}"
    )


def format_amount_pl(amount: Decimal) -> str:
    """1500.5 prints as "1 500,50": a decimal comma and a no-break space between
    digit groups, as a Polish contract prints a sum."""
    value = _to_grosz(amount)
    zlote, grosze = f"{value:.2f}".split(".")
    groups: list[str] = []
    while len(zlote) > 3:
        zlote, group = zlote[:-3], zlote[-3:]
        groups.insert(0, group)
    groups.insert(0, zlote)
    return f"{_GROUP_SEPARATOR.join(groups)},{grosze}"
