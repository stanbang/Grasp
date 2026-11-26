import json
import os
from pathlib import Path
import socket
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
import tomllib
import unittest
from uuid import uuid4

from mcp.client import Client
from mcp.client.stdio import StdioServerParameters

from grasp_agent.client import GraspClient, GraspError, loopback_url

ROOT = Path(__file__).resolve().parents[3]
OWNER = "protocol-test-owner"
AGENT = "protocol-test-agent"
WEB = "http://127.0.0.1:5179"
TOOLS = {
    "list_boards", "create_board", "get_board", "get_board_context", "get_selection", "apply_canvas_operations",
    "get_annotations", "get_requirements", "search_knowledge", "read_source",
}
OBJECT = {
    "id": "note", "kind": "annotation", "title": "Useful note",
    "placement": {"x": 0, "y": 30, "width": 220, "height": 100},
}


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


class ProtocolTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        work = ROOT / "work"
        work.mkdir(exist_ok=True)
        directory = TemporaryDirectory(prefix="phase3-protocol-", dir=work)
        cls.addClassCleanup(directory.cleanup)
        python = ROOT / (".venv/Scripts/python.exe" if os.name == "nt" else ".venv/bin/python")
        port = free_port()
        cls.base = f"http://127.0.0.1:{port}"
        cls.settings = Path(directory.name) / ".env"
        cls.settings.write_text(f"API_PORT={port}\nGRASP_AGENT_TOKEN={AGENT}\n", encoding="utf-8")
        cls.agent_env = {
            "GRASP_API_URL": cls.base, "GRASP_AGENT_TOKEN": AGENT,
            "GRASP_ENV_FILE": str(cls.settings), "GRASP_WEB_URL": WEB,
        }
        log = Path(directory.name) / "api.log"
        with log.open("wb") as output:
            process = subprocess.Popen([
                str(python), "-m", "uvicorn", "app.main:app", "--app-dir", "apps/api",
                "--host", "127.0.0.1", "--port", str(port),
            ], cwd=ROOT, stderr=output, stdout=output, env={
                **os.environ, "DATA_DIR": directory.name, "MOCK_LLM": "1", "ACCESS_TOKEN": OWNER,
                "GRASP_AGENT_TOKEN": AGENT, "GRASP_AGENT_SOURCE_DOC_IDS": "",
            })
        cls.addClassCleanup(cls.stop_api, process)
        deadline = time.monotonic() + 15
        while process.poll() is None and time.monotonic() < deadline:
            try:
                GraspClient(cls.base, AGENT).doctor()
                break
            except GraspError:
                time.sleep(.2)
        else:
            raise RuntimeError(f"The protocol fixture API did not start.\n{log.read_text()}")

    @staticmethod
    def stop_api(process):
        if process.poll() is not None:
            return
        if os.name == "nt":
            subprocess.run(["taskkill", "/t", "/f", "/pid", str(process.pid)], capture_output=True, check=False)
        else:
            process.terminate()
        process.wait(timeout=8)

    def connect(self, base: str | None = None, *, settings: Path | None = None):
        transport = StdioServerParameters(
            command=sys.executable, args=["-m", "grasp_agent", "mcp", "serve"],
            env={"GRASP_ENV_FILE": str(settings)} if settings else {**self.agent_env, "GRASP_API_URL": base or self.base},
        )
        return Client(transport, mode="legacy", read_timeout_seconds=8)

    def cli(self, *arguments, input=None):
        return subprocess.run([sys.executable, "-m", "grasp_agent", *arguments], input=input,
                              env={**os.environ, **self.agent_env}, capture_output=True, text=True, timeout=10)

    async def test_stdio_discovery_mutation_replay_and_validation(self):
        async with self.connect() as client:
            listed = await client.list_tools()
            self.assertEqual({tool.name for tool in listed.tools}, TOOLS)
            created = await client.call_tool("create_board", {"title": "Protocol check"})
            self.assertFalse(created.is_error, created.content)
            board_id = created.structured_content["id"]
            requirement = {
                **OBJECT, "id": "requirement", "kind": "requirement", "title": "Editable captions",
                "requirement": {"status": "proposed", "acceptanceCriteria": ["Captions can be edited"]},
            }
            arguments = {
                "board_id": board_id, "base_revision": 0, "mutation_id": uuid4().hex,
                "operations": [{"type": "addObject", "object": item} for item in (OBJECT, requirement)],
            }
            invalid = await client.call_tool("apply_canvas_operations", {
                **arguments, "operations": [{"type": "unrecognizedOperation"}],
            })
            self.assertTrue(invalid.is_error)
            self.assertEqual(invalid.structured_content["error"]["code"], "invalidRequest")
            applied = await client.call_tool("apply_canvas_operations", arguments)
            self.assertFalse(applied.is_error, applied.content)
            self.assertEqual(applied.structured_content["revision"], 1)
            self.assertEqual(applied.structured_content["actor"], "agent")
            replay = await client.call_tool("apply_canvas_operations", arguments)
            self.assertEqual(replay.structured_content, applied.structured_content)
            stale = await client.call_tool("apply_canvas_operations", {**arguments, "mutation_id": uuid4().hex})
            self.assertTrue(stale.is_error)
            self.assertEqual(stale.structured_content["error"]["currentRevision"], 1)
            self.assertEqual(stale.structured_content["error"]["code"], "staleRevision")
            current = await client.call_tool("get_board", {"board_id": board_id})
            self.assertEqual(current.structured_content, applied.structured_content["board"])
            automatic = await client.call_tool("get_board_context", {})
            self.assertEqual(automatic.structured_content["status"], "noActiveBoard")
            self.assertEqual(automatic.structured_content["workspaceUrl"], f"{WEB}/?board=project")
            self.assertIsNone(automatic.structured_content["boardUrl"])
            context = await client.call_tool("get_board_context", {"board_id": board_id, "since_revision": 0})
            self.assertFalse(context.is_error, context.content)
            self.assertEqual(context.structured_content["board"], current.structured_content)
            self.assertEqual(context.structured_content["annotationIds"], ["note"])
            self.assertEqual(context.structured_content["requirementIds"], ["requirement"])
            self.assertEqual(context.structured_content["changes"]["revisions"][0]["actor"], "agent")
            self.assertEqual(
                context.structured_content["boardUrl"], f"{WEB}/?board=project&projectBoard={board_id}",
            )
            annotation = await client.call_tool("get_annotations", {"board_id": board_id, "author": "agent"})
            self.assertEqual(annotation.structured_content["annotations"][0]["title"], OBJECT["title"])
            requirements = await client.call_tool("get_requirements", {"board_id": board_id})
            self.assertEqual(requirements.structured_content["requirements"][0]["requirement"], requirement["requirement"])
            selection = await client.call_tool("get_selection", {"board_id": board_id})
            self.assertFalse(selection.structured_content["available"])
            empty = await client.call_tool("search_knowledge", {"query": "captions", "doc_ids": []})
            self.assertEqual(empty.structured_content, {"mode": "mock", "results": []})

    async def test_stdio_lists_tools_when_api_is_unavailable(self):
        async with self.connect(f"http://127.0.0.1:{free_port()}") as client:
            self.assertIn("list_boards", {tool.name for tool in (await client.list_tools()).tools})
            result = await client.call_tool("list_boards")
            self.assertTrue(result.is_error)
            self.assertEqual(result.structured_content["error"]["code"], "serviceUnavailable")

    async def test_stdio_uses_project_dotenv_without_shell_exports(self):
        async with self.connect(settings=self.settings) as client:
            self.assertEqual({tool.name for tool in (await client.list_tools()).tools}, TOOLS)
            response = await client.call_tool("list_boards")
            self.assertFalse(response.is_error, response.content)
            self.assertIn("boards", response.structured_content)

    async def test_missing_token_is_a_tool_error_instead_of_failed_initialization(self):
        async with self.connect(settings=self.settings.with_name("missing.env")) as client:
            self.assertEqual({tool.name for tool in (await client.list_tools()).tools}, TOOLS)
            response = await client.call_tool("list_boards")
            self.assertTrue(response.is_error)
            self.assertEqual(response.structured_content["error"]["code"], "missingToken")

    def test_cli_configuration_and_round_trip(self):
        configured = self.cli("init")
        self.assertEqual(configured.returncode, 0, configured.stderr)
        config = tomllib.loads(configured.stdout)["mcp_servers"]["grasp"]
        self.assertEqual(config["env_vars"], ["GRASP_AGENT_TOKEN", "GRASP_API_URL"])
        self.assertEqual(config["env"], {"GRASP_ENV_FILE": str(self.settings)})
        self.assertNotIn(AGENT, configured.stdout)
        pinned = self.cli("--api-url", self.base + "/api", "init")
        self.assertEqual(pinned.returncode, 0, pinned.stderr)
        table = tomllib.loads(pinned.stdout)["mcp_servers"]["grasp"]
        self.assertEqual(table["env"]["GRASP_API_URL"], self.base + "/api")
        self.assertEqual(table["env_vars"], ["GRASP_AGENT_TOKEN"])
        self.assertEqual(json.loads(self.cli("doctor").stdout)["status"], "ok")
        board = json.loads(self.cli("board", "create", "CLI check").stdout)
        self.assertEqual(json.loads(self.cli("board", "read", board["id"]).stdout), board)
        url = self.cli("open", board["id"], "--print-url")
        self.assertTrue(url.stdout.strip().endswith(f"projectBoard={board['id']}"))
        malformed = self.cli("board", "apply", board["id"], "-", input="{bad")
        self.assertEqual(malformed.returncode, 1)
        self.assertEqual(json.loads(malformed.stderr)["error"]["code"], "invalidJson")
        batch = {"baseRevision": 0, "mutationId": uuid4().hex, "operations": [{"type": "addObject", "object": OBJECT}]}
        written = self.cli("board", "apply", board["id"], "-", input=json.dumps(batch))
        self.assertEqual(written.returncode, 0, written.stderr)
        self.assertEqual(json.loads(written.stdout)["revision"], 1)
        self.assertEqual(json.loads(self.cli("search", "captions").stdout)["results"], [])


class LocalUrlTests(unittest.TestCase):
    def test_untrusted_urls_are_rejected(self):
        for url in ("https://127.0.0.1:8000", "http://192.0.2.1", "http://127.0.0.1:8000/private",
                    "http://127.0.0.1.example.org", "http://token@127.0.0.1", "http://127.0.0.1:8000/?token=one"):
            with self.subTest(url=url), self.assertRaises(GraspError):
                loopback_url(url, allow_api_path=True)
