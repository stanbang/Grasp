from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, select

from app.canvas_storage import BoardRevisionRow, CANVAS_TABLES
from app.config import Settings, get_settings
from app.main import app
from app.models import ChunkRow, DocumentRow, GraphEdgeRow, GraphNodeRow, ProgressRow, SourcePageRow
from app.production import application

OWNER = {"Authorization": "Bearer test-owner"}
AGENT = {"Authorization": "Bearer test-agent"}
PLACEMENT = {"x": 12, "y": -3.5, "width": 220, "height": 120}
LEGACY_DOCUMENT = "824e9b6a-9cb3-46e8-b885-049450cdb14c"


@pytest.fixture
def library(tmp_path, monkeypatch):
    for key, value in {
        "DATA_DIR": str(tmp_path), "MOCK_LLM": "1", "ACCESS_TOKEN": "test-owner", "GRASP_AGENT_TOKEN": "test-agent",
    }.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()


def create(client, title="Feedback project", headers=OWNER, prefix=""):
    response = client.post(f"{prefix}/boards", json={"title": title}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def item(key, kind="annotation", **details):
    return {"id": key, "kind": kind, "title": key, "placement": PLACEMENT, **details}


def add(key, kind="annotation", **details):
    return {"type": "addObject", "object": item(key, kind, **details)}


def batch(base, mutation, *operations):
    return {"baseRevision": base, "mutationId": mutation, "operations": operations}


def write(client, board, data, headers=OWNER):
    return client.post(f"/boards/{board['id']}/ops", json=data, headers=headers)


def state(client, board):
    response = client.get(f"/boards/{board['id']}", headers=OWNER)
    assert response.status_code == 200
    return response.json()


def test_round_trip_batch_undo_context_and_restart(library):
    with TestClient(app) as client:
        board = create(client)
        second = create(client, "Other", AGENT)
        first_page = client.get("/boards?limit=1", headers=AGENT).json()
        assert first_page["boards"][0]["id"] == second["id"]
        assert first_page["boards"][0]["createdBy"] == "agent"
        assert first_page["nextOffset"] == 1
        assert client.get("/boards?offset=1&limit=1", headers=OWNER).json()["boards"][0]["id"] == board["id"]
        assert board["schemaVersion"] == 1 and board["projectId"] != board["id"]
        path = f"/boards/{board['id']}"
        assert client.get(f"{path}?afterRevision=0", headers=OWNER).status_code == 204

        connection = {"id": "dependency", "source": "question", "target": "requirement", "label": "Clarifies"}
        draft = batch(0, "agent-proposal",
            add("visual", "illustration", illustration="chunks"),
            add("requirement", "requirement", requirement={"acceptanceCriteria": ["Open a saved project"]}),
            add("question", "question", question={"required": True}, relatedObjectIds=["requirement"]),
            add("metadata", "prototype", prototype={
                "previewId": "preview", "revision": 1, "entryPoint": "demo/index.html",
                "digest": "b" * 64, "requirementIds": ["requirement"],
            }),
            {"type": "addConnection", "connection": connection},
        )
        response = write(client, board, draft, AGENT)
        assert response.status_code == 200, response.text
        first = response.json()
        assert first["baseRevision"] == 0 and first["revision"] == 1 and first["actor"] == "agent"
        assert client.get(f"{path}?afterRevision=0", headers=OWNER).json() == first["board"]

        accepted = item("requirement", "requirement", requirement={"status": "accepted", "acceptanceCriteria": ["Open a saved project"]})
        user = batch(1, "owner-edit",
            add("feedback", relatedObjectIds=["visual"], noteStyle="underline"),
            {"type": "answerQuestion", "objectId": "question", "text": "Use the saved project."},
            {"type": "updateObject", "object": accepted},
            {"type": "placeObject", "objectId": "visual", "placement": {**PLACEMENT, "x": 224}},
            {"type": "updateConnection", "connection": {**connection, "label": "Resolves"}},
        )
        response = write(client, board, user)
        assert response.status_code == 200, response.text
        saved = response.json()["board"]
        assert saved["objects"]["visual"]["placement"]["x"] == 224
        assert saved["objects"]["requirement"]["decidedBy"] == "user"
        assert saved["objects"]["question"]["answer"]["answeredBy"] == "user"
        assert saved["objects"]["feedback"]["createdBy"] == "user"
        assert saved["connections"]["dependency"]["createdBy"] == "agent"
        assert saved["connections"]["dependency"]["updatedBy"] == "user"
        assert write(client, board, draft, AGENT).json() == first

        context = client.get(f"{path}/objects/requirement/context", headers=AGENT).json()
        assert context["revision"] == 2
        assert {related["id"] for related in context["relatedObjects"]} == {"question", "metadata"}
        assert context["connections"][0]["label"] == "Resolves"
        assert client.get(f"/boards/{second['id']}/objects/visual/context", headers=AGENT).status_code == 404

        undo = write(client, board, batch(2, "undo", {"type": "restoreRevision", "revision": 1})).json()["board"]
        assert undo["revision"] == 3
        assert undo["objects"] == first["board"]["objects"] and undo["connections"] == first["board"]["connections"]
        redo = write(client, board, batch(3, "redo", {"type": "restoreRevision", "revision": 2})).json()["board"]
        assert redo["revision"] == 4 and redo["objects"] == saved["objects"] and redo["connections"] == saved["connections"]

    with TestClient(app) as client:
        assert state(client, board) == redo
        assert client.get(f"{path}/revisions/2", headers=OWNER).json() == saved
        assert write(client, board, user).json()["board"] == saved


def test_competing_batches_stale_precedence_and_replay(library):
    with TestClient(app) as client:
        board = create(client)
        barrier = Barrier(2)

        def compete(label, credential):
            barrier.wait(timeout=5)
            data = batch(0, f"mutation-{label}", add(label))
            return data, credential, write(client, board, data, credential)

        with ThreadPoolExecutor(max_workers=2) as workers:
            responses = [workers.submit(compete, "browser", OWNER), workers.submit(compete, "agent", AGENT)]
            results = sorted((result.result() for result in responses), key=lambda result: result[2].status_code)
        committed, auth, good = results[0]
        assert good.status_code == 200
        assert results[1][2].json()["detail"] == {
            "code": "staleRevision", "message": "The board changed since this edit started.", "currentRevision": 1,
        }
        assert len(state(client, board)["objects"]) == 1
        assert write(client, board, batch(1, "later", add("later"))).status_code == 200
        assert write(client, board, committed, auth).json() == good.json()
        assert write(client, board, {**committed, "baseRevision": 2}, auth).json()["detail"]["code"] == "mutationIdReused"
        assert write(client, board, committed, AGENT if auth == OWNER else OWNER).status_code == 409


def test_invalid_and_unauthorized_batches_leave_no_partial_writes(library):
    with TestClient(app) as client:
        board = create(client)
        other = create(client)
        assert write(client, other, batch(0, "foreign", add("foreign"))).status_code == 200
        assert write(client, board, batch(0, "seed",
            add("protected"), add("q", "question", question={}),
            add("decision", "requirement", requirement={"status": "accepted"}),
        )).status_code == 200
        before = state(client, board)
        invalid_operations = [
            {"type": "unrecognized"},
            add("spoof", createdBy="user"),
            add("bad-geometry", placement={**PLACEMENT, "height": -5}),
            add("bad-illustration", "illustration", illustration="foreign"),
            add("bad-path", "prototype", prototype={"previewId": "preview", "revision": 1,
                "digest": "1" * 64, "entryPoint": "../private.html"}),
            add("bad-related", relatedObjectIds=["foreign"]),
            {"type": "addConnection", "connection": {"id": "via", "source": "protected", "target": "foreign", "label": "Wrong"}},
            {"type": "placeObject", "objectId": "protected", "placement": {**PLACEMENT, "groupId": "q"}},
            {"type": "updateConnection", "connection": {"id": "unknown", "source": "protected", "target": "q", "label": "Wrong"}},
        ]
        for offset, operation in enumerate(invalid_operations):
            response = write(client, board, batch(1, f"invalid-{offset}", add("unsaved"), operation))
            assert response.status_code == 422, response.text
        path = f"/boards/{board['id']}/ops"
        response = client.post(path, headers={**OWNER, "Content-Type": "application/json"}, content=(
            '{"baseRevision":1,"mutationId":"nan","operations":[{"type":"placeObject","objectId":"q",'
            '"placement":{"x":NaN,"y":1,"width":10,"height":10}}]}'
        ))
        assert response.status_code == 422
        for operation in [
            {"type": "answerQuestion", "objectId": "q", "text": "Forged answer"},
            {"type": "restoreRevision", "revision": 0},
            {"type": "removeObject", "objectId": "protected"},
            {"type": "updateObject", "object": item("protected", description="Changed by agent")},
            {"type": "removeObject", "objectId": "decision"},
            add("unauthorized", "requirement", requirement={"status": "accepted"}),
        ]:
            assert write(client, board, batch(1, "unauthorized", add("unsaved"), operation), AGENT).status_code == 403
        assert write(client, board, batch(1, "unauthenticated", add("unsaved")), {}).status_code == 401
        assert client.get("/graph", headers=AGENT).status_code == 401
        assert client.get("/documents", headers=AGENT).status_code == 401
        assert state(client, board) == before
        with Session(app.state.storage.engine) as session:
            assert len(session.exec(select(BoardRevisionRow).where(BoardRevisionRow.board_id == board["id"])).all()) == 2
        assert write(client, board, batch(1, "unauthorized", {
            "type": "placeObject", "objectId": "protected", "placement": {**PLACEMENT, "x": 200},
        }), AGENT).status_code == 200


def test_group_and_connection_removal_restores_both(library):
    with TestClient(app) as client:
        board = create(client)
        response = write(client, board, batch(0, "group",
            add("group", "group"), add("a", placement={**PLACEMENT, "groupId": "group"}), add("b"),
            {"type": "addConnection", "connection": {"id": "edge", "source": "a", "target": "b", "label": "Connects"}},
        ))
        assert response.status_code == 200, response.text
        result = write(client, board, batch(1, "remove", {"type": "removeObject", "objectId": "group"},
            {"type": "removeObject", "objectId": "b"})).json()["board"]
        assert not result["connections"] and result["objects"]["a"]["placement"]["groupId"] is None
        restored = write(client, board, batch(2, "undo", {"type": "restoreRevision", "revision": 1})).json()["board"]
        assert restored["connections"]["edge"]["target"] == "b"
        assert restored["objects"]["a"]["placement"]["groupId"] == "group"


def test_additive_legacy_migration_and_exact_evidence(library):
    engine = create_engine(f"sqlite:///{(library / 'grasp.sqlite3').as_posix()}")
    SQLModel.metadata.create_all(engine, tables=[
        table for table in SQLModel.metadata.sorted_tables if table not in CANVAS_TABLES
    ])
    with Session(engine) as session:
        session.add(DocumentRow(id=LEGACY_DOCUMENT, name="existing.md", status="done", uploadedAt=datetime.now(timezone.utc)))
        session.add(ProgressRow(totalNodes=2))
        session.add(SourcePageRow(docId=LEGACY_DOCUMENT, page=1, text="α✨🧪é. Old text."))
        session.add(ChunkRow(id="chunk", docId=LEGACY_DOCUMENT, page=1, charStart=1, charEnd=6, text="✨🧪é. "))
        session.add(GraphNodeRow(id="stable", label="Stable concept", summary="A source-backed concept",
            docIds=[LEGACY_DOCUMENT], sourceChunkIds=["chunk"]))
        session.add(GraphNodeRow(id="second", label="Related concept", summary="Related",
            docIds=[LEGACY_DOCUMENT], sourceChunkIds=["chunk"]))
        session.add(GraphEdgeRow(id="semantic-link", source="stable", target="second",
            relationshipLabel="supports", docIds=[LEGACY_DOCUMENT]))
        session.commit()
    engine.dispose()

    span = {"chunkId": "chunk", "docId": LEGACY_DOCUMENT, "page": 1, "charStart": 2, "charEnd": 4}
    with TestClient(app) as client:
        assert client.get(f"/documents/{LEGACY_DOCUMENT}/pages/1", headers=OWNER).json()["text"] == "α✨🧪é. Old text."
        originals = client.get("/graph", headers=OWNER).json()
        assert {node["id"] for node in originals["nodes"]} == {"stable", "second"}
        assert client.get("/progress", headers=OWNER).json()["totalNodes"] == 2
        board = create(client)
        edge = {"id": "edge", "source": "source", "target": "target", "label": "Source supports",
            "canonicalEdgeId": "semantic-link"}
        proposal = batch(0, "evidence",
            add("source", "evidence", canonicalNodeId="stable", evidence=[span]),
            add("target", "text", canonicalNodeId="second"),
            {"type": "addConnection", "connection": edge},
        )
        response = write(client, board, proposal, AGENT)
        assert response.status_code == 200, response.text
        path = f"/boards/{board['id']}/objects/source/context"
        context = client.get(path, headers=AGENT).json()
        assert context["canonicalConcept"]["sourceChunkIds"] == ["chunk"]
        assert context["canonicalRelationships"][0]["docIds"] == [LEGACY_DOCUMENT]
        assert context["evidence"] == [{"reference": span, "available": True, "quote": "🧪é", "sourceName": "existing.md"}]
        assert client.get("/graph", headers=OWNER).json() == originals
        for bad_span in [{**span, "page": 2}, {**span, "charEnd": 7}, {**span, "docId": "foreign"}]:
            assert write(client, board, batch(1, "invalid", add("forged", "evidence", evidence=[bad_span]))).status_code == 422
        assert write(client, board, batch(1, "wrong-canonical", {"type": "updateConnection",
            "connection": {**edge, "source": "target", "target": "source"},
        })).status_code == 422
        assert client.delete(f"/documents/{LEGACY_DOCUMENT}", headers=OWNER).status_code == 200
        missing = client.get(path, headers=AGENT).json()
        assert missing["object"]["canonicalNodeId"] == "stable"
        assert missing["evidence"] == [{"reference": span, "available": False, "quote": None, "sourceName": None}]
        assert write(client, board, batch(1, "later-edit", add("unrelated"))).status_code == 200


def test_mounted_route_and_auth_configuration(library):
    with pytest.raises(ValueError, match="different, nonempty"):
        Settings(agent_token="no-owner")
    with pytest.raises(ValueError, match="different, nonempty"):
        Settings(agent_token="same", access_token="same")
    with TestClient(application) as client:
        board = create(client, headers=AGENT, prefix="/api")
        assert board["createdBy"] == "agent"
        assert client.get(f"/api/boards/{board['id']}", headers=AGENT).status_code == 200
        assert client.get("/api/graph", headers=AGENT).status_code == 401
