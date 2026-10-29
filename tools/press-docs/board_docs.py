"""
Corrects the board's press documents (DOCX written in Google Docs) and renders them to PDF on the
laptop, keeping the board's layout.

  replace   applies text corrections to DOCX files without touching their layout
  render    sets a DOCX as a PDF through LibreOffice the way Google Docs set it

Run from the repository root with the venv's Python:

  .venv\\Scripts\\python.exe -I tools\\press-docs\\board_docs.py replace FIXES.json SRC_DIR OUT_DIR
  .venv\\Scripts\\python.exe -I tools\\press-docs\\board_docs.py render IN.docx OUT.pdf [--regular TEXT]...

FIXES.json maps a DOCX file name in SRC_DIR to its corrections, `[[find, replace], ...]`. Text in a
DOCX is cut into runs at arbitrary points, so a part's runs are joined, the text is found there and
the change is written back into the runs it spans. A correction that matches nothing stops the run:
a typo in FIXES.json must not pass for a correction made. Each output also carries Word's
`doNotExpandShiftReturn`, so an editor's Word does not stretch the lines Google Docs left alone.

`render` needs the documents' fonts installed (Spectral and Comfortaa for the board's documents;
LibreOffice substitutes silently otherwise — check with `pdffonts`) and works on a copy that differs
from the source only where LibreOffice and Google Docs disagree:
  · "<Family> Light" + bold is set in the SemiBold face, as Google Docs sets it;
  · a header that pushes the date to the margin with tabs and spaces gets one right tab stop at the
    margin, and no line ends in spaces (LibreOffice counts them and wraps the date);
  · a short paragraph set wholly in bold or a SemiBold/Bold face is kept with the next one;
  · a trailing empty paragraph is dropped, so it cannot open a blank last page;
  · paragraphs starting with a `--regular` text lose the bold flag. Google Docs sets the same
    "Light + bold" markup sometimes bold and sometimes regular, so read the board's PDF to know which.
Compare the result with the board's PDF page by page before it replaces anything.

The LibreOffice binary is SOFFICE from the environment, or its default install path.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape, unescape

TEXT_NODE = re.compile(r"(<w:t(?:\s[^>]*)?>)([^<]*)(</w:t>)")
TEXT_PARTS = re.compile(r"word/(document|header\d+|footer\d+)\.xml$")
PARAGRAPH = re.compile(r"<w:p[ >].*?</w:p>", re.S)
RUN_PROPS = re.compile(r"<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>", re.S)
RUN = re.compile(r"<w:r(?:\s[^>]*)?>(?:(?!</w:r>).)*</w:r>", re.S)
HEAVY = re.compile(r'<w:b w:val="1"/>|w:ascii="[^"]*(?:SemiBold|Bold)"')
SPACER = r'(?:<w:tab/>|<w:t xml:space="preserve">\s*</w:t>)'
SOFFICE = os.environ.get("SOFFICE", r"C:\Program Files\LibreOffice\program\soffice.exe")


# ── replace ───────────────────────────────────────────────────────────────────────────────────


def replace_in_part(xml: str, find: str, repl: str) -> tuple[str, int]:
    nodes = list(TEXT_NODE.finditer(xml))
    texts = [unescape(node.group(2)) for node in nodes]
    starts: list[int] = []
    position = 0
    for text in texts:
        starts.append(position)
        position += len(text)
    hits = [hit.start() for hit in re.finditer(re.escape(find), "".join(texts))]
    # Right to left, so an edit never shifts the offsets of a hit still to come.
    for start in reversed(hits):
        end = start + len(find)
        first = next(i for i in range(len(texts)) if starts[i] + len(texts[i]) > start)
        i = first
        while i < len(texts) and starts[i] < end:
            text = texts[i]
            low, high = max(start - starts[i], 0), min(end - starts[i], len(text))
            texts[i] = text[:low] + (repl if i == first else "") + text[high:]
            i += 1
    out: list[str] = []
    last = 0
    for node, text in zip(nodes, texts, strict=True):
        open_tag = node.group(1)
        if text != text.strip() and "xml:space" not in open_tag:
            open_tag = open_tag[:-1] + ' xml:space="preserve">'
        out += [xml[last : node.start()], open_tag, escape(text), node.group(3)]
        last = node.end()
    out.append(xml[last:])
    return "".join(out), len(hits)


def no_expand_shift_return(settings: str) -> str:
    # Google Docs leaves a justified line that ends in a manual break alone; Word stretches it
    # across the page unless the document carries this compatibility flag.
    if "doNotExpandShiftReturn" in settings:
        return settings
    if "<w:compat>" in settings:
        return settings.replace("<w:compat>", "<w:compat><w:doNotExpandShiftReturn/>", 1)
    flag = "<w:compat><w:doNotExpandShiftReturn/></w:compat>"
    if "<w:compat/>" in settings:
        return settings.replace("<w:compat/>", flag, 1)
    return settings.replace("</w:settings>", flag + "</w:settings>", 1)


def replace(fixes_file: Path, source: Path, target: Path) -> None:
    fixes: dict[str, list[list[str]]] = json.loads(fixes_file.read_text(encoding="utf-8"))
    target.mkdir(parents=True, exist_ok=True)
    unmatched: list[str] = []
    for name, pairs in fixes.items():
        counts = [0] * len(pairs)
        with zipfile.ZipFile(source / name) as zin, zipfile.ZipFile(target / name, "w") as zout:
            for info in zin.infolist():
                data = zin.read(info.filename)
                if TEXT_PARTS.match(info.filename):
                    xml = data.decode("utf-8")
                    for k, (find, repl) in enumerate(pairs):
                        xml, count = replace_in_part(xml, find, repl)
                        counts[k] += count
                    data = xml.encode("utf-8")
                elif info.filename == "word/settings.xml":
                    data = no_expand_shift_return(data.decode("utf-8")).encode("utf-8")
                zout.writestr(info, data)
        print(name)
        for (find, _), count in zip(pairs, counts, strict=True):
            print(f"  {count}x  {find}")
            if count == 0:
                unmatched.append(f"{name}: {find}")
    if unmatched:
        sys.exit("No match, nothing was corrected for:\n  " + "\n  ".join(unmatched))


# ── render ────────────────────────────────────────────────────────────────────────────────────


def semibold(props: str) -> str:
    if not re.search(r'w:ascii="[^"]* Light"', props) or '<w:b w:val="1"/>' not in props:
        return props
    props = re.sub(r'(w:\w+=")([^"]*) Light"', r'\1\2 SemiBold"', props)
    return props.replace('<w:b w:val="1"/>', "").replace('<w:bCs w:val="1"/>', "")


def paragraph_text(paragraph: str) -> str:
    return "".join(unescape(node.group(2)) for node in TEXT_NODE.finditer(paragraph)).strip()


def set_regular(xml: str, starts: list[str]) -> str:
    def paragraph(match: re.Match[str]) -> str:
        p = match.group(0)
        if any(paragraph_text(p).startswith(start) for start in starts):
            p = p.replace('<w:b w:val="1"/>', "").replace('<w:bCs w:val="1"/>', "")
        return p

    return PARAGRAPH.sub(paragraph, xml)


def keep_headings(xml: str) -> str:
    def paragraph(match: re.Match[str]) -> str:
        p = match.group(0)
        texted = [run for run in RUN.findall(p) if re.search(r"<w:t(?:\s[^>]*)?>[^<]*\S", run)]
        if not texted or len(paragraph_text(p)) > 80 or "<w:keepNext" in p:
            return p
        if not all(HEAVY.search(run) for run in texted):
            return p
        style = re.search(r"<w:pPr><w:pStyle [^>]*/>", p)
        if style:
            return p.replace(style.group(0), style.group(0) + "<w:keepNext/>", 1)
        return p.replace("<w:pPr>", "<w:pPr><w:keepNext/>", 1)

    return PARAGRAPH.sub(paragraph, xml)


def drop_trailing_empty(xml: str) -> str:
    end = xml.rfind("<w:sectPr")
    start = max(xml.rfind("<w:p ", 0, end), xml.rfind("<w:p>", 0, end))
    tail = xml[start:end]
    if start > 0 and not any(tag in tail for tag in ("<w:t", "<w:br", "<w:drawing")):
        return xml[:start] + xml[end:]
    return xml


def text_width(document: str) -> int:
    def attribute(element: str, name: str) -> float:
        found = re.search(rf'<w:{element} [^>]*w:{name}="([\d.]+)"', document)
        if not found:
            raise SystemExit(f"document.xml has no w:{element} w:{name}")
        return float(found.group(1))

    return int(attribute("pgSz", "w") - attribute("pgMar", "left") - attribute("pgMar", "right"))


def fit_header(xml: str, width: int) -> str:
    def paragraph(match: re.Match[str]) -> str:
        p = match.group(0)
        if "<w:tab/>" in p:
            p = re.sub(f"{SPACER}*<w:tab/>{SPACER}*", "<w:tab/>", p)
            p = re.sub(r'<w:tab/><w:t xml:space="preserve">\s+', '<w:tab/><w:t xml:space="preserve">', p)
            stop = f'<w:pPr><w:tabs><w:tab w:val="right" w:pos="{width}"/></w:tabs>'
            p = p.replace("<w:pPr>", stop, 1)
        nodes = list(TEXT_NODE.finditer(p))
        if not nodes:
            return p
        last = nodes[-1]
        return p[: last.start(2)] + last.group(2).rstrip() + p[last.end(2) :]

    return PARAGRAPH.sub(paragraph, xml)


def render_copy(source: Path, target: Path, regular: list[str]) -> None:
    with zipfile.ZipFile(source) as zin, zipfile.ZipFile(target, "w") as zout:
        width = text_width(zin.read("word/document.xml").decode("utf-8"))
        for info in zin.infolist():
            data = zin.read(info.filename)
            if TEXT_PARTS.match(info.filename):
                xml = data.decode("utf-8")
                if info.filename == "word/document.xml":
                    xml = drop_trailing_empty(keep_headings(set_regular(xml, regular)))
                xml = RUN_PROPS.sub(lambda m: semibold(m.group(0)), xml)
                if info.filename.startswith("word/header"):
                    xml = fit_header(xml, width)
                data = xml.encode("utf-8")
            zout.writestr(info, data)


def render(source: Path, target: Path, regular: list[str]) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        copy = work / f"{target.stem}.docx"
        render_copy(source, copy, regular)
        # A profile of its own, so the run neither reads nor changes the user's LibreOffice.
        profile = (work / "profile").as_uri()
        subprocess.run(
            [
                SOFFICE,
                f"-env:UserInstallation={profile}",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(work),
                str(copy),
            ],
            check=True,
            capture_output=True,
            timeout=300,
        )
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(work / f"{target.stem}.pdf", target)
    print(target)


def main(argv: list[str]) -> None:
    if len(argv) == 4 and argv[0] == "replace":
        replace(Path(argv[1]), Path(argv[2]), Path(argv[3]))
    elif len(argv) >= 3 and argv[0] == "render":
        rest = argv[3:]
        if len(rest) % 2 or any(flag != "--regular" for flag in rest[::2]):
            sys.exit("render IN.docx OUT.pdf [--regular TEXT]...")
        render(Path(argv[1]), Path(argv[2]), rest[1::2])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
