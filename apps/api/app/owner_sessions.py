import hmac
import re
import secrets
import time

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlmodel import Field as Column, Session, SQLModel

SESSION_PATH = "/owner-session"
SESSION_AGE = 30 * 24 * 60 * 60
router = APIRouter()


class OwnerSession(SQLModel, table=True):
    __tablename__ = "owner_browser_sessions"

    digest: str = Column(primary_key=True)
    origin: str
    expires_at: float


class UnlockWorkspace(BaseModel):
    token: str = Field(min_length=1, max_length=4096)


def workspace_origin(request: Request) -> str | None:
    url = request.url
    if url.scheme == "https" or (url.scheme == "http" and url.hostname in {"127.0.0.1", "localhost", "::1"}):
        return f"{url.scheme}://{url.netloc}"
    return None


def cookie_name(request: Request) -> str:
    # Cookies are otherwise shared by all ports on the same host.
    return f"grasp-owner-{request.url.port or (443 if request.url.scheme == 'https' else 80)}"


def session_digest(request: Request, secret: str) -> str | None:
    cookie = request.cookies.get(cookie_name(request), "")
    if re.fullmatch(r"[A-Za-z0-9_-]{43}", cookie):
        return hmac.digest(secret.encode(), cookie.encode(), "sha256").hex()
    return None


def browser_owner(request: Request) -> bool:
    storage = request.app.state.storage
    token = storage.settings.access_token
    origin = workspace_origin(request)
    if not token or not origin:
        return False
    key = session_digest(request, token)
    if not key:
        return False
    with Session(storage.engine) as session:
        entry = session.get(OwnerSession, key)
        return bool(entry and entry.origin == origin and entry.expires_at > time.time())


def require_same_origin(request: Request) -> str:
    origin = workspace_origin(request)
    if not origin or request.headers.get("origin") != origin:
        raise HTTPException(403, "Open GRASP from its workspace address.")
    return origin


@router.get(SESSION_PATH)
def owner_session_status(request: Request) -> dict[str, bool]:
    return {"required": bool(request.app.state.storage.settings.access_token)}


@router.post(SESSION_PATH, status_code=204)
def unlock_workspace(request: Request, payload: UnlockWorkspace, response: Response) -> None:
    origin = require_same_origin(request)
    storage = request.app.state.storage
    token = storage.settings.access_token
    if not token or not hmac.compare_digest(token.encode(), payload.token.encode()):
        raise HTTPException(401, "Enter the workspace owner token.")
    cookie = secrets.token_urlsafe(32)
    now = time.time()
    key = hmac.digest(token.encode(), cookie.encode(), "sha256").hex()
    with Session(storage.engine) as session:
        previous = session_digest(request, token)
        session.execute(delete(OwnerSession).where(
            (OwnerSession.expires_at <= now) | (OwnerSession.digest == previous),
        ))
        session.add(OwnerSession(digest=key, origin=origin, expires_at=now + SESSION_AGE))
        session.commit()
    response.set_cookie(cookie_name(request), cookie, max_age=SESSION_AGE, path="/api",
                        httponly=True, samesite="strict", secure=request.url.scheme == "https")


@router.delete(SESSION_PATH, status_code=204)
def logout_workspace(request: Request, response: Response, all_sessions: bool = Query(False, alias="all")) -> None:
    require_same_origin(request)
    storage = request.app.state.storage
    with Session(storage.engine) as session:
        key = session_digest(request, storage.settings.access_token)
        if all_sessions:
            if not browser_owner(request):
                raise HTTPException(401, "Unlock the workspace to revoke all browser sessions.")
            session.execute(delete(OwnerSession))
        elif key:
            session.execute(delete(OwnerSession).where(OwnerSession.digest == key))
        session.commit()
    response.delete_cookie(cookie_name(request), path="/api", httponly=True, samesite="strict",
                           secure=request.url.scheme == "https")
