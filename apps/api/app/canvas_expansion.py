import re
from collections import defaultdict

from fastapi import HTTPException

from .canvas_contracts import AddConnection, AddObject, CanvasBatch, CanvasPlacement, ProjectBoard

GENERIC_LABELS = {"related", "related to", "relates to", "connects to", "links to", "points to",
                  "associated with", "connection", "link", "see also", "see", "n a"}


def overlaps(first: CanvasPlacement, second: CanvasPlacement) -> bool:
    return (first.x < second.x + second.width and second.x < first.x + first.width
            and first.y < second.y + second.height and second.y < first.y + first.height)


def validate_expansion(batch: CanvasBatch, before: ProjectBoard, after: ProjectBoard) -> None:
    anchor = batch.expandFromObjectId
    if anchor is None:
        return
    if anchor not in before.objects or before.objects[anchor].kind == "group":
        raise HTTPException(422, "Expand from an existing object that can have connections.")
    if any(not isinstance(operation, (AddObject, AddConnection)) for operation in batch.operations):
        raise HTTPException(422, "An expansion can only add objects and connections.")

    new = after.objects.keys() - before.objects.keys()
    content = {key for key in new if after.objects[key].kind not in ("group", "heading")}
    if not content:
        raise HTTPException(422, "Add connected explanatory content to the expansion.")

    neighbors: dict[str, set[str]] = defaultdict(set)
    for operation in batch.operations:
        if not isinstance(operation, AddConnection):
            continue
        edge = operation.connection
        label = " ".join(re.findall(r"\w+", edge.label.casefold().replace("_", " ")))
        if not label or label in GENERIC_LABELS or edge.role == "structural":
            raise HTTPException(422, f"Describe what connection {edge.id} does with a specific label and role.")
        if edge.source not in content and edge.target not in content:
            raise HTTPException(422, "An expansion connection must involve new explanatory content.")
        neighbors[edge.source].add(edge.target)
        neighbors[edge.target].add(edge.source)

    # Follow the new branch only. A route through unrelated existing architecture cannot anchor an explanation.
    reachable = {anchor}
    pending = [anchor]
    while pending:
        current = pending.pop()
        next_items = (neighbors[current] & content) - reachable
        pending.extend(next_items)
        reachable.update(next_items)
    if not content.issubset(reachable):
        raise HTTPException(422, "Connect each new explanation to its source through the new branch.")

    for key in sorted(new):
        item = after.objects[key]
        for other in after.objects.values():
            if other.id == key or item.placement.groupId == other.id or other.placement.groupId == key:
                continue
            if overlaps(item.placement, other.placement):
                raise HTTPException(422, f"Place the new object {key} clear of {other.id}.")
