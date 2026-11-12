import hashlib
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_chroma import Chroma
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from .config import Settings
from .llm import build_embedder
from .models import ProgressRow


def create_sqlite_engine(data_dir: Path) -> Engine:
    data_dir.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f"sqlite:///{(data_dir / 'grasp.sqlite3').as_posix()}",
        connect_args={"check_same_thread": False, "timeout": 10},
    )

    @event.listens_for(engine, "connect")
    def configure_connection(connection: object, record: object) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        if session.get(ProgressRow, 1) is None:
            session.add(ProgressRow())
            session.commit()
    return engine


class Storage:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.engine = create_sqlite_engine(settings.data_dir)
        self.chroma = chromadb.PersistentClient(
            path=str(settings.data_dir / "chroma"),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        identity = (
            "mock-sha256-256-v1" if settings.mock_llm
            else f"{settings.llm_provider}:{settings.embedding_model}"
        )
        signature = hashlib.sha256(identity.encode()).hexdigest()[:16]
        self.embedding_identity = identity
        self.collection_name = f"chunks_{signature}"
        self.collection = self.chroma.get_or_create_collection(
            self.collection_name, metadata={"embedding_identity": identity},
            embedding_function=None,
        )

    def vector_store(self) -> Chroma:
        return Chroma(
            client=self.chroma, collection_name=self.collection_name,
            embedding_function=build_embedder(self.settings),
        )

    def check_sqlite(self) -> bool:
        with self.engine.connect() as connection:
            return connection.execute(text("SELECT 1")).scalar() == 1

    def check_chroma(self) -> bool:
        return self.chroma.heartbeat() > 0 and self.collection.count() >= 0

    def close(self) -> None:
        self.engine.dispose()
