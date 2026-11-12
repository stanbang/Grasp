import json
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.schemas import IngestionEvent
from .test_chunking import write_pdf


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    settings = Settings(data_dir=tmp_path / "data", max_upload_bytes=2048)
    monkeypatch.setattr("app.main.get_settings", lambda: settings)
    with TestClient(app) as test_client:
        yield test_client


def events_for(client: TestClient, doc_id: str, headers: dict[str, str] | None = None) -> list[IngestionEvent]:
    response = client.get(f"/documents/{doc_id}/events", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    return [IngestionEvent.model_validate(json.loads(line[6:])) for line in response.text.splitlines() if line.startswith("data: ")]


def test_upload_stream_replay_and_exact_sources(client: TestClient) -> None:
    text = "## Memory\n\nMemory connects ideas. 🧠\n\n## Recall\n\nRecall checks understanding."
    response = client.post("/documents", files={"file": ("notes.md", text.encode("utf-8"), "text/markdown")})
    assert response.status_code == 202
    document = response.json()
    assert document["status"] == "queued" and document["name"] == "notes.md"
    doc_id = document["id"]
    events = events_for(client, doc_id)
    assert events[0].document.status == "queued"
    assert events[-1].type == "complete"
    assert [event.id for event in events] == sorted({event.id for event in events})
    assert client.get(f"/documents/{doc_id}").json()["status"] == "done"
    assert client.get("/documents").json()["documents"][0]["id"] == doc_id
    page = client.get(f"/documents/{doc_id}/pages/1").json()
    chunks = client.get(f"/documents/{doc_id}/chunks").json()["chunks"]
    assert page["text"] == text
    assert all(page["text"][chunk["charStart"]:chunk["charEnd"]] == chunk["text"] for chunk in chunks)
    graph = client.get("/graph").json()
    assert len(graph["nodes"]) == 2 and len(graph["edges"]) == 1
    assert all("quiz" not in node for node in graph["nodes"])
    replay = events_for(client, doc_id, {"Last-Event-ID": str(events[-2].id)})
    assert [event.type for event in replay] == ["complete"]
    assert events_for(client, doc_id, {"Last-Event-ID": str(events[-1].id)}) == []


@pytest.mark.parametrize("filename,content,status", [
    ("file.exe", b"no", 415), ("empty.txt", b"", 400),
    ("large.txt", b"a" * 2049, 413), ("a" * 201 + ".txt", b"text", 400),
])
def test_invalid_uploads_are_rejected_without_creating_documents(client: TestClient, filename: str, content: bytes, status: int) -> None:
    response = client.post("/documents", files={"file": (filename, content)})
    assert response.status_code == status
    assert client.get("/documents").json()["documents"] == []


def test_unreadable_document_has_a_terminal_error(client: TestClient) -> None:
    response = client.post("/documents", files={"file": ("invalid.txt", b"\xff\xfeinvalid")})
    doc_id = response.json()["id"]
    events = events_for(client, doc_id)
    assert events[-1].type == "error"
    assert "UTF-8" in events[-1].message
    assert client.get(f"/documents/{doc_id}").json()["status"] == "failed"
    assert client.get(f"/documents/{doc_id}/chunks").json()["chunks"] == []


def test_pdf_upload_preserves_one_based_page_provenance(client: TestClient, tmp_path: Path) -> None:
    path = tmp_path / "two-pages.pdf"
    write_pdf(path, ["Memory holds information.", "Recall checks understanding."])
    assert path.stat().st_size <= 2048
    response = client.post("/documents", files={"file": (path.name, path.read_bytes(), "application/pdf")})
    doc_id = response.json()["id"]
    assert events_for(client, doc_id)[-1].type == "complete"
    chunks = client.get(f"/documents/{doc_id}/chunks").json()["chunks"]
    assert {chunk["page"] for chunk in chunks} == {1, 2}
    assert client.get(f"/documents/{doc_id}/pages/2").json()["text"].startswith("Recall")


def test_unknown_documents_and_invalid_event_cursors(client: TestClient) -> None:
    unknown = str(uuid4())
    assert client.get(f"/documents/{unknown}/events").status_code == 404
    assert client.get("/documents/not-a-uuid").status_code == 422
    assert client.get(f"/documents/{unknown}/events?after=-1").status_code == 422
    assert client.get(f"/documents/{unknown}/events", headers={"Last-Event-ID": "oops"}).status_code == 422
