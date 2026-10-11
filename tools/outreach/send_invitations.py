"""
Sends the concert mails defined in a send page, one message per recipient, through Gmail SMTP from
the sender's own Google Workspace account. The page's script is the single source of every text:
node renders it, so the page preview and the sent mail match.

Send pages hold recipients' addresses, so they live with the campaign's records in the foundation
office repository (../VOCTFOUNDATION/relacje/log/), never in this public repository. The 2026-10-09
campaign there is the worked example to copy.

Run from this repository's root (PAGE is relative to the current directory):
  python tools/outreach/send_invitations.py --page PAGE --sender FROM [--login ACCOUNT] --preview
  python tools/outreach/send_invitations.py --page PAGE --sender FROM [--login ACCOUNT] --test
  python tools/outreach/send_invitations.py --page PAGE --sender FROM [--login ACCOUNT] --send
  python tools/outreach/send_invitations.py --page PAGE --sender FROM --report

FROM is the address recipients see and the signature carries; ACCOUNT is the Google account that
signs in (default: FROM). Gmail keeps FROM only when it is a verified "Send mail as" alias of
ACCOUNT, otherwise it silently substitutes ACCOUNT, which is why --test exists.

A send page's script, above its "// PAGE:" marker, defines SENDER_NAME, SUBJECT, ATTACHMENT, GROUPS
and body(contact, sender); optionally subjectFor(contact) for per-recipient subjects and TEST_KINDS
for which kinds --test and --preview sample.

ATTACHMENT.path in a page is relative to this repository's root, where the press pack lives.

The Google app password is read from .secrets/gmail-app-password.txt (git-ignored); it never appears
on the command line. Every delivered or refused address is recorded in the log (default: next to the
page, as <page>.log.json), and a rerun skips the delivered ones, so an interrupted run resumes where
it stopped.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import smtplib
import subprocess
import sys
import time
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PASSWORD_FILE = ROOT / ".secrets" / "gmail-app-password.txt"
PAGE_MARKER = "// PAGE:"
DEFAULT_TEST_KINDS = ["sisters", "parish", "choir", "school"]

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


def build(
    fields: dict, sender: str, from_name: str, to: str, cc: str, subject: str, attachment: tuple[bytes, str]
) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr((from_name, sender))
    msg["To"] = to
    if cc:
        msg["Cc"] = cc
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=sender.split("@", 1)[1])
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


def connect(login: str) -> smtplib.SMTP:
    if not PASSWORD_FILE.exists():
        sys.exit(f"Missing {PASSWORD_FILE.relative_to(ROOT)}: put the Google app password there.")
    password = PASSWORD_FILE.read_text(encoding="utf-8-sig").strip().replace(" ", "")
    smtp = smtplib.SMTP("smtp.gmail.com", 587, timeout=30)
    smtp.starttls()
    smtp.login(login, password)
    return smtp


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
    mode.add_argument("--report", action="store_true", help="list who was sent to, grouped, from the log")
    parser.add_argument("--pause", type=float, default=20.0, help="seconds between messages (default 20)")
    parser.add_argument("--skip", default="", help="comma-separated addresses already sent by hand")
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
    smtp = connect(login)
    try:
        if args.test:
            test_to = args.test_to or login
            for sample in samples(messages, test_kinds):
                subject = f"[TEST, docelowo: {sample['to']}] {sample['subject']}"
                smtp.send_message(build(sample, args.sender, from_name, test_to, "", subject, attachment))
                print(f"test sent: {sample['kind']} -> {test_to}")
            return

        log = load_log(log_path)
        skip = {a.strip().lower() for a in args.skip.split(",") if a.strip()}
        queue = [m for m in messages if log.get(m["to"], {}).get("status") != "sent" and m["to"].lower() not in skip]
        print(f"{len(queue)} to send, {len(messages) - len(queue)} already sent or skipped")
        for i, m in enumerate(queue, 1):
            try:
                smtp.send_message(build(m, args.sender, from_name, m["to"], m["cc"], m["subject"], attachment))
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
