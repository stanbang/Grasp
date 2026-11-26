from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

CanvasId = Annotated[str, StringConstraints(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,95}$")]
CanvasTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=96)]
CanvasText = Annotated[str, StringConstraints(max_length=4000)]
Revision = Annotated[int, Field(ge=0, strict=True)]
Actor = Literal["user", "agent"]
ConnectionRole = Literal["structural", "data", "process", "annotation"]
Illustration = Literal[
    "document", "pages", "chunks", "embeddings", "similarity", "chroma", "sqlite", "retrieval",
    "generation", "validation", "citation", "graph", "api", "streaming", "evaluation", "ocr",
]
ObjectKind = Literal[
    "explanation", "annotation", "group", "heading", "text", "illustration", "evidence",
    "requirement", "question", "prototype",
]
Extent = Annotated[float, Field(gt=0, le=20_000, strict=True)]
Coordinate = Annotated[float, Field(ge=-1_000_000, le=1_000_000, strict=True)]


class CanvasContract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class CanvasPlacement(CanvasContract):
    x: Coordinate
    y: Coordinate
    width: Extent
    height: Extent
    groupId: CanvasId | None = None


class CanvasEvidenceRef(CanvasContract):
    chunkId: CanvasId
    docId: CanvasId
    page: Annotated[int, Field(ge=1, strict=True)]
    charStart: Annotated[int, Field(ge=0, strict=True)]
    charEnd: Annotated[int, Field(ge=1, strict=True)]

    @model_validator(mode="after")
    def ordered_span(self) -> "CanvasEvidenceRef":
        if not 0 < self.charEnd - self.charStart <= 4000:
            raise ValueError("Evidence must identify a nonempty span of at most 4000 code points.")
        return self


class CanvasRequirement(CanvasContract):
    status: Literal["proposed", "accepted", "rejected"] = "proposed"
    acceptanceCriteria: Annotated[list[CanvasTitle], Field(max_length=20)] = Field(default_factory=list)


class CanvasQuestion(CanvasContract):
    required: bool = Field(default=True, strict=True)


class CanvasAnswer(CanvasContract):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
    answeredBy: Literal["user"]
    answeredAt: datetime


class CanvasPrototype(CanvasContract):
    previewId: CanvasId
    revision: Annotated[int, Field(ge=1, strict=True)]
    digest: Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]
    entryPoint: Annotated[str, StringConstraints(
        max_length=240, pattern=r"^([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+\.html$",
    )]
    requirementIds: Annotated[list[CanvasId], Field(max_length=20)] = Field(default_factory=list)


class CanvasObjectData(CanvasContract):
    id: CanvasId
    kind: ObjectKind
    title: CanvasTitle
    description: CanvasText = ""
    placement: CanvasPlacement
    illustration: Illustration | None = None
    noteStyle: Literal["plain", "underline", "callout"] | None = None
    canonicalNodeId: CanvasId | None = None
    evidence: Annotated[list[CanvasEvidenceRef], Field(max_length=8)] = Field(default_factory=list)
    relatedObjectIds: Annotated[list[CanvasId], Field(max_length=20)] = Field(default_factory=list)
    relatedConnectionIds: Annotated[list[CanvasId], Field(max_length=20)] = Field(default_factory=list)
    requirement: CanvasRequirement | None = None
    question: CanvasQuestion | None = None
    prototype: CanvasPrototype | None = None

    @model_validator(mode="after")
    def details_match_kind(self) -> "CanvasObjectData":
        for kind, value in (
            ("illustration", self.illustration), ("requirement", self.requirement),
            ("question", self.question), ("prototype", self.prototype),
        ):
            if (self.kind == kind) != (value is not None):
                raise ValueError(f"Only {kind} objects must include {kind} details.")
        if self.noteStyle is not None and self.kind != "annotation":
            raise ValueError("Only annotations have a note style.")
        if self.kind == "evidence" and not self.evidence:
            raise ValueError("An evidence object needs a source span.")
        if self.relatedConnectionIds and self.kind not in ("annotation", "requirement", "question"):
            raise ValueError("Only notes, requirements and questions can attach to a connection.")
        return self


class CanvasObject(CanvasObjectData):
    createdBy: Actor
    updatedBy: Actor
    answer: CanvasAnswer | None = None
    decidedBy: Literal["user"] | None = None


class CanvasConnectionData(CanvasContract):
    id: CanvasId
    source: CanvasId
    target: CanvasId
    label: CanvasTitle
    role: ConnectionRole = "data"
    canonicalEdgeId: CanvasId | None = None


class CanvasConnection(CanvasConnectionData):
    createdBy: Actor
    updatedBy: Actor


class CreateBoard(CanvasContract):
    title: CanvasTitle


class BoardSummary(CanvasContract):
    id: CanvasId
    projectId: CanvasId
    schemaVersion: Literal[1]
    title: CanvasTitle
    revision: Revision
    createdAt: datetime
    updatedAt: datetime
    createdBy: Actor


class BoardList(CanvasContract):
    boards: list[BoardSummary]
    nextOffset: int | None


class ProjectBoard(BoardSummary):
    objects: dict[str, CanvasObject]
    connections: dict[str, CanvasConnection]


class AddObject(CanvasContract):
    type: Literal["addObject"]
    object: CanvasObjectData


class UpdateObject(CanvasContract):
    type: Literal["updateObject"]
    object: CanvasObjectData


class PlaceObject(CanvasContract):
    type: Literal["placeObject"]
    objectId: CanvasId
    placement: CanvasPlacement


class RemoveObject(CanvasContract):
    type: Literal["removeObject"]
    objectId: CanvasId


class AddConnection(CanvasContract):
    type: Literal["addConnection"]
    connection: CanvasConnectionData


class UpdateConnection(CanvasContract):
    type: Literal["updateConnection"]
    connection: CanvasConnectionData


class RemoveConnection(CanvasContract):
    type: Literal["removeConnection"]
    connectionId: CanvasId


class AnswerQuestion(CanvasContract):
    type: Literal["answerQuestion"]
    objectId: CanvasId
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


class RestoreRevision(CanvasContract):
    type: Literal["restoreRevision"]
    revision: Revision


CanvasOperation = Annotated[
    AddObject | UpdateObject | PlaceObject | RemoveObject | AddConnection | UpdateConnection |
    RemoveConnection | AnswerQuestion | RestoreRevision,
    Field(discriminator="type"),
]


class CanvasBatch(CanvasContract):
    baseRevision: Revision
    mutationId: CanvasId
    operations: Annotated[list[CanvasOperation], Field(min_length=1, max_length=240)]
    expandFromObjectId: CanvasId | None = None


class BoardCommit(CanvasContract):
    boardId: CanvasId
    baseRevision: Revision
    revision: Revision
    mutationId: CanvasId
    actor: Actor
    committedAt: datetime
    board: ProjectBoard


class BoardConflict(CanvasContract):
    code: Literal["staleRevision", "mutationIdReused"]
    message: str
    currentRevision: Revision


class BoardConflictResponse(CanvasContract):
    detail: BoardConflict


class CanvasEvidenceContext(CanvasContract):
    reference: CanvasEvidenceRef
    available: bool
    quote: str | None
    sourceName: str | None


class CanvasConceptContext(CanvasContract):
    id: CanvasId
    label: str
    summary: str
    docIds: list[str]
    sourceChunkIds: list[str]


class CanvasRelationshipContext(CanvasContract):
    id: CanvasId
    source: CanvasId
    target: CanvasId
    relationshipLabel: str
    docIds: list[str]


class CanvasObjectContext(CanvasContract):
    boardId: CanvasId
    revision: Revision
    object: CanvasObject
    connections: list[CanvasConnection]
    relatedObjects: list[CanvasObject]
    evidence: list[CanvasEvidenceContext]
    canonicalConcept: CanvasConceptContext | None
    canonicalRelationships: list[CanvasRelationshipContext]


CANVAS_MODELS = (
    CanvasPlacement, CanvasEvidenceRef, CanvasRequirement, CanvasQuestion, CanvasAnswer, CanvasPrototype,
    CanvasObjectData, CanvasObject, CanvasConnectionData, CanvasConnection, CreateBoard, BoardSummary,
    BoardList, ProjectBoard, AddObject, UpdateObject, PlaceObject, RemoveObject, AddConnection, UpdateConnection,
    RemoveConnection, AnswerQuestion, RestoreRevision, CanvasBatch, BoardCommit, BoardConflict, BoardConflictResponse,
    CanvasEvidenceContext, CanvasConceptContext, CanvasRelationshipContext, CanvasObjectContext,
)
