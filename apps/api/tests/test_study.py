from .test_document_api import client

def test_demo_chat_and_quiz_grade(client):
    demo = client.post('/demo').json()
    assert demo['nodes']
    node = demo['nodes'][0]
    chat = client.post('/chat', json={'question':'What is memory?'})
    assert chat.status_code == 200
    answer = chat.json()
    assert answer['citations'] and answer['referencedNodeIds']
    for citation in answer['citations']:
        chunks = client.get('/documents/'+citation['docId']+'/chunks').json()['chunks']
        chunk = next(c for c in chunks if c['id']==citation['chunkId'])
        assert citation['quote'] in chunk['text']
    quiz = client.post('/quiz',json={'nodeId':node['id']}).json()
    assert len(quiz['questions'])==3
    assert all('answerIndex' not in q and 'quote' not in q for q in quiz['questions'])
    result = client.post('/quiz/grade',json={'attemptId':quiz['attemptId'],'answers':[0,2,1]})
    assert result.status_code==200 and result.json()['passed']
    assert client.get('/progress').json()['masteredCount']>=1
    assert client.post('/quiz/grade',json={'attemptId':quiz['attemptId'],'answers':[0,2,1]}).status_code==409

def test_failed_quiz_does_not_master(client):
    node=client.post('/demo').json()['nodes'][0]
    quiz=client.post('/quiz',json={'nodeId':node['id']}).json()
    result=client.post('/quiz/grade',json={'attemptId':quiz['attemptId'],'answers':[1,1,0]}).json()
    assert result['score']==0 and not result['passed']
    assert client.get('/progress').json()['masteredCount']==0
