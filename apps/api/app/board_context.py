from typing import TypeVar

from sqlmodel import Session, select

from .agent_contracts import BoardChanges, BoardContext, BoardItemChange, BoardRevisionChanges
from .board_selections import TabPresence, context_selection
from .canvas_contracts import CanvasConnection, CanvasObject, ProjectBoard
from .canvas_service import board_row, invalid, revision_row, summary
from .canvas_storage import BoardRevisionRow

HISTORY_PAGE_SIZE = 12
HISTORY_PAGE_BYTES = 256 * 1024
Item = TypeVar("Item", CanvasObject, CanvasConnection)


def item_changes(before: dict[str, Item], after: dict[str, Item]) -> list[BoardItemChange]:
    changes = []
    for key in sorted(before.keys() | after.keys()):
        previous, current = before.get(key), after.get(key)
        item = current if current is not None else previous
        assert item is not None
        fields = []
        if previous is None:
            change = "added"
        elif current is None:
            change = "removed"
        else:
            change = "modified"
            previous_values = previous.model_dump(exclude={"createdBy", "updatedBy"})
            fields = [name for name, value in current.model_dump(exclude={"createdBy", "updatedBy"}).items()
                      if previous_values[name] != value]
            if not fields:
                continue
        changes.append(BoardItemChange(
            id=key, label=item.title if isinstance(item, CanvasObject) else item.label,
            kind=item.kind if isinstance(item, CanvasObject) else item.role,
            change=change, fields=fields,
        ))
    return changes


def changes_since(session: Session, head: ProjectBoard, since: int) -> BoardChanges:
    if since > head.revision:
        invalid("Use a revision from this board at or before its current revision.")
    revisions = []
    remaining_bytes = HISTORY_PAGE_BYTES
    if since < head.revision:
        before = ProjectBoard.model_validate_json(revision_row(session, head.id, since).snapshot)
        rows = session.exec(select(BoardRevisionRow).where(
            BoardRevisionRow.board_id == head.id,
            BoardRevisionRow.revision > since,
            BoardRevisionRow.revision <= head.revision,
        ).order_by(BoardRevisionRow.revision).limit(HISTORY_PAGE_SIZE))
        for row in rows:
            after = head if row.revision == head.revision else ProjectBoard.model_validate_json(row.snapshot)
            delta = BoardRevisionChanges(
                revision=row.revision, actor=row.actor,
                objects=item_changes(before.objects, after.objects),
                connections=item_changes(before.connections, after.connections),
            )
            remaining_bytes -= len(delta.model_dump_json().encode())
            if revisions and remaining_bytes < 0:
                break
            revisions.append(delta)
            before = after
    through = revisions[-1].revision if revisions else since
    return BoardChanges(
        fromRevision=since, throughRevision=through, revisions=revisions,
        nextSinceRevision=through if through < head.revision else None,
    )


def read_board_context(
    session: Session, presence: tuple[TabPresence, ...], board_id: str | None, since: int | None,
) -> BoardContext:
    if since is not None and board_id is None:
        invalid("Supply the board ID that the earlier revision belongs to.")
    if board_id is None:
        active_ids = sorted({tab.board_id for tab in presence if tab.board_id is not None})
        if len(active_ids) != 1:
            return BoardContext(
                status="ambiguousBoard" if active_ids else "noActiveBoard",
                candidates=[summary(board_row(session, active_id)) for active_id in active_ids],
                board=None, selection=None, annotationIds=[], requirementIds=[], proposalIds=[], changes=None,
            )
        board_id = active_ids[0]
    row = board_row(session, board_id)
    board = ProjectBoard.model_validate_json(revision_row(session, row.id, row.revision).snapshot)
    objects = board.objects.values()
    return BoardContext(
        status="ready", candidates=[], board=board,
        selection=context_selection(presence, board.id, board.revision),
        annotationIds=[item.id for item in objects if item.kind == "annotation"],
        requirementIds=[item.id for item in objects if item.kind == "requirement"],
        proposalIds=[item.id for item in objects if item.createdBy == "agent" and (
            item.requirement is None or item.requirement.status == "proposed"
        )],
        changes=changes_since(session, board, since) if since is not None else None,
    )
