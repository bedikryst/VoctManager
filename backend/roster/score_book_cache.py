"""Private, shared compositions of score books for the choir."""

import hashlib
import os
import tempfile
import time
import uuid
from collections.abc import Callable
from contextlib import suppress
from pathlib import Path
from typing import BinaryIO

from django.conf import settings
from django.core.cache import cache

_LOCK_SECONDS = 300
_WAIT_SECONDS = 240


class CompositionBusy(Exception):
    """Another worker did not finish composing within the request window."""


def open_choir_copy(
    project_id: object, book_stamp: str, fingerprint: str, compose: Callable[[], bytes],
) -> BinaryIO:
    """Open one atomically published composition, serializing builds per project."""
    directory = Path(settings.MEDIA_ROOT) / "project_scores" / "composed" / str(project_id)
    name = hashlib.sha256(f"{book_stamp}:{fingerprint}".encode()).hexdigest() + ".pdf"
    target = directory / name
    lock_key = f"score_book_composition:{project_id}"
    token = uuid.uuid4().hex
    deadline = time.monotonic() + _WAIT_SECONDS
    while True:
        try:
            return target.open("rb")
        except FileNotFoundError:
            pass
        if cache.add(lock_key, token, timeout=_LOCK_SECONDS):
            break
        if time.monotonic() >= deadline:
            raise CompositionBusy
        time.sleep(0.1)

    try:
        try:
            return target.open("rb")
        except FileNotFoundError:
            pass
        directory.mkdir(parents=True, exist_ok=True)
        data = compose()
        temp_name = ""
        try:
            with tempfile.NamedTemporaryFile(dir=directory, suffix=".tmp", delete=False) as temp:
                temp_name = temp.name
                temp.write(data)
            os.replace(temp_name, target)
        finally:
            if temp_name and os.path.exists(temp_name):
                os.unlink(temp_name)
        handle = target.open("rb")
        for old in directory.glob("*.pdf"):
            if old != target:
                # Windows cannot remove a file while another response has it open.
                with suppress(OSError):
                    old.unlink()
        return handle
    finally:
        if cache.get(lock_key) == token:
            cache.delete(lock_key)
