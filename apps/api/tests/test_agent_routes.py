from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import board_selections
from app.config import get_settings
from app.main import app
from app.models import ChunkRow, DocumentRow, SourcePageRow

OWNER = {"Authorization": "Bearer agent-route-owner"}
AGENT = {"Authorization": "Bearer agent-route-agent"}
SHARED = "a4f46c59-4514-4896-be47-078843e2d36f"
PRIVATE = "79948f3b-16c7-46e1-a8b6-9bde9e3c2589"
PLACEMENT = {"x": 1, "y": 2, "width": 200, "height": 120}


@pytest.fixture
def client(tmp_path, monkeypatch):
    for key, value in {
        "DATA_DIR": str(tmp_path), "MOCK_LLM": "1", "ACCESS_TOKEN": "agent-route-owner",
        "GRASP_AGENT_TOKEN": "agent-route-agent", "GRASP_AGENT_SOURCE_DOC_IDS": SHARED,
    }.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    try:
        with TestClient(app) as test:
            yield test
    finally:
        get_settings.cache_clear()


def create_board(client):
    return client.post("/boards", json={"title": "Test board"}, headers=OWNER).json()["id"]


def add_object(client, board_id, object_id, headers=OWNER, **details):
    body = {"baseRevision": 0, "mutationId": "add-fixture", "operations": [{
        "type": "addObject", "object": {
            "id": object_id, "kind": "text", "title": "Fixture", "placement": PLACEMENT, **details,
        },
    }]}
    return client.post(f"/boards/{board_id}/ops", headers=headers, json=body)


def test_selection_is_transient_owner_only_and_matches_board_revision(client, monkeypatch):
    now = [100.0]
    monkeypatch.setattr(board_selections, "monotonic", lambda: now[0])
    first, second = create_board(client), create_board(client)
    assert add_object(client, first, "selected").status_code == 200
    assert add_object(client, second, "foreign").status_code == 200
    path = f"/boards/{first}/selection"
    assert client.get(path, headers=AGENT).json() == {
        "available": False, "boardId": first, "revision": 1, "objectIds": [],
    }
    payload = {"baseRevision": 1, "objectIds": ["selected", "selected"]}
    assert client.put(path, headers=AGENT, json=payload).status_code == 403
    assert client.put(path, headers=OWNER, json={**payload, "objectIds": ["foreign"]}).status_code == 422
    response = client.put(path, headers=OWNER, json=payload)
    assert response.status_code == 200
    assert client.get(path, headers=AGENT).json() == {
        "available": True, "boardId": first, "revision": 1, "objectIds": ["selected"],
    }
    assert client.get(f"/boards/{second}/selection", headers=AGENT).json()["available"] is False
    assert client.get(f"/boards/{first}", headers=AGENT).json()["revision"] == 1
    now[0] += board_selections.SELECTION_TTL_SECONDS
    assert client.get(path, headers=AGENT).json()["available"] is False

    assert client.put(path, headers=OWNER, json=payload).status_code == 200
    edit = client.post(f"/boards/{first}/ops", headers=AGENT, json={
        "baseRevision": 1, "mutationId": "move", "operations": [
            {"type": "placeObject", "objectId": "selected", "placement": {**PLACEMENT, "x": 150}},
        ],
    })
    assert edit.status_code == 200
    assert client.get(path, headers=AGENT).json() == {
        "available": False, "boardId": first, "revision": 2, "objectIds": [],
    }
    assert client.put(path, headers=OWNER, json=payload).json()["detail"]["code"] == "staleRevision"


def test_context_resolves_browsers_without_guessing_and_rejects_late_heartbeats(client, monkeypatch):
    now = [100.0]
    monkeypatch.setattr(board_selections, "monotonic", lambda: now[0])
    first, second = create_board(client), create_board(client)
    assert add_object(client, first, "selected").status_code == 200

    def share(board, tab, sequence, ids, revision=1, headers=OWNER):
        return client.put(f"/boards/{board}/presence", headers=headers, json={
            "tabId": tab, "sequence": sequence, "baseRevision": revision, "objectIds": ids,
        })

    def context(**parameters):
        response = client.get("/boards/context", headers=AGENT, params=parameters)
        assert response.status_code == 200, response.text
        return response.json()

    assert context()["status"] == "noActiveBoard"
    assert share(first, "tab-a", 1, ["selected"], headers=AGENT).status_code == 403
    assert share(first, "tab-a", 1, ["unowned"]).status_code == 422
    assert share(first, "tab-a", 1, ["selected", "selected"]).status_code == 204
    active = context()
    assert active["board"]["id"] == first
    assert active["selection"] == {"status": "selected", "objectIds": ["selected"]}
    assert client.get(f"/boards/{first}/selection", headers=AGENT).json()["available"]

    assert share(second, "tab-b", 1, [], revision=0).status_code == 204
    ambiguous = context()
    assert ambiguous["status"] == "ambiguousBoard" and ambiguous["board"] is None
    assert {candidate["id"] for candidate in ambiguous["candidates"]} == {first, second}
    assert context(boardId=first)["selection"] == active["selection"]
    assert context(boardId=second)["selection"]["status"] == "empty"

    assert share(first, "tab-b", 2, [], revision=1).status_code == 204
    assert context()["selection"]["status"] == "ambiguous"
    release = "/boards/active/tab-b?sequence=3"
    assert client.delete(release, headers=AGENT).status_code == 403
    assert client.delete(release, headers=OWNER).status_code == 204
    assert share(second, "tab-b", 2, [], revision=0).status_code == 204
    assert context()["board"]["id"] == first
    assert share(first, "tab-a", 2, None).status_code == 204
    assert context()["selection"]["status"] == "unavailable"
    assert share(first, "tab-a", 3, [], revision=0).status_code == 409

    now[0] += board_selections.SELECTION_TTL_SECONDS
    assert context()["status"] == "noActiveBoard"
    assert context(boardId=first)["board"]["revision"] == 1


def test_context_reports_attributed_history_and_keeps_the_selected_revision_consistent(client):
    board = create_board(client)
    assert add_object(client, board, "card", headers=AGENT).status_code == 200
    assert client.put(f"/boards/{board}/presence", headers=OWNER, json={
        "tabId": "tab", "sequence": 1, "baseRevision": 1, "objectIds": ["card"],
    }).status_code == 204
    path = f"/boards/{board}/ops"
    note = {"id": "note", "kind": "annotation", "title": "Review before publish", "placement": PLACEMENT}
    requirement = {
        "id": "approval", "kind": "requirement", "title": "Require human approval", "placement": PLACEMENT,
        "requirement": {"status": "accepted", "acceptanceCriteria": ["Record reviewer approval"]},
    }
    written = client.post(path, headers=OWNER, json={
        "baseRevision": 1, "mutationId": "owner-review", "operations": [
            {"type": "placeObject", "objectId": "card", "placement": {**PLACEMENT, "x": 150}},
            {"type": "addObject", "object": note},
            {"type": "addObject", "object": requirement},
            {"type": "addConnection", "connection": {
                "id": "note-to-card", "source": "note", "target": "card", "label": "Review", "role": "annotation",
            }},
        ],
    })
    assert written.status_code == 200, written.text
    assert client.post(path, headers=AGENT, json={
        "baseRevision": 2, "mutationId": "agent-later", "operations": [
            {"type": "placeObject", "objectId": "card", "placement": {**PLACEMENT, "x": 160}},
        ],
    }).status_code == 200
    response = client.get("/boards/context", headers=AGENT, params={"boardId": board, "sinceRevision": 1})
    assert response.status_code == 200, response.text
    value = response.json()
    assert value["board"]["revision"] == 3
    assert value["board"]["objects"]["card"]["updatedBy"] == "agent"
    assert value["board"]["objects"]["note"]["createdBy"] == "user"
    assert value["annotationIds"] == ["note"]
    assert value["requirementIds"] == ["approval"]
    assert value["proposalIds"] == ["card"]
    assert value["selection"] == {"status": "stale", "objectIds": []}
    first, second = value["changes"]["revisions"]
    assert first["actor"] == "user" and second["actor"] == "agent"
    assert {"id": "card", "kind": "text", "label": "Fixture", "change": "modified", "fields": ["placement"]} in first["objects"]
    assert first["connections"][0]["change"] == "added"
    assert first["connections"][0]["id"] == "note-to-card"
    assert value["changes"]["nextSinceRevision"] is None
    assert client.get("/boards/context", headers=AGENT, params={"sinceRevision": 1}).status_code == 422
    assert client.get("/boards/context", headers=AGENT, params={"boardId": board, "sinceRevision": 4}).status_code == 422

    for base in range(3, 15):
        write = client.post(path, headers=OWNER, json={
            "baseRevision": base, "mutationId": f"move-{base}", "operations": [
                {"type": "placeObject", "objectId": "card", "placement": {**PLACEMENT, "x": base}},
            ],
        })
        assert write.status_code == 200, write.text
    first_page = client.get("/boards/context", headers=AGENT, params={"boardId": board, "sinceRevision": 0}).json()
    assert first_page["board"]["revision"] == 15
    cursor = first_page["changes"]["nextSinceRevision"]
    second_page = client.get("/boards/context", headers=AGENT, params={"boardId": board, "sinceRevision": cursor}).json()
    assert second_page["changes"]["revisions"][0]["revision"] == cursor + 1
    assert second_page["changes"]["throughRevision"] == 15
    assert second_page["changes"]["nextSinceRevision"] is None


def seed_sources():
    public_quote = "🧪 Editable captions require reviewer approval."
    private_quote = "Private captions may mention another client."
    sources = [(SHARED, "shared", public_quote), (PRIVATE, "private", private_quote)]
    with Session(app.state.storage.engine) as session:
        for doc_id, chunk_id, quote in sources:
            session.add(DocumentRow(id=doc_id, name=f"{chunk_id}.md", status="done", uploadedAt=datetime.now(timezone.utc)))
        session.flush()
        for doc_id, chunk_id, quote in sources:
            session.add(SourcePageRow(docId=doc_id, page=1, text=f"α {quote} End."))
            session.add(ChunkRow(id=chunk_id, docId=doc_id, page=1, text=quote, charStart=2, charEnd=2 + len(quote)))
        session.commit()
    app.state.storage.vector_store().add_texts(
        [quote for _, _, quote in sources],
        metadatas=[{"docId": doc_id} for doc_id, _, _ in sources],
        ids=[chunk_id for _, chunk_id, _ in sources],
    )
    return public_quote, private_quote


def test_scoped_search_reads_exact_evidence_and_blocks_indirect_access(client):
    quote, private_quote = seed_sources()
    query = {"query": "editable captions reviewer approval", "topK": 4}
    assert client.post("/knowledge/search", headers=AGENT, json={**query, "docIds": []}).json() == {
        "mode": "mock", "results": [],
    }
    assert client.post("/knowledge/search", headers=AGENT, json={**query, "docIds": [SHARED, PRIVATE]}).status_code == 403
    assert client.post("/knowledge/search", headers=AGENT, json={**query, "topK": "4", "docIds": [SHARED]}).status_code == 422
    search = client.post("/knowledge/search", headers=AGENT, json={**query, "docIds": [SHARED]})
    assert search.status_code == 200, search.text
    reference = {"chunkId": "shared", "docId": SHARED, "page": 1, "charStart": 2, "charEnd": 2 + len(quote)}
    assert search.json() == {"mode": "mock", "results": [
        {"rank": 1, "sourceName": "shared.md", "reference": reference, "excerpt": quote},
    ]}
    source = client.post("/knowledge/source", headers=AGENT, json=reference).json()
    assert source == {"available": True, "quote": quote, "reference": reference, "sourceName": "shared.md"}
    assert client.post("/knowledge/source", headers=AGENT, json={**reference, "charStart": 0}).json()["available"] is False
    private = {**reference, "docId": PRIVATE, "chunkId": "private", "charEnd": 2 + len(private_quote)}
    assert client.post("/knowledge/source", headers=AGENT, json=private).status_code == 403
    assert client.get("/documents", headers=AGENT).status_code == 401

    hidden_board = create_board(client)
    assert add_object(client, hidden_board, "source", headers=AGENT, kind="evidence", evidence=[private]).status_code == 403
    assert add_object(client, hidden_board, "source", kind="evidence", evidence=[private]).status_code == 200
    context_path = f"/boards/{hidden_board}/objects/source/context"
    assert client.get(context_path, headers=AGENT).json()["evidence"][0]["available"] is False
    assert client.get(context_path, headers=OWNER).json()["evidence"][0]["quote"] == private_quote
