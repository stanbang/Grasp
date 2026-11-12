import json
from sqlmodel import Session
from .config import PROJECT_ROOT
from .storage import Storage
from .models import DocumentRow, ChunkRow, SourcePageRow, GraphNodeRow, GraphEdgeRow
from .schemas import GraphResponse, Document, Chunk
from .graph_repository import graph_snapshot, refresh_progress
from .llm import DeterministicEmbeddings

def load_demo(storage: Storage) -> GraphResponse:
    data=json.loads((PROJECT_ROOT/'samples/demo-graph.json').read_text(encoding='utf-8'))
    graph=GraphResponse.model_validate(data['graph'])
    chunks=[Chunk.model_validate(c) for c in data['chunks']]
    storage.collection.upsert(ids=[c.id for c in chunks],documents=[c.text for c in chunks],embeddings=DeterministicEmbeddings().embed_documents([c.text for c in chunks]),metadatas=[c.model_dump(exclude={'id','text'}) for c in chunks])
    with Session(storage.engine) as session,session.begin():
        for row in data['documents']:
            session.merge(DocumentRow(**Document.model_validate(row).model_dump()))
        session.flush()
        for page in data['pages']:session.merge(SourcePageRow(**page))
        for chunk in chunks:session.merge(ChunkRow(**chunk.model_dump()))
        for node in graph.nodes:session.merge(GraphNodeRow(**node.model_dump()))
        session.flush()
        for edge in graph.edges:session.merge(GraphEdgeRow(**edge.model_dump()))
        session.flush()
        refresh_progress(session)
    return graph
