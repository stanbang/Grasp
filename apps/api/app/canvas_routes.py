from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, Response
from sqlmodel import Session
from sqlalchemy import text

from .agent_contracts import BoardContext, BoardPresenceUpdate, BoardSelection, BoardSelectionUpdate
from .board_context import read_board_context
from .canvas_contracts import (
    BoardCommit, BoardConflictResponse, BoardList, CanvasBatch, CanvasId, CanvasObjectContext, CreateBoard, ProjectBoard,
)
from .canvas_service import board_row, commit_batch, conflict, create_board, list_boards, object_context, read_board, revision_row
from .request_controls import agent_source_scope

router = APIRouter(prefix="/boards", tags=["project boards"])


@router.get("")
def boards(
    request: Request, offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> BoardList:
    with Session(request.app.state.storage.engine) as session:
        return list_boards(session, offset, limit)


@router.post("", status_code=201)
def new_board(request: Request, payload: CreateBoard) -> ProjectBoard:
    with Session(request.app.state.storage.engine) as session:
        return create_board(session, payload.title, request.state.board_actor)


@router.get("/context")
def board_context(
    request: Request, boardId: CanvasId | None = None, sinceRevision: Annotated[int | None, Query(ge=0)] = None,
) -> BoardContext:
    with Session(request.app.state.storage.engine) as session:
        session.execute(text("BEGIN"))
        return read_board_context(session, request.app.state.board_selections.active_tabs(), boardId, sinceRevision)


@router.delete("/active/{tab_id}", status_code=204)
def release_active_board(request: Request, tab_id: CanvasId, sequence: Annotated[int, Query(ge=0)]) -> Response:
    require_selection_owner(request)
    request.app.state.board_selections.share(tab_id, sequence, None)
    return Response(status_code=204)


@router.get("/{board_id}", response_model=ProjectBoard, responses={204: {"description": "Revision unchanged"}})
def board(
    request: Request, board_id: str, afterRevision: Annotated[int | None, Query(ge=0)] = None,
) -> ProjectBoard | Response:
    with Session(request.app.state.storage.engine) as session:
        state = read_board(session, board_id, afterRevision)
        return state if state else Response(status_code=204)


@router.get("/{board_id}/revisions/{revision}")
def board_revision(request: Request, board_id: str, revision: int) -> ProjectBoard:
    with Session(request.app.state.storage.engine) as session:
        board_row(session, board_id)
        return ProjectBoard.model_validate_json(revision_row(session, board_id, revision).snapshot)


@router.get("/{board_id}/objects/{object_id}/context")
def context(request: Request, board_id: str, object_id: str) -> CanvasObjectContext:
    with Session(request.app.state.storage.engine) as session:
        session.execute(text("BEGIN"))
        state = read_board(session, board_id)
        assert state is not None
        return object_context(session, state, object_id, agent_source_scope(request))


@router.post("/{board_id}/ops", responses={409: {"model": BoardConflictResponse}})
def operations(request: Request, board_id: str, batch: CanvasBatch) -> BoardCommit:
    storage = request.app.state.storage
    with Session(storage.engine) as session:
        return commit_batch(session, board_id, batch, request.state.board_actor, agent_source_scope(request))


@router.get("/{board_id}/selection")
def selection(request: Request, board_id: str) -> BoardSelection:
    with Session(request.app.state.storage.engine) as session:
        revision = board_row(session, board_id).revision
    return request.app.state.board_selections.read(board_id, revision)


@router.put("/{board_id}/selection", responses={409: {"model": BoardConflictResponse}})
def publish_selection(request: Request, board_id: str, payload: BoardSelectionUpdate) -> BoardSelection:
    verify_selection(request, board_id, payload.baseRevision, payload.objectIds)
    return request.app.state.board_selections.publish(
        board_id, payload.baseRevision, list(dict.fromkeys(payload.objectIds)),
    )


@router.put("/{board_id}/presence", status_code=204, responses={409: {"model": BoardConflictResponse}})
def share_active_board(request: Request, board_id: CanvasId, payload: BoardPresenceUpdate) -> Response:
    verify_selection(request, board_id, payload.baseRevision, payload.objectIds or [])
    request.app.state.board_selections.share(
        payload.tabId, payload.sequence, board_id, payload.baseRevision, payload.objectIds,
    )
    return Response(status_code=204)


def require_selection_owner(request: Request) -> None:
    if request.state.board_actor != "user":
        raise HTTPException(403, "Only the workspace owner can share a browser selection.")


def verify_selection(request: Request, board_id: str, revision: int, object_ids: list[str]) -> None:
    require_selection_owner(request)
    with Session(request.app.state.storage.engine) as session:
        state = read_board(session, board_id)
        assert state is not None
        if state.revision != revision:
            conflict("staleRevision", "The board changed before this selection was shared.", state.revision)
        if not set(object_ids).issubset(state.objects):
            raise HTTPException(422, "Select objects on the current board.")
