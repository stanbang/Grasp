from datetime import datetime
from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field

class QuizAttemptRow(SQLModel, table=True):
    __tablename__ = 'quiz_attempts'
    id: str = Field(primary_key=True)
    nodeIds: list[str] = Field(sa_column=Column(JSON, nullable=False))
    questions: list[dict] = Field(sa_column=Column(JSON, nullable=False))
    submitted: bool = False
