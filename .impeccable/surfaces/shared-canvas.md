---
version: 1
slug: shared-canvas
primary_target: apps/web/src/App.tsx
related_targets: [apps/web/src/canvas/CanvasBoard.tsx, apps/web/src/canvas/canvas.css]
---

# Shared canvas

Mode: Operate. The approved [Phase 0 shape](../../DESIGN.md#shape) sets the direction for the desktop study workspace and the Engineering Canvas.

- The board occupies the viewport beneath a compact workspace switcher. A sparse grid and readable links lead between the cards. An empty study board offers source import and a real sample. A populated board opens on its sources and concepts.
- A bottom toolbar holds active canvas tools. Zoom and fit sit together. The outline provides a keyboard-accessible route to the same objects. The inspector opens from the board and has room for an exact passage, relation or editing action.
- Keyboard and pointer users can select and move objects. Narrow layouts use one foreground panel at a time. Reduced motion skips camera transitions.
- Importing a note or opening a sample uses the existing API and preserves source identity. Architecture cards use repository facts and the same gestures as study cards. 3D opens on demand with the current concept selection.
- Verify real gestures, source inspection and the empty, populated and narrow workspace before the Phase 1 review.
