"""
===============================================================================
Archive Domain Events
===============================================================================
Defines decoupled signals (events) emitted by the Archive bounded context.
Other domains (like Roster or Notifications) can subscribe to these events
without creating tight coupling.
"""

import django.dispatch

# Emitted when a piece's core materials (e.g., sheet music, tracks) are updated.
# Expected kwargs: `piece` (Piece instance)
piece_material_updated_event = django.dispatch.Signal()