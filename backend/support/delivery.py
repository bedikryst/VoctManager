"""
===============================================================================
Support Agent — Answering a Stored Report
===============================================================================
Domain: Support
Description:
    Runs the agent on one FeedbackReport and delivers what it decided. The reply
    goes to the reporter by e-mail, marked as written by an AI assistant, with
    replies to it routed to the maintainer. The maintainer gets every outcome,
    silences and failures included, with the agent's reading and developer note,
    and the same text is appended to the report's triage note.

    The report reaches the agent in the shape it was evaluated on
    (`support.evaluation.report_for`): Warsaw time, the kind's English label, the
    route with ids masked, a role instead of the reporter's identity, and the same
    person's reports within `BURST` either side as neighbours. The run starts
    shortly after the report (`support.tasks.DELAY`), so of the later reports it
    sees only those already sent by then.

    Two deterministic checks from `reply_form` stand between the model and the
    reporter: the reply is in the report's language and shows no gender. A reply
    that fails one is held and reaches the maintainer only.

    The agent reads the code at the report's build stamp and falls back to HEAD
    when the stamp does not resolve (a build made without a commit, a shallow
    clone). The maintainer's mail and note are Polish by construction, like the
    report notification in `core.services.FeedbackService`.

Standards: SaaS 2026.
===============================================================================
"""
from __future__ import annotations

import datetime as dt
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Final
from zoneinfo import ZoneInfo

import anthropic
from django.conf import settings
from django.utils import timezone, translation

from core.constants import AppRole
from core.models import FeedbackReport
from core.permissions import user_is_manager
from core.services import FeedbackService
from notifications.email_service import EmailType
from notifications.email_tasks import send_transactional_email_task
from support.agent import AgentRun, NeighbourReport, ReportInput, run_support_agent
from support.code_reader import CodeReader, CodeReaderError, head_commit
from support.reply_form import gendered_forms, in_language_of, language_of

logger = logging.getLogger(__name__)

BURST: Final[dt.timedelta] = dt.timedelta(minutes=20)
REQUEST_TIMEOUT_SECONDS: Final[float] = 180.0
MAX_RETRIES: Final[int] = 4

_WARSAW: Final[ZoneInfo] = ZoneInfo('Europe/Warsaw')
_UUID: Final[re.Pattern[str]] = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

_ROLES: Final[dict[str, str]] = {
    AppRole.MANAGER: "one of the ensemble's managers, such as its conductor, who has manager permissions in the app",
    AppRole.ARTIST: "a singer of the ensemble, with no manager permissions in the app",
    AppRole.CREW: "a collaborator of the ensemble (crew), with no manager permissions in the app",
}
_DELETED_ROLE: Final[str] = "a former member whose account has since been deleted"

# The reply's chrome follows the reply, which the agent writes in the report's
# language, not the reporter's profile locale; `reply_form` tells only these two apart.
_REPLY_CHROME: Final[dict[str, dict[str, str]]] = {
    'pl': {
        'subject': "Odpowiedź na Twoje zgłoszenie",
        'eyebrow': "VoctManager · Odpowiedź na zgłoszenie",
        'report_label': "Twoje zgłoszenie",
        'note': (
            "Tę odpowiedź przygotował asystent AI na podstawie kodu aplikacji. "
            "Jeśli coś się nie zgadza, odpisz na tę wiadomość: trafi do twórcy Panelu."
        ),
    },
    'en': {
        'subject': "A reply to your report",
        'eyebrow': "VoctManager · A reply to your report",
        'report_label': "Your report",
        'note': (
            "This reply was written by an AI assistant from the app's code. "
            "If something doesn't add up, reply to this email and it will reach the panel's developer."
        ),
    },
}


@dataclass(frozen=True)
class Verdict:
    """What happened to the agent's reply. `held_because` is empty unless a check stopped it."""
    reply: str
    sent: bool
    held_because: str


def report_input(report: FeedbackReport) -> ReportInput:
    """The report as the agent sees it: no name, no e-mail, no id."""
    reporter = report.reporter
    neighbours = (
        FeedbackReport.objects.filter(
            reporter=reporter,
            created_at__gte=report.created_at - BURST,
            created_at__lte=report.created_at + BURST,
        )
        .exclude(pk=report.pk)
        .order_by('created_at')
        if reporter is not None
        else FeedbackReport.objects.none()
    )
    return ReportInput(
        sent=_stamp(report.created_at),
        filed_as=_filed_as(report),
        screen=_UUID.sub('<id>', report.route),
        reporter_role=_role(report),
        body=report.body,
        neighbours=tuple(
            NeighbourReport(
                offset=_offset_words(other.created_at, report.created_at),
                filed_as=_filed_as(other),
                screen=_UUID.sub('<id>', other.route),
                body=other.body,
            )
            for other in neighbours
        ),
    )


def code_reader_for(report: FeedbackReport, repo: Path) -> CodeReader:
    """The code at the report's build, or at HEAD when its stamp names no commit here."""
    version = str(report.context.get('app_version', ''))
    stamp = version.split()[-1] if version.split() else ''
    try:
        return CodeReader(repo, stamp)
    except CodeReaderError:
        logger.info("support_agent.stamp_unresolved report=%s stamp=%r", report.pk, stamp)
        return CodeReader(repo, head_commit(repo))


def verdict_for(report: FeedbackReport, run: AgentRun) -> Verdict:
    """Whether the reply may go to the reporter. Silence and a failed run send nothing."""
    reply = run.outcome.reply.strip() if run.outcome is not None else ''
    if not reply:
        return Verdict(reply='', sent=False, held_because='')
    if report.reporter is None or not report.reporter.email:
        return Verdict(reply=reply, sent=False, held_because="konto zgłaszającego nie istnieje")
    if not in_language_of(reply, report.body):
        return Verdict(reply=reply, sent=False, held_because="odpowiedź w innym języku niż zgłoszenie")
    forms = gendered_forms(reply)
    if forms:
        return Verdict(reply=reply, sent=False, held_because=f"formy z rodzajem: {', '.join(forms)}")
    return Verdict(reply=reply, sent=True, held_because='')


def answer_report(
    report_id: str,
    *,
    client: anthropic.Anthropic | None = None,
    repo: Path | None = None,
) -> None:
    """Run the agent on one report and deliver the outcome. Never raises on a failed run."""
    report = FeedbackReport.objects.select_related('reporter__profile').filter(pk=report_id).first()
    if report is None:
        return
    try:
        reader = code_reader_for(report, repo or Path(settings.SUPPORT_AGENT_REPO))
        run = run_support_agent(
            report=report_input(report),
            reader=reader,
            client=client or anthropic.Anthropic(
                api_key=settings.ANTHROPIC_API_KEY,
                timeout=REQUEST_TIMEOUT_SECONDS,
                max_retries=MAX_RETRIES,
            ),
        )
    except Exception as exc:
        # A bad key, an empty balance or a missing repo fails every later run the
        # same way; the maintainer hears of it on the first one.
        logger.exception("support_agent.failed report=%s", report.pk)
        _deliver(report, run=None, commit='', error=f'{type(exc).__name__}: {exc}')
        return
    _deliver(report, run=run, commit=reader.commit, error='')


def _deliver(report: FeedbackReport, *, run: AgentRun | None, commit: str, error: str) -> None:
    verdict = verdict_for(report, run) if run is not None else Verdict(reply='', sent=False, held_because='')
    if verdict.sent and report.reporter is not None:
        chrome = _REPLY_CHROME[language_of(verdict.reply) or 'pl']
        send_transactional_email_task.delay(
            recipient_email=report.reporter.email,
            subject=chrome['subject'],
            template_name='feedback_reply',
            context={**chrome, 'reply': verdict.reply, 'body': report.body},
            fallback_language=language_of(verdict.reply) or 'pl',
            email_type=EmailType.OPERATIONAL,
            reply_to=[settings.FEEDBACK_NOTIFICATION_EMAIL],
        )
    summary = _summary(run, verdict, error)
    note = _note(run, verdict, summary, commit)
    report.refresh_from_db(fields=['note'])
    report.note = f'{report.note}\n\n{note}'.strip()
    report.save(update_fields=['note'])
    outcome = run.outcome if run is not None else None
    send_transactional_email_task.delay(
        recipient_email=settings.FEEDBACK_NOTIFICATION_EMAIL,
        subject=f"[Agent] {FeedbackService.build_subject(report)}",
        template_name='feedback_agent_outcome',
        context={
            'summary': summary,
            'body': report.body,
            'reply': verdict.reply,
            'reading': outcome.reading if outcome is not None else '',
            'developer_note': outcome.developer_note if outcome is not None else '',
            'action': outcome.action if outcome is not None else '',
            'stats': _stats(run, commit),
            'admin_url': f"{settings.FRONTEND_URL}/admin/core/feedbackreport/{report.pk}/change/",
        },
        fallback_language='pl',
        email_type=EmailType.OPERATIONAL,
    )


def _summary(run: AgentRun | None, verdict: Verdict, error: str) -> str:
    if run is None:
        return f"Agent nie ruszył: {error}"
    if run.outcome is None:
        return f"Agent nie odpowiedział ({run.status}{': ' + run.error if run.error else ''})"
    if verdict.sent:
        return "Odpowiedź wysłana do zgłaszającego"
    if verdict.held_because:
        return f"Odpowiedź wstrzymana: {verdict.held_because}"
    return "Bez odpowiedzi do zgłaszającego"


def _stats(run: AgentRun | None, commit: str) -> str:
    if run is None:
        return ''
    limit = f" · limit: {run.limit_hit}" if run.limit_hit else ''
    return (
        f"${run.cost_usd:.2f} · {run.tool_rounds} rund narzędzi · {run.elapsed_seconds:.0f} s"
        f" · kod z {commit[:8]}{limit}"
    )


def _note(run: AgentRun | None, verdict: Verdict, summary: str, commit: str) -> str:
    outcome = run.outcome if run is not None else None
    lines = [f"[Agent {timezone.localtime():%Y-%m-%d %H:%M}] {summary}"]
    if run is not None:
        lines.append(_stats(run, commit))
    if outcome is not None:
        lines += [f"Akcja: {outcome.action}", f"Odczytanie: {outcome.reading}"]
        if verdict.reply:
            lines += ["Odpowiedź:", verdict.reply]
        if outcome.developer_note:
            lines += ["Notatka dla dewelopera:", outcome.developer_note]
    return '\n'.join(lines)


def _role(report: FeedbackReport) -> str:
    reporter = report.reporter
    if reporter is None:
        return _DELETED_ROLE
    if user_is_manager(reporter):
        return _ROLES[AppRole.MANAGER]
    profile = getattr(reporter, 'profile', None)
    return _ROLES.get(profile.role if profile is not None else AppRole.ARTIST, _ROLES[AppRole.ARTIST])


def _stamp(moment: dt.datetime) -> str:
    local = moment.astimezone(_WARSAW)
    return f"{local:%Y-%m-%d %H:%M} ({local:%A}, Warsaw time)"


def _offset_words(moment: dt.datetime, primary: dt.datetime) -> str:
    minutes = round((moment - primary).total_seconds() / 60)
    return f"{abs(minutes)} minutes {'later' if minutes >= 0 else 'earlier'}"


def _filed_as(report: FeedbackReport) -> str:
    with translation.override('en'):
        return str(report.get_kind_display())
