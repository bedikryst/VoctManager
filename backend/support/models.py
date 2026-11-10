"""
===============================================================================
Support Agent — Run Records
===============================================================================
Domain: Support
Description:
    One row each time the agent takes up a report: what started it, what it
    decided, where the reply went, what it cost and which commit it read. The
    report's triage note carries the same outcome as text; these rows are the
    structured record behind it, and the delivery asks two questions of them.

    Whether a report still needs a run of its own. A run reads every report of
    the same person within `support.delivery.BURST` that exists when it starts,
    so a report filed before another run's `started_at` has been read already.
    Only a run that ended in a sent reply or a decided silence counts: a held
    reply or a failure answered nothing.

    What the person was already told. A later run is shown the replies sent to
    its neighbours, so an addendum does not draw the same reply twice.

    Which conversation a reply continues. A reply in Messages names its thread,
    and a later reply in the same burst goes into it, after only the reports no
    earlier reply there had read.

Standards: SaaS 2026.
===============================================================================
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _

from core.models import FeedbackReport


class SupportRunTrigger(models.TextChoices):
    AUTO = 'AUTO', _('After the report')
    RETRY = 'RETRY', _('Retry after an API failure')
    MANUAL = 'MANUAL', _('Started from the admin')


class SupportRunResult(models.TextChoices):
    RUNNING = 'RUNNING', _('Running')
    SENT = 'SENT', _('Reply sent')
    HELD = 'HELD', _('Reply held')
    SILENT = 'SILENT', _('No reply')
    FAILED = 'FAILED', _('Failed')
    COVERED = 'COVERED', _('Read by another run')


class SupportReplyChannel(models.TextChoices):
    APP = 'APP', _('In the app')
    EMAIL = 'EMAIL', _('By e-mail')


class SupportRun(models.Model):
    """One run of the support agent on one report, or the record that none was needed."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(FeedbackReport, on_delete=models.CASCADE, related_name='support_runs')
    trigger = models.CharField(max_length=6, choices=SupportRunTrigger.choices)
    result = models.CharField(
        max_length=7,
        choices=SupportRunResult.choices,
        default=SupportRunResult.RUNNING,
        help_text=_("Stays RUNNING when the worker died mid-run."),
    )
    covered_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text=_("For a covered report: the run that read it as a neighbour."),
    )
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        blank=True,
        help_text=_("The tool loop's status. Empty when the run never reached the model."),
    )
    action = models.CharField(max_length=16, blank=True)
    reading = models.TextField(blank=True)
    reply = models.TextField(blank=True, help_text=_("What the agent wrote to the reporter, sent or held."))
    channel = models.CharField(max_length=5, choices=SupportReplyChannel.choices, blank=True)
    thread = models.ForeignKey(
        'messaging.Thread',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text=_("The conversation the reply went into. Empty for a reply by e-mail."),
    )
    held_because = models.CharField(max_length=200, blank=True)
    developer_note = models.TextField(blank=True)
    error = models.TextField(blank=True)
    commit = models.CharField(max_length=40, blank=True)
    cost_usd = models.DecimalField(max_digits=8, decimal_places=4, default=Decimal('0'))
    tool_rounds = models.PositiveSmallIntegerField(default=0)
    elapsed_seconds = models.FloatField(default=0.0)

    class Meta:
        db_table = 'support_run'
        ordering = ('-started_at',)

    def __str__(self) -> str:
        return f"{self.get_result_display()} · {self.started_at:%Y-%m-%d %H:%M}"
