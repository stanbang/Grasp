from collections import defaultdict, deque
from math import ceil, hypot, sqrt
from textwrap import TextWrapper
from unicodedata import east_asian_width

from fastapi import HTTPException
from pydantic import ValidationError

from .canvas_contracts import CanvasObject, CanvasPlacement, ProjectBoard
from .canvas_expansion import overlaps

GAP = 64
HEADER = 66


def lines(text: str, columns: int) -> int:
    wrapper = TextWrapper(width=columns)
    total = 0
    for paragraph in text.splitlines():
        expanded = "".join(char * (2 if east_asian_width(char) in ("F", "W") else 1) for char in paragraph)
        total += max(1, len(wrapper.wrap(expanded)))
    return total


def object_height(item: CanvasObject, width: float) -> float:
    note = item.kind == "annotation"
    title_columns = max(8, int((width - 34) / (13 if note else 9)))
    detail_columns = max(8, int((width - 34) / (12 if note else 7.7)))
    art = 65 if item.kind == "illustration" else 0
    decision = 20 if item.kind in ("requirement", "question") else 0
    detail_lines = lines(item.description, detail_columns) if item.description != item.title else 0
    return min(370, max(58, 34 + lines(item.title, title_columns) * (27 if note else 21)
                        + detail_lines * (24 if note else 18) + art + decision))


def size_new(item: CanvasObject) -> None:
    width = min(352, max(188, 166 + len(item.title) * 2, 188 + sqrt(len(item.description)) * 7))
    item.placement = item.placement.model_copy(update={"width": ceil(width), "height": object_height(item, width)})
    item.sizing = "auto"


def flow_order(ids: list[str], pairs: list[tuple[str, str]]) -> list[str]:
    incoming = dict.fromkeys(ids, 0)
    next_items = defaultdict(list)
    for source, target in pairs:
        if source in incoming and target in incoming and source != target:
            next_items[source].append(target)
            incoming[target] += 1
    pending = deque(key for key in ids if incoming[key] == 0)
    ordered = []
    while pending:
        key = pending.popleft()
        ordered.append(key)
        for target in next_items[key]:
            incoming[target] -= 1
            if incoming[target] == 0:
                pending.append(target)
    return ordered + [key for key in ids if incoming[key] > 0]


def arrange_grid(
    items: list[CanvasObject], left: float, top: float, columns: int,
) -> tuple[float, float]:
    bottom = top
    right = left
    for start in range(0, len(items), columns):
        row = items[start:start + columns]
        x = left
        row_bottom = bottom
        for item in row:
            item.placement = item.placement.model_copy(update={"x": x, "y": bottom})
            x += item.placement.width + GAP
            row_bottom = max(row_bottom, bottom + item.placement.height)
        right = max(right, x - GAP)
        bottom = row_bottom + GAP
    return right, bottom - GAP


def near(
    item: CanvasObject, anchor: CanvasPlacement, occupied: list[CanvasObject], group: CanvasObject | None,
) -> CanvasPlacement:
    size = item.placement
    target_x, target_y = anchor.x + anchor.width / 2, anchor.y + anchor.height / 2
    candidates = []
    for ring in range(1, 8):
        step_x, step_y = (size.width + GAP) * ring, (size.height + GAP) * ring
        for offset in range(-ring, ring + 1):
            candidates.extend([
                (target_x + step_x, target_y + offset * (size.height + GAP)),
                (target_x - step_x, target_y + offset * (size.height + GAP)),
                (target_x + offset * (size.width + GAP), target_y + step_y),
                (target_x + offset * (size.width + GAP), target_y - step_y),
            ])
    if group:
        bounds = group.placement
        for row in range(min(24, int(bounds.height / (size.height + 24)))):
            for col in range(min(24, int(bounds.width / (size.width + 24)))):
                candidates.append((bounds.x + 24 + col * (size.width + 24) + size.width / 2,
                                   bounds.y + HEADER + row * (size.height + 24) + size.height / 2))
    for center_x, center_y in sorted(candidates, key=lambda point: hypot(point[0] - target_x, point[1] - target_y)):
        x, y = center_x - size.width / 2, center_y - size.height / 2
        if abs(x) > 1_000_000 or abs(y) > 1_000_000:
            continue
        if group and (x < bounds.x + 12 or y < bounds.y + HEADER - 12
                      or x + size.width > bounds.x + bounds.width - 12 or y + size.height > bounds.y + bounds.height - 12):
            continue
        rectangle = size.model_copy(update={"x": x, "y": y, "groupId": group.id if group else None})
        padded = rectangle.model_copy(update={"x": x - 14, "y": y - 14,
                                             "width": size.width + 28, "height": size.height + 28})
        if not any(other is not group and overlaps(padded, other.placement) for other in occupied):
            return rectangle
    raise HTTPException(422, "There is no clear space near this object. Choose nearby open space or move the local group.")


def auto_layout(before: ProjectBoard, board: ProjectBoard, anchor_id: str | None) -> None:
    previous = list(board.objects[key] for key in before.objects if key in board.objects)
    new = {key: item for key, item in board.objects.items() if key not in before.objects}
    if not new:
        return
    pairs = [(edge.source, edge.target) for edge in board.connections.values()]
    groups = [item for item in new.values() if item.kind == "group"]
    members = defaultdict(list)
    for item in new.values():
        if item.kind != "group":
            size_new(item)
            if item.placement.groupId:
                members[item.placement.groupId].append(item.id)
    for group in groups:
        ordered = [new[key] for key in flow_order(members[group.id], pairs)]
        right, bottom = arrange_grid(ordered, 26, HEADER, 2) if ordered else (250, 140)
        group.placement = group.placement.model_copy(update={"x": 0, "y": 0, "width": right + 26, "height": bottom + 26})

    def move_members(group: CanvasObject) -> None:
        for key in members[group.id]:
            item = new[key]
            item.placement = item.placement.model_copy(update={
                "x": item.placement.x + group.placement.x, "y": item.placement.y + group.placement.y,
            })

    if anchor_id:
        anchor = before.objects.get(anchor_id)
        if not anchor:
            raise HTTPException(422, "Choose an existing object for the expansion.")
        occupied = previous.copy()
        for group in groups:
            group.placement = near(group, anchor.placement, occupied, None)
            move_members(group)
            occupied.extend([group, *(new[key] for key in members[group.id])])
        for key in flow_order(list(new), pairs):
            item = new[key]
            if item.kind == "group" or item.placement.groupId in new:
                continue
            group = board.objects.get(item.placement.groupId or anchor.placement.groupId or "")
            if group and not item.placement.groupId:
                try:
                    item.placement = near(item, anchor.placement, occupied, group)
                except HTTPException:
                    item.placement = near(item, anchor.placement, occupied, None)
            else:
                item.placement = near(item, anchor.placement, occupied, group)
            occupied.append(item)
        validate_layout(new)
        return

    top_level = [key for key, item in new.items() if not item.placement.groupId]
    edges = [(board.objects[source].placement.groupId or source, board.objects[target].placement.groupId or target)
             for source, target in pairs]
    arranged = [new[key] for key in flow_order(top_level, edges)]
    left = min((item.placement.x for item in previous), default=0)
    top = max((item.placement.y + item.placement.height for item in previous), default=-GAP) + GAP
    arrange_grid(arranged, left, top, 2 if groups else 3)
    for group in groups:
        move_members(group)
    occupied = [*previous, *arranged, *(new[key] for group in groups for key in members[group.id])]
    for key, ids in members.items():
        if key in new:
            continue
        group = board.objects[key]
        for object_id in ids:
            item = new[object_id]
            item.placement = near(item, group.placement, occupied, group)
            occupied.append(item)
    validate_layout(new)


def validate_layout(new: dict[str, CanvasObject]) -> None:
    try:
        for item in new.values():
            CanvasPlacement.model_validate(item.placement.model_dump())
    except ValidationError as error:
        raise HTTPException(422, "The new layout exceeds the canvas bounds. Split it into smaller sections.") from error


def size_changed_content(before: ProjectBoard, board: ProjectBoard) -> None:
    for key in before.objects.keys() & board.objects.keys():
        item, old = board.objects[key], before.objects[key]
        if item.sizing != "auto" or (item.title, item.description, item.illustration) == (
            old.title, old.description, old.illustration,
        ):
            continue
        placement = item.placement
        below = [other.placement.y - placement.y - 14 for other in board.objects.values()
                 if other.id not in (key, placement.groupId) and other.placement.y >= placement.y + placement.height
                 and other.placement.x < placement.x + placement.width
                 and placement.x < other.placement.x + other.placement.width]
        if placement.groupId:
            group = board.objects[placement.groupId].placement
            below.append(group.y + group.height - placement.y - 12)
        available = max(placement.height, min(below, default=370))
        item.placement = placement.model_copy(update={"height": min(object_height(item, placement.width), available)})
