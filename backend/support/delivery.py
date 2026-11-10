"""
===============================================================================
Support Agent — Answering a Stored Report
===============================================================================
Domain: Support
Description:
    Runs the agent on one FeedbackReport and delivers what it decided. The reply
    reaches the reporter in the app as a direct message (CUSTOM_ADMIN_MESSAGE:
    the bell, the toast on next open, push and e-mail by their preferences) whose
    sender is named as the AI assistant. No user account stands behind that name;
    the sender id is the maintainer's, so a read receipt comes back to him. A
    reply over that type's length cap goes by e-mail instead, with replies to the
    mail routed to the maintainer. Every run is a `SupportRun` row; the
    maintainer gets every run's outcome, silences and failures included, with the
    agent's reading and developer note, and the same text is appended to the
    report's triage note in Warsaw time.

    The report reaches the agent in the shape it was evaluated on
    (`support.evaluation.report_for`): Warsaw time, the kind's English label, the
    route with ids masked, a role instead of the reporter's identity, and the same
    person's reports within `BURST` either side as neighbours. The run starts
    shortly after the report (`support.tasks.DELAY`), so of the later reports it
    sees only those already sent by then.

    A burst gets one reply where one will do. A report that another run already
    read as a neighbour, and answered or chose to leave unanswered, gets no run
    of its own: its row says which run covered it, its note says so, and no mail
    goes out, since the covering run's mail was the decision. A later report is
    shown the replies its neighbours were sent, so an addendum written after the
    reply draws only what that reply left open. A run started from the admin
    skips the first check.

    A run that ends on a transient API failure (overload, rate limit, a dropped
    connection, after the SDK's own retries) is tried once more `RETRY_AFTER`
    later; its mail says when.

    Two deterministic checks from `reply_form` stand between the model and the
    reporter: the reply is in the report's language and shows no gender. A reply
    that fails one is held and reaches the maintainer only.

    The panel's build stamp names the last commit that touched frontend/, not
    the deploy, so the backend the reporter used is HEAD of the host checkout.
    While HEAD's frontend/src matches the stamp's, the agent reads HEAD; a panel
    older than that (a service worker still serving a past build) is read at its
    stamp, backend included. A stamp that names no commit here (a build made
    without one, a shallow clone) falls back to HEAD. The maintainer's mail and
    note are Polish by construction, like the report notification in
    `core.services.FeedbackService`.

Standards: SaaS 2026.
===============================================================================
"""
from __future__ import annotations

import datetime as dt
import logging
import re
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Final
from zoneinfo import ZoneInfo

import anthropic
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone, translation

from core.constants import AppRole
from core.models import FeedbackReport
from core.permissions import user_is_manager
from core.services import FeedbackService
from notifications.dtos import CustomAdminMessageMetadata, NotificationCreateDTO
from notifications.email_service import EmailType
from notifications.email_tasks import send_transactional_email_task
from notifications.models import NotificationLevel, NotificationType
from notifications.services import NotificationService
from support.agent import AgentRun, NeighbourReport, ReportInput, run_support_agent
from support.code_reader import CodeReader, CodeReaderError, head_commit, unchanged_between
from support.models import SupportReplyChannel, SupportRun, SupportRunResult, SupportRunTrigger
from support.reply_form import gendered_forms, in_language_of, language_of

logger = logging.getLogger(__name__)

User = get_user_model()

BURST: Final[dt.timedelta] = dt.timedelta(minutes=20)
RETRY_AFTER: Final[dt.timedelta] = dt.timedelta(minutes=15)
# The outcomes that settle every report the run read. A held reply reached nobody.
_SETTLING: Final[tuple[str, ...]] = (SupportRunResult.SENT, SupportRunResult.SILENT)
# `CustomAdminMessageMetadata.message` caps at this; a longer reply goes by e-mail.
_IN_APP_MESSAGE_LIMIT: Final[int] = 2000
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
        'sender_name': "Asystent AI",
        'subject': "Odpowiedź na Twoje zgłoszenie",
        'eyebrow': "VoctManager · Odpowiedź na zgłoszenie",
        'report_label': "Twoje zgłoszenie",
        'note': (
            "Tę odpowiedź przygotował asystent AI na podstawie kodu aplikacji. "
            "Jeśli coś się nie zgadza, odpisz na tę wiadomość: trafi do twórcy Panelu."
        ),
    },
    'en': {
        'sender_name': "AI assistant",
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
    neighbours = list(
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
    replies = _replies_sent(neighbours)
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
                reply_sent=replies.get(other.pk, ''),
            )
            for other in neighbours
        ),
    )


def run_that_read(report: FeedbackReport) -> SupportRun | None:
    """A settled run on another report of the same person that started after this one was filed.

    That run listed every report of the person within `BURST` that existed when it
    started, so it read this one as a neighbour and decided on it.
    """
    if report.reporter_id is None:
        return None
    return (
        SupportRun.objects.filter(
            report__reporter_id=report.reporter_id,
            report__created_at__gte=report.created_at - BURST,
            report__created_at__lte=report.created_at + BURST,
            started_at__gt=report.created_at,
            result__in=_SETTLING,
        )
        .exclude(report=report)
        .select_related('report')
        .order_by('started_at')
        .first()
    )


def should_retry(record: SupportRun) -> bool:
    """One more try for an automatic run that a transient API failure ended."""
    return (
        record.trigger == SupportRunTrigger.AUTO
        and record.result == SupportRunResult.FAILED
        and record.status == 'api_error'
    )


def code_reader_for(report: FeedbackReport, repo: Path) -> CodeReader:
    """The code the reporter used: HEAD while their panel is current, else their panel's commit."""
    version = str(report.context.get('app_version', ''))
    stamp = version.split()[-1] if version.split() else ''
    head = CodeReader(repo, head_commit(repo))
    try:
        built = CodeReader(repo, stamp)
    except CodeReaderError:
        logger.info("support_agent.stamp_unresolved report=%s stamp=%r", report.pk, stamp)
        return head
    return head if unchanged_between(repo, built.commit, head.commit, 'frontend/src/') else built


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
    trigger: SupportRunTrigger = SupportRunTrigger.AUTO,
    client: anthropic.Anthropic | None = None,
    repo: Path | None = None,
) -> SupportRun | None:
    """Run the agent on one report and deliver the outcome. Never raises on a failed run."""
    report = FeedbackReport.objects.select_related('reporter__profile').filter(pk=report_id).first()
    if report is None:
        return None
    if trigger != SupportRunTrigger.MANUAL:
        covering = run_that_read(report)
        if covering is not None:
            return _record_covered(report, trigger, covering)
    # Created before the neighbours are listed: `run_that_read` treats every report
    # filed before `started_at` as read by this run.
    record = SupportRun.objects.create(report=report, trigger=trigger)
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
        _deliver(report, record, run=None, commit='', error=f'{type(exc).__name__}: {exc}')
        return record
    _deliver(report, record, run=run, commit=reader.commit, error='')
    return record


def _record_covered(report: FeedbackReport, trigger: SupportRunTrigger, covering: SupportRun) -> SupportRun:
    record = SupportRun.objects.create(
        report=report,
        trigger=trigger,
        result=SupportRunResult.COVERED,
        covered_by=covering,
        finished_at=timezone.now(),
    )
    decided = "odpowiedź wysłana" if covering.result == SupportRunResult.SENT else "bez odpowiedzi"
    _append_note(report, (
        f"[Agent {_note_stamp()}] Bez osobnego przebiegu: agent przeczytał to zgłoszenie przy zgłoszeniu "
        f"z {covering.report.created_at.astimezone(_WARSAW):%H:%M} ({decided})"
    ))
    return record


def _deliver(
    report: FeedbackReport,
    record: SupportRun,
    *,
    run: AgentRun | None,
    commit: str,
    error: str,
) -> None:
    verdict = verdict_for(report, run) if run is not None else Verdict(reply='', sent=False, held_because='')
    channel = _send_reply(report, verdict.reply) if verdict.sent else ''
    _close(record, run=run, verdict=verdict, channel=channel, commit=commit, error=error)
    summary = _summary(record, run, verdict, error)
    _append_note(report, _note(run, verdict, summary, commit))
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


def _close(
    record: SupportRun,
    *,
    run: AgentRun | None,
    verdict: Verdict,
    channel: str,
    commit: str,
    error: str,
) -> None:
    outcome = run.outcome if run is not None else None
    if outcome is None:
        record.result = SupportRunResult.FAILED
    elif verdict.sent:
        record.result = SupportRunResult.SENT
    elif verdict.held_because:
        record.result = SupportRunResult.HELD
    else:
        record.result = SupportRunResult.SILENT
    record.finished_at = timezone.now()
    record.reply = verdict.reply
    record.channel = channel
    record.held_because = verdict.held_because[:200]
    record.commit = commit
    record.error = error or (run.error or '' if run is not None else '')
    if outcome is not None:
        record.action = outcome.action
        record.reading = outcome.reading
        record.developer_note = outcome.developer_note
    if run is not None:
        record.status = run.status
        record.cost_usd = run.cost_usd.quantize(Decimal('0.0001'))
        record.tool_rounds = run.tool_rounds
        record.elapsed_seconds = run.elapsed_seconds
    record.save()


def _append_note(report: FeedbackReport, text: str) -> None:
    report.refresh_from_db(fields=['note'])
    report.note = f'{report.note}\n\n{text}'.strip()
    report.save(update_fields=['note'])


def _replies_sent(reports: Iterable[FeedbackReport]) -> dict[uuid.UUID, str]:
    """What each report's person was told, oldest reply first where there were several."""
    replies: dict[uuid.UUID, list[str]] = {}
    sent = SupportRun.objects.filter(report__in=list(reports), result=SupportRunResult.SENT).order_by('started_at')
    for record in sent:
        replies.setdefault(record.report_id, []).append(record.reply)
    return {report_id: '\n\n'.join(texts) for report_id, texts in replies.items()}


def _send_reply(report: FeedbackReport, reply: str) -> str:
    """Deliver the reply to the reporter and name the channel it went by."""
    reporter = report.reporter
    if reporter is None:
        return ''
    language = language_of(reply) or 'pl'
    chrome = _REPLY_CHROME[language]
    if len(reply) <= _IN_APP_MESSAGE_LIMIT:
        maintainer_id = (
            User.objects.filter(email__iexact=settings.FEEDBACK_NOTIFICATION_EMAIL).values_list('pk', flat=True).first()
        )
        NotificationService.create_notification(NotificationCreateDTO(
            recipient_id=str(reporter.pk),
            notification_type=NotificationType.CUSTOM_ADMIN_MESSAGE,
            level=NotificationLevel.INFO,
            metadata=CustomAdminMessageMetadata(
                title=chrome['subject'],
                message=reply,
                sender_id=str(maintainer_id or ''),
                sender_name=chrome['sender_name'],
            ),
        ))
        return SupportReplyChannel.APP
    send_transactional_email_task.delay(
        recipient_email=reporter.email,
        subject=chrome['subject'],
        template_name='feedback_reply',
        context={**chrome, 'reply': reply, 'body': report.body},
        fallback_language=language,
        email_type=EmailType.OPERATIONAL,
        reply_to=[settings.FEEDBACK_NOTIFICATION_EMAIL],
    )
    return SupportReplyChannel.EMAIL


_CHANNEL_WORDS: Final[dict[str, str]] = {
    SupportReplyChannel.APP: "w aplikacji",
    SupportReplyChannel.EMAIL: "mailem, za długa na wiadomość w aplikacji",
}


def _summary(record: SupportRun, run: AgentRun | None, verdict: Verdict, error: str) -> str:
    if run is None:
        return f"Agent nie ruszył: {error}"
    if run.outcome is None:
        retry = (
            f"; ponowię około {(timezone.now() + RETRY_AFTER).astimezone(_WARSAW):%H:%M}"
            if should_retry(record) else ''
        )
        return f"Agent nie odpowiedział ({run.status}{': ' + run.error if run.error else ''}){retry}"
    if verdict.sent:
        return f"Odpowiedź wysłana do zgłaszającego ({_CHANNEL_WORDS[record.channel]})"
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
    lines = [f"[Agent {_note_stamp()}] {summary}"]
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


def _note_stamp() -> str:
    """Now, for the triage note: Warsaw time, the clock of the report it sits under."""
    return f"{timezone.now().astimezone(_WARSAW):%Y-%m-%d %H:%M}"


def _offset_words(moment: dt.datetime, primary: dt.datetime) -> str:
    minutes = round((moment - primary).total_seconds() / 60)
    return f"{abs(minutes)} minutes {'later' if minutes >= 0 else 'earlier'}"


def _filed_as(report: FeedbackReport) -> str:
    with translation.override('en'):
        return str(report.get_kind_display())
