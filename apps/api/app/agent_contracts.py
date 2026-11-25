from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from .canvas_contracts import Actor, BoardSummary, CanvasContract, CanvasEvidenceRef, CanvasId, ProjectBoard, Revision


class BoardSelectionUpdate(CanvasContract):
    baseRevision: Revision
    objectIds: Annotated[list[CanvasId], Field(max_length=200)]


class BoardSelection(CanvasContract):
    boardId: CanvasId
    revision: Revision
    available: bool
    objectIds: list[CanvasId]


class BoardPresenceUpdate(CanvasContract):
    tabId: CanvasId
    sequence: Revision
    baseRevision: Revision
    objectIds: Annotated[list[CanvasId], Field(max_length=200)] | None


class BoardContextSelection(CanvasContract):
    status: Literal["selected", "empty", "unavailable", "stale", "ambiguous"]
    objectIds: list[CanvasId]


class BoardItemChange(CanvasContract):
    id: CanvasId
    label: str
    kind: str
    change: Literal["added", "modified", "removed"]
    fields: list[str]


class BoardRevisionChanges(CanvasContract):
    revision: Revision
    actor: Actor
    objects: list[BoardItemChange]
    connections: list[BoardItemChange]


class BoardChanges(CanvasContract):
    fromRevision: Revision
    throughRevision: Revision
    revisions: list[BoardRevisionChanges]
    nextSinceRevision: Revision | None


class BoardContext(CanvasContract):
    status: Literal["ready", "noActiveBoard", "ambiguousBoard"]
    candidates: list[BoardSummary]
    board: ProjectBoard | None
    selection: BoardContextSelection | None
    annotationIds: list[CanvasId]
    requirementIds: list[CanvasId]
    proposalIds: list[CanvasId]
    changes: BoardChanges | None


class KnowledgeSearch(CanvasContract):
    query: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
    docIds: Annotated[list[CanvasId], Field(max_length=20)]
    topK: Annotated[int, Field(ge=1, le=10, strict=True)] = 5


class KnowledgeHit(CanvasContract):
    rank: int
    sourceName: str
    reference: CanvasEvidenceRef
    excerpt: str


class KnowledgeResults(CanvasContract):
    mode: Literal["mock", "live"]
    results: list[KnowledgeHit]


AGENT_MODELS = (
    BoardSelectionUpdate, BoardSelection, BoardPresenceUpdate, BoardContextSelection, BoardItemChange,
    BoardRevisionChanges, BoardChanges, BoardContext, KnowledgeSearch, KnowledgeHit, KnowledgeResults,
)
