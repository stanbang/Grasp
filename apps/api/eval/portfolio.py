"""Compare retrieval choices on public sample notes in temporary indexes."""
import argparse
import hashlib
import json
import statistics
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import NotRequired, TypedDict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlmodel import Session
from app.config import PROJECT_ROOT, get_settings
from app.ingestion import index_chunks
from app.llm import build_embedder, provider_check
from app.models import ChunkRow, DocumentRow
from app.parsing import chunk_pages, read_pages
from app.retrieval import query_terms, retrieve_chunks
from app.schemas import Chunk
from app.storage import Storage

FIXTURES = Path(__file__).parent
NOTES = ("memory-and-learning.md", "retrieval-review.md")
TOP_K = 3
CANDIDATES = 8


class Question(TypedDict):
    question: str
    document: str
    quote: str
    scope: NotRequired[list[str]]


class Result(Question):
    rank: int | None
    retrievedChunkIds: list[str]
    outOfScope: int
    retrievalMs: float


def corpus() -> dict[str, Path]:
    return {
        **{name: PROJECT_ROOT / "samples" / name for name in NOTES},
        **{path.name: path for path in sorted((FIXTURES / "portfolio-fixtures").glob("*.md"))},
    }


def index_corpus(storage: Storage, paths: dict[str, Path]) -> list[Chunk]:
    settings = storage.settings
    chunks = [
        chunk
        for name, path in paths.items()
        for chunk in chunk_pages(read_pages(path, name), settings.chunk_size, settings.chunk_overlap)
    ]
    with Session(storage.engine) as session:
        for name in paths:
            session.add(DocumentRow(id=name, name=name, status="done", uploadedAt=datetime.now(timezone.utc)))
        session.commit()
        for chunk in chunks:
            session.add(ChunkRow(**chunk.model_dump()))
        session.commit()
    index_chunks(storage, chunks, build_embedder(settings))
    return chunks


def measure(
    storage: Storage, cases: list[Question], chunks: list[Chunk], warm_query: str,
) -> dict[str, list[Result]]:
    ranked: dict[str, list[Result]] = {"vector": [], "vector_then_terms": []}
    retrieve_chunks(storage, warm_query, CANDIDATES, [])
    for case in cases:
        scope = case.get("scope", [])
        relevant = {
            chunk.id for chunk in chunks
            if chunk.docId == case["document"] and case["quote"] in chunk.text
        }
        if not relevant:
            raise ValueError(f"Gold quote absent from the indexed source: {case['question']}")
        start = time.perf_counter()
        candidates = retrieve_chunks(storage, case["question"], CANDIDATES, scope)
        retrieved = time.perf_counter()
        terms = query_terms(case["question"])
        reranked = sorted(candidates, key=lambda chunk: -len(terms & query_terms(chunk.text)))
        finished = time.perf_counter()
        for name, ordered, elapsed in (
            ("vector", candidates, retrieved - start),
            ("vector_then_terms", reranked, finished - start),
        ):
            ids = [chunk.id for chunk in ordered[:TOP_K]]
            rank = next((i for i, cid in enumerate(ids, 1) if cid in relevant), None)
            ranked[name].append({
                **case, "rank": rank, "retrievedChunkIds": ids,
                "outOfScope": sum(chunk.docId not in scope for chunk in ordered[:TOP_K]) if scope else 0,
                "retrievalMs": round(elapsed * 1000, 2),
            })
    return ranked


def summarize(
    name: str, rows: list[Result], chunks: list[Chunk], size: int, overlap: int, embedding: str,
) -> dict[str, object]:
    ordered = sorted(row["retrievalMs"] for row in rows)
    count = len(rows)
    return {
        "id": f"{size}-{name}", "ranking": name, "embedding": embedding,
        "chunkSize": size, "overlap": overlap, "chunks": len(chunks),
        "hitAt1": sum(row["rank"] == 1 for row in rows) / count,
        "hitAt3": sum(row["rank"] is not None for row in rows) / count,
        "mrrAt3": sum(1 / row["rank"] for row in rows if row["rank"]) / count,
        "p50Ms": round(statistics.median(ordered), 2),
        "p95Ms": ordered[(95 * count + 99) // 100 - 1],
        "scopedCases": sum(bool(row.get("scope")) for row in rows),
        "outOfScope": sum(row["outOfScope"] for row in rows),
        "meanContextChars": round(statistics.mean(
            sum(len(chunk.text) for chunk in chunks if chunk.id in row["retrievedChunkIds"])
            for row in rows
        )),
        "cases": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Use the configured embedding API on public fixtures.")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    settings = get_settings().model_copy(update={"mock_llm": not args.live})
    if not provider_check(settings).configured:
        raise SystemExit("Configure the selected embedding provider or omit --live.")
    paths = corpus()
    cases: list[Question] = json.loads((FIXTURES / "portfolio-questions.json").read_text(encoding="utf-8"))
    results = []
    for size, overlap in ((900, 150), (360, 60)):
        with tempfile.TemporaryDirectory(prefix="grasp-portfolio-", ignore_cleanup_errors=True) as folder:
            storage = Storage(settings.model_copy(update={
                "data_dir": Path(folder), "chunk_size": size, "chunk_overlap": overlap,
            }))
            try:
                chunks = index_corpus(storage, paths)
                runs = measure(storage, cases, chunks, "What is memory?")
                results.extend(summarize(name, rows, chunks, size, overlap, storage.embedding_identity)
                               for name, rows in runs.items())
            finally:
                storage.close()
    report = {
        "mode": "live embeddings" if args.live else "deterministic fixture",
        "questions": len(cases), "topK": TOP_K, "candidateK": CANDIDATES,
        "corpus": {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in paths.items()},
        "runs": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for run in results:
        print(f"{run['id']} | {run['chunks']} chunks | Hit@3 {run['hitAt3']:.3f} | MRR@3 {run['mrrAt3']:.3f} | p95 {run['p95Ms']:.1f} ms")


if __name__ == "__main__":
    main()
