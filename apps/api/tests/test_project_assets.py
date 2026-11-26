from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from io import BytesIO
from os import utime
from pathlib import Path
import sqlite3
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfWriter
from sqlalchemy import text
from sqlmodel import Session, select

from app.asset_routes import cleanup_expired_assets
from app.asset_storage import AssetImportRow
from app.config import Settings
from app.main import app
from .test_chunking import write_pdf
from .test_document_api import events_for

OWNER = {"Authorization": "Bearer mock-asset-owner"}
AGENT = {"Authorization": "Bearer mock-asset-agent"}
PLACEMENT = {"x": 37, "y": 79, "width": 280, "height": 184}


@pytest.fixture
def library(tmp_path, monkeypatch):
    settings = Settings(data_dir=tmp_path, access_token="mock-asset-owner", agent_token="mock-asset-agent",
                        max_upload_bytes=120_000, requests_per_minute=1000)
    monkeypatch.setattr("app.main.get_settings", lambda: settings)
    return tmp_path


def board(client):
    response = client.post("/boards", headers=OWNER, json={"title": "Asset fixture"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def raster(format="PNG", size=(36, 21), *, semantic_color="cyan", orientation=None):
    output = BytesIO()
    with Image.new("RGB", size, semantic_color) as picture:
        if orientation:
            exif = picture.getexif()
            exif[274] = orientation
            picture.save(output, format, exif=exif)
        else:
            picture.save(output, format)
    return output.getvalue()


def upload(client, board_id, name, content, *, collection=None, position=0, method="picker", headers=OWNER):
    return client.post(
        f"/boards/{board_id}/assets", headers=headers,
        params={"collectionId": collection or uuid4().hex, "position": position, "method": method},
        files={"file": (name, content, "application/octet-stream")},
    )


def added(object_id, asset_id=None, *, kind="image", page=None, title=None, related=None):
    item = {"id": object_id, "kind": kind, "title": title or object_id, "placement": PLACEMENT}
    if asset_id:
        item["asset"] = {"assetId": asset_id, "page": page}
    if related:
        item["relatedObjectIds"] = [related]
    return {"type": "addObject", "object": item}


def edit(client, board_id, revision, *operations, headers=OWNER, mutation=None):
    return client.post(f"/boards/{board_id}/ops", headers=headers, json={
        "baseRevision": revision, "mutationId": mutation or uuid4().hex, "operations": operations,
    })


def sharing(client, path, shared, headers=OWNER):
    return client.put(f"{path}/sharing", headers=headers, json={"shared": shared})


def test_originals_previews_and_revision_survive_real_storage_reopen(library):
    images = [
        ("picker", "overview.png", raster(size=(1600, 300)), (1600, 300), (1280, 240)),
        ("drop", "rotated.JPEG", raster("JPEG", (45, 20), orientation=6), (20, 45), (20, 45)),
        ("paste", "controls.webp", raster("WEBP"), (36, 21), (36, 21)),
    ]
    collection = uuid4().hex
    with TestClient(app) as client:
        board_id = board(client)
        assets = []
        for position, (method, name, source, dimensions, preview_dimensions) in enumerate(images):
            response = upload(client, board_id, name, source, collection=collection, position=position, method=method)
            assert response.status_code == 201, response.text
            asset = response.json()
            assets.append(asset)
            assert (asset["width"], asset["height"]) == dimensions
            assert asset["digest"] == sha256(source).hexdigest() and asset["byteLength"] == len(source)
            assert not asset["shared"]
            response = client.get(f"/boards/{board_id}/assets/{asset['id']}/preview", headers=OWNER)
            assert response.headers["content-type"] == "image/webp"
            with Image.open(BytesIO(response.content)) as preview:
                assert preview.size == preview_dimensions and preview.format == "WEBP"
                assert 274 not in preview.getexif()

        repeat = upload(client, board_id, images[0][1], images[0][2], collection=collection)
        duplicate = upload(client, board_id, "copied.png", images[0][2])
        assert repeat.json()["id"] == duplicate.json()["id"] == assets[0]["id"]
        conflict = upload(client, board_id, "different.png", raster(), collection=collection)
        assert conflict.status_code == 409
        with Session(client.app.state.storage.engine) as session:
            rows = session.exec(select(AssetImportRow).where(AssetImportRow.collection_id == collection)
                                .order_by(AssetImportRow.position)).all()
            assert [row.asset_id for row in rows] == [asset["id"] for asset in assets]
            assert [row.method for row in rows] == [entry[0] for entry in images]
        assert len(list((library / "assets").glob("*.original"))) == 3

        commit = edit(client, board_id, 0,
                      *(added(f"image-{index}", asset["id"]) for index, asset in enumerate([*assets, assets[0]])))
        assert commit.status_code == 200, commit.text
        saved = commit.json()["board"]
        assert saved["schemaVersion"] == 2 and "data:image" not in commit.text
        assert client.get(f"/boards/{board_id}/revisions/0", headers=OWNER).json()["schemaVersion"] == 1
    with TestClient(app) as client:
        assert client.get(f"/boards/{board_id}", headers=OWNER).json() == saved
        for asset, (_, _, source, _, _) in zip(assets, images, strict=True):
            path = f"/boards/{board_id}/assets/{asset['id']}"
            assert client.get(path, headers=OWNER).json() == asset
            assert client.get(f"{path}/original", headers=OWNER).content == source
            assert client.get(f"{path}/preview", headers=OWNER).status_code == 200


def test_bad_files_do_not_block_valid_siblings_or_stage_bytes(library):
    with TestClient(app) as client:
        board_id = board(client)
        collection = uuid4().hex
        items = [
            ("blocked.svg", b"<svg/>", 415), ("broken.png", b"broken", 422),
            ("mislabeled.jpg", raster(), 422), ("oversized.webp", b"irrelevant" * 15_000, 413),
            ("wide.png", raster(size=(8193, 1)), 413), ("large-raster.png", raster(size=(4096, 4096)), 413),
            ("good.jpeg", raster("JPEG"), 201),
        ]
        for index, (name, content, status) in enumerate(items):
            response = upload(client, board_id, name, content, collection=collection, position=index)
            assert response.status_code == status, response.text
        assert len(list((library / "assets").glob("*.original"))) == 1
        with Session(client.app.state.storage.engine) as session:
            assert [row.position for row in session.exec(select(AssetImportRow))] == [6]
        assert client.get(f"/boards/{board_id}", headers=OWNER).json()["revision"] == 0


def test_parallel_retries_share_bytes_but_never_a_board_grant(library):
    origin = "http://127.0.0.1:5173"
    with TestClient(app, base_url=origin) as client:
        first, second = board(client), board(client)
        content, collection = raster(), uuid4().hex
        login = client.post("/owner-session", headers={"Origin": origin}, json={"token": OWNER["Authorization"][7:]})
        cookie = {"Cookie": f"grasp-owner-5173={login.cookies.get('grasp-owner-5173')}"}
        denied = upload(client, first, "first.png", content, headers={**cookie, "Origin": "http://127.0.0.1:5999"})
        assert denied.status_code == 403

        def upload_first(_):
            return upload(client, first, "first.png", content, collection=collection).json()["id"]

        with ThreadPoolExecutor(max_workers=2) as pool:
            first_ids = list(pool.map(upload_first, range(2)))
        first_id = first_ids[0]
        second_id = upload(client, second, "second.png", content).json()["id"]
        assert set(first_ids) == {first_id} and second_id != first_id
        assert len(list((library / "assets").glob("*.original"))) == 1
        first_path = f"/boards/{first}/assets/{first_id}"
        second_path = f"/boards/{second}/assets/{second_id}"
        assert sharing(client, first_path, True, {**cookie, "Origin": "http://127.0.0.1:5999"}).status_code == 403
        assert sharing(client, first_path, True).json()["shared"]
        assert client.get(f"{first_path}/original", headers=AGENT).content == content
        assert client.get(f"{second_path}/original", headers=AGENT).status_code == 404


def test_board_grants_redact_every_agent_view_and_do_not_restore(library):
    with TestClient(app) as client:
        board_id, foreign = board(client), board(client)
        source = raster()
        response = upload(client, board_id, "private-filename.png", source)
        assert response.status_code == 201, response.text
        asset_id = response.json()["id"]
        path = f"/boards/{board_id}/assets/{asset_id}"
        assert upload(client, board_id, "new.png", source, headers=AGENT).status_code == 403
        assert sharing(client, path, True, AGENT).status_code == 403
        assert client.get(path).status_code == 401
        assert edit(client, foreign, 0, added("bad", asset_id)).status_code == 404
        assert client.get(f"/boards/{foreign}", headers=OWNER).json()["revision"] == 0
        response = edit(client, board_id, 0, added("photo", asset_id, title="private-filename.png"),
                        added("annotated", kind="text"))
        assert response.status_code == 200, response.text
        assert edit(client, board_id, 1, added("duplicate", asset_id), headers=AGENT).status_code == 403
        assert edit(client, board_id, 1, added("bad-note", kind="annotation", related="photo"), headers=AGENT).status_code == 403
        assert edit(client, board_id, 1, {"type": "removeObject", "objectId": "photo"}, headers=AGENT).status_code == 403
        for guess in (added("photo", kind="text"), added("photo", "unknown-asset")):
            rejected = edit(client, board_id, 1, {**guess, "type": "updateObject"}, headers=AGENT)
            assert rejected.status_code == 403

        def assert_hidden(revision):
            encoded = f"/boards/{board_id}"
            for route in (encoded, f"{encoded}/revisions/1", f"{encoded}/objects/photo/context",
                          f"/boards/context?boardId={board_id}&sinceRevision=0"):
                response = client.get(route, headers=AGENT)
                assert response.status_code == 200, response.text
                assert "Private source" in response.text
                assert "private-filename.png" not in response.text and asset_id not in response.text
            for suffix in ("", "/original", "/preview"):
                assert client.get(path + suffix, headers=AGENT).status_code == 404
            assert client.get(encoded, headers=OWNER).json()["revision"] == revision

        assert_hidden(1)
        assert sharing(client, path, True).json()["shared"]
        assert client.get(f"{path}/original", headers=AGENT).content == source
        assert client.get(f"{path}/preview", headers=AGENT).status_code == 200
        assert client.get(f"/boards/{foreign}/assets/{asset_id}", headers=AGENT).status_code == 404
        note = added("agent-note", kind="annotation", related="photo")
        response = edit(client, board_id, 1, note, headers=AGENT, mutation="agent-note")
        assert response.status_code == 200 and asset_id in response.text
        assert not sharing(client, path, False).json()["shared"]
        replay = edit(client, board_id, 1, note, headers=AGENT, mutation="agent-note")
        assert replay.status_code == 200 and asset_id not in replay.text
        assert_hidden(2)
        restore = edit(client, board_id, 2, {"type": "restoreRevision", "revision": 1})
        assert restore.status_code == 200, restore.text
        assert restore.json()["board"]["objects"]["photo"]["placement"] == {**PLACEMENT, "groupId": None}
        assert_hidden(3)


def test_project_documents_use_existing_ingestion_and_board_grants(library: Path):
    pdf_path = library / "fixture.pdf"
    write_pdf(pdf_path, ["First fixture page.", "Orchid scanner uses a sensor."])
    data = pdf_path.read_bytes()
    with TestClient(app) as client:
        board_id = board(client)
        names = [("private-fixture.pdf", data), ("procedure.md", b"# Fixture\n\nInspect the sensor."),
                 ("description.txt", "Check the sensor. 🧪".encode())]
        assets = [upload(client, board_id, name, content).json() for name, content in names]
        for asset in assets:
            assert events_for(client, asset["documentId"], OWNER)[-1].type == "complete"
        pdf = assets[0]
        path = f"/boards/{board_id}/assets/{pdf['id']}"
        document_id = pdf["documentId"]
        assert pdf["pageCount"] == 2
        assert client.get(f"/documents/{document_id}/pages/2", headers=OWNER).json()["text"].startswith("Orchid")
        assert client.get(f"/documents/{document_id}/original", headers=OWNER).content == data
        assert client.get(f"{path}/original", headers=OWNER).content == data
        assert not (library / "assets").exists()
        assert edit(client, board_id, 0, added("wrong-page", pdf["id"], kind="document", page=3)).status_code == 422
        response = edit(client, board_id, 0, added("pdf", pdf["id"], kind="document", page=2))
        assert response.status_code == 200, response.text
        assert client.get(f"{path}/original", headers=AGENT).status_code == 404

        public = client.post("/documents", headers=OWNER, files={"file": ("library.pdf", data)}).json()["id"]
        assert public != document_id
        assert events_for(client, public, OWNER)[-1].type == "complete"
        storage = client.app.state.storage
        storage.settings = storage.settings.model_copy(update={"agent_source_doc_ids": frozenset({document_id, public})})
        sources = client.post("/knowledge/search", headers=AGENT, json={"docIds": [public], "query": "orchid scanner"})
        assert sources.status_code == 200 and sources.json()["results"]
        excerpt = client.get(f"/documents/{document_id}/chunks", headers=OWNER).json()["chunks"][0]
        ref = {key: excerpt[key] for key in ("docId", "page", "charStart", "charEnd")}
        ref["chunkId"] = excerpt["id"]
        assert client.post("/knowledge/source", json=ref, headers=AGENT).status_code == 403
        assert sharing(client, path, True).json()["shared"]
        assert client.get(f"{path}/original", headers=AGENT).content == data
        assert client.get(f"/documents/{document_id}/original", headers=AGENT).status_code == 401
        assert client.post("/knowledge/source", json=ref, headers=AGENT).status_code == 403
        assert client.post("/knowledge/search", json={"docIds": [document_id], "query": "orchid"},
                           headers=AGENT).status_code == 403
        assert client.delete(f"/documents/{document_id}", headers=OWNER).status_code == 200
        assert client.get(path, headers=OWNER).json()["available"] is False
        assert client.get(f"{path}/original", headers=AGENT).status_code == 404
        assert "private-fixture.pdf" not in client.get(f"/boards/{board_id}", headers=AGENT).text


def test_textless_pdf_keeps_its_original_and_board_placement(library):
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=400)
    file = BytesIO()
    writer.write(file)
    with TestClient(app) as client:
        board_id = board(client)
        response = upload(client, board_id, "diagram.pdf", file.getvalue())
        assert response.status_code == 201, response.text
        asset = response.json()
        assert events_for(client, asset["documentId"], OWNER)[-1].type == "error"
        assert edit(client, board_id, 0, added("diagram", asset["id"], kind="document", page=1)).status_code == 200
        path = f"/boards/{board_id}/assets/{asset['id']}"
        assert client.get(path, headers=OWNER).json()["indexStatus"] == "failed"
        assert client.get(f"{path}/original", headers=OWNER).content == file.getvalue()


def test_stale_placement_reuses_upload_and_cleanup_keeps_historical_references(library):
    with TestClient(app) as client:
        board_id = board(client)
        source, collection = raster(), uuid4().hex
        asset_id = upload(client, board_id, "retry.png", source, collection=collection).json()["id"]
        assert edit(client, board_id, 0, added("owner-note", kind="annotation")).status_code == 200
        stale = edit(client, board_id, 0, added("photo", asset_id))
        assert stale.status_code == 409 and stale.json()["detail"]["currentRevision"] == 1
        assert upload(client, board_id, "retry.png", source, collection=collection).json()["id"] == asset_id
        commit = edit(client, board_id, 1, added("photo", asset_id), mutation="retry-placement")
        assert commit.status_code == 200 and "owner-note" in commit.json()["board"]["objects"]
        assert edit(client, board_id, 1, added("photo", asset_id), mutation="retry-placement").json() == commit.json()
        assert edit(client, board_id, 2, {"type": "removeObject", "objectId": "photo"}).status_code == 200
        abandoned = upload(client, board_id, "abandoned.png", raster(semantic_color="red")).json()
        storage = client.app.state.storage
        old = datetime.now(timezone.utc) - timedelta(days=8)
        with Session(storage.engine) as session:
            session.execute(text("UPDATE project_assets SET staged_at = :old"), {"old": old})
            session.commit()
        for file in (library / "assets").iterdir():
            utime(file, (old.timestamp(), old.timestamp()))
        cleanup_expired_assets(storage)
        assert client.get(f"/boards/{board_id}/assets/{abandoned['id']}", headers=OWNER).status_code == 404
        assert edit(client, board_id, 3, {"type": "restoreRevision", "revision": 2}).status_code == 200
        assert client.get(f"/boards/{board_id}/assets/{asset_id}/original", headers=OWNER).content == source
        assert len(list((library / "assets").glob("*.original"))) == 1


def test_database_upgrade_leaves_existing_snapshots_and_retries_intact(library):
    with TestClient(app) as client:
        board_id = board(client)
        operation = added("owner-content", kind="annotation")
        saved = edit(client, board_id, 0, operation, mutation="old-edit").json()
    with sqlite3.connect(library / "grasp.sqlite3") as connection:
        connection.execute("ALTER TABLE project_boards DROP COLUMN schema_version")
        for name in ("project_asset_imports", "project_assets", "project_source_documents"):
            connection.execute(f"DROP TABLE {name}")
        connection.execute("DELETE FROM canvas_schema WHERE version = 2")
    with TestClient(app) as client:
        assert client.get(f"/boards/{board_id}", headers=OWNER).json() == saved["board"]
        assert edit(client, board_id, 0, operation, mutation="old-edit").json() == saved
        asset = upload(client, board_id, "new.png", raster()).json()
        upgraded = edit(client, board_id, 1, added("asset", asset["id"])).json()["board"]
        assert upgraded["schemaVersion"] == 2 and upgraded["objects"]["owner-content"] == saved["board"]["objects"]["owner-content"]
