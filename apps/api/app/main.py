from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlmodel import Session

from .asset_routes import cleanup_expired_assets, router as asset_router
from .config import PROJECT_ROOT, get_settings
from .board_selections import BoardSelections
from .canvas_routes import router as canvas_router
from .knowledge_routes import router as knowledge_router
from .owner_sessions import SESSION_PATH, router as owner_session_router
from .request_controls import RequestControls, is_agent_path, request_path
from .llm import provider_check
from .document_routes import router as document_router
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
    app.state.board_selections = BoardSelections()
    app.state.ingestion = IngestionQueue(app.state.storage)
    app.state.ingestion.recover_interrupted()
    from .document_lifecycle import backfill_digests, retry_pending_cleanup
    backfill_digests(app.state.storage)
    retry_pending_cleanup(app.state.storage)
    cleanup_expired_assets(app.state.storage)
    try:
        yield
    finally:
        app.state.ingestion.close()
        app.state.storage.close()


app = FastAPI(
    title="Grasp API", version="0.6.0",
    description="Local project boards, document questions, exact source citations and a 3D knowledge map.",
    lifespan=lifespan,
)
app.add_middleware(RequestControls)
app.include_router(document_router)
app.include_router(study_router)
app.include_router(conversation_router)
app.include_router(canvas_router)
app.include_router(asset_router)
app.include_router(knowledge_router)
app.include_router(owner_session_router)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    path = request_path(request.scope)
    if path == SESSION_PATH:
        return JSONResponse(status_code=422, content={"detail": "Enter the workspace owner token."})
    if is_agent_path(path):
        # Exclude raw input, which can contain non-JSON values such as NaN.
        return JSONResponse(status_code=422, content={"detail": [
            {"loc": issue["loc"], "msg": issue["msg"], "type": issue["type"]} for issue in error.errors()
        ]})
    return await request_validation_exception_handler(request, error)


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
