from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from sqlmodel import Session

from .config import PROJECT_ROOT, get_settings
from .request_controls import RequestControls
from .llm import provider_check
from .document_routes import router as document_router
from .preview_routes import router as preview_router
from .study_routes import router as study_router
from .conversations import router as conversation_router
from .graph_repository import graph_snapshot
from .ingestion import IngestionQueue
from .models import ProgressRow
from .schemas import (
    PUBLIC_MODELS, HealthResponse, SampleResponse, SchemaDescription, SchemasResponse,
    GraphResponse, Progress,
)
from .storage import Storage


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.storage = Storage(get_settings())
    app.state.ingestion = IngestionQueue(app.state.storage)
    app.state.ingestion.recover_interrupted()
    from .document_lifecycle import backfill_digests, retry_pending_cleanup
    backfill_digests(app.state.storage)
    retry_pending_cleanup(app.state.storage)
    try:
        yield
    finally:
        app.state.ingestion.close()
        app.state.storage.close()


app = FastAPI(
    title="Grasp API", version="0.6.0",
    description="Local document questions, exact source citations and a 3D knowledge map.",
    lifespan=lifespan,
)
app.add_middleware(RequestControls)
app.include_router(document_router)
app.include_router(preview_router)
app.include_router(study_router)
app.include_router(conversation_router)


@app.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    storage: Storage = request.app.state.storage
    llm = provider_check(get_settings())
    sqlite_ok = storage.check_sqlite()
    chroma_ok = storage.check_chroma()
    return HealthResponse(
        status="ok" if sqlite_ok and chroma_ok and llm.configured else "degraded",
        phase=6,
        sqlite="ok" if sqlite_ok else "unavailable",
        chroma="ok" if chroma_ok else "unavailable",
        llm=llm,
    )


@app.get("/schemas", response_model=SchemasResponse)
def schemas() -> SchemasResponse:
    return SchemasResponse(schemas=[
        SchemaDescription(name=model.__name__, definition=model.model_json_schema())
        for model in PUBLIC_MODELS
    ])


@app.get("/samples/study-note", response_model=SampleResponse)
def sample_note() -> SampleResponse:
    sample_path = PROJECT_ROOT / "samples" / "memory-and-learning.md"
    return SampleResponse(
        name=sample_path.name, text=sample_path.read_text(encoding="utf-8"),
        contentType="text/markdown",
    )


@app.get("/graph", response_model=GraphResponse, response_model_exclude_none=True)
def graph(request: Request) -> GraphResponse:
    with Session(request.app.state.storage.engine) as session:
        return graph_snapshot(session)


@app.get("/progress", response_model=Progress)
def progress(request: Request) -> Progress:
    with Session(request.app.state.storage.engine) as session:
        row = session.get(ProgressRow, 1)
        if row is None:
            raise RuntimeError("The local progress record is missing.")
        return Progress.model_validate(row.model_dump(exclude={"id"}))
