"""
===============================================================================
Support Agent — Celery Entry Point
===============================================================================
Domain: Support
Description:
    Queues the agent for a new feedback report and runs it on the worker, and
    skips it entirely where no Anthropic key is configured (dev, tests) or
    `SUPPORT_AGENT_ENABLED` is off. The switch is read again when a queued run
    starts, so turning it off also stops runs already waiting. A run started from
    the admin ignores it: that is a person asking for this one run.

    The run waits `DELAY`, long enough for the addendum a reporter sends right
    after hitting send, and short enough that the reply beats them finding the
    answer themselves. In the mailbox, 5 of 41 follow-ups within twenty minutes
    came inside two; the rest reach the agent only when they are earlier
    neighbours of a later report.

    An automatic run ended by a transient API failure queues itself once more
    (`support.delivery.should_retry`); the retry is not retried again.

    Prod runs one worker with beat embedded, so a run holds the queue while it
    lasts: about a minute typically (62 s median over the API), and the agent's
    own five-minute deadline sits inside the soft limit below.

Standards: SaaS 2026.
===============================================================================
"""
from __future__ import annotations

import datetime as dt
from typing import Final

from celery import shared_task
from django.conf import settings
from django.db import transaction

from core.models import FeedbackReport
from support.delivery import RETRY_AFTER, answer_report, should_retry
from support.models import SupportRunTrigger

DELAY: Final[dt.timedelta] = dt.timedelta(minutes=2)


@shared_task(name='support.answer_feedback_report', soft_time_limit=600, time_limit=660)
def answer_feedback_report_task(report_id: str, trigger: str = SupportRunTrigger.AUTO.value) -> None:
    if trigger != SupportRunTrigger.MANUAL and not settings.SUPPORT_AGENT_ENABLED:
        return
    record = answer_report(report_id, trigger=SupportRunTrigger(trigger))
    if record is not None and should_retry(record):
        answer_feedback_report_task.apply_async(
            args=[report_id],
            kwargs={'trigger': SupportRunTrigger.RETRY.value},
            countdown=int(RETRY_AFTER.total_seconds()),
        )


def schedule_answer(report: FeedbackReport) -> None:
    """Queue the agent for a report once the request that filed it has committed."""
    if not settings.ANTHROPIC_API_KEY or not settings.SUPPORT_AGENT_ENABLED:
        return
    report_id = str(report.pk)
    transaction.on_commit(
        lambda: answer_feedback_report_task.apply_async(args=[report_id], countdown=int(DELAY.total_seconds())),
    )


def queue_manual_run(report: FeedbackReport) -> None:
    """Run the agent on a report now, whatever earlier runs did with it."""
    answer_feedback_report_task.delay(str(report.pk), trigger=SupportRunTrigger.MANUAL.value)
