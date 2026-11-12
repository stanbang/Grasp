from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from sqlmodel import Session, select

from app.config import Settings
from app.events import append_event, encode_event, read_events
from app.graph_repository import graph_snapshot
from app.ingestion import IngestionQueue
from app.models import ChunkRow, DocumentRow, ProgressRow, SourcePageRow
from app.storage import Storage


@pytest.fixture
def queue(tmp_path: Path):
    storage = Storage(Settings(data_dir=tmp_path / "data"))
    ingestion = IngestionQueue(storage)
    yield ingestion
    ingestion.close()
    storage.close()


def enqueue_record(queue: IngestionQueue, tmp_path: Path, text: str) -> tuple[str, Path]:
    doc_id = str(uuid4())
    path = tmp_path / f"{doc_id}.md"
    path.write_text(text, encoding="utf-8", newline="")
    with Session(queue.storage.engine) as session:
        document = DocumentRow(id=doc_id, name="note.md", status="queued", uploadedAt=datetime.now(timezone.utc))
        session.add(document)
        append_event(session, document, "status", message="Queued for processing.")
        session.commit()
    return doc_id, path


def test_ingestion_links_vectors_chunks_pages_and_graph(queue: IngestionQueue, tmp_path: Path) -> None:
    text = "## Working memory\n\nHold information briefly.\n\n## Retrieval\n\nRecall an idea before checking."
    doc_id, path = enqueue_record(queue, tmp_path, text)
    queue.process(doc_id, path)
    with Session(queue.storage.engine) as session:
        assert session.get(DocumentRow, doc_id).status == "done"
        chunks = session.exec(select(ChunkRow).where(ChunkRow.docId == doc_id)).all()
        assert chunks
        source = session.get(SourcePageRow, (doc_id, 1))
        assert source.text == text
        for chunk in chunks:
            assert source.text[chunk.charStart:chunk.charEnd] == chunk.text
        graph = graph_snapshot(session)
        assert len(graph.nodes) == 2 and len(graph.edges) == 1
        assert all(set(node.sourceChunkIds) <= {chunk.id for chunk in chunks} for node in graph.nodes)
        assert session.get(ProgressRow, 1).totalNodes == 2
    vectors = queue.storage.collection.get(where={"docId": doc_id}, include=["metadatas", "documents"])
    assert set(vectors["ids"]) == {chunk.id for chunk in chunks}
    assert vectors["metadatas"][0]["charStart"] == 0
    events, terminal = read_events(queue.storage.engine, doc_id, 0)
    assert terminal and events[-1].type == "complete"
    assert sum(event.type == "node" for event in events) == 2
    assert sum(event.type == "edge" for event in events) == 1
    assert "event: complete\n" in encode_event(events[-1])


def test_cross_document_merge_and_duplicate_job_are_idempotent(queue: IngestionQueue, tmp_path: Path) -> None:
    first_id, first_path = enqueue_record(queue, tmp_path, "## Retrieval practice\n\nRecall an idea.")
    second_id, second_path = enqueue_record(queue, tmp_path, "## Retrieval practice\n\nCheck recalled details against the source.")
    queue.process(first_id, first_path)
    queue.process(second_id, second_path)
    queue.process(second_id, second_path)
    with Session(queue.storage.engine) as session:
        graph = graph_snapshot(session)
        assert len(graph.nodes) == 1
        assert set(graph.nodes[0].docIds) == {first_id, second_id}
        assert len(graph.nodes[0].sourceChunkIds) == 2
        progress = session.get(ProgressRow, 1)
        assert progress.totalNodes == 1 and progress.crossDocLinks == 1
        assert progress.coveragePercent == 0 and progress.exploredCount == 0
    events, _ = read_events(queue.storage.engine, second_id, 0)
    assert sum(event.type == "complete" for event in events) == 1
    replay, terminal = read_events(queue.storage.engine, second_id, events[-2].id)
    assert terminal and [event.type for event in replay] == ["complete"]


def test_extraction_failure_rolls_back_domain_data_and_removes_vectors(queue: IngestionQueue, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    doc_id, path = enqueue_record(queue, tmp_path, "## Memory\n\nAn original note.")
    def fail(*args, **kwargs):
        raise RuntimeError("provider unavailable")
    monkeypatch.setattr("app.ingestion.extract_concepts", fail)
    queue.process(doc_id, path)
    with Session(queue.storage.engine) as session:
        assert session.get(DocumentRow, doc_id).status == "failed"
        assert not session.exec(select(ChunkRow).where(ChunkRow.docId == doc_id)).all()
        assert not graph_snapshot(session).nodes
        assert session.get(ProgressRow, 1).totalNodes == 0
    assert queue.storage.collection.get(where={"docId": doc_id})["ids"] == []
    events, terminal = read_events(queue.storage.engine, doc_id, 0)
    assert terminal and events[-1].type == "error"
    assert "provider unavailable" not in events[-1].message


def test_restart_marks_interrupted_jobs_failed_and_replays_the_error(queue: IngestionQueue, tmp_path: Path) -> None:
    doc_id, _ = enqueue_record(queue, tmp_path, "A note.")
    queue.recover_interrupted()
    events, terminal = read_events(queue.storage.engine, doc_id, 0)
    assert terminal and events[-1].document.status == "failed"
    assert "restarted" in events[-1].message


def test_configured_document_cap_is_enforced(queue: IngestionQueue, tmp_path: Path) -> None:
    queue.storage.settings = queue.storage.settings.model_copy(update={"max_nodes_per_document": 1})
    doc_id, path = enqueue_record(queue, tmp_path, "## First\n\nOne idea.\n\n## Second\n\nAnother idea.")
    queue.process(doc_id, path)
    with Session(queue.storage.engine) as session:
        assert session.get(DocumentRow, doc_id).status == "done"
        assert len(graph_snapshot(session).nodes) == 1


def test_sql_failure_preserves_existing_graph_and_discards_uncommitted_events(queue: IngestionQueue, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    text = "## Memory\n\nAn idea.\n\n## Recall\n\nA second idea."
    first_id, first_path = enqueue_record(queue, tmp_path, text)
    queue.process(first_id, first_path)
    second_id, second_path = enqueue_record(queue, tmp_path, text)
    def fail_on_edge(session, document, kind, **payload):
        if kind == "edge":
            raise RuntimeError("forced transaction failure")
        return append_event(session, document, kind, **payload)
    monkeypatch.setattr("app.graph_repository.append_event", fail_on_edge)
    queue.process(second_id, second_path)
    with Session(queue.storage.engine) as session:
        graph = graph_snapshot(session)
        assert len(graph.nodes) == 2 and len(graph.edges) == 1
        assert all(node.docIds == [first_id] for node in graph.nodes)
        assert graph.edges[0].docIds == [first_id]
        assert session.get(DocumentRow, second_id).status == "failed"
        assert session.get(ProgressRow, 1).crossDocLinks == 0
        assert not session.exec(select(ChunkRow).where(ChunkRow.docId == second_id)).all()
    events, terminal = read_events(queue.storage.engine, second_id, 0)
    assert terminal and events[-1].type == "error"
    assert all(event.type not in {"node", "edge", "complete"} for event in events)
    assert queue.storage.collection.get(where={"docId": second_id})["ids"] == []
