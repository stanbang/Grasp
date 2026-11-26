from datetime import datetime, timezone
from hashlib import sha256
from typing import Literal, NoReturn
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlmodel import Session, select

from .asset_access import board_asset, shared_assets, visible_board
from .asset_storage import ProjectDocumentRow
from .canvas_contracts import (
    Actor, AddConnection, AddObject, AnswerQuestion, BoardCommit, BoardConflict, BoardList,
    BoardSummary, CanvasAnswer, CanvasBatch, CanvasConceptContext, CanvasConnection,
    CanvasEvidenceContext, CanvasEvidenceRef, CanvasObject, CanvasObjectContext, CanvasObjectData,
    CanvasOperation, CanvasRelationshipContext, PlaceObject, ProjectBoard, RemoveConnection, RemoveObject, RestoreRevision,
    UpdateConnection, UpdateObject,
)
from .canvas_expansion import validate_expansion
from .canvas_layout import auto_layout, size_changed_content
from .canvas_storage import BoardRevisionRow, ProjectBoardRow
from .models import ChunkRow, DocumentRow, GraphEdgeRow, GraphNodeRow, SourcePageRow


def board_row(session: Session, board_id: str) -> ProjectBoardRow:
    row = session.get(ProjectBoardRow, board_id)
    if row is None:
        raise HTTPException(404, "Project board not found.")
    return row


def summary(row: ProjectBoardRow) -> BoardSummary:
    return BoardSummary(
        id=row.id, projectId=row.project_id, schemaVersion=row.schema_version, title=row.title, revision=row.revision,
        createdAt=row.created_at.replace(tzinfo=timezone.utc), updatedAt=row.updated_at.replace(tzinfo=timezone.utc),
        createdBy=row.created_by,
    )


def revision_row(session: Session, board_id: str, revision: int) -> BoardRevisionRow:
    row = session.get(BoardRevisionRow, (board_id, revision))
    if row is None:
        raise HTTPException(404, "Board revision not found.")
    return row


def read_board(session: Session, board_id: str, after_revision: int | None = None) -> ProjectBoard | None:
    row = board_row(session, board_id)
    if after_revision == row.revision:
        return None
    return ProjectBoard.model_validate_json(revision_row(session, board_id, row.revision).snapshot)


def list_boards(session: Session, offset: int, limit: int) -> BoardList:
    rows = session.exec(select(ProjectBoardRow).order_by(
        ProjectBoardRow.created_at.desc(), ProjectBoardRow.id,
    ).offset(offset).limit(limit + 1)).all()
    return BoardList(
        boards=[summary(row) for row in rows[:limit]],
        nextOffset=offset + limit if len(rows) > limit else None,
    )


def create_board(session: Session, title: str, actor: Actor) -> ProjectBoard:
    now = datetime.now(timezone.utc)
    row = ProjectBoardRow(
        id=str(uuid4()), project_id=str(uuid4()), title=title, revision=0,
        created_at=now, updated_at=now, created_by=actor,
    )
    board = ProjectBoard(**summary(row).model_dump(), objects={}, connections={})
    session.add(row)
    session.flush()
    session.add(BoardRevisionRow(board_id=row.id, revision=0, snapshot=board.model_dump_json(), actor=actor))
    session.commit()
    return board


def receipt(row: BoardRevisionRow) -> BoardCommit:
    board = ProjectBoard.model_validate_json(row.snapshot)
    assert row.base_revision is not None and row.mutation_id is not None
    return BoardCommit(
        boardId=board.id, baseRevision=row.base_revision, revision=board.revision,
        mutationId=row.mutation_id, actor=row.actor, committedAt=board.updatedAt, board=board,
    )


def conflict(code: Literal["staleRevision", "mutationIdReused"], message: str, revision: int) -> NoReturn:
    detail = BoardConflict(code=code, message=message, currentRevision=revision)
    raise HTTPException(409, detail.model_dump())


def invalid(message: str) -> NoReturn:
    raise HTTPException(422, message)


def object_in(board: ProjectBoard, object_id: str) -> CanvasObject:
    item = board.objects.get(object_id)
    if item is None:
        invalid(f"Object {object_id} is not on this board.")
    return item


def resolve_evidence(session: Session, reference: CanvasEvidenceRef) -> CanvasEvidenceContext:
    document = session.get(DocumentRow, reference.docId)
    chunk = session.get(ChunkRow, reference.chunkId)
    page = session.get(SourcePageRow, (reference.docId, reference.page))
    if (
        document is not None and document.status == "done" and chunk is not None and page is not None
        and chunk.docId == reference.docId and chunk.page == reference.page
        and chunk.charStart <= reference.charStart < reference.charEnd <= chunk.charEnd
    ):
        start = reference.charStart - chunk.charStart
        end = reference.charEnd - chunk.charStart
        quote = page.text[reference.charStart:reference.charEnd]
        if len(quote) == end - start and quote == chunk.text[start:end]:
            return CanvasEvidenceContext(reference=reference, available=True, quote=quote, sourceName=document.name)
    return CanvasEvidenceContext(reference=reference, available=False, quote=None, sourceName=None)


def require_shared_documents(scope: frozenset[str] | None, document_ids: list[str] | set[str]) -> None:
    if scope is not None and not scope.issuperset(document_ids):
        raise HTTPException(403, "The workspace owner has not shared one or more of these documents with the agent.")


def object_context(
    session: Session, board: ProjectBoard, object_id: str, source_scope: frozenset[str] | None,
) -> CanvasObjectContext:
    item = board.objects.get(object_id)
    if item is None:
        raise HTTPException(404, "Object not found on this board.")
    links = [edge for edge in board.connections.values() if object_id in (edge.source, edge.target)]
    related = dict.fromkeys([*item.relatedObjectIds, *(item.prototype.requirementIds if item.prototype else [])])
    for edge in links:
        related[edge.target if edge.source == object_id else edge.source] = None
    for other in board.objects.values():
        if object_id in other.relatedObjectIds or (other.prototype and object_id in other.prototype.requirementIds):
            related[other.id] = None
    node = session.get(GraphNodeRow, item.canonicalNodeId) if item.canonicalNodeId else None
    relationships: list[CanvasRelationshipContext] = []
    for key in dict.fromkeys(edge.canonicalEdgeId for edge in links if edge.canonicalEdgeId):
        relationship = session.get(GraphEdgeRow, key)
        if relationship and (source_scope is None or source_scope.issuperset(relationship.docIds)):
            relationships.append(CanvasRelationshipContext.model_validate(relationship.model_dump()))
    evidence = [
        resolve_evidence(session, reference) if source_scope is None or reference.docId in source_scope else
        CanvasEvidenceContext(reference=reference, available=False, quote=None, sourceName=None)
        for reference in item.evidence
    ]
    return CanvasObjectContext(
        boardId=board.id, revision=board.revision, object=item, connections=links,
        relatedObjects=[board.objects[key] for key in related],
        evidence=evidence,
        canonicalConcept=CanvasConceptContext(
            id=node.id, label=node.label, summary=node.summary, docIds=node.docIds, sourceChunkIds=node.sourceChunkIds,
        ) if node and (source_scope is None or source_scope.issuperset(node.docIds)) else None,
        canonicalRelationships=relationships,
    )


def check_object_permission(
    existing: CanvasObject | None, replacement: CanvasObjectData | None, actor: Actor,
) -> None:
    if actor == "user":
        return
    old_requirement = existing.requirement if existing else None
    new_requirement = replacement.requirement if replacement else None
    if new_requirement and new_requirement.status != "proposed" and new_requirement != old_requirement:
        raise HTTPException(403, "Only the workspace owner can decide a requirement.")
    protected = existing and (
        existing.decidedBy or existing.answer or (existing.kind == "annotation" and existing.createdBy == "user")
    )
    if protected and (
        replacement is None or existing.model_dump(include=set(CanvasObjectData.model_fields) - {"placement"})
        != replacement.model_dump(exclude={"placement"})
    ):
        raise HTTPException(403, "Only the workspace owner can change this object's content.")


def put_object(board: ProjectBoard, item: CanvasObjectData, actor: Actor, adding: bool) -> None:
    existing = board.objects.get(item.id)
    if adding == (existing is not None):
        invalid(f"Object {item.id} already exists." if adding else f"Object {item.id} is not on this board.")
    if existing and "sizing" not in item.model_fields_set:
        item = item.model_copy(update={"sizing": existing.sizing})
    check_object_permission(existing, item, actor)
    if existing and existing.kind != item.kind:
        invalid("An object's kind cannot change.")
    if existing and existing.asset and item.asset and existing.asset.assetId != item.asset.assetId:
        invalid("Place a new object to attach a different asset.")
    if existing and existing.prototype and item.prototype and existing.prototype != item.prototype:
        if item.prototype.revision <= existing.prototype.revision:
            invalid("Changed prototype metadata needs a higher prototype revision.")
    board.objects[item.id] = CanvasObject(
        **item.model_dump(), createdBy=existing.createdBy if existing else actor, updatedBy=actor,
        answer=existing.answer if existing else None,
        decidedBy="user" if item.requirement and item.requirement.status != "proposed" else None,
    )


def apply_operation(
    board: ProjectBoard, operation: CanvasOperation, actor: Actor, now: datetime,
) -> None:
    if isinstance(operation, (AddObject, UpdateObject)):
        put_object(board, operation.object, actor, isinstance(operation, AddObject))
    elif isinstance(operation, PlaceObject):
        item = object_in(board, operation.objectId)
        if actor == "user" and item.sizing == "auto" and (item.placement.width, item.placement.height) != (
            operation.placement.width, operation.placement.height,
        ):
            item.sizing = "manual"
        item.placement = operation.placement
        item.updatedBy = actor
    elif isinstance(operation, RemoveObject):
        existing = object_in(board, operation.objectId)
        check_object_permission(existing, None, actor)
        del board.objects[existing.id]
        for item in board.objects.values():
            if item.placement.groupId == existing.id:
                item.placement.groupId = None
                item.updatedBy = actor
        removed = {key for key, edge in board.connections.items() if existing.id in (edge.source, edge.target)}
        for key in removed:
            del board.connections[key]
        detach_feedback(board, actor, removed, existing.id)
    elif isinstance(operation, (AddConnection, UpdateConnection)):
        edge = operation.connection
        existing_connection = board.connections.get(edge.id)
        adding = isinstance(operation, AddConnection)
        if adding == (existing_connection is not None):
            invalid(f"Connection {edge.id} already exists." if adding else f"Connection {edge.id} is not on this board.")
        board.connections[edge.id] = CanvasConnection(
            **edge.model_dump(), createdBy=existing_connection.createdBy if existing_connection else actor, updatedBy=actor,
        )
    elif isinstance(operation, RemoveConnection):
        if board.connections.pop(operation.connectionId, None) is None:
            invalid(f"Connection {operation.connectionId} is not on this board.")
        detach_feedback(board, actor, {operation.connectionId})
    elif isinstance(operation, AnswerQuestion):
        if actor != "user":
            raise HTTPException(403, "Only the workspace owner can answer a question.")
        question = object_in(board, operation.objectId)
        if question.kind != "question":
            invalid("Only a question object can be answered.")
        question.answer = CanvasAnswer(text=operation.text, answeredBy="user", answeredAt=now)
        question.updatedBy = actor


def detach_feedback(
    board: ProjectBoard, actor: Actor, connection_ids: set[str], object_id: str | None = None,
) -> None:
    for item in board.objects.values():
        if object_id in item.relatedObjectIds or connection_ids.intersection(item.relatedConnectionIds):
            check_object_permission(item, None, actor)
            item.relatedObjectIds = [key for key in item.relatedObjectIds if key != object_id]
            item.relatedConnectionIds = [key for key in item.relatedConnectionIds if key not in connection_ids]


def unavailable_asset() -> NoReturn:
    raise HTTPException(403, "The workspace owner has not shared this asset with the agent.")


def operation_object_id(operation: CanvasOperation) -> str | None:
    if isinstance(operation, (AddObject, UpdateObject)):
        return operation.object.id
    if isinstance(operation, (PlaceObject, RemoveObject, AnswerQuestion)):
        return operation.objectId
    return None


def validate_board(
    session: Session, board: ProjectBoard, before: ProjectBoard, restoring: bool,
    source_scope: frozenset[str] | None, visible: set[str] | None, restricted: set[str], now: datetime,
) -> None:
    if len(board.objects) > 200 or len(board.connections) > 400:
        invalid("A project board can hold up to 200 objects and 400 connections.")
    if any(board.objects.get(key) != before.objects[key] for key in restricted):
        unavailable_asset()
    for item in board.objects.values():
        if item.placement.groupId:
            parent = object_in(board, item.placement.groupId)
            if item.kind == "group" or parent.kind != "group":
                invalid("Only objects can belong to a group. Groups cannot be nested.")
        related = item.relatedObjectIds
        if item.id in related or len(set(related)) != len(related):
            invalid("Related object IDs must be unique and cannot include the object itself.")
        for key in related:
            object_in(board, key)
        links = item.relatedConnectionIds
        if len(set(links)) != len(links) or not set(links).issubset(board.connections):
            invalid("Feedback connections must be unique and on this board.")
        if item.prototype:
            keys = item.prototype.requirementIds
            if len(set(keys)) != len(keys) or any(object_in(board, key).kind != "requirement" for key in keys):
                invalid("A prototype needs unique references to requirement objects.")
        if restoring:
            continue
        previous = before.objects.get(item.id)
        if restricted.intersection(set(related) - set(previous.relatedObjectIds if previous else [])):
            unavailable_asset()
        if item.asset and (previous is None or item.asset != previous.asset):
            row = board_asset(session, board.id, item.asset.assetId)
            if visible is not None and row.id not in visible:
                unavailable_asset()
            if row.document_id:
                if item.kind != "document" or (item.asset.page or 1) > (row.page_count or 0):
                    invalid("A document object needs an available page of a document asset.")
                if session.get(DocumentRow, row.document_id) is None:
                    invalid("The original document is unavailable.")
            elif item.kind != "image" or item.asset.page is not None:
                invalid("An image object needs an image asset without a page.")
            if row.attached_at is None:
                row.attached_at = now
                session.add(row)
        if len({(ref.chunkId, ref.charStart, ref.charEnd) for ref in item.evidence}) != len(item.evidence):
            invalid("Source spans on an object must be unique.")
        if item.canonicalNodeId and (previous is None or item.canonicalNodeId != previous.canonicalNodeId):
            canonical_node = session.get(GraphNodeRow, item.canonicalNodeId)
            if canonical_node is None:
                invalid("The canonical concept is unavailable.")
            require_shared_documents(source_scope, canonical_node.docIds)
        for reference in item.evidence:
            if previous is None or reference not in previous.evidence:
                require_shared_documents(source_scope, {reference.docId})
                if session.get(ProjectDocumentRow, reference.docId) is not None:
                    invalid("Use a document object for a Project source.")
                if not resolve_evidence(session, reference).available:
                    invalid("The evidence does not match an available source span.")

    endpoints: set[tuple[str, str]] = set()
    for edge in board.connections.values():
        source, target = object_in(board, edge.source), object_in(board, edge.target)
        pair = (source.id, target.id)
        if source.id == target.id or source.kind == "group" or target.kind == "group" or pair in endpoints:
            invalid("A connection needs two distinct objects and unique directed endpoints.")
        endpoints.add(pair)
        old_edge = before.connections.get(edge.id)
        if restricted.intersection(pair) and (old_edge is None or (old_edge.source, old_edge.target) != pair):
            unavailable_asset()
        if edge.canonicalEdgeId and not restoring:
            old_source, old_target = before.objects.get(source.id), before.objects.get(target.id)
            changed = (
                old_edge is None or old_edge.canonicalEdgeId != edge.canonicalEdgeId
                or (old_edge.source, old_edge.target) != pair or old_source is None or old_target is None
                or (old_source.canonicalNodeId, old_target.canonicalNodeId) != (source.canonicalNodeId, target.canonicalNodeId)
            )
            if changed:
                canonical = session.get(GraphEdgeRow, edge.canonicalEdgeId)
                if canonical is None or (canonical.source, canonical.target) != (source.canonicalNodeId, target.canonicalNodeId):
                    invalid("The canonical relationship does not match the connection's concepts.")
                require_shared_documents(source_scope, canonical.docIds)


def batch_digest(batch: CanvasBatch) -> str:
    # Keep retries from earlier clients valid when the new optional fields are unused.
    exclude = {}
    if batch.expandFromObjectId is None:
        exclude["expandFromObjectId"] = True
    if not batch.autoLayout:
        exclude["autoLayout"] = True
    object_defaults = {}
    for index, operation in enumerate(batch.operations):
        if isinstance(operation, (AddObject, UpdateObject)):
            omitted = {key for key, empty in (("relatedConnectionIds", not operation.object.relatedConnectionIds),
                                             ("sizing", operation.object.sizing is None)) if empty}
            if omitted:
                object_defaults[index] = {"object": omitted}
    if object_defaults:
        exclude["operations"] = object_defaults
    return sha256(batch.model_dump_json(exclude=exclude).encode()).hexdigest()


def commit_batch(
    session: Session, board_id: str, batch: CanvasBatch, actor: Actor, source_scope: frozenset[str] | None,
) -> BoardCommit:
    # Lock before reading the head so two workers cannot both accept the same base revision.
    session.execute(text("BEGIN IMMEDIATE"))
    head = board_row(session, board_id)
    visible = shared_assets(session, board_id) if actor == "agent" else None
    digest = batch_digest(batch)
    replay = session.exec(select(BoardRevisionRow).where(
        BoardRevisionRow.board_id == board_id, BoardRevisionRow.mutation_id == batch.mutationId,
    )).first()
    if replay:
        if replay.actor != actor or replay.request_digest != digest:
            conflict("mutationIdReused", "This mutation ID was used for a different request.", head.revision)
        result = receipt(replay)
        if visible is not None:
            result.board = visible_board(result.board, visible)
        return result
    if batch.baseRevision != head.revision:
        conflict("staleRevision", "The board changed since this edit started.", head.revision)

    before = ProjectBoard.model_validate_json(revision_row(session, board_id, head.revision).snapshot)
    restricted = {
        item.id for item in before.objects.values()
        if visible is not None and item.asset and item.asset.assetId not in visible
    }
    restorations = [item for item in batch.operations if isinstance(item, RestoreRevision)]
    now = datetime.now(timezone.utc)
    if restorations:
        if actor != "user":
            raise HTTPException(403, "Only the workspace owner can restore a board revision.")
        if len(batch.operations) != 1 or restorations[0].revision >= head.revision:
            invalid("Restore one earlier revision in its own batch.")
        board = ProjectBoard.model_validate_json(revision_row(session, board_id, restorations[0].revision).snapshot)
    else:
        board = before.model_copy(deep=True)
        for operation in batch.operations:
            if operation_object_id(operation) in restricted:
                unavailable_asset()
            apply_operation(board, operation, actor, now)
    validate_board(session, board, before, bool(restorations), source_scope, visible, restricted, now)
    if not restorations:
        if batch.autoLayout:
            auto_layout(before, board, batch.expandFromObjectId)
        size_changed_content(before, board)
    validate_expansion(batch, before, board)
    head.revision += 1
    head.updated_at = now
    if any(item.asset for item in board.objects.values()):
        board.schemaVersion = 2
    head.schema_version = board.schemaVersion
    board.revision, board.updatedAt = head.revision, now
    snapshot = board.model_dump_json()
    if len(snapshot.encode()) > 512 * 1024:
        invalid("The saved board must be 512 KiB or smaller.")
    row = BoardRevisionRow(
        board_id=board_id, revision=head.revision, snapshot=snapshot, mutation_id=batch.mutationId,
        request_digest=digest, base_revision=batch.baseRevision, actor=actor,
    )
    session.add(row)
    result = receipt(row)
    if visible is not None:
        result.board = visible_board(result.board, visible)
    session.commit()
    return result
