from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Schema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class Quiz(Schema):
    question: str = Field(min_length=1)
    options: tuple[str, str, str]
    answerIndex: int = Field(ge=0, le=2)


class GraphNode(Schema):
    id: str
    label: str
    summary: str
    docIds: list[str]
    sourceChunkIds: list[str]
    masteryState: Literal["unexplored", "learning", "mastered"]
    quiz: Quiz | None = None


class GraphEdge(Schema):
    id: str
    source: str
    target: str
    relationshipLabel: str
    docIds: list[str]


class Chunk(Schema):
    id: str
    docId: str
    page: int = Field(ge=1)
    text: str
    charStart: int = Field(ge=0)
    charEnd: int = Field(ge=0)

    @model_validator(mode="after")
    def check_offsets(self) -> "Chunk":
        if self.charEnd - self.charStart != len(self.text):
            raise ValueError("Chunk offsets must span exactly the stored text.")
        return self


class Document(Schema):
    id: str
    name: str
    status: Literal["queued", "chunking", "extracting", "done", "failed"]
    uploadedAt: datetime


class Citation(Schema):
    chunkId: str
    docId: str
    page: int = Field(ge=1)
    quote: str


class ChatResponse(Schema):
    answer: str
    citations: list[Citation]
    referencedNodeIds: list[str]


class Progress(Schema):
    masteredCount: int = Field(ge=0)
    exploredCount: int = Field(ge=0)
    totalNodes: int = Field(ge=0)
    coveragePercent: float = Field(ge=0, le=100)
    crossDocLinks: int = Field(ge=0)

    @model_validator(mode="after")
    def check_counts(self) -> "Progress":
        if not self.masteredCount <= self.exploredCount <= self.totalNodes:
            raise ValueError("Mastered and explored counts cannot exceed the graph size.")
        return self


class ProviderCheck(Schema):
    configured: bool
    provider: Literal["mock", "openai", "gemini"]
    model: str


class HealthResponse(Schema):
    status: Literal["ok", "degraded"]
    phase: Literal[2]
    sqlite: Literal["ok", "unavailable"]
    chroma: Literal["ok", "unavailable"]
    llm: ProviderCheck


class SampleResponse(Schema):
    name: str
    text: str
    contentType: Literal["text/markdown"]


class SchemaDescription(Schema):
    name: str
    definition: dict[str, object]


class SchemasResponse(Schema):
    schemas: list[SchemaDescription]


class ExtractedConcept(Schema):
    label: str = Field(min_length=1, max_length=120)
    summary: str = Field(min_length=1, max_length=1200)
    sourceChunkIds: list[str] = Field(min_length=1, max_length=16)


class ExtractedRelationship(Schema):
    sourceLabel: str = Field(min_length=1, max_length=120)
    targetLabel: str = Field(min_length=1, max_length=120)
    relationshipLabel: str = Field(min_length=1, max_length=120)


class ExtractionResult(Schema):
    concepts: list[ExtractedConcept] = Field(max_length=200)
    relationships: list[ExtractedRelationship] = Field(max_length=400)


class DocumentsResponse(Schema):
    documents: list[Document]


class ChunksResponse(Schema):
    chunks: list[Chunk]


class PageResponse(Schema):
    docId: str
    page: int = Field(ge=1)
    text: str


class GraphResponse(Schema):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class IngestionEvent(Schema):
    id: int = Field(ge=1)
    docId: str
    type: Literal["status", "node", "edge", "complete", "error"]
    document: Document | None = None
    message: str | None = None
    completedBatches: int | None = None
    totalBatches: int | None = None
    node: GraphNode | None = None
    edge: GraphEdge | None = None
    chunkCount: int | None = None
    nodeCount: int | None = None
    edgeCount: int | None = None

    @model_validator(mode="after")
    def check_payload(self) -> "IngestionEvent":
        if self.type == "node" and self.node is None:
            raise ValueError("A node event needs a node.")
        if self.type == "edge" and self.edge is None:
            raise ValueError("An edge event needs an edge.")
        if self.type in {"status", "complete", "error"} and self.document is None:
            raise ValueError("Document events need the current document.")
        return self


PUBLIC_MODELS: tuple[type[Schema], ...] = (
    Quiz, GraphNode, GraphEdge, Chunk, Document, Citation, ChatResponse, Progress,
    ProviderCheck, HealthResponse, SampleResponse, SchemaDescription, SchemasResponse,
    DocumentsResponse, ChunksResponse, PageResponse, GraphResponse, IngestionEvent,
)
