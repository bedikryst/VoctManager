"""
===============================================================================
Support Agent — Celery Entry Point
===============================================================================
Domain: Support
Description:
    Queues the agent for a new feedback report and runs it on the worker, and
    skips it entirely where no Anthropic key is configured (dev, tests).

    The run waits `DELAY`, long enough for the addendum a reporter sends right
    after hitting send, and short enough that the reply beats them finding the
    answer themselves. In the mailbox, 5 of 41 follow-ups within twenty minutes
    came inside two; the rest reach the agent only when they are earlier
    neighbours of a later report.

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
from support.delivery import answer_report

DELAY: Final[dt.timedelta] = dt.timedelta(minutes=2)


@shared_task(name='support.answer_feedback_report', soft_time_limit=600, time_limit=660)
def answer_feedback_report_task(report_id: str) -> None:
    answer_report(report_id)


def schedule_answer(report: FeedbackReport) -> None:
    """Queue the agent for a report once the request that filed it has committed."""
    if not settings.ANTHROPIC_API_KEY:
        return
    report_id = str(report.pk)
    transaction.on_commit(
        lambda: answer_feedback_report_task.apply_async(args=[report_id], countdown=int(DELAY.total_seconds())),
    )
