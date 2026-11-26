import argparse
import json
import os
import sys
import webbrowser
from pathlib import Path

from .client import MAX_REQUEST_BYTES, GraspClient, GraspError, JsonObject, loopback_url, projects_url, web_board_url
from .setup import agent_checks, installed_agents, setup
from .workspace import api_address, connect, local_settings, settings_file, workspace_address


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
    installer = commands.add_parser("setup", help="Configure the workspace and install GRASP in supported agents.")
    installer.add_argument("--agent", choices=("all", "codex", "claude-code"), default="all")
    installer.add_argument("--replace-skill", action="store_true", help="Replace a customized GRASP skill.")
    commands.add_parser("doctor", help="Check the workspace, MCP registration and agent skill.")
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
    if args.command == "setup":
        return setup(args.agent, args.api_url, args.web_url, args.replace_skill)
    if args.command == "open":
        settings = local_settings()
        api_url = api_address(args.api_url, settings)
        web_base = workspace_address(api_url, args.web_url, settings)
        url = web_board_url(web_base, args.board_id) if args.board_id else projects_url(web_base)
        if args.print_url:
            return url
        if not webbrowser.open(url):
            raise GraspError("browserUnavailable", f"Open this URL in your browser: {url}")
        return None

    if args.command == "mcp":
        from .mcp_server import create_server
        create_server(lambda: connect(args.api_url, args.web_url)).run(transport="stdio")
        return None

    client = connect(args.api_url, args.web_url)
    match args.command:
        case "doctor":
            check = client.doctor()
            agents = agent_checks(installed_agents(), args.api_url, args.web_url)
            if check["browserStatus"] != "ready":
                check["hint"] = "Start the GRASP web workspace with python scripts/dev.py."
            if not agents or any(agent.get("registration") != "ready" or agent.get("skill") != "ready" for agent in agents):
                check["setupHint"] = "Run grasp setup for the installed coding agent."
            return {**check, "agents": agents}
        case "board":
            return board_command(args, client)
        case "search":
            return client.search(args.query, args.doc, args.top_k)
        case "source":
            return client.source(read_json(args.reference))
    raise AssertionError("Unknown command.")


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        result = run(args)
    except GraspError as error:
        print(json.dumps({"error": error.as_dict()}, ensure_ascii=True), file=sys.stderr)
        return 1
    if isinstance(result, dict):
        print(json.dumps(result, ensure_ascii=True, indent=2))
        if args.command == "setup" and result["status"] == "needsAttention":
            return 1
    elif result is not None:
        print(result)
    return 0
