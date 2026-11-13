import re
from sqlmodel import Session, select
from .models import ChunkRow, DocumentRow
from .storage import Storage

STOP_WORDS=set('a an the is are was were what which how why does do can could please explain summarize summary tell me about it that this these those more simply detail details and or in on of to for from your my document documents note notes main ideas overview key points topic topics information'.split())

def query_terms(text: str) -> set[str]:
    return {word for word in re.findall(r'\w+',text.casefold()) if len(word)>2 and word not in STOP_WORDS}

def retrieve_chunks(storage: Storage, question: str, top_k: int, doc_ids: list[str], context: str='') -> list[ChunkRow]:
    search_filter={'docId':{'$in':doc_ids}} if doc_ids else None
    query=f'{context}\n{question}'.strip() if context else question
    matches=storage.vector_store().similarity_search(query,k=top_k,filter=search_filter)
    with Session(storage.engine) as session:
        rows=[]
        for match in matches:
            chunk=session.get(ChunkRow,str(match.id))
            if chunk:
                doc=session.get(DocumentRow,chunk.docId)
                if doc and doc.status=='done':rows.append(chunk)
        if storage.settings.mock_llm:
            terms=query_terms(query)
            # Hash vectors are fixtures. Exact term overlap keeps unrelated mock answers honest.
            if terms: rows=[chunk for chunk in rows if terms.intersection(query_terms(chunk.text))]
        return rows
