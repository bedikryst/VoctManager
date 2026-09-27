"""
===============================================================================
Roster Domain Listeners (Event Consumers)
===============================================================================
Domain: Roster
Description:
    Subscribes to cross-domain events emitted by other bounded contexts
    (e.g., Archive). Translates these external events into localized actions
    such as participant notification logic.

Standards: SaaS 2026, Loose Coupling, Event-Driven Architecture.
===============================================================================
"""

import logging

from django.core.cache import cache
from django.dispatch import receiver

from archive.signals import piece_material_updated_event

from .tasks import (
    dispatch_material_notice_task,
    material_notice_gate_key,
    material_notice_key_timeout,
    material_notice_kinds_key,
    material_notice_window_seconds,
)

logger = logging.getLogger(__name__)


@receiver(piece_material_updated_event)
def handle_piece_material_updated(sender, piece, kind="", **kwargs):
    """
    Listens to the Archive domain for material updates and folds them into one
    notice per piece per window (`dispatch_material_notice_task`).

    The first event on a piece opens the window and schedules the notice for its
    end; every event records its `kind` ("score" | "recording"). The material is
    piece-scoped and fans out across every concert programming it, so the piece,
    its composer and the kind are the context the notice can name — and the
    participants are resolved when the window closes, not here.
    """
    piece_id = str(piece.id)
    timeout = material_notice_key_timeout()

    try:
        # The kind goes in before the gate, so a task that runs the instant it is
        # scheduled (eager mode, an idle worker) already finds it.
        kinds_key = material_notice_kinds_key(piece_id)
        cache.set(kinds_key, [*(cache.get(kinds_key) or []), kind], timeout=timeout)

        gate_key = material_notice_gate_key(piece_id)
        if not cache.add(gate_key, True, timeout=timeout):
            return
        try:
            dispatch_material_notice_task.apply_async(
                args=[piece_id], countdown=material_notice_window_seconds(),
            )
        except Exception:
            # Nothing was scheduled, so the gate must not stand: the next event
            # gets to open the window instead of joining one that never closes.
            cache.delete(gate_key)
            raise
        logger.debug(f"[RosterListener] Material window opened for piece ID:{piece_id}")
    except Exception as e:
        logger.error(f"[RosterListener] Failed to process material update for piece {piece_id}: {e}", exc_info=True)
