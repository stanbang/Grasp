from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from re import fullmatch
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import delete, text
from sqlmodel import Session, select
from starlette.concurrency import run_in_threadpool

from .asset_access import board_asset
from .asset_media import DOCUMENT_MEDIA, IMAGE_FORMATS, document_pages, image_preview
from .asset_storage import AssetImportRow, ProjectAssetRow
from .canvas_contracts import AssetImportMethod, AssetSharing, CanvasId, ProjectAsset
from .canvas_service import board_row
from .document_lifecycle import uploaded_path
from .document_routes import create_upload, read_file_upload
from .ingestion import IngestionQueue
from .models import DocumentRow
from .storage import Storage

router = APIRouter(prefix="/boards/{board_id}/assets", tags=["project assets"])
STAGING_LIFETIME = timedelta(days=7)
MAX_COLLECTION_FILES = 30


def raster_path(storage: Storage, digest: str, preview: bool = False) -> Path:
    suffix = ".preview-v1.webp" if preview else ".original"
    return storage.settings.data_dir / "assets" / (digest + suffix)


def original_path(storage: Storage, session: Session, row: ProjectAssetRow) -> Path | None:
    if row.document_id is None:
        return raster_path(storage, row.digest)
    document = session.get(DocumentRow, row.document_id)
    return uploaded_path(storage, document) if document else None


def asset_view(storage: Storage, session: Session, row: ProjectAssetRow) -> ProjectAsset:
    path = original_path(storage, session, row)
    document = session.get(DocumentRow, row.document_id) if row.document_id else None
    return ProjectAsset(
        id=row.id, kind="document" if row.document_id else "image", name=row.name, digest=row.digest,
        mediaType=row.media_type, byteLength=row.byte_length, width=row.width, height=row.height,
        pageCount=row.page_count, documentId=row.document_id,
        indexStatus=document.status if document else None,
        available=path is not None and path.is_file(), shared=row.shared,
    )


def write_raster(path: Path, content: bytes) -> None:
    if path.is_file():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    try:
        temporary.write_bytes(content)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def stage_asset(
    storage: Storage, queue: IngestionQueue, board_id: str, collection_id: str, position: int,
    method: AssetImportMethod, name: str, extension: str, content: bytes,
) -> ProjectAsset:
    digest = sha256(content).hexdigest()
    with storage.asset_upload_lock:
        with Session(storage.engine) as session:
            board_row(session, board_id)
            imported = session.get(AssetImportRow, (board_id, collection_id, position))
            if imported:
                row = board_asset(session, board_id, imported.asset_id)
                if row.digest != digest or imported.name != name or imported.method != method:
                    raise HTTPException(409, "This import slot was already used for a different file.")
                return asset_view(storage, session, row)
            prior = session.exec(select(ProjectAssetRow).where(
                ProjectAssetRow.board_id == board_id, ProjectAssetRow.digest == digest,
            ).order_by(ProjectAssetRow.staged_at.desc())).all()
            existing = next((row for row in prior if asset_view(storage, session, row).available), None)

        now = datetime.now(timezone.utc)
        row = ProjectAssetRow(
            id=str(uuid4()), board_id=board_id, digest=digest, name=name, byte_length=len(content),
            media_type=DOCUMENT_MEDIA.get(extension, ""), staged_at=now,
        )
        if extension in IMAGE_FORMATS:
            expected_format, row.media_type = IMAGE_FORMATS[extension]
            if not existing or existing.media_type != row.media_type or not raster_path(storage, digest, True).is_file():
                preview = image_preview(content, expected_format)
                row.width, row.height, row.orientation = preview.width, preview.height, preview.orientation
                write_raster(raster_path(storage, digest), content)
                write_raster(raster_path(storage, digest, True), preview.content)
        else:
            row.page_count = document_pages(content, extension)
            if not existing or existing.media_type != row.media_type:
                document = create_upload(storage, queue, name, extension, content, project_source=True)
                row.document_id = document.id
        if existing and existing.media_type == row.media_type:
            row = existing
            if row.attached_at is None:
                row.staged_at = now
        with Session(storage.engine) as session:
            session.add(row)
            session.flush()
            session.add(AssetImportRow(
                board_id=board_id, collection_id=collection_id, position=position, asset_id=row.id,
                name=name, method=method, imported_at=now, imported_by="user",
            ))
            view = asset_view(storage, session, row)
            session.commit()
            return view


def cleanup_expired_assets(storage: Storage) -> None:
    cutoff = datetime.now(timezone.utc) - STAGING_LIFETIME
    with storage.asset_upload_lock, Session(storage.engine) as session:
        session.execute(text("BEGIN IMMEDIATE"))
        expired = session.exec(select(ProjectAssetRow).where(
            ProjectAssetRow.attached_at.is_(None), ProjectAssetRow.staged_at < cutoff,
        )).all()
        for row in expired:
            session.exec(delete(AssetImportRow).where(AssetImportRow.asset_id == row.id))
            session.delete(row)
        session.commit()
        directory = storage.settings.data_dir / "assets"
        if not directory.is_dir():
            return
        retained = set(session.exec(select(ProjectAssetRow.digest).where(ProjectAssetRow.document_id.is_(None))))
        for path in directory.iterdir():
            match = fullmatch(r"([a-f0-9]{64})\.(?:original|preview-v1\.webp)(\.tmp)?", path.name)
            if match and (match[2] or match[1] not in retained) and path.is_file():
                if path.stat().st_mtime < cutoff.timestamp():
                    path.unlink(missing_ok=True)


def require_asset_owner(request: Request) -> None:
    if request.state.board_actor != "user":
        raise HTTPException(403, "Only the workspace owner can import or share assets.")


@router.post("", status_code=201)
async def upload_asset(
    request: Request, board_id: CanvasId, file: Annotated[UploadFile, File()], collectionId: CanvasId,
    position: Annotated[int, Query(ge=0, lt=MAX_COLLECTION_FILES)], method: AssetImportMethod,
) -> ProjectAsset:
    require_asset_owner(request)
    storage = request.app.state.storage
    name, extension, content = await read_file_upload(
        file, storage.settings.max_upload_bytes, {*IMAGE_FORMATS, *DOCUMENT_MEDIA},
        "Import a PNG, JPEG, WebP, PDF, Markdown or UTF-8 text file.",
    )
    return await run_in_threadpool(
        stage_asset, storage, request.app.state.ingestion, board_id, collectionId, position,
        method, name, extension, content,
    )


def readable_asset(request: Request, session: Session, board_id: str, asset_id: str) -> ProjectAssetRow:
    row = board_asset(session, board_id, asset_id)
    if request.state.board_actor == "agent" and (
        not row.shared or (row.document_id is not None and session.get(DocumentRow, row.document_id) is None)
    ):
        raise HTTPException(404, "Asset not found on this board.")
    return row


@router.get("/{asset_id}")
def read_asset(request: Request, board_id: CanvasId, asset_id: CanvasId) -> ProjectAsset:
    storage = request.app.state.storage
    with Session(storage.engine) as session:
        return asset_view(storage, session, readable_asset(request, session, board_id, asset_id))


@router.put("/{asset_id}/sharing")
def share_asset(request: Request, board_id: CanvasId, asset_id: CanvasId, sharing: AssetSharing) -> ProjectAsset:
    require_asset_owner(request)
    storage = request.app.state.storage
    with Session(storage.engine) as session:
        session.execute(text("BEGIN IMMEDIATE"))
        row = board_asset(session, board_id, asset_id)
        if sharing.shared and not row.shared:
            row.granted_at, row.granted_by, row.revoked_at = datetime.now(timezone.utc), "user", None
        elif not sharing.shared and row.shared:
            row.revoked_at = datetime.now(timezone.utc)
        view = asset_view(storage, session, row)
        session.add(row)
        session.commit()
        return view


@router.get("/{asset_id}/{variant}")
def read_asset_file(
    request: Request, board_id: CanvasId, asset_id: CanvasId, variant: Literal["original", "preview"],
) -> FileResponse:
    storage = request.app.state.storage
    with Session(storage.engine) as session:
        row = readable_asset(request, session, board_id, asset_id)
        path = original_path(storage, session, row)
        media_type = row.media_type
        if variant == "preview":
            if row.document_id is not None or path is None or not path.is_file():
                raise HTTPException(404, "Preview unavailable.")
            path, media_type = raster_path(storage, row.digest, True), "image/webp"
        if path is None or not path.is_file():
            raise HTTPException(404, "The original file is unavailable.")
        return FileResponse(
            path, media_type=media_type, filename=row.name if variant == "original" else None,
            content_disposition_type="inline",
        )
