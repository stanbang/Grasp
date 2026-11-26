import os
from pathlib import Path

from dotenv import dotenv_values

from .client import GraspClient, GraspError, loopback_url


def checkout() -> Path | None:
    return next((path for path in Path(__file__).resolve().parents if (path / "scripts/dev.py").is_file()), None)


def settings_file() -> Path:
    override = os.environ.get("GRASP_ENV_FILE")
    return Path(override).resolve() if override else (checkout() or Path.cwd()) / ".env"


def local_settings() -> dict[str, str | None]:
    try:
        return dotenv_values(settings_file(), encoding="utf-8-sig")
    except (OSError, UnicodeError) as error:
        raise GraspError("invalidSettings", "Could not read the local GRASP .env file as UTF-8.") from error


def api_address(override: str | None, settings: dict[str, str | None]) -> str:
    address = override or os.environ.get("GRASP_API_URL")
    port = os.environ.get("API_PORT", settings.get("API_PORT") or "8000")
    return loopback_url(address or f"http://127.0.0.1:{port}", allow_api_path=True)


def workspace_address(api_url: str, override: str | None, settings: dict[str, str | None]) -> str:
    port = os.environ.get("WEB_PORT", settings.get("WEB_PORT") or "5173")
    default = api_url.removesuffix("/api") if api_url.endswith("/api") else f"http://127.0.0.1:{port}"
    return loopback_url(override or os.environ.get("GRASP_WEB_URL") or default)


def connect(api_url: str | None, web_url: str | None = None) -> GraspClient:
    settings = local_settings()
    address = api_address(api_url, settings)
    token = os.environ.get("GRASP_AGENT_TOKEN", settings.get("GRASP_AGENT_TOKEN") or "")
    return GraspClient(address, token, workspace_address(address, web_url, settings))
