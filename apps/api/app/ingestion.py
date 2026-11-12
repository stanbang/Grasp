import logging
import math
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

from langchain_core.embeddings import Embeddings
from sqlmodel import Session, select

from .events import append_event
from .extraction import extract_concepts
from .graph_repository import commit_document, prepare_merger
from .llm import build_embedder
from .merging import GraphMerger, concept_text
from .models import DocumentRow
from .parsing import DocumentInputError, chunk_pages, read_pages
from .schemas import Chunk
from .storage import Storage

logger = logging.getLogger(__name__)
EXTRACTION_BATCH_SIZE = 8
EMBEDDING_BATCH_SIZE = 64


def update_status(
    storage: Storage, doc_id: str, status: Literal["chunking", "extracting", "failed"], message: str,
    *, completed: int | None = None, total: int | None = None,
) -> None:
    with Session(storage.engine) as session:
        document = session.get(DocumentRow, doc_id)
        if document is None:
            raise RuntimeError("The upload record is missing.")
        document.status = status
        session.add(document)
        append_event(
            session, document, "error" if status == "failed" else "status",
            message=message, completed_batches=completed, total_batches=total,
        )
        session.commit()


def checked_embeddings(embedder: Embeddings, texts: list[str]) -> list[list[float]]:
    vectors = embedder.embed_documents(texts)
    if len(vectors) != len(texts) or any(not vector for vector in vectors):
        raise ValueError("The embedding provider did not return one vector per input.")
    if any(not math.isfinite(value) for vector in vectors for value in vector):
        raise ValueError("Embedding vectors must contain finite numbers.")
    return vectors


def index_chunks(storage: Storage, chunks: list[Chunk], embedder: Embeddings) -> None:
    for start in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
        batch = chunks[start:start + EMBEDDING_BATCH_SIZE]
        texts = [chunk.text for chunk in batch]
        vectors = checked_embeddings(embedder, texts)
        storage.collection.upsert(
            ids=[chunk.id for chunk in batch], documents=texts, embeddings=vectors,
            metadatas=[chunk.model_dump(exclude={"id", "text"}) for chunk in batch],
        )


def fill_missing_node_vectors(merger: GraphMerger, embedder: Embeddings) -> None:
    missing = [node for node in merger.nodes.values() if node.id not in merger.vectors]
    for start in range(0, len(missing), EMBEDDING_BATCH_SIZE):
        batch = missing[start:start + EMBEDDING_BATCH_SIZE]
        vectors = checked_embeddings(embedder, [concept_text(node.label, node.summary) for node in batch])
        merger.vectors.update({node.id: vector for node, vector in zip(batch, vectors)})


def ingest_document(storage: Storage, doc_id: str, path: Path) -> None:
    update_status(storage, doc_id, "chunking", "Reading source pages and locating chunks.")
    pages = read_pages(path, doc_id)
    chunks = chunk_pages(pages, storage.settings.chunk_size, storage.settings.chunk_overlap)
    if not chunks:
        raise DocumentInputError("No readable chunks were found in this document.")
    batch_count = (len(chunks) + EXTRACTION_BATCH_SIZE - 1) // EXTRACTION_BATCH_SIZE
    update_status(storage, doc_id, "extracting", "Indexing chunks and extracting concepts.", completed=0, total=batch_count)
    embedder = build_embedder(storage.settings)
    index_chunks(storage, chunks, embedder)
    merger = prepare_merger(storage, doc_id)
    fill_missing_node_vectors(merger, embedder)
    for index, start in enumerate(range(0, len(chunks), EXTRACTION_BATCH_SIZE)):
        if merger.remaining == 0:
            break
        batch = chunks[start:start + EXTRACTION_BATCH_SIZE]
        result = extract_concepts(batch, storage.settings, merger.remaining)
        vectors = checked_embeddings(embedder, [concept_text(node.label, node.summary) for node in result.concepts]) if result.concepts else []
        merger.merge_batch(result, vectors)
        update_status(
            storage, doc_id, "extracting", "Extracted a source batch.",
            completed=index + 1, total=batch_count,
        )
    commit_document(storage, doc_id, pages, chunks, merger)


class IngestionQueue:
    def __init__(self, storage: Storage):
        self.storage = storage
        # One writer keeps graph merges ordered and prevents duplicate concepts across uploads.
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="grasp-ingest")

    def recover_interrupted(self) -> None:
        with Session(self.storage.engine) as session:
            documents = session.exec(select(DocumentRow).where(
                DocumentRow.status.in_(["queued", "chunking", "extracting"]),
            )).all()
            ids = [document.id for document in documents]
        for doc_id in ids:
            self.storage.collection.delete(where={"docId": doc_id})
            update_status(self.storage, doc_id, "failed", "Processing stopped when the API restarted. Upload the file again.")

    def submit(self, doc_id: str, path: Path) -> None:
        self.executor.submit(self.process, doc_id, path)

    def process(self, doc_id: str, path: Path) -> None:
        with Session(self.storage.engine) as session:
            document = session.get(DocumentRow, doc_id)
            if document is None or document.status != "queued":
                return
        try:
            ingest_document(self.storage, doc_id, path)
        except Exception as error:
            # A worker failure must become a durable terminal event rather than a lost future.
            logger.error("Ingestion failed for %s (%s)", doc_id, type(error).__name__)
            try:
                self.storage.collection.delete(where={"docId": doc_id})
            except Exception as cleanup_error:
                logger.error("Vector cleanup failed for %s (%s)", doc_id, type(cleanup_error).__name__)
            message = str(error) if isinstance(error, DocumentInputError) else "Processing failed. Check the file and model configuration, then upload again."
            update_status(self.storage, doc_id, "failed", message)

    def close(self) -> None:
        self.executor.shutdown(wait=True)
