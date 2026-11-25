from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from .canvas_contracts import CanvasContract, CanvasEvidenceRef, CanvasId, Revision


class BoardSelectionUpdate(CanvasContract):
    baseRevision: Revision
    objectIds: Annotated[list[CanvasId], Field(max_length=200)]


class BoardSelection(CanvasContract):
    boardId: CanvasId
    revision: Revision
    available: bool
    objectIds: list[CanvasId]


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


AGENT_MODELS = (BoardSelectionUpdate, BoardSelection, KnowledgeSearch, KnowledgeHit, KnowledgeResults)
