from dataclasses import dataclass
from threading import Lock
from time import monotonic

from .agent_contracts import BoardContextSelection, BoardSelection

SELECTION_TTL_SECONDS = 25
SEQUENCE_TTL_SECONDS = 60


@dataclass(frozen=True)
class ActiveSelection:
    board_id: str
    revision: int
    object_ids: tuple[str, ...]
    connection_ids: tuple[str, ...]
    expires_at: float


@dataclass(frozen=True)
class TabPresence:
    sequence: int
    board_id: str | None
    revision: int
    object_ids: tuple[str, ...] | None
    connection_ids: tuple[str, ...]
    recorded_at: float


def context_selection(presence: tuple[TabPresence, ...], board_id: str, revision: int) -> BoardContextSelection:
    tabs = [tab for tab in presence if tab.board_id == board_id]
    if len(tabs) > 1:
        return BoardContextSelection(status="ambiguous", objectIds=[], connectionIds=[])
    if not tabs:
        return BoardContextSelection(status="unavailable", objectIds=[], connectionIds=[])
    tab = tabs[0]
    if tab.revision != revision:
        return BoardContextSelection(status="stale", objectIds=[], connectionIds=[])
    if tab.object_ids is None:
        return BoardContextSelection(status="unavailable", objectIds=[], connectionIds=[])
    return BoardContextSelection(
        status="selected" if tab.object_ids or tab.connection_ids else "empty",
        objectIds=list(tab.object_ids), connectionIds=list(tab.connection_ids),
    )


class BoardSelections:
    def __init__(self) -> None:
        self._active: ActiveSelection | None = None
        self._tabs: dict[str, TabPresence] = {}
        self._lock = Lock()

    def share(
        self, tab_id: str, sequence: int, board_id: str | None,
        revision: int = 0, object_ids: list[str] | None = None, connection_ids: tuple[str, ...] = (),
    ) -> None:
        with self._lock:
            now = self._prune()
            previous = self._tabs.get(tab_id)
            if previous is None or sequence > previous.sequence:
                self._tabs[tab_id] = TabPresence(
                    sequence, board_id, revision,
                    tuple(dict.fromkeys(object_ids)) if object_ids is not None else None,
                    tuple(dict.fromkeys(connection_ids)), now,
                )

    def _prune(self) -> float:
        now = monotonic()
        # Keep releases briefly so a late heartbeat cannot bring back a closed tab.
        self._tabs = {key: tab for key, tab in self._tabs.items() if now - tab.recorded_at < SEQUENCE_TTL_SECONDS}
        return now

    def active_tabs(self) -> tuple[TabPresence, ...]:
        with self._lock:
            now = self._prune()
            return tuple(
                tab for tab in self._tabs.values()
                if tab.board_id is not None and now - tab.recorded_at < SELECTION_TTL_SECONDS
            )

    def publish(self, board_id: str, revision: int, object_ids: list[str], connection_ids: list[str]) -> BoardSelection:
        with self._lock:
            self._active = ActiveSelection(
                board_id, revision, tuple(object_ids), tuple(connection_ids), monotonic() + SELECTION_TTL_SECONDS,
            )
        return BoardSelection(
            boardId=board_id, revision=revision, available=bool(object_ids or connection_ids),
            objectIds=object_ids, connectionIds=connection_ids,
        )

    def read(self, board_id: str, revision: int) -> BoardSelection:
        tabs = tuple(tab for tab in self.active_tabs() if tab.board_id == board_id)
        if tabs:
            selection = context_selection(tabs, board_id, revision)
            return BoardSelection(
                boardId=board_id, revision=revision, available=selection.status == "selected",
                objectIds=selection.objectIds, connectionIds=selection.connectionIds,
            )
        with self._lock:
            active = self._active
            if active and active.expires_at <= monotonic():
                self._active = None
                active = None
            if not active or (active.board_id, active.revision) != (board_id, revision):
                return BoardSelection(boardId=board_id, revision=revision, available=False, objectIds=[], connectionIds=[])
        return BoardSelection(
            boardId=board_id, revision=revision, available=bool(active.object_ids or active.connection_ids),
            objectIds=list(active.object_ids), connectionIds=list(active.connection_ids),
        )
