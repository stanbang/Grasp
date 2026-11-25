---
version: 1
slug: shared-canvas
primary_target: apps/web/src/App.tsx
related_targets: [apps/web/src/canvas/CanvasBoard.tsx, apps/web/src/canvas/canvas.css]
---

# Shared canvas

Mode: Operate. [Shared whiteboard design](../../DESIGN.md#shared-whiteboard) governs the study workspace and Engineering Canvas.

- The board occupies the viewport behind floating controls. A faint grid orients movement. Warm charcoal, editorial headings, standalone diagram figures and handwritten notes give the Engineering Canvas its visual identity. The Knowledge board opens on document bands and shared concepts. The empty board offers source import and an offline sample.
- A bottom toolbar holds active canvas tools. Zoom and fit sit together. The outline provides a keyboard-accessible route to the same objects. The inspector opens from the board and has room for an exact passage, relation or editing action.
- Keyboard and pointer users can select and move objects. Narrow layouts use one foreground panel at a time. Reduced motion skips camera transitions.
- Importing a note or opening a sample uses the existing API and preserves source identity. Pin exact evidence from the inspector. Architecture objects use repository facts and the same gestures as study objects. Mark example values at the point of inspection. 3D opens on demand with the current concept selection.
- Verify gestures, source inspection, presentation mode and the empty, populated and narrow workspace for Phase 1.1 review.
