"""Reversible scalar edits on the archive review card."""

from dataclasses import dataclass
from typing import cast
from uuid import UUID

from django.contrib.contenttypes.models import ContentType
from django.core import signing
from django.db.models import QuerySet

from archive.models import Composer, Piece, ProvenanceRecord
from core.models import SoftDeleteModel

type Scalar = str | int | bool | None
_SALT = 'archive.piece-field-edit'
_UNDO_MAX_AGE = 300


class EditSuperseded(Exception):
    """The saved field no longer matches the undo receipt."""


@dataclass(frozen=True)
class FieldEdit:
    """A whitelisted field on a row locked for the duration of the write."""

    target: SoftDeleteModel
    field: str
    tracked: bool

    def _sources(self) -> QuerySet[ProvenanceRecord]:
        return ProvenanceRecord.objects.filter(
            content_type=ContentType.objects.get_for_model(self.target),
            object_id=self.target.pk,
            field_name=self.field,
        ).order_by('-retrieved_at', '-pk')

    def value(self) -> Scalar:
        value = cast(Scalar | UUID, getattr(self.target, self.field))
        return str(value) if isinstance(value, UUID) else value

    def _system(self) -> str | None:
        if isinstance(self.target, Piece) and self.field == 'lyrics_ipa':
            return self.target.lyrics_ipa_system
        return None

    def _revision(self) -> str | None:
        if self.tracked:
            source = self._sources().first()
            return str(source.pk) if source else None
        return self.target.updated_at.isoformat()

    def _identity(self, piece: Piece, user_id: str) -> list[str]:
        return [str(piece.pk), str(self.target.pk), self.field, user_id]

    def _latest_state(self) -> list[Scalar]:
        return [self.value(), self._system(), self._revision()]

    def write(self, value: Scalar, *, system: str | None = None) -> None:
        setattr(self.target, self.field, value)
        fields = [self.field, 'updated_at']
        if isinstance(self.target, Piece) and self.field == 'lyrics_ipa' and (system is not None or not value):
            self.target.lyrics_ipa_system = system or ''
            fields.append('lyrics_ipa_system')
        self.target.save(update_fields=fields)

    def previous(self) -> tuple[Scalar, str | None]:
        return self.value(), self._system()

    def receipt(self, piece: Piece, user_id: str, previous: tuple[Scalar, str | None]) -> str:
        return signing.dumps({
            'target': self._identity(piece, user_id),
            'previous': previous,
            'saved': self._latest_state(),
        }, salt=_SALT, compress=True)

    def undo(self, piece: Piece, user_id: str, receipt: str) -> None:
        try:
            edit = signing.loads(receipt, salt=_SALT, max_age=_UNDO_MAX_AGE)
        except signing.BadSignature as exc:
            raise EditSuperseded from exc
        if edit['target'] != self._identity(piece, user_id) or edit['saved'] != self._latest_state():
            raise EditSuperseded
        value, system = edit['previous']
        if self.field == 'composer_id' and value and not Composer.objects.filter(pk=value).exists():
            raise EditSuperseded
        if self.tracked:
            # Withdraw the provenance of this edit so readers see the actual
            # preceding source, including its confidence and original timestamp.
            source = self._sources().first()
            if source is None:
                raise EditSuperseded
            source.delete()
        self.write(value, system=system)
