from fastapi import HTTPException
from sqlmodel import Session, select

from .asset_storage import ProjectAssetRow
from .canvas_contracts import CanvasObject, ProjectBoard
from .models import DocumentRow


def board_asset(session: Session, board_id: str, asset_id: str) -> ProjectAssetRow:
    row = session.get(ProjectAssetRow, asset_id)
    if row is None or row.board_id != board_id:
        raise HTTPException(404, "Asset not found on this board.")
    return row


def shared_assets(session: Session, board_id: str) -> set[str]:
    return set(session.exec(select(ProjectAssetRow.id).outerjoin(
        DocumentRow, DocumentRow.id == ProjectAssetRow.document_id,
    ).where(
        ProjectAssetRow.board_id == board_id, ProjectAssetRow.granted_at.is_not(None),
        ProjectAssetRow.revoked_at.is_(None),
        (ProjectAssetRow.document_id.is_(None)) | (DocumentRow.id.is_not(None)),
    )))


def visible_board(board: ProjectBoard, visible_assets: set[str]) -> ProjectBoard:
    objects = board.objects.copy()
    for key, item in board.objects.items():
        if item.asset and item.asset.assetId not in visible_assets:
            objects[key] = CanvasObject(
                id=item.id, kind="explanation", title="Private source", placement=item.placement,
                createdBy=item.createdBy, updatedBy=item.updatedBy,
            )
    return board.model_copy(update={"objects": objects})
