from dataclasses import dataclass
from threading import Lock
from time import monotonic

from .agent_contracts import BoardSelection

SELECTION_TTL_SECONDS = 25


@dataclass(frozen=True)
class ActiveSelection:
    board_id: str
    revision: int
    object_ids: tuple[str, ...]
    expires_at: float


class BoardSelections:
    def __init__(self) -> None:
        self._active: ActiveSelection | None = None
        self._lock = Lock()

    def publish(self, board_id: str, revision: int, object_ids: list[str]) -> BoardSelection:
        with self._lock:
            self._active = ActiveSelection(board_id, revision, tuple(object_ids), monotonic() + SELECTION_TTL_SECONDS)
        return BoardSelection(boardId=board_id, revision=revision, available=bool(object_ids), objectIds=object_ids)

    def read(self, board_id: str, revision: int) -> BoardSelection:
        with self._lock:
            active = self._active
            if active and active.expires_at <= monotonic():
                self._active = None
                active = None
            ids = active.object_ids if active and (active.board_id, active.revision) == (board_id, revision) else ()
        return BoardSelection(boardId=board_id, revision=revision, available=bool(ids), objectIds=list(ids))
