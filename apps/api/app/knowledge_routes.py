from fastapi import APIRouter, Request
from sqlmodel import Session, select

from .agent_contracts import KnowledgeHit, KnowledgeResults, KnowledgeSearch
from .canvas_contracts import CanvasEvidenceContext, CanvasEvidenceRef
from .canvas_service import require_shared_documents, resolve_evidence
from .models import DocumentRow
from .retrieval import retrieve_chunks
from .request_controls import agent_source_scope
from .storage import Storage

router = APIRouter(prefix="/knowledge", tags=["scoped knowledge"])


def require_scope(request: Request, document_ids: set[str]) -> Storage:
    require_shared_documents(agent_source_scope(request), document_ids)
    return request.app.state.storage


@router.post("/search")
def search_knowledge(request: Request, body: KnowledgeSearch) -> KnowledgeResults:
    storage = require_scope(request, set(body.docIds))
    mode = "mock" if storage.settings.mock_llm else "live"
    if not body.docIds:
        return KnowledgeResults(mode=mode, results=[])

    with Session(storage.engine) as session:
        ready_ids = list(session.exec(select(DocumentRow.id).where(
            DocumentRow.id.in_(body.docIds), DocumentRow.status == "done",
        )).all())
    if not ready_ids:
        return KnowledgeResults(mode=mode, results=[])

    matches = retrieve_chunks(storage, body.query, body.topK, ready_ids)
    results: list[KnowledgeHit] = []
    with Session(storage.engine) as session:
        for chunk in matches:
            if chunk.docId not in ready_ids or chunk.charStart >= chunk.charEnd:
                continue
            # Legacy indexes may contain longer chunks. Keep the shareable span within the canvas contract.
            reference = CanvasEvidenceRef(
                chunkId=chunk.id, docId=chunk.docId, page=chunk.page,
                charStart=chunk.charStart, charEnd=min(chunk.charEnd, chunk.charStart + 4000),
            )
            source = resolve_evidence(session, reference)
            if source.available and source.sourceName is not None and source.quote is not None:
                results.append(KnowledgeHit(
                    rank=len(results) + 1, sourceName=source.sourceName, reference=reference, excerpt=source.quote[:200],
                ))
    return KnowledgeResults(mode=mode, results=results)


@router.post("/source")
def read_source(request: Request, reference: CanvasEvidenceRef) -> CanvasEvidenceContext:
    storage = require_scope(request, {reference.docId})
    with Session(storage.engine) as session:
        return resolve_evidence(session, reference)
