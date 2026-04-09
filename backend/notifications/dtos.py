# notifications/dtos.py
from dataclasses import dataclass, field
from typing import Dict, Any, Optional

@dataclass(frozen=True)
class NotificationCreateDTO:
    """
    Data Transfer Object strictly typing the payload for notification creation.
    Guarantees structural integrity before passing to Celery and Service layers.
    """
    recipient_id: str
    notification_type: str
    level: str
    metadata: Dict[str, Any] = field(default_factory=dict)