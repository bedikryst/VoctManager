"""
@file csv_format.py
@description The shape Polish Excel opens without an import dialog, shared by
             every CSV the finance module hands out: UTF-8 with a BOM, `;`
             between cells, a decimal comma without digit grouping, dd.mm.yyyy
             dates, a hand-typed cell that cannot run as a formula, and an
             identifier Excel does not turn into a number or a date.
@architecture Enterprise SaaS 2026
@module finance/infrastructure/csv_format
"""
import csv
import io
import re
from collections.abc import Iterable, Sequence
from datetime import date
from decimal import Decimal

# Excel reads a cell starting with one of these as a formula. A payee name or a
# note is typed by hand, so text cells that start with one are quoted as text.
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

# Built from its code point: the character itself is invisible in the source.
_BOM = chr(0xFEFF)


# What Excel would read as a number or a date: "0012" loses its zeros and
# "12/2026" becomes December. The pattern admits no quote, so such a value can
# sit inside a text formula's literal without escaping it.
_NUMBER_LIKE = re.compile(r"[\d\s.,/:\-]+|\d+[eE][+-]?\d+")


def text_cell(value: str) -> str:
    return f"'{value}" if value.startswith(_FORMULA_PREFIXES) else value


def code_cell(value: str) -> str:
    """A document or contract number exactly as typed. One that Excel would
    convert is written as the text formula `="0012"`."""
    if value and _NUMBER_LIKE.fullmatch(value):
        return f'="{value}"'
    return text_cell(value)


def amount_cell(value: Decimal | None) -> str:
    """Prints 1250.5 as 1250,50: a decimal comma and no digit grouping, which
    Excel would otherwise have to be told how to read."""
    return "" if value is None else f"{value:.2f}".replace(".", ",")


def date_cell(value: date | None) -> str:
    return "" if value is None else value.strftime("%d.%m.%Y")


def encode_csv(rows: Iterable[Sequence[str]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerows(rows)
    return (_BOM + buffer.getvalue()).encode("utf-8")
