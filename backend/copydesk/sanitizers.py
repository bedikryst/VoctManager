"""
@file sanitizers.py
@description Rebuilds an editor's submitted value from a whitelist instead of
             storing what arrived. A browser's `contenteditable` emits `<div>`,
             `<br>` and styled `<span>` into an edited segment; a paste carries
             whole stylesheets. Same failure mode as the annotation payload
             sanitizer — a serializer that rebuilds its payload silently drops
             whatever is not on the list, so the list is the specification.
@architecture Enterprise SaaS 2026
@module copydesk/sanitizers
"""
from __future__ import annotations

import re
from html import escape
from html.parser import HTMLParser

#: The inline vocabulary the site's prose actually uses. Anything else is
#: flattened to its text: markup is not what an editor is being asked for, and a
#: `<span style>` surviving into `concerts.yaml` would put presentation into a
#: content file the guardrails keep free of it.
ALLOWED_TAGS: frozenset[str] = frozenset({"em", "strong", "a"})

#: The attributes that survive: `href` on `<a>`, and `lang` wherever the inline
#: vocabulary goes. Everything else an editor's browser attaches (class, style,
#: dir, data-*) is layout or provenance, not copy.
#:
#: `lang` is here because the corpus writes it: /koncerty names the old
#: `<em lang="fr">Concerts Spirituels</em>` in Polish prose, and an attribute the
#: list does not know is one the round trip through a proposal deletes in
#: silence. It says which language a phrase is in — meaning, not presentation —
#: and a screen reader and the hyphenator both read it.
ALLOWED_ATTRIBUTES: dict[str, frozenset[str]] = {
    "a": frozenset({"href", "lang"}),
    "em": frozenset({"lang"}),
    "strong": frozenset({"lang"}),
}

#: Schemes a link may carry. `javascript:` and `data:` are absent deliberately:
#: these values are rendered into a public static site, and a proposal is
#: written by a person the developer trusts but reviewed as a `git diff`, where
#: a hostile URL is exactly the thing an eye slides past.
_ALLOWED_SCHEMES: frozenset[str] = frozenset({"http", "https", "mailto"})

#: Tags whose whole job is to start a line. Contenteditable wraps every line of
#: a multi-line edit in one of these, so flattening them to nothing would fuse
#: the last word of each line onto the first of the next.
#:
#: The break is emitted on the OPENING tag only. Emitting one on the close as
#: well doubles every line into a blank-line-separated paragraph, because
#: `<div>a</div><div>b</div>` — which is two lines, not two paragraphs — closes
#: and opens back to back. A deliberate blank line survives as two `<br>`.
_LINE_BREAKING_TAGS: frozenset[str] = frozenset({"br", "div", "p", "li", "tr", "h1", "h2", "h3"})

#: Guard against pathological nesting from a paste. Real copy nests one level
#: (`<a>` inside `<em>`); anything deeper is a document, not a sentence.
_MAX_NESTING = 8

_BLANK_RUN = re.compile(r"\n{3,}")
_TRAILING_SPACES = re.compile(r"[ \t]+\n")

#: A language tag the shape BCP 47 gives one: subtags of letters and digits
#: joined by hyphens (`fr`, `pt-BR`, `zh-Hant`).
_LANGUAGE_TAG = re.compile(r"^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$")


def _safe_href(value: str | None) -> str | None:
    """The href to keep, or None to drop the attribute and leave a bare `<a>`.

    A relative path (`/koncerty/wcielenie`) or a fragment is allowed unchanged —
    that is how the site links to itself, and it carries no scheme to check.
    """
    if value is None:
        return None
    href = value.strip()
    if not href:
        return None
    if href.startswith(("/", "#")):
        return href
    scheme, separator, _rest = href.partition(":")
    if not separator:
        # No scheme at all: a bare relative link like `koncerty/wcielenie`.
        return href
    return href if scheme.lower() in _ALLOWED_SCHEMES else None


def _safe_lang(value: str | None) -> str | None:
    """The language tag to keep, or None to drop the attribute.

    Dropped rather than escaped: a `lang` no parser recognises annotates
    nothing, and leaving it in would put a paste's leftovers on the page.
    """
    if value is None:
        return None
    tag = value.strip()
    return tag if _LANGUAGE_TAG.match(tag) else None


#: How each allowed attribute's value is checked. An attribute named in
#: ALLOWED_ATTRIBUTES and missing here is a programming error, and the emit
#: below drops it rather than trusting an unchecked value onto a static site.
_ATTRIBUTE_GUARDS = {"href": _safe_href, "lang": _safe_lang}


class _InlineHtmlSanitizer(HTMLParser):
    """Re-emits a fragment keeping only ALLOWED_TAGS, correctly nested.

    Unbalanced input is normal, not exceptional: a browser hands over `<em>foo`
    as readily as `<em>foo</em>`, and a naive pass-through would leak the open
    tag into the next segment on the page. Open tags are tracked and closed at
    the end, and an end tag with nothing open is dropped.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []
        self._open: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _LINE_BREAKING_TAGS:
            self._parts.append("\n")
        if tag not in ALLOWED_TAGS or len(self._open) >= _MAX_NESTING:
            return
        allowed = ALLOWED_ATTRIBUTES.get(tag, frozenset())
        rendered = [tag]
        seen: set[str] = set()
        for raw_name, value in attrs:
            name = raw_name.lower()
            if name not in allowed or name in seen:
                # A repeated attribute is a paste artefact: the first wins, as a
                # browser's own parser would have it.
                continue
            guard = _ATTRIBUTE_GUARDS.get(name)
            kept = guard(value) if guard else None
            if kept is None:
                continue
            seen.add(name)
            rendered.append(f'{name}="{escape(kept, quote=True)}"')
        self._parts.append(f"<{' '.join(rendered)}>")
        self._open.append(tag)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        # `<br/>` and friends: they break a line and open nothing.
        if tag in _LINE_BREAKING_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag not in ALLOWED_TAGS or tag not in self._open:
            return
        # Close everything opened inside the tag being closed, innermost first,
        # so overlapping input (`<em>a<strong>b</em>c`) still yields valid markup.
        while self._open:
            open_tag = self._open.pop()
            self._parts.append(f"</{open_tag}>")
            if open_tag == tag:
                break

    def handle_data(self, data: str) -> None:
        self._parts.append(escape(data, quote=False))

    def result(self) -> str:
        while self._open:
            self._parts.append(f"</{self._open.pop()}>")
        return "".join(self._parts)


class _TextExtractor(HTMLParser):
    """Everything a fragment says, with nothing it looks like."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _LINE_BREAKING_TAGS:
            self._parts.append("\n")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _LINE_BREAKING_TAGS:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def result(self) -> str:
        return "".join(self._parts)


def _tidy(value: str) -> str:
    """Line endings to LF, no trailing spaces, at most one blank line, stripped."""
    text = value.replace("\r\n", "\n").replace("\r", "\n")
    text = _TRAILING_SPACES.sub("\n", text)
    return _BLANK_RUN.sub("\n\n", text).strip()


def sanitize_html(value: str) -> str:
    """An `html` segment: inline emphasis and links survive, everything else is flattened."""
    parser = _InlineHtmlSanitizer()
    parser.feed(value)
    parser.close()
    return _tidy(parser.result())


def sanitize_text(value: str) -> str:
    """A `text` segment: no HTML path at all.

    Markup is not rejected, it is *removed* — an editor who pasted a formatted
    paragraph into a plain field meant the words, and a 400 would lose them
    without telling them which of the invisible spans was at fault.
    """
    parser = _TextExtractor()
    parser.feed(value)
    parser.close()
    return _tidy(parser.result())
