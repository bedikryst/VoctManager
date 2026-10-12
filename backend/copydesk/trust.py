"""
@file trust.py
@description What a trusted translator's save must pass to be accepted without
             a review. It checks only what needs no knowledge of the language,
             and so what a review of a translation nobody else can read would
             still have caught: the build's `{slots}` and an `HTML` field's link
             targets, both against the Polish the translation ships beside. A
             value that fails waits in the review queue, where checking a slot
             or a link needs no French.
@architecture Enterprise SaaS 2026
@module copydesk/trust
"""
from __future__ import annotations

import re
from html.parser import HTMLParser
from typing import Literal

from .models import SegmentKind

#: Why a trusted save waits for a review. The comment mode explains each one in
#: the editor's language (`web/src/comment-mode/strings.ts`).
HoldReason = Literal["empty", "slots", "links"]

#: A build-time slot (`{name}`), filled by string replacement whatever language
#: surrounds it. Mirrors `PLACEHOLDER` in `web/src/comment-mode/match.ts`.
_SLOT = re.compile(r"\{[A-Za-z][A-Za-z0-9_]*\}")

#: Any pair of braces. Besides the slots, `page.press.contact.list` marks its
#: link with braces around words that ARE translated, so for those only the
#: number of pairs has to match.
_BRACES = re.compile(r"\{[^{}]*\}")


class _LinkCollector(HTMLParser):
    """Every `href` on an `<a>`, unescaped by the parser as the browser would."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hrefs: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        for name, value in attrs:
            if name == "href" and value is not None:
                self.hrefs.add(value.strip())


def _braces(value: str) -> tuple[frozenset[str], int]:
    """The slots a value uses, and how many link markers it carries.

    A set for the slots: the build replaces every occurrence, so a translation
    may use a name once where the Polish uses it twice.
    """
    groups = _BRACES.findall(value)
    slots = frozenset(group for group in groups if _SLOT.fullmatch(group))
    return slots, sum(1 for group in groups if not _SLOT.fullmatch(group))


def _links(value: str) -> frozenset[str]:
    collector = _LinkCollector()
    collector.feed(value)
    collector.close()
    return frozenset(collector.hrefs)


def hold_reason(*, value: str, polish: str, kind: str) -> HoldReason | None:
    """Why `value` cannot be accepted on save beside `polish`, or None.

    `value` is the stored value, after the sanitizer. An empty one is held for
    the reason `EmptyAcceptanceError` exists: `copy:apply` refuses to write it.
    """
    if not value.strip():
        return "empty"
    if _braces(value) != _braces(polish):
        return "slots"
    if kind == SegmentKind.HTML and _links(value) != _links(polish):
        return "links"
    return None
