# The copy is typeset prose and its apostrophes are typographic on purpose.
# ruff: noqa: RUF001
"""
Sends one concert mail to every confirmed address on the public invitation list (the backend's
`outreach` notice list), from inside the production backend container. It goes out through the
same sender, Reply-To and one-click List-Unsubscribe headers as the list's confirmation mail, and
the addresses never leave the server.

The copy for the evening is COPY below, one entry per language. A CONFIRMED address whose language
has no entry stops the run before anything is sent: falling back to Polish would write to a reader
in a language they did not choose.

Run from the laptop, repository root, against prod:

  scp tools/outreach/notice_reminder.py voct:/root/notice_reminder.py
  ssh voct "cd /root/voctmanager && docker compose -f docker-compose.yml -f docker-compose.prod.yml cp /root/notice_reminder.py web:/tmp/notice_reminder.py && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T -e MODE=preview web python /tmp/notice_reminder.py"

MODE (passed with -e MODE=...):
  preview    counts by status and language, the recipients, and the plain-text mail per language
  test       one mail per language to TEST_TO (-e TEST_TO=...), with inert unsubscribe links
  send       every CONFIRMED address not yet in the send log; a rerun sends only to the rest,
             so it also reaches anyone who confirmed since the previous run
  reconfirm  a fresh confirmation link to every PENDING address, once; it is the only mail a
             PENDING row licenses, so it never carries the concert
EXCLUDE (-e EXCLUDE=a@x,b@y) leaves addresses out of `send` and `reconfirm`.

The send logs live in the container's /tmp, so they last until the container is recreated.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, "/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.conf import settings  # noqa: E402
from django.core.mail import EmailMultiAlternatives  # noqa: E402
from django.template import engines  # noqa: E402
from django.utils import timezone  # noqa: E402

from notifications.email_service import EmailType  # noqa: E402
from outreach.copy import POLICY_PATH  # noqa: E402
from outreach.models import ConcertNoticeSubscription, NoticeStatus, new_token  # noqa: E402
from outreach.services import NoticeListService, unsubscribe_headers, unsubscribe_url  # noqa: E402

SLUG = "pochwala-stworzenia"
SEND_LOG = Path(f"/tmp/notice-reminder-{SLUG}.json")
RECONFIRM_LOG = Path(f"/tmp/notice-reconfirm-{SLUG}.json")
TEMPLATE_NAME = "notice_reminder"
PAUSE_SECONDS = 1.0

CONCERT_PATH = {
    "pl": f"/koncerty/{SLUG}",
    "en": f"/en/koncerty/{SLUG}",
}
MAP_URL = "https://maps.app.goo.gl/YNrqTTynPnUC4fZc8"

COPY: dict[str, dict] = {
    "pl": {
        "subject": "Pochwała Stworzenia · dziś o 13:30",
        "preheader": "Kościół Wszystkich Świętych w Warszawie, kościół górny. Wstęp wolny.",
        "eyebrow": "Nuntius · Zaproszenia",
        "headline": "Pochwała Stworzenia",
        "moment": "Dziś, w niedzielę 11 października, o 13:30",
        "greeting": "Dzień dobry,",
        "paragraphs": [
            "serdecznie zapraszamy na dzisiejszy koncert, którym kończy się festiwal „Fenomen "
            "Człowieka”. Program wyrasta z Pieśni słonecznej św. Franciszka i prowadzi od "
            "zachwytu nad stworzeniem ku nadziei wieczności.",
            "Całą drogę domyka Stetit Angelus Dubry, obraz anioła, który przy ołtarzu ofiaruje "
            "Bogu kadzidło z modlitwami wszystkich świętych. Zaśpiewamy go w kościele pod tym "
            "samym wezwaniem.",
            "Partie wokalne dopełnią skrzypce Radu Ropotana i organy, a całość poprowadzi "
            "Florent de Bazelaire.",
        ],
        "facts": [
            {
                "label": "Gdzie",
                "lines": ["Kościół Wszystkich Świętych, kościół górny", "pl. Grzybowski 3/5, Warszawa"],
                "link": "Mapa dojazdu",
            },
            {"label": "Wstęp", "lines": ["wolny"]},
        ],
        "button": "Program koncertu",
        "closing": "Do zobaczenia",
        "signature": "VoctEnsemble",
        "why": "Ten adres jest na liście zaproszeń VoctEnsemble. Piszemy tylko o koncertach.",
        "controller": (
            "Administratorem danych jest Fundacja VoctFoundation, ul. Św. Filipa 23/3, "
            "31-150 Kraków. Zgodę możesz wycofać w każdej chwili, linkiem poniżej albo pisząc "
            "na rodo@voctensemble.com."
        ),
        "unsubscribeLabel": "Wypisz się z listy",
        "policyLabel": "Polityka prywatności",
    },
    "en": {
        "subject": "In Praise of Creation · today at 1.30 pm",
        "preheader": "All Saints’ Church in Warsaw, upper church. Admission free.",
        "eyebrow": "Nuntius · Invitations",
        "headline": "In Praise of Creation",
        "moment": "Today, Sunday 11 October, at 1.30 pm",
        "greeting": "Hello,",
        "paragraphs": [
            "We warmly invite you to today’s concert, which closes the festival “Fenomen "
            "Człowieka”. The programme grows out of St Francis’s Canticle of the Sun and leads "
            "from wonder at creation towards the hope of eternity.",
            "The journey closes with Dubra’s Stetit Angelus, the angel at the altar offering God incense "
            "with the prayers of all the saints. We sing it in a church dedicated to All Saints.",
            "Radu Ropotan’s violin and the organ join the voices, and Florent de Bazelaire conducts.",
        ],
        "facts": [
            {
                "label": "Where",
                "lines": ["All Saints’ Church, upper church", "pl. Grzybowski 3/5, Warsaw"],
                "link": "Map",
            },
            {"label": "Admission", "lines": ["free"]},
        ],
        "button": "The programme",
        "closing": "See you there",
        "signature": "VoctEnsemble",
        "why": "This address is on the VoctEnsemble invitation list. We write only about concerts.",
        "controller": (
            "The data controller is Fundacja VoctFoundation, ul. Św. Filipa 23/3, 31-150 Kraków, "
            "Poland. You may withdraw your consent at any time, through the link below or by "
            "writing to rodo@voctensemble.com."
        ),
        "unsubscribeLabel": "Unsubscribe",
        "policyLabel": "Privacy policy",
    },
}

SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
SERIF = "Georgia, 'Times New Roman', serif"

HTML = """<!doctype html>
<html lang="{{ lang }}" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>{{ c.headline }}</title>
    <style>
      body, p, h1 { margin: 0; padding: 0; }
      table { border-spacing: 0; }
      .email-shell { width: 560px; max-width: 560px; }
      @media only screen and (max-width: 600px) {
        .outer-cell { padding: 28px 16px !important; }
        .email-shell { width: 100% !important; }
        .masthead { padding: 0 8px 24px !important; }
        .letter-body { padding: 36px 28px !important; }
        .legal-note { padding: 24px 8px 0 !important; }
        .email-h1 { font-size: 33px !important; }
        .fact-label { width: 76px !important; }
        .cta-table, .cta-table tbody, .cta-table tr, .cta-table td, .cta-link { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; width: 100%; background-color: #f4f1e9; color: #161514;">
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #f4f1e9; opacity: 0;">
      {{ c.preheader }}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f4f1e9" style="width: 100%; background-color: #f4f1e9;">
      <tr>
        <td class="outer-cell" align="center" style="padding: 52px 20px 44px;">
          <table role="presentation" class="email-shell" border="0" cellpadding="0" cellspacing="0" width="560" style="width: 560px; max-width: 560px;">
            <tr>
              <td class="masthead" style="padding: 0 8px 28px; border-bottom: 1px solid #c6a45b;">
                <p aria-label="VoctEnsemble" style="font-family: SERIF; font-size: 22px; font-weight: 400; line-height: 1; letter-spacing: 0.09em; color: #161514; margin: 0;">VOCTENSEMBLE</p>
              </td>
            </tr>
            <tr>
              <td class="letter-body" bgcolor="#fbfaf6" style="padding: 46px 48px 44px; background-color: #fbfaf6;">
                <p style="font-family: SANS; font-size: 11px; font-weight: 700; letter-spacing: 0.13em; line-height: 1.5; text-transform: uppercase; color: #8d733d; margin: 0 0 17px;">{{ c.eyebrow }}</p>
                <h1 class="email-h1" style="font-family: SERIF; font-size: 39px; font-weight: 400; line-height: 1.1; color: #161514; margin: 0 0 12px;">{{ c.headline }}</h1>
                <p style="font-family: SERIF; font-size: 18px; font-style: italic; line-height: 1.45; color: #735f35; margin: 0 0 34px;">{{ c.moment }}</p>
                <p style="font-family: SANS; font-size: 16px; line-height: 1.68; color: #34302b; margin: 0 0 6px;">{{ c.greeting }}</p>
                {% for paragraph in c.paragraphs %}<p style="font-family: SANS; font-size: 16px; line-height: 1.68; color: #34302b; margin: 0 0 18px;">{{ paragraph }}</p>
                {% endfor %}
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; margin: 14px 0 30px; border-top: 1px solid #d9d3c7;">
                  {% for fact in c.facts %}<tr>
                    <td class="fact-label" valign="top" width="92" style="width: 92px; padding: 13px 12px 13px 0; border-bottom: 1px solid #d9d3c7; font-family: SANS; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; line-height: 1.9; text-transform: uppercase; color: #8d733d;">{{ fact.label }}</td>
                    <td valign="top" style="padding: 13px 0; border-bottom: 1px solid #d9d3c7; font-family: SERIF; font-size: 17px; line-height: 1.5; color: #161514;">{% for line in fact.lines %}{{ line }}{% if not forloop.last %}<br />{% endif %}{% endfor %}{% if fact.link %}<br /><a href="{{ map_url }}" style="font-family: SANS; font-size: 13px; line-height: 2; color: #735f35; text-decoration: underline;">{{ fact.link }}</a>{% endif %}</td>
                  </tr>
                  {% endfor %}
                </table>
                <table role="presentation" class="cta-table" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; margin: 0 0 34px;">
                  <tr>
                    <td bgcolor="#161514" style="background-color: #161514;">
                      <a class="cta-link" href="{{ concert_url }}" style="display: inline-block; padding: 15px 21px; font-family: SANS; font-size: 13px; font-weight: 700; line-height: 1.2; color: #fbfaf6; text-decoration: none; text-align: center;">{{ c.button }} <span style="color: #d8bd7d;">&rarr;</span></a>
                    </td>
                  </tr>
                </table>
                <p style="font-family: SERIF; font-size: 18px; font-style: italic; line-height: 1.4; color: #34302b; margin: 0 0 4px;">{{ c.closing }}</p>
                <p style="font-family: SERIF; font-size: 13px; letter-spacing: 0.12em; line-height: 1.4; text-transform: uppercase; color: #161514; margin: 0;">{{ c.signature }}</p>
              </td>
            </tr>
            <tr>
              <td class="legal-note" style="padding: 26px 8px 0;">
                <p style="font-family: SANS; font-size: 12px; line-height: 1.62; color: #746d62; margin: 0 0 10px;">{{ c.why }} {{ c.controller }}</p>
                <p style="font-family: SANS; font-size: 12px; line-height: 1.5; margin: 0;"><a href="{{ unsubscribe_url }}" style="color: #735f35; text-decoration: underline;">{{ c.unsubscribeLabel }}</a><span style="color: #a39a8b;">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span><a href="{{ policy_url }}" style="color: #735f35; text-decoration: underline;">{{ c.policyLabel }}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".replace("font-family: SANS", f"font-family: {SANS}").replace("font-family: SERIF", f"font-family: {SERIF}")

TEXT = """{% autoescape off %}{{ c.eyebrow|upper }}

{{ c.headline }}
{{ c.moment }}
=========================================

{{ c.greeting }}
{% for paragraph in c.paragraphs %}
{{ paragraph }}
{% endfor %}
{% for fact in c.facts %}{{ fact.label|upper }}: {{ fact.lines|join:", " }}
{% if fact.link %}{{ fact.link }}: {{ map_url }}
{% endif %}{% endfor %}
{{ c.button|upper }}:
{{ concert_url }}

{{ c.closing }}
{{ c.signature }}

-----------------------------------------

{{ c.why }} {{ c.controller }}
{{ c.unsubscribeLabel }}: {{ unsubscribe_url }}
{{ c.policyLabel }}: {{ policy_url }}
{% endautoescape %}"""

ENGINE = engines["django"]
HTML_TEMPLATE = ENGINE.from_string(HTML)
TEXT_TEMPLATE = ENGINE.from_string(TEXT)

# Polish typesetting keeps a one-letter word, an abbreviation and a day number off the end of a
# line, so each is tied to the word after it with a no-break space. HTML only: in plain text the
# client's own wrapping is all there is, and a no-break space there only hides the line break.
TIE = re.compile(r"(?<!\w)([aiouwzAIOUWZ]|św\.|pl\.|ul\.|\d+) ")


def tied(value):
    if isinstance(value, str):
        return TIE.sub("\\1\u00a0", value)
    if isinstance(value, list):
        return [tied(item) for item in value]
    if isinstance(value, dict):
        return {key: tied(item) for key, item in value.items()}
    return value


def render(subscription: ConcertNoticeSubscription) -> tuple[str, str, str]:
    """Subject, plain text and HTML for one row; raises KeyError for a language COPY lacks."""
    copy = COPY[subscription.locale]
    base = settings.PUBLIC_SITE_URL.rstrip("/")
    context = {
        "lang": subscription.locale,
        "c": copy,
        "concert_url": f"{base}{CONCERT_PATH[subscription.locale]}",
        "map_url": MAP_URL,
        "unsubscribe_url": unsubscribe_url(subscription),
        "policy_url": f"{base}{POLICY_PATH[subscription.locale]}",
    }
    text = TEXT_TEMPLATE.render(context).strip() + "\n"
    html = HTML_TEMPLATE.render({**context, "c": tied(copy)})
    return copy["subject"], text, html


def build(subscription: ConcertNoticeSubscription, to: str, subject_prefix: str = "") -> EmailMultiAlternatives:
    subject, text, html = render(subscription)
    msg = EmailMultiAlternatives(
        subject=subject_prefix + subject,
        body=text,
        from_email=settings.PUBLIC_FROM_EMAIL,
        to=[to],
        reply_to=[settings.PUBLIC_REPLY_TO_EMAIL],
        headers=unsubscribe_headers(subscription),
    )
    msg.attach_alternative(html, "text/html")
    # Read by Anymail as ESP tags, the same pair the dispatcher sets on every mail it sends.
    msg.tags = [EmailType.OPERATIONAL, TEMPLATE_NAME]  # type: ignore[attr-defined]
    return msg


def load_log(path: Path) -> dict[str, dict]:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save_log(path: Path, log: dict[str, dict]) -> None:
    path.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")


def confirmed() -> list[ConcertNoticeSubscription]:
    return list(ConcertNoticeSubscription.objects.filter(status=NoticeStatus.CONFIRMED).order_by("created_at"))


def check_languages(rows: list[ConcertNoticeSubscription]) -> None:
    missing = sorted({row.locale for row in rows} - COPY.keys())
    if missing:
        sys.exit(f"No copy for language(s) {', '.join(missing)}; add them to COPY. Nothing was sent.")


def preview() -> None:
    rows = ConcertNoticeSubscription.objects.all()
    for status in NoticeStatus.values:
        by_locale: dict[str, int] = {}
        for row in rows.filter(status=status):
            by_locale[row.locale] = by_locale.get(row.locale, 0) + 1
        print(f"{status}: {sum(by_locale.values())} {by_locale}")
    recipients = confirmed()
    check_languages(recipients)
    sent = load_log(SEND_LOG)
    print(f"\nFrom: {settings.PUBLIC_FROM_EMAIL}   Reply-To: {settings.PUBLIC_REPLY_TO_EMAIL}")
    print("Recipients (CONFIRMED):")
    for row in recipients:
        mark = "  [already sent]" if sent.get(row.email, {}).get("status") == "sent" else ""
        print(f"  {row.locale}  {row.email}{mark}")
    for locale in sorted({row.locale for row in recipients}):
        sample = next(row for row in recipients if row.locale == locale)
        subject, text, _ = render(sample)
        print(f"\n===== {locale}: {subject}\n\n{text}")


def test() -> None:
    to = os.environ.get("TEST_TO", "").strip()
    if not to:
        sys.exit("Set TEST_TO=<address> for MODE=test.")
    recipients = confirmed()
    check_languages(recipients)
    for locale in sorted({row.locale for row in recipients} | {"pl"}):
        # An unsaved row with a token that matches nobody: the links and the List-Unsubscribe
        # header are real in shape and inert in effect, so clicking them in a test mail cannot
        # withdraw a subscriber's consent.
        inert = ConcertNoticeSubscription(email=to, locale=locale, unsubscribe_token="test-inert-token")
        build(inert, to, subject_prefix="[TEST] ").send()
        print(f"test sent: {locale} -> {to}")


def excluded() -> set[str]:
    return {a.strip().lower() for a in os.environ.get("EXCLUDE", "").split(",") if a.strip()}


def send() -> None:
    recipients = confirmed()
    check_languages(recipients)
    for row in recipients:
        render(row)
    exclude = excluded()
    log = load_log(SEND_LOG)
    queue = [r for r in recipients if log.get(r.email, {}).get("status") != "sent" and r.email not in exclude]
    print(f"{len(queue)} to send, {len(recipients) - len(queue)} already sent or excluded")
    for i, row in enumerate(queue, 1):
        try:
            build(row, row.email).send()
            status = "sent"
        except Exception as exc:  # one refused address must not stop the rest
            status = f"failed: {exc}"
        log[row.email] = {"status": status, "at": timezone.now().isoformat(timespec="seconds")}
        save_log(SEND_LOG, log)
        print(f"[{i}/{len(queue)}] {status}: {row.email}", flush=True)
        if i < len(queue):
            time.sleep(PAUSE_SECONDS)


def reconfirm() -> None:
    log = load_log(RECONFIRM_LOG)
    exclude = excluded()
    pending = ConcertNoticeSubscription.objects.filter(status=NoticeStatus.PENDING).order_by("created_at")
    for row in pending:
        if row.email in exclude:
            print(f"excluded: {row.email}")
            continue
        if row.email in log:
            print(f"already asked again: {row.email}")
            continue
        if row.confirm_resend_blocked:
            print(f"cooldown still running, skipped: {row.email}")
            continue
        # A fresh token and clock, as a repeat sign-up would set them: the old link may be days
        # from expiring, and the purge would take the row with it.
        row.confirm_token = new_token()
        row.confirm_sent_at = timezone.now()
        row.save(update_fields=["confirm_token", "confirm_sent_at", "updated_at"])
        NoticeListService.send_confirmation(row)
        log[row.email] = {"status": "sent", "at": timezone.now().isoformat(timespec="seconds")}
        save_log(RECONFIRM_LOG, log)
        print(f"confirmation sent again: {row.email}", flush=True)


MODES = {"preview": preview, "test": test, "send": send, "reconfirm": reconfirm}
mode = os.environ.get("MODE", "preview")
if mode not in MODES:
    sys.exit(f"MODE must be one of {', '.join(MODES)}.")
MODES[mode]()
