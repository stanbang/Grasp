from datetime import datetime

from sqlmodel import Field, SQLModel


class ProjectDocumentRow(SQLModel, table=True):
    __tablename__ = "project_source_documents"

    # Keep the marker even if the original is removed.
    document_id: str = Field(primary_key=True)


class ProjectAssetRow(SQLModel, table=True):
    __tablename__ = "project_assets"
    id: str = Field(primary_key=True)
    board_id: str = Field(foreign_key="project_boards.id", index=True)
    digest: str = Field(index=True)
    name: str
    media_type: str
    byte_length: int
    width: int | None = None
    height: int | None = None
    orientation: int | None = None
    page_count: int | None = None
    document_id: str | None = None
    staged_at: datetime
    attached_at: datetime | None = None
    granted_at: datetime | None = None
    granted_by: str | None = None
    revoked_at: datetime | None = None

    @property
    def shared(self) -> bool:
        return self.granted_at is not None and self.revoked_at is None


class AssetImportRow(SQLModel, table=True):
    __tablename__ = "project_asset_imports"

    board_id: str = Field(foreign_key="project_boards.id", primary_key=True)
    collection_id: str = Field(primary_key=True)
    position: int = Field(primary_key=True)
    asset_id: str = Field(foreign_key="project_assets.id", index=True)
    name: str
    method: str
    imported_at: datetime
    imported_by: str


ASSET_TABLES = (ProjectDocumentRow.__table__, ProjectAssetRow.__table__, AssetImportRow.__table__)
