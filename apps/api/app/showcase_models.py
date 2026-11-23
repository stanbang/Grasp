from typing import Literal

from pydantic import Field, model_validator

from .schemas import ChatResponse, Chunk, GraphResponse, PageResponse, Schema

StageKind = Literal["pages", "text", "chunks", "embeddings", "concepts", "links", "ready"]
STAGE_ORDER: tuple[StageKind, ...] = ("pages", "text", "chunks", "embeddings", "concepts", "links", "ready")


class ShowcaseStage(Schema):
    kind: StageKind
    lines: list[str] = Field(min_length=1)
    durationMs: float | None


class ShowcasePoint(Schema):
    id: str
    xyz: tuple[float, float, float]


class ShowcasePrompt(Schema):
    question: str
    answer: ChatResponse


class ShowcaseTrace(Schema):
    version: Literal[1]
    mode: Literal["mock"]
    id: str
    title: str
    fileName: str
    sourcePath: str
    sourceSha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    embeddingIdentity: Literal["mock-sha256-256-v1"]
    chunkSize: int = Field(gt=0)
    chunkOverlap: int = Field(ge=0)
    pages: list[PageResponse] = Field(min_length=1)
    chunks: list[Chunk] = Field(min_length=1)
    chunkPositions: list[ShowcasePoint]
    conceptPositions: list[ShowcasePoint]
    graph: GraphResponse
    stages: list[ShowcaseStage]
    prompts: list[ShowcasePrompt]

    @model_validator(mode="after")
    def check_sources(self) -> "ShowcaseTrace":
        if self.chunkOverlap >= self.chunkSize:
            raise ValueError("Chunk overlap must be smaller than the chunk size.")
        if tuple(stage.kind for stage in self.stages) != STAGE_ORDER:
            raise ValueError("Trace stages must follow ingestion order.")
        if any(stage.durationMs is not None and not 0 <= stage.durationMs < float("inf") for stage in self.stages):
            raise ValueError("Recorded durations must be finite and nonnegative.")
        if [page.page for page in self.pages] != list(range(1, len(self.pages) + 1)):
            raise ValueError("Pages must be contiguous and one-based.")
        pages = {page.page: page for page in self.pages}
        chunks = {chunk.id: chunk for chunk in self.chunks}
        nodes = {node.id: node for node in self.graph.nodes}
        if any(page.docId != self.id for page in pages.values()):
            raise ValueError("All pages must belong to the sample.")
        for chunk in self.chunks:
            page = pages.get(chunk.page)
            if chunk.docId != self.id or page is None or page.text[chunk.charStart:chunk.charEnd] != chunk.text:
                raise ValueError("Each chunk must match its exact page span.")
        for positions, records in ((self.chunkPositions, self.chunks), (self.conceptPositions, self.graph.nodes)):
            if sorted(point.id for point in positions) != sorted({item.id for item in records}) or len(positions) != len(records):
                raise ValueError("Each chunk and concept needs one projected position.")
            if any(not -1 <= axis <= 1 for point in positions for axis in point.xyz):
                raise ValueError("Projected positions must be finite and normalized.")
        for node in self.graph.nodes:
            if node.docIds != [self.id] or not node.sourceChunkIds or not set(node.sourceChunkIds) <= chunks.keys():
                raise ValueError("Each concept must point to source chunks in the sample.")
        for edge in self.graph.edges:
            if edge.docIds != [self.id] or edge.source not in nodes or edge.target not in nodes:
                raise ValueError("Each link must connect concepts in the sample.")
        for prompt in self.prompts:
            cited_chunks = set()
            for citation in prompt.answer.citations:
                chunk = chunks.get(citation.chunkId)
                if chunk is None or citation.docId != chunk.docId or citation.page != chunk.page or not citation.quote or citation.quote not in chunk.text:
                    raise ValueError("Each citation must quote the cited chunk exactly.")
                cited_chunks.add(chunk.id)
            expected = {node.id for node in self.graph.nodes if cited_chunks.intersection(node.sourceChunkIds)}
            if not cited_chunks or set(prompt.answer.referencedNodeIds) != expected:
                raise ValueError("Prompt highlights must be derived from cited chunks.")
        return self


SHOWCASE_MODELS = (ShowcaseStage, ShowcasePoint, ShowcasePrompt, ShowcaseTrace)
