import subprocess
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone

import pytest
from sqlmodel import Session

from app.models import DocumentRow
from .test_chunking import write_pdf
from .test_document_api import client, events_for


def add_pdf(client, tmp_path: Path, status: str = "done") -> str:
    doc_id = str(uuid4())
    storage = client.app.state.storage
    path = storage.settings.data_dir / "uploads" / f"{doc_id}.pdf"
    path.parent.mkdir(exist_ok=True)
    write_pdf(path, ["Memory stores ideas.", "Recall retrieves ideas."])
    with Session(storage.engine) as session:
        session.add(DocumentRow(id=doc_id, name="notes.pdf", status=status, uploadedAt=datetime.now(timezone.utc)))
        session.commit()
    return doc_id


def test_metadata_reports_original_pdf_pages(client, tmp_path):
    doc_id = add_pdf(client, tmp_path)
    result = client.get(f"/documents/{doc_id}/preview-metadata")
    assert result.status_code == 200
    assert result.json() == {"docId": doc_id, "contentType": "application/pdf", "pageCount": 2, "chunkCount": 0}
    assert client.get("/documents/not-a-uuid/thumbnail").status_code == 422


def test_thumbnail_is_bounded_cached_and_deleted(client, tmp_path, monkeypatch):
    doc_id = add_pdf(client, tmp_path)
    calls = []
    monkeypatch.setattr("app.preview_routes.shutil.which", lambda _: "pdftoppm")
    def render(arguments, **options):
        calls.append((arguments, options))
        Path(arguments[-1] + ".png").write_bytes(b"\x89PNG\r\n\x1a\npreview")
    monkeypatch.setattr("app.preview_routes.subprocess.run", render)
    first = client.get(f"/documents/{doc_id}/thumbnail")
    assert first.status_code == 200 and first.headers["content-type"] == "image/png"
    assert client.get(f"/documents/{doc_id}/thumbnail").content == first.content
    assert len(calls) == 1 and calls[0][1]["timeout"] == 20
    assert "600" in calls[0][0] and calls[0][0][1:5] == ["-f", "1", "-l", "1"]
    assert client.delete(f"/documents/{doc_id}").status_code == 200
    assert not (client.app.state.storage.settings.data_dir / "previews" / f"{doc_id}.png").exists()


@pytest.mark.parametrize("failure", ["missing", "timeout", "large", "invalid"])
def test_preview_failures_preserve_indexed_document(client, tmp_path, monkeypatch, failure):
    doc_id = add_pdf(client, tmp_path)
    monkeypatch.setattr("app.preview_routes.shutil.which", lambda _: None if failure == "missing" else "pdftoppm")
    def render(arguments, **options):
        if failure == "timeout":
            raise subprocess.TimeoutExpired(arguments, 20)
        Path(arguments[-1] + ".png").write_bytes(b"x" * (2 * 1024 * 1024 + 1) if failure == "large" else b"invalid")
    monkeypatch.setattr("app.preview_routes.subprocess.run", render)
    assert client.get(f"/documents/{doc_id}/thumbnail").status_code == 503
    assert client.get(f"/documents/{doc_id}").json()["status"] == "done"


def test_only_done_pdfs_have_thumbnails(client, tmp_path):
    doc_id = add_pdf(client, tmp_path, status="queued")
    assert client.get(f"/documents/{doc_id}/thumbnail").status_code == 409
    response = client.post("/documents", files={"file": ("notes.md", b"# Memory\n\nMemory stores ideas.")})
    note = response.json()["id"]
    events_for(client, note)
    assert client.get(f"/documents/{note}/thumbnail").status_code == 415
    metadata = client.get(f"/documents/{note}/preview-metadata").json()
    assert metadata["pageCount"] == 1 and metadata["chunkCount"] >= 1
