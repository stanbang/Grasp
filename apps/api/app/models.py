from datetime import datetime

from sqlalchemy import JSON, CheckConstraint, Column
from sqlmodel import Field, SQLModel


class DocumentRow(SQLModel, table=True):
    __tablename__ = "documents"
    id: str = Field(primary_key=True)
    name: str
    status: str
    uploadedAt: datetime


class ChunkRow(SQLModel, table=True):
    __tablename__ = "chunks"
    __table_args__ = (
        CheckConstraint("page >= 1"),
        CheckConstraint('"charStart" >= 0 AND "charEnd" >= "charStart"'),
        CheckConstraint('"charEnd" - "charStart" = length(text)'),
    )
    id: str = Field(primary_key=True)
    docId: str = Field(foreign_key="documents.id", index=True)
    page: int
    text: str
    charStart: int
    charEnd: int


class GraphNodeRow(SQLModel, table=True):
    __tablename__ = "graph_nodes"
    __table_args__ = (CheckConstraint('"masteryState" IN (\'unexplored\', \'learning\', \'mastered\')'),)
    id: str = Field(primary_key=True)
    label: str = Field(index=True)
    summary: str
    docIds: list[str] = Field(sa_column=Column(JSON, nullable=False))
    sourceChunkIds: list[str] = Field(sa_column=Column(JSON, nullable=False))
    masteryState: str = "unexplored"
    quiz: dict[str, object] | None = Field(default=None, sa_column=Column(JSON))


class GraphEdgeRow(SQLModel, table=True):
    __tablename__ = "graph_edges"
    id: str = Field(primary_key=True)
    source: str = Field(foreign_key="graph_nodes.id", index=True)
    target: str = Field(foreign_key="graph_nodes.id", index=True)
    relationshipLabel: str
    docIds: list[str] = Field(sa_column=Column(JSON, nullable=False))


class CrossDocumentLinkRow(SQLModel, table=True):
    __tablename__ = "cross_document_links"
    nodeId: str = Field(foreign_key="graph_nodes.id", primary_key=True)
    docId: str = Field(foreign_key="documents.id", primary_key=True)


class ProgressRow(SQLModel, table=True):
    __tablename__ = "progress"
    __table_args__ = (CheckConstraint("id = 1"),)
    id: int = Field(default=1, primary_key=True)
    masteredCount: int = 0
    exploredCount: int = 0
    totalNodes: int = 0
    coveragePercent: float = 0
    crossDocLinks: int = 0


class SourcePageRow(SQLModel, table=True):
    __tablename__ = "source_pages"
    docId: str = Field(foreign_key="documents.id", primary_key=True)
    page: int = Field(primary_key=True)
    text: str


class NodeEmbeddingRow(SQLModel, table=True):
    __tablename__ = "node_embeddings"
    nodeId: str = Field(foreign_key="graph_nodes.id", primary_key=True)
    identity: str = Field(primary_key=True)
    vector: list[float] = Field(sa_column=Column(JSON, nullable=False))


class IngestionEventRow(SQLModel, table=True):
    __tablename__ = "ingestion_events"
    id: int | None = Field(default=None, primary_key=True)
    docId: str = Field(foreign_key="documents.id", index=True)
    type: str
    payload: dict[str, object] = Field(sa_column=Column(JSON, nullable=False))
