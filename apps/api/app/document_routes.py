from typing import Annotated
from uuid import UUID, uuid4
from pathlib import Path as FilePath
from datetime import datetime, timezone

from starlette.concurrency import run_in_threadpool

from fastapi import APIRouter, File, Header, HTTPException, Path, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from .events import append_event, stream_events
from .models import ChunkRow, DocumentRow, SourcePageRow
from .schemas import Chunk, ChunksResponse, Document, DocumentsResponse, PageResponse
from .storage import Storage
from .ingestion import IngestionQueue
from .parsing import ALLOWED_EXTENSIONS

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=Document, status_code=202)
async def upload_document(request: Request, file: Annotated[UploadFile, File()]) -> Document:
    storage: Storage = request.app.state.storage
    queue: IngestionQueue = request.app.state.ingestion
    name = FilePath((file.filename or "").replace("\\", "/")).name
    extension = FilePath(name).suffix.lower()
    try:
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=415, detail="Upload a PDF, Markdown (.md) or UTF-8 text (.txt) file.")
        if len(name) > 200 or any(ord(character) < 32 for character in name):
            raise HTTPException(status_code=400, detail="Use a filename under 201 characters without control characters.")
        content = await file.read(storage.settings.max_upload_bytes + 1)
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        if len(content) > storage.settings.max_upload_bytes:
            raise HTTPException(status_code=413, detail=f"Upload a file no larger than {storage.settings.max_upload_bytes:,} bytes.")
    finally:
        await file.close()
    doc_id = str(uuid4())
    upload_dir = storage.settings.data_dir / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    path = upload_dir / f"{doc_id}{extension}"
    await run_in_threadpool(path.write_bytes, content)
    document = DocumentRow(id=doc_id, name=name, status="queued", uploadedAt=datetime.now(timezone.utc))
    try:
        with Session(storage.engine) as session:
            session.add(document)
            append_event(session, document, "status", message="Queued for processing.")
            response = Document.model_validate(document.model_dump())
            session.commit()
    except Exception:
        path.unlink(missing_ok=True)
        raise
    queue.submit(doc_id, path)
    return response


def require_document(storage: Storage, doc_id: str) -> DocumentRow:
    with Session(storage.engine) as session:
        document = session.get(DocumentRow, doc_id)
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found.")
        return document


@router.get("", response_model=DocumentsResponse)
def list_documents(request: Request) -> DocumentsResponse:
    with Session(request.app.state.storage.engine) as session:
        rows = session.exec(select(DocumentRow).order_by(DocumentRow.uploadedAt.desc(), DocumentRow.id)).all()
        return DocumentsResponse(documents=[Document.model_validate(row.model_dump()) for row in rows])


@router.get("/{doc_id}", response_model=Document)
def get_document(request: Request, doc_id: UUID) -> Document:
    row = require_document(request.app.state.storage, str(doc_id))
    return Document.model_validate(row.model_dump())


@router.get("/{doc_id}/chunks", response_model=ChunksResponse)
def get_chunks(request: Request, doc_id: UUID) -> ChunksResponse:
    storage: Storage = request.app.state.storage
    require_document(storage, str(doc_id))
    with Session(storage.engine) as session:
        rows = session.exec(select(ChunkRow).where(ChunkRow.docId == str(doc_id)).order_by(ChunkRow.page, ChunkRow.charStart)).all()
        return ChunksResponse(chunks=[Chunk.model_validate(row.model_dump()) for row in rows])


@router.get("/{doc_id}/pages/{page}", response_model=PageResponse)
def get_page(request: Request, doc_id: UUID, page: Annotated[int, Path(ge=1)]) -> PageResponse:
    storage: Storage = request.app.state.storage
    require_document(storage, str(doc_id))
    with Session(storage.engine) as session:
        row = session.get(SourcePageRow, (str(doc_id), page))
        if row is None:
            raise HTTPException(status_code=404, detail="Source page not found. Pages are available after processing finishes.")
        return PageResponse.model_validate(row.model_dump())


@router.get(
    "/{doc_id}/events", response_class=StreamingResponse,
    responses={200: {"description": "Durable SSE stream. Each data field is an IngestionEvent JSON object.", "content": {"text/event-stream": {"schema": {"type": "string"}}}}},
)
def document_events(
    request: Request, doc_id: UUID,
    after: Annotated[int, Query(ge=0)] = 0,
    last_event_id: Annotated[int, Header(alias="Last-Event-ID", ge=0)] = 0,
) -> StreamingResponse:
    storage: Storage = request.app.state.storage
    require_document(storage, str(doc_id))
    return StreamingResponse(
        stream_events(request, storage.engine, str(doc_id), max(after, last_event_id)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
