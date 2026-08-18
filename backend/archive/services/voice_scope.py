"""
===============================================================================
Voice Scope — which divisi (and which tracks) a reader is actually looking at
===============================================================================
Domain: Archive (Repertoire & Materials)
Description:
    A piece can be published in more than one arrangement, and the arrangements
    need not share a voicing: the same motet exists in unison and in three
    parts. [PieceVoiceRequirement] and [Track] therefore carry an optional
    `edition` — and this module is the single place that decides which layer
    wins for a given reader.

    Resolution is an OVERRIDE, never a merge: an edition that declares its own
    divisi replaces the piece-wide one outright, because "unison" and "three
    parts" added together describe no arrangement anyone sings. A piece whose
    editions declare nothing falls back to the piece-wide layer, which is what
    every row written before editions could carry a divisi means.

    The resolved set is also what names the lines — see [core.voice_labels]:
    a family with one line in the resolved scope is printed without its index.

Standards: SaaS 2026, DDD.
===============================================================================
"""

from collections.abc import Iterable, Mapping, Sequence
from uuid import UUID

from archive.models import PieceVoiceRequirement, Track
from core.voice_labels import collapse_voice_labels


# Constrained to the two edition-scoped sub-entities of the Piece aggregate
# rather than merely bounded, so the concrete row type survives the call.
def scoped_to_edition[Scoped: (PieceVoiceRequirement, Track)](
    rows: Sequence[Scoped],
    edition_id: UUID | None,
) -> list[Scoped]:
    """The rows that apply to `edition_id`, with the piece-wide layer as fallback.

    `rows` is every row of one piece (typically a prefetched list, so this stays
    query-free). Pass `edition_id=None` for a reader with no edition in hand —
    the archive list, a piece nobody has bound yet — which resolves to the
    piece-wide layer.
    """
    if edition_id is not None:
        own = [row for row in rows if row.edition_id == edition_id]
        if own:
            return own
    return [row for row in rows if row.edition_id is None]


def voice_scope(
    requirements: Sequence[PieceVoiceRequirement],
    edition_id: UUID | None = None,
    extra_codes: Iterable[str | None] = (),
) -> set[str]:
    """Codes a reader of this piece sees at once — the naming scope.

    `extra_codes` folds in lines that exist in fact but not in the declared
    divisi: a singer cast on T2 of a piece that only declares T1 must not read
    "Tenor" beside "Tenor 2", so what is on the board widens the scope.
    """
    codes = {row.voice_line for row in scoped_to_edition(requirements, edition_id)}
    codes.update(code for code in extra_codes if code)
    return codes


def voice_labels(
    requirements: Sequence[PieceVoiceRequirement],
    edition_id: UUID | None = None,
    extra_codes: Iterable[str | None] = (),
) -> dict[str, str]:
    """code → display name for one piece, read through `edition_id`."""
    return collapse_voice_labels(voice_scope(requirements, edition_id, extra_codes))


def voice_labels_for_pieces(
    piece_ids: Iterable[UUID],
    *,
    edition_by_piece: Mapping[UUID, UUID | None] | None = None,
    extra_codes_by_piece: Mapping[UUID, Iterable[str | None]] | None = None,
) -> dict[UUID, dict[str, str]]:
    """Label maps for many pieces in one query — for the aggregate surfaces
    (dossier, ensemble roster, e-mail digests) that hold codes without having
    walked the pieces themselves.
    """
    ids = list(piece_ids)
    if not ids:
        return {}

    by_piece: dict[UUID, list[PieceVoiceRequirement]] = {piece_id: [] for piece_id in ids}
    for requirement in PieceVoiceRequirement.objects.filter(piece_id__in=ids):
        by_piece.setdefault(requirement.piece_id, []).append(requirement)

    editions = edition_by_piece or {}
    extras = extra_codes_by_piece or {}
    return {
        piece_id: voice_labels(rows, editions.get(piece_id), extras.get(piece_id, ()))
        for piece_id, rows in by_piece.items()
    }
