import json
import re
from http.client import HTTPConnection, HTTPException
from typing import Any
from urllib.parse import urlencode, urlsplit

DEFAULT_API_URL = "http://127.0.0.1:8000"
DEFAULT_WEB_URL = "http://127.0.0.1:5173"
ID_PATTERN = r"^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,95}$"
MAX_REQUEST_BYTES = 65_536
MAX_RESPONSE_BYTES = 1_048_576
JsonObject = dict[str, Any]


class GraspError(Exception):
    def __init__(self, code: str, message: str, *, status: int | None = None, current_revision: int | None = None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.current_revision = current_revision

    def as_dict(self) -> JsonObject:
        result = {"code": self.code, "message": str(self)}
        if self.status is not None:
            result["status"] = self.status
        if self.current_revision is not None:
            result["currentRevision"] = self.current_revision
        return result


def loopback_url(value: str, *, allow_api_path: bool = False) -> str:
    try:
        parsed = urlsplit(value)
        allowed_paths = ("", "/", "/api", "/api/") if allow_api_path else ("", "/")
        if (
            parsed.scheme == "http" and parsed.hostname == "127.0.0.1" and parsed.port != 0
            and parsed.username is None and parsed.password is None and not parsed.query and not parsed.fragment
            and parsed.path in allowed_paths
        ):
            port = f":{parsed.port}" if parsed.port is not None else ""
            return f"http://127.0.0.1{port}{parsed.path.rstrip('/')}"
    except ValueError:
        pass
    example = "http://127.0.0.1:8000 (or the same origin with /api)" if allow_api_path else DEFAULT_WEB_URL
    raise GraspError("invalidUrl", f"Use a loopback GRASP URL such as {example}.")


def board_path(board_id: str) -> str:
    if not re.fullmatch(ID_PATTERN, board_id):
        raise GraspError("invalidBoardId", "Use a board ID returned by the GRASP service.")
    return f"/boards/{board_id}"


def web_board_url(base: str, board_id: str | None) -> str:
    url = loopback_url(base)
    if not board_id:
        return url + "/"
    board_path(board_id)
    return f"{url}/?{urlencode({'board': 'project', 'projectBoard': board_id})}"


def request_error(status: int, detail: Any) -> GraspError:
    text = detail if isinstance(detail, str) else ""
    if status == 401:
        return GraspError("unauthorized", "Check that GRASP_AGENT_TOKEN matches the token on the running API.", status=status)
    if status == 409 and isinstance(detail, dict):
        code = detail.get("code")
        revision = detail.get("currentRevision")
        if code == "staleRevision" and isinstance(revision, int):
            return GraspError(code, f"Board is at revision {revision}. Read it and review the changes before submitting a new batch.",
                              status=status, current_revision=revision)
        if code == "mutationIdReused" and isinstance(revision, int):
            return GraspError(code, "This mutation ID already belongs to another request. Use a new ID for a revised batch.",
                              status=status, current_revision=revision)
    if status == 422 and isinstance(detail, list) and detail and isinstance(detail[0], dict):
        first = detail[0]
        location = ".".join(map(str, first.get("loc", [])))
        text = f"{location}: {first.get('msg', 'Invalid value.')}" if location else first.get("msg", "")
    codes = {403: "forbidden", 404: "notFound", 413: "batchTooLarge", 422: "invalidRequest", 429: "rateLimited"}
    hint = "Check the API logs." if status >= 500 else "Check the requested board, scope or operation fields."
    return GraspError(codes.get(status, "httpError"), text or f"GRASP returned HTTP {status}. {hint}", status=status)


class GraspClient:
    def __init__(self, api_url: str, token: str):
        self.api_url = loopback_url(api_url, allow_api_path=True)
        if not token:
            raise GraspError("missingToken", "Set GRASP_AGENT_TOKEN in the process that starts grasp or Codex.")
        if not token.isascii() or not token.isprintable() or any(character.isspace() for character in token):
            raise GraspError("invalidToken", "Use the workspace agent token without whitespace.")
        self._token = token
        self._address = urlsplit(self.api_url)

    def _json(self, method: str, endpoint: str, body: JsonObject | None = None, *, timeout: float = 10) -> JsonObject:
        headers = {"Authorization": f"Bearer {self._token}", "Accept": "application/json"}
        content = None
        if body is not None:
            try:
                content = json.dumps(body, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
            except (ValueError, UnicodeError) as error:
                raise GraspError("invalidJson", "Send valid UTF-8 JSON without nonfinite numbers.") from error
            if len(content) > MAX_REQUEST_BYTES:
                raise GraspError("batchTooLarge", "Requests must fit in 64 KiB. Split the batch.")
            headers["Content-Type"] = "application/json"
        connection = HTTPConnection("127.0.0.1", self._address.port or 80, timeout=timeout)
        try:
            connection.request(method, self._address.path + endpoint, body=content, headers=headers)
            response = connection.getresponse()
            status = response.status
            raw = response.read(MAX_RESPONSE_BYTES + 1)
        except (OSError, HTTPException) as error:
            hint = " A write may have committed. Retry the identical batch with the same mutation ID." if endpoint.endswith("/ops") else ""
            raise GraspError("serviceUnavailable", f"Cannot reach GRASP at {self.api_url}. Start the API and check GRASP_API_URL.{hint}") from error
        finally:
            connection.close()
        if len(raw) > MAX_RESPONSE_BYTES:
            raise GraspError("invalidResponse", "The GRASP response is larger than 1 MiB.")
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeError):
            payload = None
        if not 200 <= status < 300:
            raise request_error(status, payload.get("detail") if isinstance(payload, dict) else None)
        if not isinstance(payload, dict):
            raise GraspError("invalidResponse", "The endpoint did not return a GRASP JSON object. Check GRASP_API_URL.")
        return payload

    def doctor(self) -> JsonObject:
        health = self._json("GET", "/health")
        if health.get("status") != "ok":
            raise GraspError("apiDegraded", "GRASP reports degraded health. Check SQLite, Chroma and provider settings.")
        self.list_boards(limit=1)
        return {"status": "ok", "apiUrl": self.api_url, "health": health, "boardAccess": True}

    def list_boards(self, offset: int = 0, limit: int = 50) -> JsonObject:
        query = urlencode({"offset": offset, "limit": limit})
        return self._json("GET", f"/boards?{query}")

    def create_board(self, title: str) -> JsonObject:
        return self._json("POST", "/boards", {"title": title})

    def get_board(self, board_id: str) -> JsonObject:
        return self._json("GET", board_path(board_id))

    def get_selection(self, board_id: str) -> JsonObject:
        return self._json("GET", board_path(board_id) + "/selection")

    def apply(self, board_id: str, batch: JsonObject) -> JsonObject:
        return self._json("POST", board_path(board_id) + "/ops", batch)

    def annotations(self, board_id: str, author: str | None = None) -> JsonObject:
        board = self.get_board(board_id)
        objects = [item for item in board["objects"].values() if item["kind"] == "annotation" and (
            author is None or author in (item["createdBy"], item["updatedBy"])
        )]
        return {"boardId": board["id"], "revision": board["revision"], "annotations": objects}

    def requirements(self, board_id: str) -> JsonObject:
        board = self.get_board(board_id)
        objects = [item for item in board["objects"].values() if item["kind"] == "requirement"]
        return {"boardId": board["id"], "revision": board["revision"], "requirements": objects}

    def search(self, query: str, doc_ids: list[str], top_k: int) -> JsonObject:
        return self._json("POST", "/knowledge/search", {"query": query, "docIds": doc_ids, "topK": top_k}, timeout=25)

    def source(self, reference: JsonObject) -> JsonObject:
        return self._json("POST", "/knowledge/source", reference)
