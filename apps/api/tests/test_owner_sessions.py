from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

ORIGIN = "http://127.0.0.1:5173"
SAME_ORIGIN = {"Origin": ORIGIN}
OWNER = "owner-session-fixture"
AGENT = {"Authorization": "Bearer agent-session-fixture"}


def test_owner_sessions_restore_revoke_and_keep_agent_permissions(tmp_path, monkeypatch):
    for key, value in {
        "DATA_DIR": str(tmp_path), "MOCK_LLM": "1", "ACCESS_TOKEN": OWNER,
        "GRASP_AGENT_TOKEN": "agent-session-fixture",
    }.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    try:
        with TestClient(app, base_url=ORIGIN) as client:
            assert client.get("/boards").status_code == 401
            assert client.post("/owner-session", headers={"Origin": "http://127.0.0.1:5999"},
                               json={"token": OWNER}).status_code == 403
            assert client.post("/owner-session", headers=SAME_ORIGIN,
                               json={"token": "agent-session-fixture"}).status_code == 401
            login = client.post("/owner-session", headers=SAME_ORIGIN, json={"token": OWNER})
            assert login.status_code == 204 and not login.content
            cookie = login.cookies.get("grasp-owner-5173")
            assert cookie and OWNER not in login.headers["set-cookie"]
            for attribute in ("HttpOnly", "Path=/api", "SameSite=strict", "Max-Age="):
                assert attribute in login.headers["set-cookie"]
            # TestClient calls the unmounted API. A normal browser sends this cookie to /api/*.
            headers = {"Cookie": f"grasp-owner-5173={cookie}"}
            assert client.get("/boards", headers=headers).status_code == 200
            assert client.post("/boards", headers=headers, json={"title": "cross-origin"}).status_code == 403
            board = client.post("/boards", headers={**headers, **SAME_ORIGIN}, json={"title": "Workspace"})
            assert board.status_code == 201
            path = f"/boards/{board.json()['id']}"
            assert client.get(path, headers=AGENT).status_code == 200
            assert client.get("/documents", headers={**headers, **AGENT}).status_code == 401

        with TestClient(app, base_url=ORIGIN) as client:
            assert client.get(path, headers=headers).status_code == 200
            second = client.post("/owner-session", headers=SAME_ORIGIN, json={"token": OWNER})
            second_headers = {"Cookie": f"grasp-owner-5173={second.cookies.get('grasp-owner-5173')}"}
            assert client.delete("/owner-session?all=true", headers={**second_headers, **SAME_ORIGIN}).status_code == 204
            assert client.get(path, headers=headers).status_code == 401
            assert client.get(path, headers=second_headers).status_code == 401
            next_login = client.post("/owner-session", headers=SAME_ORIGIN, json={"token": OWNER})
            next_headers = {"Cookie": f"grasp-owner-5173={next_login.cookies.get('grasp-owner-5173')}"}
            assert client.delete("/owner-session", headers={**next_headers, **SAME_ORIGIN}).status_code == 204
            assert client.get(path, headers=next_headers).status_code == 401
            issued = client.post("/owner-session", headers=SAME_ORIGIN, json={"token": OWNER})
            after_rotation = {"Cookie": f"grasp-owner-5173={issued.cookies.get('grasp-owner-5173')}"}

        monkeypatch.setenv("ACCESS_TOKEN", "rotated-owner-fixture")
        get_settings.cache_clear()
        with TestClient(app, base_url=ORIGIN) as client:
            assert client.get(path, headers=after_rotation).status_code == 401
            assert client.get(path, headers=AGENT).status_code == 200
    finally:
        get_settings.cache_clear()
