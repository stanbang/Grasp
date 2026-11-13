import mimetypes
import shutil
import subprocess
import tempfile
from pathlib import Path
from threading import BoundedSemaphore
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pypdf import PdfReader
from sqlmodel import Session, select

from .document_lifecycle import uploaded_path
from .document_routes import require_document
from .models import ChunkRow, SourcePageRow
from .schemas import Schema
from .storage import Storage

router = APIRouter(prefix="/documents", tags=["document previews"])
render_slots = BoundedSemaphore(2)
MAX_PREVIEW_BYTES = 2 * 1024 * 1024


class PreviewMetadata(Schema):
    docId: str
    contentType: str
    pageCount: int
    chunkCount: int


@router.get("/{doc_id}/preview-metadata", response_model=PreviewMetadata)
def preview_metadata(doc_id: UUID, request: Request) -> PreviewMetadata:
    storage: Storage = request.app.state.storage
    document = require_document(storage, str(doc_id))
    with Session(storage.engine) as session:
        chunks = session.exec(select(ChunkRow.id).where(ChunkRow.docId == str(doc_id))).all()
        pages = session.exec(select(SourcePageRow.page).where(SourcePageRow.docId == str(doc_id))).all()
    path = uploaded_path(storage, document)
    page_count = len(pages)
    if path.suffix == ".pdf" and path.is_file():
        try:
            page_count = len(PdfReader(path).pages)
        except Exception as error:
            raise HTTPException(422, "The original PDF metadata could not be read.") from error
    return PreviewMetadata(
        docId=str(doc_id), contentType=mimetypes.guess_type(document.name)[0] or "text/plain",
        pageCount=page_count, chunkCount=len(chunks),
    )


def render_thumbnail(storage: Storage, doc_id: str) -> Path:
    document = require_document(storage, doc_id)
    if document.status != "done":
        raise HTTPException(409, "Wait for indexing to finish before opening a preview.")
    source = uploaded_path(storage, document)
    if source.suffix != ".pdf":
        raise HTTPException(415, "Image previews are available for PDF documents.")
    if not source.is_file():
        raise HTTPException(404, "The original PDF is unavailable; read its extracted passages instead.")
    cache = storage.settings.data_dir / "previews"
    destination = cache / f"{doc_id}.png"
    if destination.is_file():
        return destination
    renderer = shutil.which("pdftoppm")
    if not renderer:
        raise HTTPException(503, "PDF thumbnails need local Poppler. The document's indexed text remains available.")
    if not render_slots.acquire(blocking=False):
        raise HTTPException(503, "Other previews are rendering. Try this document again shortly.")
    try:
        cache.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="render-", dir=cache) as folder:
            prefix = Path(folder) / "page"
            try:
                subprocess.run(
                    [renderer, "-f", "1", "-l", "1", "-singlefile", "-scale-to", "600", "-png", str(source), str(prefix)],
                    check=True, capture_output=True, timeout=20,
                )
            except (subprocess.SubprocessError, OSError) as error:
                raise HTTPException(503, "The PDF preview could not be rendered. Its indexed passages remain available.") from error
            image = prefix.with_suffix(".png")
            if not image.is_file() or image.stat().st_size > MAX_PREVIEW_BYTES:
                raise HTTPException(503, "The PDF preview exceeded the image limit.")
            with image.open("rb") as rendered:
                if rendered.read(8) != b"\x89PNG\r\n\x1a\n":
                    raise HTTPException(503, "The PDF renderer did not return a PNG image.")
            with storage.upload_lock:
                require_document(storage, doc_id)
                image.replace(destination)
    finally:
        render_slots.release()
    return destination


@router.get("/{doc_id}/thumbnail", response_class=FileResponse)
def thumbnail(doc_id: UUID, request: Request) -> FileResponse:
    path = render_thumbnail(request.app.state.storage, str(doc_id))
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "private, no-store"})
