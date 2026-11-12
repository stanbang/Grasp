from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request

from .config import PROJECT_ROOT, get_settings
from .llm import provider_check
from .schemas import (
    PUBLIC_MODELS, HealthResponse, SampleResponse, SchemaDescription, SchemasResponse,
)
from .storage import Storage


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.storage = Storage(get_settings())
    try:
        yield
    finally:
        app.state.storage.close()


app = FastAPI(
    title="Grasp API", version="0.1.0",
    description="Phase 1: local storage, sample notes and shared contracts.",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    storage: Storage = request.app.state.storage
    llm = provider_check(get_settings())
    sqlite_ok = storage.check_sqlite()
    chroma_ok = storage.check_chroma()
    return HealthResponse(
        status="ok" if sqlite_ok and chroma_ok and llm.configured else "degraded",
        phase=1,
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
