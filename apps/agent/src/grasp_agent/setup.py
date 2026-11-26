import json
import os
import secrets
import shutil
import subprocess
import sys
import tomllib
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path

from dotenv import set_key

from .client import GraspError, JsonObject, loopback_url
from .workspace import api_address, checkout, connect, local_settings, settings_file, workspace_address

SERVER_ARGS = ["-m", "grasp_agent", "mcp", "serve"]
SKILL = Path(__file__).with_name("skills") / "grasp-canvas" / "SKILL.md"
MANAGED_SKILL = "<!-- Installed by grasp setup. -->"
PHASE_31_SKILL = "71ed003648d9c15446fbd9c49e81cb2dec0f229f76f3279d1385da73ec070034"


@dataclass(frozen=True)
class Agent:
    name: str
    command: list[str]
    config: Path
    skills: Path

    def registration(self) -> JsonObject | None:
        try:
            data = self.config.read_text(encoding="utf-8-sig")
            if self.name == "codex":
                servers = tomllib.loads(data).get("mcp_servers", {})
            else:
                servers = json.loads(data).get("mcpServers", {})
            entry = servers.get("grasp")
            if entry is not None and not isinstance(entry, dict):
                raise ValueError("Invalid GRASP registration")
            return entry
        except FileNotFoundError:
            return None
        except (OSError, ValueError, AttributeError) as error:
            raise GraspError("invalidAgentConfig", f"Check the {self.name} settings file at {self.config}.") from error

    def register(self, env: dict[str, str]) -> None:
        env_options = [item for name, value in env.items() for item in ("--env", f"{name}={value}")]
        scope = [] if self.name == "codex" else ["--scope", "user", "--transport", "stdio"]
        command = [*self.command, "mcp", "add", *env_options, *scope, "grasp", "--", sys.executable, *SERVER_ARGS]
        try:
            run = subprocess.run(command, cwd=Path.home(), capture_output=True, timeout=30)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise GraspError("registrationFailed", f"Could not run {self.name} to register GRASP. Check its installation.") from error
        if run.returncode != 0:
            raise GraspError(
                "registrationFailed", f"{self.name} could not save GRASP. Check its MCP settings and workspace policy.",
            )


def installed_agents() -> list[Agent]:
    home = Path.home()
    codex_home = Path(os.environ.get("CODEX_HOME") or home / ".codex")
    claude_home = Path(os.environ.get("CLAUDE_CONFIG_DIR") or home / ".claude")
    agents = []
    codex = shutil.which("codex.exe") or shutil.which("codex")
    if codex:
        command = [codex]
        if Path(codex).suffix.lower() == ".cmd":
            npm_entry = Path(codex).parent / "node_modules/@openai/codex/bin/codex.js"
            node = shutil.which("node")
            if node and npm_entry.is_file():
                command = [node, str(npm_entry)]
        agents.append(Agent("codex", command, codex_home / "config.toml", home / ".agents/skills"))
    claude = shutil.which("claude")
    if claude:
        config = claude_home / ".claude.json" if os.environ.get("CLAUDE_CONFIG_DIR") else home / ".claude.json"
        agents.append(Agent("claude-code", [claude], config, claude_home / "skills"))
    return agents


def configure_workspace() -> bool:
    path = settings_file()
    try:
        if not path.exists():
            root = checkout()
            template = root / ".env.example" if root else None
            initial = template.read_text(encoding="utf-8") if template and template.is_file() else ""
            with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w", encoding="utf-8") as output:
                output.write(initial)
        values = local_settings()
        tokens = {key: values.get(key) or "" for key in ("ACCESS_TOKEN", "GRASP_AGENT_TOKEN")}
        owner, agent = tokens.values()
        if owner and owner == agent:
            raise GraspError("sharedToken", "Use distinct ACCESS_TOKEN and GRASP_AGENT_TOKEN values in the GRASP .env.")
        for key, token in tokens.items():
            if key in os.environ and os.environ[key] != token:
                raise GraspError("credentialOverride", f"Clear the process override for {key} or configure it in the GRASP .env.")
        missing = [key for key, token in tokens.items() if not token]
        for key in missing:
            set_key(path, key, secrets.token_urlsafe(32), encoding="utf-8")
        return bool(missing)
    except OSError as error:
        raise GraspError("invalidSettings", f"Could not configure {path}. Check that its directory is writable.") from error


def skill_status(agent: Agent, *, install: bool, replace: bool) -> str:
    destination = agent.skills / "grasp-canvas" / "SKILL.md"
    try:
        source = SKILL.read_text(encoding="utf-8")
        previous = destination.read_text(encoding="utf-8-sig") if destination.exists() else None
        if previous == source:
            return "ready"
        if not install:
            return "missing" if previous is None else "different"
        managed = previous and (
            MANAGED_SKILL in previous.splitlines() or sha256(previous.encode()).hexdigest() == PHASE_31_SKILL
        )
        if previous is not None and not (managed or replace):
            raise GraspError("skillConflict", f"Review the existing skill at {destination} or rerun setup with --replace-skill.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(source, encoding="utf-8", newline="\n")
        if destination.read_text(encoding="utf-8") != source:
            raise GraspError("skillInstallFailed", f"Verify the GRASP skill at {destination}.")
        return "installed"
    except (OSError, UnicodeError) as error:
        raise GraspError("skillInstallFailed", f"Check the GRASP skill file at {destination}.") from error


def registration_matches(
    entry: JsonObject, env: dict[str, str], api: str, web: str, settings: dict[str, str | None],
) -> bool:
    command = entry.get("command")
    configured = entry.get("env")
    if not isinstance(command, str) or not isinstance(configured, dict):
        return False
    default_api = f"http://127.0.0.1:{settings.get('API_PORT') or '8000'}"
    try:
        registered_api = loopback_url(configured.get("GRASP_API_URL") or default_api, allow_api_path=True)
        default_web = (
            registered_api.removesuffix("/api") if registered_api.endswith("/api")
            else f"http://127.0.0.1:{settings.get('WEB_PORT') or '5173'}"
        )
        registered_web = loopback_url(configured.get("GRASP_WEB_URL") or default_web)
    except (GraspError, AttributeError, TypeError):
        return False
    return (
        Path(command).resolve() == Path(sys.executable).resolve()
        and entry.get("args") == SERVER_ARGS
        and entry.get("enabled") is not False
        and isinstance(configured.get("GRASP_ENV_FILE"), str)
        and Path(configured["GRASP_ENV_FILE"]).resolve() == Path(env["GRASP_ENV_FILE"])
        and registered_api == api
        and registered_web == web
        and "GRASP_AGENT_TOKEN" not in configured
    )


def agent_checks(
    agents: list[Agent], api_override: str | None, web_override: str | None,
    *, install: bool = False, replace_skill: bool = False,
) -> list[JsonObject]:
    settings = local_settings()
    api = api_address(api_override, settings)
    web = workspace_address(api, web_override, settings)
    env = {"GRASP_ENV_FILE": str(settings_file())}
    if api_override or os.environ.get("GRASP_API_URL") or os.environ.get("API_PORT"):
        env["GRASP_API_URL"] = api
    if web_override or os.environ.get("GRASP_WEB_URL") or os.environ.get("WEB_PORT"):
        env["GRASP_WEB_URL"] = web

    results = []
    for agent in agents:
        try:
            entry = agent.registration()
            if install and entry is None:
                agent.register(env)
                entry = agent.registration()
                if entry is None:
                    raise GraspError("registrationFailed", f"{agent.name} did not save the user-level GRASP registration.")
            if entry is not None and not registration_matches(entry, env, api, web, settings):
                raise GraspError(
                    "registrationConflict",
                    f"Review the GRASP command, settings file and URLs in {agent.config}. "
                    "If the entry is obsolete, remove only the grasp server from that client and rerun setup.",
                )
            skill = skill_status(agent, install=install, replace=replace_skill)
            results.append({"agent": agent.name, "registration": "ready" if entry else "missing", "skill": skill})
        except GraspError as error:
            results.append({"agent": agent.name, "error": error.as_dict()})
    return results


def setup(agent_name: str, api_url: str | None, web_url: str | None, replace_skill: bool) -> JsonObject:
    agents = [agent for agent in installed_agents() if agent_name in ("all", agent.name)]
    if not agents:
        raise GraspError("noCodingAgent", "Install Codex or Claude Code and make its command available on PATH.")
    settings = local_settings()
    workspace_address(api_address(api_url, settings), web_url, settings)
    changed = configure_workspace()
    checks = agent_checks(agents, api_url, web_url, install=True, replace_skill=replace_skill)
    result: JsonObject = {
        "status": "needsAttention" if any("error" in check for check in checks) else "configured",
        "settingsFile": str(settings_file()), "agents": checks,
    }
    try:
        client = connect(api_url, web_url)
        result["service"] = client.doctor()
    except GraspError as error:
        result["service"] = error.as_dict()
    if result["status"] == "needsAttention":
        result["next"] = "Resolve the reported agent settings issue, then run grasp setup again."
    elif changed or result["service"].get("browserStatus") != "ready":
        result["next"] = "Start or restart GRASP with python scripts/dev.py, then run grasp doctor."
    else:
        result["next"] = "Open a fresh local agent conversation and ask to work visually in GRASP."
    return result
