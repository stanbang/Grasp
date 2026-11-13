from datetime import datetime, timezone
from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field

class FileDigestRow(SQLModel, table=True):
    __tablename__ = 'file_digests'
    docId: str = Field(foreign_key='documents.id', primary_key=True)
    digest: str = Field(index=True)

class ConversationRow(SQLModel, table=True):
    __tablename__ = 'conversations'
    id: str = Field(primary_key=True)
    title: str
    createdAt: datetime

class ChatTurnRow(SQLModel, table=True):
    __tablename__ = 'chat_turns'
    id: int | None = Field(default=None, primary_key=True)
    conversationId: str = Field(foreign_key='conversations.id', index=True)
    question: str
    response: dict[str, object] = Field(sa_column=Column(JSON, nullable=False))
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PendingCleanupRow(SQLModel, table=True):
    __tablename__ = 'pending_document_cleanup'
    docId: str = Field(primary_key=True)
    name: str
