from typing import Annotated

from fastapi import APIRouter, Query, Request, Response
from sqlmodel import Session
from sqlalchemy import text

from .canvas_contracts import (
    BoardCommit, BoardConflictResponse, BoardList, CanvasBatch, CanvasObjectContext, CreateBoard, ProjectBoard,
)
from .canvas_service import board_row, commit_batch, create_board, list_boards, object_context, read_board, revision_row

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
        return object_context(session, state, object_id)


@router.post("/{board_id}/ops", responses={409: {"model": BoardConflictResponse}})
def operations(request: Request, board_id: str, batch: CanvasBatch) -> BoardCommit:
    with Session(request.app.state.storage.engine) as session:
        return commit_batch(session, board_id, batch, request.state.board_actor)
