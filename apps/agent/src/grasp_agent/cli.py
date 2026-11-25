import argparse
import json
import os
import sys
import webbrowser
from pathlib import Path

from dotenv import dotenv_values

from .client import MAX_REQUEST_BYTES, GraspClient, GraspError, JsonObject
from .client import loopback_url, web_board_url


def read_json(source: str) -> JsonObject:
    try:
        if source == "-":
            data = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
        else:
            with Path(source).open("rb") as stream:
                data = stream.read(MAX_REQUEST_BYTES + 1)
        if len(data) > MAX_REQUEST_BYTES:
            raise GraspError("batchTooLarge", "The JSON input must fit in 64 KiB.")
        value = json.loads(data.decode("utf-8-sig"))
    except OSError as error:
        raise GraspError("unreadableInput", "Could not read the JSON file or standard input.") from error
    except ValueError as error:
        raise GraspError("invalidJson", "Supply a valid UTF-8 JSON object.") from error
    if not isinstance(value, dict):
        raise GraspError("invalidJson", "Supply a JSON object.")
    return value


def settings_file() -> Path:
    return Path(os.environ.get("GRASP_ENV_FILE") or ".env").resolve()


def local_settings() -> dict[str, str | None]:
    try:
        return dotenv_values(settings_file(), encoding="utf-8-sig")
    except (OSError, UnicodeError) as error:
        raise GraspError("invalidSettings", "Could not read the local GRASP .env file as UTF-8.") from error


def api_address(override: str | None, settings: dict[str, str | None]) -> str:
    address = override or os.environ.get("GRASP_API_URL")
    port = os.environ.get("API_PORT", settings.get("API_PORT") or "8000")
    return loopback_url(address or f"http://127.0.0.1:{port}", allow_api_path=True)


def connect(api_url: str | None) -> GraspClient:
    settings = local_settings()
    token = os.environ.get("GRASP_AGENT_TOKEN", settings.get("GRASP_AGENT_TOKEN") or "")
    return GraspClient(api_address(api_url, settings), token)


def codex_config(api_url: str | None) -> str:
    def quote(value: str) -> str:
        return json.dumps(value, ensure_ascii=False)
    forwarded = ["GRASP_AGENT_TOKEN", "GRASP_API_URL"] if api_url is None else ["GRASP_AGENT_TOKEN"]
    address = f"\nGRASP_API_URL = {quote(loopback_url(api_url, allow_api_path=True))}" if api_url else ""
    return (
        "[mcp_servers.grasp]\n"
        f"command = {quote(str(Path(sys.executable).resolve()))}\n"
        'args = ["-m", "grasp_agent", "mcp", "serve"]\n'
        f"cwd = {quote(str(Path.cwd()))}\n"
        f"env_vars = {json.dumps(forwarded)}\n"
        "tool_timeout_sec = 40\n\n"
        "[mcp_servers.grasp.env]\n"
        f"GRASP_ENV_FILE = {quote(str(settings_file()))}{address}"
    )


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="grasp", description="Work with a running local GRASP workspace.")
    root.add_argument("--api-url")
    root.add_argument("--web-url", default=os.environ.get("GRASP_WEB_URL"))
    commands = root.add_subparsers(dest="command", required=True)

    commands.add_parser("init", help="Print the Codex MCP configuration for this installation.")
    commands.add_parser("doctor", help="Check the API and agent credential.")
    opener = commands.add_parser("open", help="Open the workspace or a project board in your browser.")
    opener.add_argument("board_id", nargs="?")
    opener.add_argument("--print-url", action="store_true", help="Print the URL instead of opening it.")

    boards = commands.add_parser("board", help="Read and change project boards.").add_subparsers(dest="board_command", required=True)
    listing = boards.add_parser("list", help="List a page of board summaries.")
    listing.add_argument("--offset", type=int, default=0)
    listing.add_argument("--limit", type=int, default=50)
    boards.add_parser("create", help="Create a board.").add_argument("title")
    boards.add_parser("read", help="Read the saved board.").add_argument("board_id")
    apply = boards.add_parser("apply", help="Submit a CanvasBatch from a JSON file or '-'.")
    apply.add_argument("board_id")
    apply.add_argument("batch")

    search = commands.add_parser("search", help="Search explicitly shared indexed documents.")
    search.add_argument("query")
    search.add_argument("--doc", action="append", default=[], metavar="DOCUMENT_ID")
    search.add_argument("--top-k", type=int, default=5)
    commands.add_parser("source", help="Read a source reference from a JSON file or '-'.").add_argument("reference")
    mcp = commands.add_parser("mcp", help="Run the GRASP MCP adapter.")
    mcp.add_subparsers(dest="mcp_command", required=True).add_parser("serve", help="Run over stdio.")
    return root


def board_command(args: argparse.Namespace, client: GraspClient) -> JsonObject:
    match args.board_command:
        case "list":
            return client.list_boards(args.offset, args.limit)
        case "create":
            return client.create_board(args.title)
        case "read":
            return client.get_board(args.board_id)
        case "apply":
            return client.apply(args.board_id, read_json(args.batch))
    raise AssertionError("Unknown board command.")


def run(args: argparse.Namespace) -> JsonObject | str | None:
    if args.command == "init":
        return codex_config(args.api_url)
    if args.command == "open":
        settings = local_settings()
        api_url = api_address(args.api_url, settings)
        web_port = os.environ.get("WEB_PORT", settings.get("WEB_PORT") or "5173")
        web_base = args.web_url or (api_url.removesuffix("/api") if api_url.endswith("/api") else f"http://127.0.0.1:{web_port}")
        url = web_board_url(web_base, args.board_id)
        if args.print_url:
            return url
        if not webbrowser.open(url):
            raise GraspError("browserUnavailable", f"Open this URL in your browser: {url}")
        return None

    if args.command == "mcp":
        from .mcp_server import create_server
        create_server(lambda: connect(args.api_url)).run(transport="stdio")
        return None

    client = connect(args.api_url)
    match args.command:
        case "doctor":
            return client.doctor()
        case "board":
            return board_command(args, client)
        case "search":
            return client.search(args.query, args.doc, args.top_k)
        case "source":
            return client.source(read_json(args.reference))
    raise AssertionError("Unknown command.")


def main(argv: list[str] | None = None) -> int:
    try:
        result = run(parser().parse_args(argv))
    except GraspError as error:
        print(json.dumps({"error": error.as_dict()}, ensure_ascii=True), file=sys.stderr)
        return 1
    if isinstance(result, dict):
        print(json.dumps(result, ensure_ascii=True, indent=2))
    elif result is not None:
        print(result)
    return 0
