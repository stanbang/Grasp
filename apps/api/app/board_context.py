from sqlmodel import Session, select

from .agent_contracts import (
    BoardChanges, BoardConnectionChange, BoardConnectionState, BoardContext, BoardContextSelection,
    BoardFocus, BoardItemChange, BoardRevisionChanges,
)
from .board_selections import TabPresence, context_selection
from .canvas_contracts import CanvasConnection, CanvasObject, ProjectBoard
from .canvas_service import board_row, invalid, revision_row, summary
from .canvas_storage import BoardRevisionRow

HISTORY_PAGE_SIZE = 12
HISTORY_PAGE_BYTES = 256 * 1024
VISUAL_FIELDS = {"placement", "noteStyle", "sizing"}
FEEDBACK_KINDS = {"annotation", "requirement", "question"}


def changed_fields(before: CanvasObject | CanvasConnection, after: CanvasObject | CanvasConnection) -> list[str]:
    previous_values = before.model_dump(exclude={"createdBy", "updatedBy"})
    return [name for name, value in after.model_dump(exclude={"createdBy", "updatedBy"}).items()
            if previous_values[name] != value]


def object_changes(before: dict[str, CanvasObject], after: dict[str, CanvasObject]) -> list[BoardItemChange]:
    changes = []
    for key in sorted(before.keys() | after.keys()):
        previous, current = before.get(key), after.get(key)
        item = current if current is not None else previous
        assert item is not None
        fields = []
        classification = "semantic"
        if previous is None:
            change = "added"
        elif current is None:
            change = "removed"
        else:
            change = "modified"
            fields = changed_fields(previous, current)
            if not fields:
                continue
            if VISUAL_FIELDS.issuperset(fields):
                classification = "visual"
            elif VISUAL_FIELDS.intersection(fields):
                classification = "mixed"
        changes.append(BoardItemChange(
            id=key, label=item.title, kind=item.kind, change=change, fields=fields, classification=classification,
        ))
    return changes


def connection_state(board: ProjectBoard, edge: CanvasConnection) -> BoardConnectionState:
    return BoardConnectionState(
        source=edge.source, sourceTitle=board.objects[edge.source].title,
        target=edge.target, targetTitle=board.objects[edge.target].title, label=edge.label, role=edge.role,
    )


def connection_changes(before: ProjectBoard, after: ProjectBoard) -> list[BoardConnectionChange]:
    changes = []
    for key in sorted(before.connections.keys() | after.connections.keys()):
        previous, current = before.connections.get(key), after.connections.get(key)
        item = current or previous
        assert item is not None
        fields = changed_fields(previous, current) if previous and current else []
        if previous and current and not fields:
            continue
        changes.append(BoardConnectionChange(
            id=key, label=item.label, kind=item.role, fields=fields, classification="semantic",
            change="added" if previous is None else "removed" if current is None else "modified",
            before=connection_state(before, previous) if previous else None,
            after=connection_state(after, current) if current else None,
        ))
    return changes


def selected_focus(board: ProjectBoard, selection: BoardContextSelection) -> BoardFocus | None:
    if selection.status != "selected":
        return None
    anchors = set(selection.objectIds)
    connection_ids = set(selection.connectionIds)
    for key in selection.objectIds:
        item = board.objects[key]
        anchors.update(item.relatedObjectIds)
        connection_ids.update(item.relatedConnectionIds)
    for key in connection_ids:
        edge = board.connections[key]
        anchors.update((edge.source, edge.target))
    neighbors = anchors.copy()
    for edge in board.connections.values():
        if anchors.intersection((edge.source, edge.target)):
            connection_ids.add(edge.id)
            neighbors.update((edge.source, edge.target))
    feedback = {
        item.id for item in board.objects.values() if item.kind in FEEDBACK_KINDS and (
            item.id in neighbors or anchors.intersection(item.relatedObjectIds)
            or connection_ids.intersection(item.relatedConnectionIds)
        )
    }
    return BoardFocus(
        objectIds=sorted(neighbors | feedback), connectionIds=sorted(connection_ids), feedbackIds=sorted(feedback),
    )


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
                objects=object_changes(before.objects, after.objects),
                connections=connection_changes(before, after),
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
                board=None, selection=None, focus=None,
                annotationIds=[], requirementIds=[], proposalIds=[], decisionIds=[], changes=None,
            )
        board_id = active_ids[0]
    row = board_row(session, board_id)
    board = ProjectBoard.model_validate_json(revision_row(session, row.id, row.revision).snapshot)
    objects = board.objects.values()
    selection = context_selection(presence, board.id, board.revision)
    return BoardContext(
        status="ready", candidates=[], board=board,
        selection=selection, focus=selected_focus(board, selection),
        annotationIds=[item.id for item in objects if item.kind == "annotation"],
        requirementIds=[item.id for item in objects if item.kind == "requirement"],
        proposalIds=[item.id for item in objects if item.createdBy == "agent" and not (item.decidedBy or item.answer)],
        decisionIds=[item.id for item in objects if item.decidedBy or item.answer],
        changes=changes_since(session, board, since) if since is not None else None,
    )
