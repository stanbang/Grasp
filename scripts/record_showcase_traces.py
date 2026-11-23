"""Record the offline ingestion pipeline using only checked-in showcase notes."""

import argparse
from collections import defaultdict
from datetime import datetime, timezone
from functools import wraps
import hashlib
from pathlib import Path
import random
import sys
import tempfile
import textwrap
from time import perf_counter
from typing import Callable, ParamSpec, TypeVar
from unittest.mock import patch

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
from sqlmodel import Session, select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api"))

from app import ingestion
from app.config import Settings
from app.events import read_events
from app.graph_repository import graph_snapshot
from app.models import ChunkRow, DocumentRow, NodeEmbeddingRow, SourcePageRow
from app.retrieval import retrieve_chunks
from app.schemas import ChatResponse, Chunk, Citation, GraphResponse, PageResponse
from app.showcase_models import ShowcasePoint, ShowcasePrompt, ShowcaseStage, ShowcaseTrace, StageKind
from app.storage import Storage


SAMPLES = (
    ("computer-networks", "Computer networks", "samples/showcase/computer-networks.md", (
        ("What does a router do?", "A router forwards packets between networks."),
        ("What does DNS resolve?", "DNS resolves names to records, such as an IP address for a host."),
        ("What does TCP provide?", "TCP provides a reliable, ordered byte stream."),
    )),
    ("memory-and-learning", "Memory and learning", "samples/memory-and-learning.md", (
        ("What is retrieval practice?", "Retrieval practice means trying to recall"),
        ("What does working memory do?", "Working memory holds information briefly"),
    )),
    ("retrieval-review", "Retrieval review", "samples/retrieval-review.md", (
        ("What is a worked example?", "A worked example shows the steps used to solve a task."),
        ("How do I make a correction specific?", "Use the source passage to make that correction specific."),
    )),
)

Params = ParamSpec("Params")
Result = TypeVar("Result")


def observe(operation: Callable[Params, Result], stages: dict[StageKind, float], kind: StageKind) -> Callable[Params, Result]:
    @wraps(operation)
    def recorded(*args: Params.args, **kwargs: Params.kwargs) -> Result:
        start = perf_counter()
        result = operation(*args, **kwargs)
        stages[kind] += (perf_counter() - start) * 1000
        return result

    return recorded


def prepare_sample(source: Path, directory: Path) -> Path:
    text = source.read_text(encoding="utf-8")
    path = directory / source.name
    if "<!-- page break -->" not in text:
        path.write_text(text, encoding="utf-8", newline="\n")
        return path

    path = path.with_suffix(".pdf")
    writer = PdfWriter()
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"),
                             NameObject("/Subtype"): NameObject("/Type1"),
                             NameObject("/BaseFont"): NameObject("/Helvetica")})
    for body in text.split("<!-- page break -->"):
        page = writer.add_blank_page(width=612, height=792)
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
        commands = ["BT /F1 10 Tf 12 TL 54 737 Td"]
        for paragraph in body.strip().splitlines():
            for line in textwrap.wrap(paragraph, width=92) or [""]:
                safe_line = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
                commands.append(f"({safe_line or ' '}) Tj T*")
        stream = DecodedStreamObject()
        stream.set_data(("\n".join([*commands, "ET"])).encode("ascii"))
        page.replace_contents(stream)
    writer.write(path)
    return path


def project(vectors: dict[str, list[float]]) -> list[ShowcasePoint]:
    if not vectors:
        return []
    dimensions = len(next(iter(vectors.values())))
    random_source = random.Random(729)
    axes = [[random_source.gauss(0, 1) for _ in range(dimensions)] for _ in range(3)]
    raw = {key: [sum(component * weight for component, weight in zip(vector, axis)) for axis in axes]
           for key, vector in vectors.items()}
    bounds = [(min(axis), max(axis)) for axis in zip(*raw.values())]
    points = []
    for key, coords in raw.items():
        x, y, z = (round(2 * (coord - low) / (high - low) - 1, 5) if low < high else 0
                   for coord, (low, high) in zip(coords, bounds))
        points.append(ShowcasePoint(id=key, xyz=(x, y, z)))
    return points


def capture_prompts(storage: Storage, doc_id: str, graph: GraphResponse, prompts: tuple[tuple[str, str], ...]) -> list[ShowcasePrompt]:
    captured = []
    for question, anchor in prompts:
        matches = retrieve_chunks(storage, question, 5, [doc_id])
        match = next((chunk for chunk in matches if anchor in chunk.text), None)
        if match is None:
            raise ValueError(f"The recorded retriever could not find the source for {question!r}.")
        start = match.text.index(anchor)
        line_end = match.text.find("\n", start + len(anchor))
        sentence_end = match.text.find(". ", start + len(anchor))
        end = min([len(match.text), *[point for point in (line_end, sentence_end + 1 if sentence_end >= 0 else -1) if point != -1]])
        quote = anchor if anchor.endswith(".") else match.text[start:end].strip()
        cited = Citation(docId=doc_id, page=match.page, chunkId=match.id, quote=quote)
        nodes = [node.id for node in graph.nodes if match.id in node.sourceChunkIds]
        captured.append(ShowcasePrompt(question=question, answer=ChatResponse(answer=quote, citations=[cited], referencedNodeIds=nodes)))
    return captured


def record_sample(sample: tuple[str, str, str, tuple[tuple[str, str], ...]]) -> ShowcaseTrace:
    doc_id, title, source, prompts = sample
    with tempfile.TemporaryDirectory(prefix="grasp-showcase-", ignore_cleanup_errors=True) as directory:
        path = prepare_sample(ROOT / source, Path(directory))
        settings = Settings(mock_llm=True, data_dir=Path(directory) / "data", chunk_size=520, chunk_overlap=130)
        storage = Storage(settings)
        durations: dict[StageKind, float] = defaultdict(float)
        try:
            with Session(storage.engine) as session:
                session.add(DocumentRow(id=doc_id, name=path.name, status="queued", uploadedAt=datetime.now(timezone.utc)))
                session.commit()
            with patch.multiple(ingestion,
                                read_pages=observe(ingestion.read_pages, durations, "pages"),
                                chunk_pages=observe(ingestion.chunk_pages, durations, "chunks"),
                                index_chunks=observe(ingestion.index_chunks, durations, "embeddings"),
                                extract_concepts=observe(ingestion.extract_concepts, durations, "concepts"),
                                commit_document=observe(ingestion.commit_document, durations, "links")):
                ingestion.ingest_document(storage, doc_id, path)
            with Session(storage.engine) as session:
                pages = [PageResponse.model_validate(row.model_dump()) for row in session.exec(select(SourcePageRow).order_by(SourcePageRow.page))]
                chunks = [Chunk.model_validate(row.model_dump()) for row in session.exec(select(ChunkRow).order_by(ChunkRow.page, ChunkRow.charStart))]
                graph = graph_snapshot(session)
                concept_vectors = {row.nodeId: row.vector for row in session.exec(select(NodeEmbeddingRow).order_by(NodeEmbeddingRow.nodeId))}
            indexed = storage.collection.get(ids=[chunk.id for chunk in chunks], include=["embeddings"])
            embeddings = indexed["embeddings"]
            if embeddings is None:
                raise ValueError("The pipeline returned no stored embeddings.")
            chunk_vectors = {chunk_id: vector.tolist() for chunk_id, vector in zip(indexed["ids"], embeddings)}
            events, terminal = read_events(storage.engine, doc_id, 0)
            if not terminal or not any(event.type == "complete" for event in events):
                raise ValueError("The pipeline did not commit a complete trace.")
            stages: list[tuple[StageKind, list[str]]] = [
                ("pages", [events[0].message or "Source pages read."]),
                ("text", ["Show the extracted text from the recorded pages."]),
                ("chunks", [f"Located {len(chunks)} passages with page-local offsets."]),
                ("embeddings", [f"Indexed {len(chunk_vectors)} passages with deterministic mock embeddings."]),
                ("concepts", [event.message for event in events if event.completedBatches and event.message]),
                ("links", [f"Committed {len(graph.nodes)} concepts and {len(graph.edges)} links."]),
                ("ready", [next(event.message for event in events if event.type == "complete" and event.message)]),
            ]
            return ShowcaseTrace(version=1, mode="mock", id=doc_id, title=title, fileName=path.name,
                                 sourcePath=source, sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                                 embeddingIdentity=storage.embedding_identity, chunkSize=settings.chunk_size,
                                 chunkOverlap=settings.chunk_overlap, pages=pages, chunks=chunks,
                                 chunkPositions=project(chunk_vectors), conceptPositions=project(concept_vectors), graph=graph,
                                 stages=[ShowcaseStage(kind=kind, lines=lines, durationMs=round(durations[kind], 3) if kind in durations else None)
                                         for kind, lines in stages], prompts=capture_prompts(storage, doc_id, graph, prompts))
        finally:
            storage.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "apps/web/src/showcase/traces")
    args = parser.parse_args()
    traces = [record_sample(sample) for sample in SAMPLES]
    args.output.mkdir(parents=True, exist_ok=True)
    for trace in traces:
        path = args.output / f"{trace.id}.json"
        path.write_text(trace.model_dump_json(indent=2) + "\n", encoding="utf-8", newline="\n")
        print(f"{trace.id}: {len(trace.pages)} pages, {len(trace.chunks)} chunks, {len(trace.graph.nodes)} concepts")


if __name__ == "__main__":
    main()
