import asyncio
import time
from collections.abc import AsyncIterator
from typing import Literal

from fastapi import Request
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from .models import DocumentRow, IngestionEventRow
from .schemas import Document, GraphEdge, GraphNode, IngestionEvent


def append_event(
    session: Session, document: DocumentRow,
    kind: Literal["status", "node", "edge", "complete", "error"], *, message: str | None = None,
    node: GraphNode | None = None, edge: GraphEdge | None = None,
    completed_batches: int | None = None, total_batches: int | None = None,
    chunk_count: int | None = None, node_count: int | None = None, edge_count: int | None = None,
) -> IngestionEvent:
    row = IngestionEventRow(docId=document.id, type=kind, payload={})
    session.add(row)
    session.flush()
    assert row.id is not None
    event = IngestionEvent(
        id=row.id, docId=document.id, type=kind,
        document=Document.model_validate(document.model_dump()) if kind in {"status", "complete", "error"} else None,
        message=message, node=node, edge=edge,
        completedBatches=completed_batches, totalBatches=total_batches,
        chunkCount=chunk_count, nodeCount=node_count, edgeCount=edge_count,
    )
    row.payload = event.model_dump(mode="json", exclude_none=True)
    session.add(row)
    return event


def read_events(engine: Engine, doc_id: str, after: int) -> tuple[list[IngestionEvent], bool]:
    with Session(engine) as session:
        document = session.get(DocumentRow, doc_id)
        # Read terminal state first so a commit between queries cannot hide its final events.
        terminal = document is None or document.status in {"done", "failed"}
        rows = session.exec(select(IngestionEventRow).where(
            IngestionEventRow.docId == doc_id, IngestionEventRow.id > after,
        ).order_by(IngestionEventRow.id).limit(100)).all()
        return [IngestionEvent.model_validate(row.payload) for row in rows], terminal


def encode_event(event: IngestionEvent) -> str:
    payload = event.model_dump_json(exclude_none=True)
    return f"id: {event.id}\nevent: {event.type}\ndata: {payload}\n\n"


async def stream_events(request: Request, engine: Engine, doc_id: str, after: int) -> AsyncIterator[str]:
    yield "retry: 2000\n\n"
    last_heartbeat = time.monotonic()
    while not await request.is_disconnected():
        events, terminal = await asyncio.to_thread(read_events, engine, doc_id, after)
        for event in events:
            yield encode_event(event)
            after = event.id
        if terminal and len(events) < 100:
            return
        if time.monotonic() - last_heartbeat > 15:
            yield ": heartbeat\n\n"
            last_heartbeat = time.monotonic()
        await asyncio.sleep(0.2)
