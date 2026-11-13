from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from .test_document_api import client, events_for
from app.main import app
from app.config import Settings


def upload(client, name, text):
    response=client.post('/documents',files={'file':(name,text.encode())})
    assert response.status_code==202
    doc=response.json();assert events_for(client,doc['id'])[-1].type=='complete'
    return doc


def test_conversation_history_followup_and_abstention(client):
    client.post('/demo')
    conversation=client.post('/conversations').json()['id']
    first=client.post('/chat',json={'question':'What is retrieval practice?','conversationId':conversation})
    assert first.status_code==200 and first.json()['citations']
    followup=client.post('/chat',json={'question':'Explain that more simply','conversationId':conversation})
    assert followup.json()['citations']
    unsupported=client.post('/chat',json={'question':'Who won the intergalactic pickleball championship?','conversationId':conversation})
    assert unsupported.status_code==200 and not unsupported.json()['citations']
    saved=client.get('/conversations/'+conversation).json()['turns']
    assert len(saved)==3 and saved[0]['response']==first.json()
    assert client.get('/conversations').json()['conversations'][0]['title']=='What is retrieval practice?'


def test_duplicate_upload_returns_same_document(client):
    first=upload(client,'first.md','## Memory\n\nMemory stores ideas.')
    second=client.post('/documents',files={'file':('renamed.md',b'## Memory\n\nMemory stores ideas.')}).json()
    assert first['id']==second['id']
    assert len(client.get('/documents').json()['documents'])==1


def test_delete_preserves_shared_provenance_and_cleans_vectors(client):
    first=upload(client,'first.md','## Memory\n\nMemory stores ideas.')
    second=upload(client,'second.md','## Memory\n\nRecall accesses stored ideas.')
    assert client.get('/progress').json()['crossDocLinks']==1
    assert client.delete('/documents/'+first['id']).status_code==200
    graph=client.get('/graph').json()
    assert len(graph['nodes'])==1 and graph['nodes'][0]['docIds']==[second['id']]
    assert client.get('/progress').json()['crossDocLinks']==0
    result=client.app.state.storage.collection.get(where={'docId':first['id']})
    assert not result['ids']
    assert client.get('/documents/'+first['id']).status_code==404
    assert client.delete('/documents/'+second['id']).status_code==200
    assert client.get('/graph').json()=={'nodes':[],'edges':[]}


def test_replacement_failure_keeps_original_and_success_removes_it(client):
    first=upload(client,'first.md','## Memory\n\nMemory stores ideas.')
    failed=client.put('/documents/'+first['id'],files={'file':('bad.txt',b'\xff\xfe')})
    assert failed.status_code==200 and failed.json()['status']=='failed'
    assert client.get('/documents/'+first['id']).json()['status']=='done'
    replacement=client.put('/documents/'+first['id'],files={'file':('new.md',b'## Recall\n\nRecall retrieves ideas.')})
    assert replacement.status_code==200 and replacement.json()['status']=='done'
    assert client.get('/documents/'+first['id']).status_code==404
    assert all(first['id'] not in node['docIds'] for node in client.get('/graph').json()['nodes'])


def test_original_and_reindex(client):
    first=upload(client,'first.txt','Exact original text with café.')
    response=client.get('/documents/'+first['id']+'/original')
    assert response.status_code==200 and response.content.decode()=='Exact original text with café.'
    replacement=client.post('/documents/'+first['id']+'/reindex')
    assert replacement.status_code==200 and replacement.json()['status']=='done'
    assert replacement.json()['id']!=first['id']


def test_token_rate_and_body_controls(tmp_path,monkeypatch):
    settings=Settings(data_dir=tmp_path/'secure',access_token='test-token',requests_per_minute=2)
    monkeypatch.setattr('app.main.get_settings',lambda:settings)
    with TestClient(app) as secure:
        assert secure.get('/health').status_code==200
        assert secure.get('/documents').status_code==401
        headers={'Authorization':'Bearer test-token'}
        assert secure.get('/documents',headers=headers).status_code==200
        assert secure.post('/conversations',headers=headers).status_code==200
        assert secure.post('/conversations',headers=headers).status_code==200
        assert secure.post('/conversations',headers=headers).status_code==429
        assert secure.get('/documents',headers=headers).status_code==200


def test_large_chat_body_is_rejected(client):
    response=client.post('/chat',content=b'x'*70000,headers={'Content-Type':'application/json'})
    assert response.status_code==413


def test_chunked_request_limit(client):
    response=client.post('/chat',content=(b'x'*40000 for _ in range(2)),headers={'Content-Type':'application/json'})
    assert response.status_code==413


def test_failed_reindex_preserves_original_digest(client,monkeypatch):
    first=upload(client,'first.md','## Memory\n\nMemory stores ideas.')
    def fail(*args,**kwargs):raise RuntimeError('Provider offline')
    monkeypatch.setattr('app.ingestion.extract_concepts',fail)
    replacement=client.post('/documents/'+first['id']+'/reindex')
    assert replacement.status_code==200 and replacement.json()['status']=='failed'
    duplicate=client.post('/documents',files={'file':('again.md',b'## Memory\n\nMemory stores ideas.')}).json()
    assert duplicate['id']==first['id']


def test_single_origin_production_mount(tmp_path,monkeypatch):
    from app.production import application
    monkeypatch.setattr('app.main.get_settings',lambda:Settings(data_dir=tmp_path/'production'))
    with TestClient(application) as production:
        assert production.get('/api/health').json()['phase']==6
        assert production.get('/api/documents').status_code==200
        assert '/api/openapi.json' in production.get('/api/docs').text


def test_production_owner_token_and_upload_body_limit(tmp_path,monkeypatch):
    from app.production import application
    monkeypatch.setattr('app.main.get_settings',lambda:Settings(data_dir=tmp_path/'secure-production',access_token='owner'))
    with TestClient(application) as production:
        assert production.get('/api/health').status_code==200
        assert production.get('/api/documents').status_code==401
        headers={'Authorization':'Bearer owner'}
        response=production.post('/api/documents',headers=headers,files={'file':('notes.txt',b'Memory stores ideas.\n'+b' '*70000)})
        assert response.status_code==202


def test_ocr_replaces_only_empty_pages(tmp_path,monkeypatch):
    from pypdf import PdfWriter
    from app.parsing import read_pages,chunk_pages
    path=tmp_path/'scan.pdf'
    writer=PdfWriter();writer.add_blank_page(width=612,height=792);writer.write(path)
    monkeypatch.setattr('app.ocr.ocr_page',lambda path,page,language:'Scanned memory notes.')
    pages=read_pages(path,'scan',ocr_enabled=True)
    assert pages[0].text=='Scanned memory notes.'
    for chunk in chunk_pages(pages):assert pages[0].text[chunk.charStart:chunk.charEnd]==chunk.text


def test_ocr_missing_tools_is_actionable(tmp_path,monkeypatch):
    from app.ocr import ocr_page
    from app.parsing import DocumentInputError
    monkeypatch.setattr('app.ocr.shutil.which',lambda _:None)
    with pytest.raises(DocumentInputError,match='Tesseract'):ocr_page(tmp_path/'scan.pdf',1)


def test_failed_cleanup_is_durable_and_retried(client,monkeypatch):
    from app.document_lifecycle import retry_pending_cleanup
    from app.workspace_models import PendingCleanupRow
    from sqlmodel import Session
    doc=upload(client,'cleanup.txt','A memory source for cleanup.')
    storage=client.app.state.storage
    original=storage.chroma.get_collection
    monkeypatch.setattr(storage.chroma,'get_collection',lambda *args,**kwargs:(_ for _ in ()).throw(RuntimeError('Native store unavailable')))
    response=client.delete('/documents/'+doc['id'])
    assert response.status_code==200 and response.json()['cleanupPending']
    assert client.get('/documents/'+doc['id']).status_code==404
    with Session(storage.engine) as session:assert session.get(PendingCleanupRow,doc['id']) is not None
    monkeypatch.setattr(storage.chroma,'get_collection',original)
    assert retry_pending_cleanup(storage)==0
    assert not (storage.settings.data_dir/'uploads'/f"{doc['id']}.txt").exists()


def test_saved_conversation_can_be_removed(client):
    conversation=client.post('/conversations').json()['id']
    assert client.delete('/conversations/'+conversation).status_code==200
    assert client.get('/conversations/'+conversation).status_code==404
