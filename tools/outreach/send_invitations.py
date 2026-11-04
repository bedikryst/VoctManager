"""
Sends the concert mails defined in a send page, one message per recipient, through Gmail SMTP from
the sender's own Google Workspace account, or leaves them in that account's Drafts folder for the
person who signs them to read and send. The page's script is the single source of every text: node
renders it, so the page preview and the sent mail match.

Send pages hold recipients' addresses, so they live with the campaign's records in the foundation
office repository (../VOCTFOUNDATION/relacje/log/), never in this public repository. The 2026-10-09
campaign there is the worked example to copy.

Run from this repository's root (PAGE is relative to the current directory):
  python tools/outreach/send_invitations.py --page PAGE --sender FROM [--login ACCOUNT] --preview
  python tools/outreach/send_invitations.py --page PAGE --sender FROM [--login ACCOUNT] --test
  python tools/outreach/send_invitations.py --page PAGE --sender FROM [--login ACCOUNT] --send
  python tools/outreach/send_invitations.py --page PAGE --sender FROM [--login ACCOUNT] --drafts
  python tools/outreach/send_invitations.py --page PAGE --sender FROM --report

FROM is the address recipients see and the signature carries; ACCOUNT is the Google account that
signs in (default: FROM). Gmail keeps FROM only when it is a verified "Send mail as" alias of
ACCOUNT, otherwise it silently substitutes ACCOUNT, which is why --test exists.

A send page's script, above its "// PAGE:" marker, defines SENDER_NAME, SUBJECT, ATTACHMENT, GROUPS
and body(contact, sender); optionally subjectFor(contact) for per-recipient subjects and TEST_KINDS
for which kinds --test and --preview sample.

ATTACHMENT.path in a page is relative to this repository's root, where the press pack lives.

The Google app password is read from .secrets/gmail-app-password.txt (git-ignored) or from the file
--password-file names; it never appears on the command line. Every delivered or refused address is
recorded in the log (default: next to the page, as <page>.log.json), and a rerun skips the delivered
ones, so an interrupted run resumes where it stopped. --drafts keeps its own log
(<page>.drafts.log.json), since a draft is not a delivery.

--signature-html adds the account's saved signature under each message, as an HTML part. Gmail
inserts a saved signature only when a person starts composing, never into a message that arrives
over SMTP or IMAP, so a page written for such an account ends on its closing line.
"""

from __future__ import annotations

import argparse
import html
import imaplib
import json
import os
import re
import smtplib
import subprocess
import sys
import time
from collections.abc import Callable
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PASSWORD_FILE = ROOT / ".secrets" / "gmail-app-password.txt"
PAGE_MARKER = "// PAGE:"
DEFAULT_TEST_KINDS = ["sisters", "parish", "choir", "school"]
#: A link in running text, leaving out the punctuation that closes the sentence around it.
LINK = re.compile(r"https?://[^\s<]*[^\s<.,;:)]")

RENDER_JS = """
const src = require("fs").readFileSync(0, "utf8");
const run = new Function("sender", src + `
  const subjectOf = typeof subjectFor === "function" ? subjectFor : () => SUBJECT;
  return {
    fromName: SENDER_NAME,
    attachment: ATTACHMENT,
    testKinds: typeof TEST_KINDS === "undefined" ? null : TEST_KINDS,
    messages: GROUPS.flatMap((g) => g.contacts.map((c) => ({
      group: g.title, name: c.name, kind: c.kind, to: c.email, cc: c.cc || "", subject: subjectOf(c),
      body: body(c, sender),
    }))),
  };`);
process.stdout.write(JSON.stringify(run(process.env.VOCT_SENDER)));
"""


def render(sender: str, page: Path) -> dict:
    html = page.read_text(encoding="utf-8")
    script = re.search(r"<script>(.*)</script>", html, re.S)
    if script is None or PAGE_MARKER not in script.group(1):
        sys.exit(f"Cannot find the data part of the script in {page.name}.")
    data_part = script.group(1).split(PAGE_MARKER, 1)[0]
    result = subprocess.run(
        ["node", "-e", RENDER_JS],
        input=data_part,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "VOCT_SENDER": sender},
        check=False,
    )
    if result.returncode != 0:
        sys.exit("node failed to render the messages:\n" + result.stderr)
    return json.loads(result.stdout)


def load_attachment(spec: dict) -> tuple[bytes, str]:
    path = ROOT / spec["path"]
    if not path.exists():
        sys.exit(f"Missing attachment {spec['path']}.")
    return path.read_bytes(), spec["filename"]


def html_body(text: str, signature_html: str) -> str:
    """The message laid out line by line as Gmail composes it, with the saved signature under it."""
    rows = []
    for line in text.split("\n"):
        linked = LINK.sub(lambda m: f'<a href="{m.group(0)}">{m.group(0)}</a>', html.escape(line, quote=False))
        rows.append(f"<div>{linked or '<br>'}</div>")
    return f'<div dir="ltr">{"".join(rows)}<br>{signature_html}</div>'


def plain_signature(signature_html: str) -> str:
    text = re.sub(r"<(?:br|/div|/tr|/p)\b[^>]*>", "\n", signature_html)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


def build(
    fields: dict,
    sender: str,
    from_name: str,
    to: str,
    cc: str,
    subject: str,
    attachment: tuple[bytes, str],
    signature_html: str = "",
) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr((from_name, sender))
    msg["To"] = to
    if cc:
        msg["Cc"] = cc
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=sender.split("@", 1)[1])
    if signature_html:
        msg.set_content(fields["body"] + "\n\n" + plain_signature(signature_html))
        msg.add_alternative(html_body(fields["body"], signature_html), subtype="html")
    else:
        msg.set_content(fields["body"])
    data, filename = attachment
    msg.add_attachment(data, maintype="image", subtype="jpeg", filename=filename)
    return msg


def load_log(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_log(log: dict[str, dict], path: Path) -> None:
    path.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")


def read_password(path: Path) -> str:
    if not path.exists():
        sys.exit(f"Missing {path}: put the Google app password there.")
    return path.read_text(encoding="utf-8-sig").strip().replace(" ", "")


def connect(login: str, password: str) -> smtplib.SMTP:
    smtp = smtplib.SMTP("smtp.gmail.com", 587, timeout=30)
    smtp.starttls()
    smtp.login(login, password)
    return smtp


def drafts_folder(imap: imaplib.IMAP4_SSL) -> str:
    """The Drafts folder as IMAP quotes it. Its name follows the account's language, so it is found by its flag."""
    _, rows = imap.list()
    for row in rows:
        line = row.decode("ascii", "replace") if isinstance(row, bytes) else ""
        if "\\Drafts" in line:
            return line.rsplit(' "/" ', 1)[1]
    sys.exit("The account has no folder flagged as Drafts.")


def leave_as_drafts(
    messages: list[dict],
    compose: Callable[[dict, str, str, str], EmailMessage],
    login: str,
    password: str,
    skip: set[str],
    log_path: Path,
) -> None:
    log = load_log(log_path)
    queue = [m for m in messages if log.get(m["to"], {}).get("status") != "draft" and m["to"].lower() not in skip]
    print(f"{len(queue)} to leave as drafts, {len(messages) - len(queue)} already there or skipped")
    imap = imaplib.IMAP4_SSL("imap.gmail.com", timeout=30)
    imap.login(login, password)
    try:
        folder = drafts_folder(imap)
        for i, m in enumerate(queue, 1):
            draft = compose(m, m["to"], m["cc"], m["subject"])
            imap.append(folder, "(\\Draft)", None, draft.as_bytes())
            log[m["to"]] = {"name": m["name"], "status": "draft", "at": datetime.now().isoformat(timespec="seconds")}
            save_log(log, log_path)
            print(f"[{i}/{len(queue)}] draft: {m['name']} <{m['to']}>", flush=True)
    finally:
        imap.logout()


def samples(messages: list[dict], kinds: list[str]) -> list[dict]:
    return [next(m for m in messages if m["kind"] == kind) for kind in kinds if any(m["kind"] == kind for m in messages)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sender", required=True, help="the From address, also printed in the signature")
    parser.add_argument("--login", default="", help="the Google account that signs in (default: --sender)")
    parser.add_argument("--test-to", default="", help="where --test sends its samples (default: --login)")
    parser.add_argument("--page", required=True, help="the send page")
    parser.add_argument("--log", default="", help="the send log (default: <page>.log.json next to the page)")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--preview", action="store_true")
    mode.add_argument("--test", action="store_true")
    mode.add_argument("--send", action="store_true")
    mode.add_argument("--drafts", action="store_true", help="leave every message in the account's Drafts folder, sending nothing")
    mode.add_argument("--report", action="store_true", help="list who was sent to, grouped, from the log")
    parser.add_argument("--pause", type=float, default=20.0, help="seconds between messages (default 20)")
    parser.add_argument("--skip", default="", help="comma-separated addresses already sent by hand")
    parser.add_argument("--password-file", default=str(PASSWORD_FILE), help="the file holding the account's app password")
    parser.add_argument("--signature-html", default="", help="a file holding the account's saved signature as HTML")
    args = parser.parse_args()

    page = Path(args.page).resolve()
    log_path = Path(args.log).resolve() if args.log else page.with_name(page.stem + ".log.json")
    rendered = render(args.sender, page)
    messages = rendered["messages"]
    from_name = rendered["fromName"]
    attachment = load_attachment(rendered["attachment"])
    test_kinds = rendered["testKinds"] or DEFAULT_TEST_KINDS

    if args.preview:
        print(f"{len(messages)} messages from {from_name} <{args.sender}>\n")
        for sample in samples(messages, test_kinds):
            print(f"--- {sample['kind']}: {sample['to']}  cc: {sample['cc'] or '-'}\n{sample['subject']}\n\n{sample['body']}\n")
        return

    if args.report:
        log = load_log(log_path)
        current = ""
        for m in messages:
            entry = log.get(m["to"])
            if entry is None:
                continue
            if m["group"] != current:
                current = m["group"]
                print(f"\n{current}")
            address = m["to"] + (f" (kopia: {m['cc']})" if m["cc"] else "")
            failed = "" if entry["status"] == "sent" else "  [NIEDORĘCZONY]"
            print(f"- {m['name']}: {address}{failed}")
        return

    login = args.login or args.sender
    skip = {a.strip().lower() for a in args.skip.split(",") if a.strip()}
    password = read_password(Path(args.password_file).resolve())
    signature_html = Path(args.signature_html).read_text(encoding="utf-8") if args.signature_html else ""

    def compose(fields: dict, to: str, cc: str, subject: str) -> EmailMessage:
        return build(fields, args.sender, from_name, to, cc, subject, attachment, signature_html)

    if args.drafts:
        drafts_log = Path(args.log).resolve() if args.log else page.with_name(page.stem + ".drafts.log.json")
        leave_as_drafts(messages, compose, login, password, skip, drafts_log)
        return

    smtp = connect(login, password)
    try:
        if args.test:
            test_to = args.test_to or login
            for sample in samples(messages, test_kinds):
                subject = f"[TEST, docelowo: {sample['to']}] {sample['subject']}"
                smtp.send_message(compose(sample, test_to, "", subject))
                print(f"test sent: {sample['kind']} -> {test_to}")
            return

        log = load_log(log_path)
        queue = [m for m in messages if log.get(m["to"], {}).get("status") != "sent" and m["to"].lower() not in skip]
        print(f"{len(queue)} to send, {len(messages) - len(queue)} already sent or skipped")
        for i, m in enumerate(queue, 1):
            try:
                smtp.send_message(compose(m, m["to"], m["cc"], m["subject"]))
                status = "sent"
            except smtplib.SMTPRecipientsRefused as exc:
                status = f"refused: {exc.recipients}"
            log[m["to"]] = {"name": m["name"], "status": status, "at": datetime.now().isoformat(timespec="seconds")}
            save_log(log, log_path)
            print(f"[{i}/{len(queue)}] {status}: {m['name']} <{m['to']}>", flush=True)
            if i < len(queue):
                time.sleep(args.pause)
    finally:
        smtp.quit()


if __name__ == "__main__":
    main()
