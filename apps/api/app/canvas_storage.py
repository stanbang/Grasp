from datetime import datetime

from sqlalchemy import Column, Text, UniqueConstraint, text
from sqlalchemy.engine import Engine
from sqlmodel import Field, SQLModel


class ProjectBoardRow(SQLModel, table=True):
    __tablename__ = "project_boards"

    id: str = Field(primary_key=True)
    project_id: str = Field(unique=True)
    title: str
    revision: int
    created_at: datetime
    updated_at: datetime
    created_by: str


class BoardRevisionRow(SQLModel, table=True):
    __tablename__ = "board_revisions"
    __table_args__ = (UniqueConstraint("board_id", "mutation_id"),)

    board_id: str = Field(foreign_key="project_boards.id", primary_key=True)
    revision: int = Field(primary_key=True)
    snapshot: str = Field(sa_column=Column(Text, nullable=False))
    mutation_id: str | None = None
    request_digest: str | None = None
    base_revision: int | None = None
    actor: str


CANVAS_TABLES = (ProjectBoardRow.__table__, BoardRevisionRow.__table__)


def migrate_canvas(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("BEGIN IMMEDIATE"))
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS canvas_schema (version INTEGER PRIMARY KEY)"
        ))
        version = connection.execute(text("SELECT max(version) FROM canvas_schema")).scalar()
        if version is None:
            # Version 1 adds canvas tables without rewriting existing study records.
            for table in CANVAS_TABLES:
                table.create(connection, checkfirst=True)
            connection.execute(text("INSERT INTO canvas_schema (version) VALUES (1)"))
        elif version != 1:
            raise RuntimeError(f"Unsupported canvas database schema version: {version}.")
