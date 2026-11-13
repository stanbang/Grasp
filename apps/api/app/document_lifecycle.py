import hashlib
import mimetypes
from pathlib import Path
from fastapi import HTTPException
from sqlmodel import Session, select
from sqlalchemy import delete
from .models import DocumentRow, ChunkRow, SourcePageRow, GraphNodeRow, GraphEdgeRow, NodeEmbeddingRow, CrossDocumentLinkRow, IngestionEventRow
from .workspace_models import FileDigestRow, PendingCleanupRow
from .quiz_models import QuizAttemptRow
from .graph_repository import refresh_progress
from .storage import Storage


def uploaded_path(storage: Storage, document: DocumentRow) -> Path:
    suffix=Path(document.name).suffix.lower()
    return storage.settings.data_dir/'uploads'/f'{document.id}{suffix}'


def find_duplicate(storage: Storage, digest: str) -> DocumentRow | None:
    with Session(storage.engine) as session:
        row=session.exec(select(FileDigestRow).where(FileDigestRow.digest==digest)).first()
        document=session.get(DocumentRow,row.docId) if row else None
        return document if document and document.status!='failed' else None


def backfill_digests(storage: Storage) -> None:
    with Session(storage.engine) as session:
        for document in session.exec(select(DocumentRow)).all():
            path=uploaded_path(storage,document)
            if not session.get(FileDigestRow,document.id) and path.is_file():
                with path.open('rb') as source: digest=hashlib.file_digest(source,'sha256').hexdigest()
                session.add(FileDigestRow(docId=document.id,digest=digest))
        session.commit()


def remove_document(storage: Storage, doc_id: str) -> bool:
    with Session(storage.engine) as session, session.begin():
        document=session.get(DocumentRow,doc_id)
        if not document: raise HTTPException(404,'Document not found.')
        if document.status in {'queued','chunking','extracting'}: raise HTTPException(409,'Wait for processing to finish before removing this document.')
        chunk_ids=set(session.exec(select(ChunkRow.id).where(ChunkRow.docId==doc_id)).all())
        removed_nodes=[]
        for node in session.exec(select(GraphNodeRow)).all():
            if doc_id not in node.docIds: continue
            node.docIds=[value for value in node.docIds if value!=doc_id]
            node.sourceChunkIds=[value for value in node.sourceChunkIds if value not in chunk_ids]
            node.quiz=None
            if not node.docIds or not node.sourceChunkIds: removed_nodes.append(node.id)
            else:
                remaining=session.exec(select(ChunkRow).where(ChunkRow.id.in_(node.sourceChunkIds))).first()
                if remaining:node.summary=remaining.text[:400]
                session.exec(delete(NodeEmbeddingRow).where(NodeEmbeddingRow.nodeId==node.id))
                session.add(node)
        for edge in session.exec(select(GraphEdgeRow)).all():
            if doc_id in edge.docIds or edge.source in removed_nodes or edge.target in removed_nodes:
                edge.docIds=[value for value in edge.docIds if value!=doc_id]
                if not edge.docIds or edge.source in removed_nodes or edge.target in removed_nodes:session.delete(edge)
                else:session.add(edge)
        for attempt in session.exec(select(QuizAttemptRow)).all():
            if any(node in removed_nodes for node in attempt.nodeIds) or any(q.get('chunkId') in chunk_ids for q in attempt.questions):session.delete(attempt)
        session.flush()
        for node_id in removed_nodes:
            session.exec(delete(NodeEmbeddingRow).where(NodeEmbeddingRow.nodeId==node_id))
            session.exec(delete(CrossDocumentLinkRow).where(CrossDocumentLinkRow.nodeId==node_id))
            session.delete(session.get(GraphNodeRow,node_id))
        session.exec(delete(CrossDocumentLinkRow).where(CrossDocumentLinkRow.docId==doc_id))
        for model in (FileDigestRow,IngestionEventRow,SourcePageRow,ChunkRow):
            session.exec(delete(model).where(model.docId==doc_id))
        session.merge(PendingCleanupRow(docId=doc_id,name=document.name))
        session.delete(document)
        session.flush()
        refresh_progress(session)
    return cleanup_document(storage,doc_id)


def cleanup_document(storage: Storage, doc_id: str) -> bool:
    with Session(storage.engine) as session:
        pending=session.get(PendingCleanupRow,doc_id)
        if pending is None:return True
        try:
            for collection in storage.chroma.list_collections():
                storage.chroma.get_collection(collection.name,embedding_function=None).delete(where={'docId':doc_id})
            path=storage.settings.data_dir/'uploads'/f'{doc_id}{Path(pending.name).suffix.lower()}'
            path.unlink(missing_ok=True)
        except Exception:
            # Keep a durable cleanup record if a native vector handle or file is unavailable.
            return False
        session.delete(pending)
        session.commit()
        return True


def retry_pending_cleanup(storage: Storage) -> int:
    with Session(storage.engine) as session:
        ids=list(session.exec(select(PendingCleanupRow.docId)).all())
    return sum(not cleanup_document(storage,doc_id) for doc_id in ids)
