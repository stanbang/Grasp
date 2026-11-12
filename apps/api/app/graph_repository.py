from sqlmodel import Session, select

from .events import append_event
from .merging import GraphMerger
from .models import (
    ChunkRow, CrossDocumentLinkRow, DocumentRow, GraphEdgeRow, GraphNodeRow,
    NodeEmbeddingRow, ProgressRow, SourcePageRow,
)
from .parsing import SourcePage
from .schemas import Chunk, GraphEdge, GraphNode, GraphResponse, Progress
from .storage import Storage


def graph_snapshot(session: Session) -> GraphResponse:
    nodes = session.exec(select(GraphNodeRow).order_by(GraphNodeRow.id)).all()
    edges = session.exec(select(GraphEdgeRow).order_by(GraphEdgeRow.id)).all()
    return GraphResponse(
        nodes=[GraphNode.model_validate(node.model_dump()) for node in nodes],
        edges=[GraphEdge.model_validate(edge.model_dump()) for edge in edges],
    )


def prepare_merger(storage: Storage, doc_id: str) -> GraphMerger:
    with Session(storage.engine) as session:
        graph = graph_snapshot(session)
        rows = session.exec(select(NodeEmbeddingRow).where(NodeEmbeddingRow.identity == storage.embedding_identity)).all()
        vectors = {row.nodeId: row.vector for row in rows}
    return GraphMerger(
        doc_id, graph.nodes, graph.edges, vectors,
        storage.settings.concept_similarity_threshold, storage.settings.max_nodes_per_document,
    )


def refresh_progress(session: Session) -> Progress:
    nodes = session.exec(select(GraphNodeRow)).all()
    progress = session.get(ProgressRow, 1)
    if progress is None:
        raise RuntimeError("The local progress record is missing.")
    progress.totalNodes = len(nodes)
    progress.masteredCount = sum(node.masteryState == "mastered" for node in nodes)
    progress.exploredCount = sum(node.masteryState != "unexplored" for node in nodes)
    progress.coveragePercent = 100 * progress.exploredCount / len(nodes) if nodes else 0
    progress.crossDocLinks = sum(max(0, len(set(node.docIds)) - 1) for node in nodes)
    session.add(progress)
    return Progress.model_validate(progress.model_dump(exclude={"id"}))


def commit_document(
    storage: Storage, doc_id: str, pages: list[SourcePage], chunks: list[Chunk], merger: GraphMerger,
) -> None:
    with Session(storage.engine) as session, session.begin():
        document = session.get(DocumentRow, doc_id)
        if document is None:
            raise RuntimeError("The upload record is missing.")
        for page in pages:
            session.add(SourcePageRow(**page.model_dump()))
        for chunk in chunks:
            session.add(ChunkRow(**chunk.model_dump()))
        for node in merger.touched_nodes.values():
            session.merge(GraphNodeRow(**node.model_dump()))
        session.flush()
        for node in merger.touched_nodes.values():
            session.merge(NodeEmbeddingRow(
                nodeId=node.id, identity=storage.embedding_identity, vector=merger.vectors[node.id],
            ))
            for linked_doc in node.docIds:
                session.merge(CrossDocumentLinkRow(nodeId=node.id, docId=linked_doc))
            append_event(session, document, "node", node=node)
        for edge in merger.touched_edges.values():
            session.merge(GraphEdgeRow(**edge.model_dump()))
            append_event(session, document, "edge", edge=edge)
        session.flush()
        refresh_progress(session)
        document.status = "done"
        session.add(document)
        append_event(
            session, document, "complete", message="Document is ready.",
            chunk_count=len(chunks), node_count=len(merger.touched_nodes), edge_count=len(merger.touched_edges),
        )
