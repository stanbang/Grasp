# Phase 1 · Shared canvas foundation

Implemented on `feature/grasp-v2-canvas` from `showcase-overhaul` at `98f8cda`. The existing branch tips and the owner's untracked source brief and handover were preserved. The approved Phase 0 documents were committed separately. Phase 2 is pending the owner's review of this checkpoint.

## Run the workspace

Use the existing Python 3.11 environment and installed web packages. For an isolated rehearsal, run these commands from the repository root in PowerShell:

```powershell
$env:MOCK_LLM='1'
$env:DATA_DIR='work/grasp-v2-phase1/review'
$env:ACCESS_TOKEN=''
python scripts/dev.py
```

Open the loopback web address printed by the launcher. Choose **Open sample** on the empty Knowledge board or add a PDF, Markdown or text file. **Engineering** opens the starter architecture diagram using the same editing tools. In Select mode, drag a card or use its keyboard movement. Drag across empty space or Shift-click to select several cards, then choose **Group selection**. Double-click a card or choose **Inspect** to read or edit it. The hand tool, Space-drag and middle-drag pan. Fit and zoom sit beside the toolbar. **3D** opens the existing explorer. **2D** returns to the previous board.

## Implementation

| Area | Changed files and behavior |
| --- | --- |
| Workspace and adapters | [App.tsx](../../apps/web/src/App.tsx) retains import, citation, question, conversation and lifecycle paths. [study-store.ts](../../apps/web/src/study-store.ts) publishes graph and document snapshots together. [upload-state.ts](../../apps/web/src/upload-state.ts) adapts the earlier branch's replay-safe progress reducer. |
| Shared canvas | [CanvasBoard.tsx](../../apps/web/src/canvas/CanvasBoard.tsx) wraps the pinned React Flow 13.0.3 renderer. [CanvasObjects.tsx](../../apps/web/src/canvas/CanvasObjects.tsx) renders six card types and labeled arrowed relationships. [CanvasInspector.tsx](../../apps/web/src/canvas/CanvasInspector.tsx) shows scoped passages, connector endpoints, repository paths and editable authored objects. |
| State and layout | [board.ts](../../apps/web/src/canvas/board.ts) projects canonical concept, edge and source IDs, and keeps authored objects and world geometry in a versioned board document. [use-board.ts](../../apps/web/src/canvas/use-board.ts) keeps camera and selection outside revision history. A drag or resize commits one undo step. Group membership uses world geometry and is converted to parent-relative rendering positions. |
| Presentation and 3D | [engineering-board.ts](../../apps/web/src/canvas/engineering-board.ts) provides one repository-backed architecture seed. The existing 3D renderer loads on demand and [ExplorerBoundary.tsx](../../apps/web/src/canvas/ExplorerBoundary.tsx) provides 2D recovery on load failure. |
| Design | [Shared canvas brief](../../.impeccable/surfaces/shared-canvas.md) records the approved Impeccable shape. [canvas.css](../../apps/web/src/canvas/canvas.css) provides the distinct full-screen 2D board, contextual panels, dark theme and light projection palette. |
| Verification | [canvas.test.cjs](../../scripts/tests/canvas.test.cjs) joins the standard [check script](../../scripts/check.py). [canvas-browser.cjs](../../scripts/tests/canvas-browser.cjs) runs the Chromium interaction and evidence checks against an isolated mock server. |

Semantic links preserve their canonical IDs, direction, labels and document provenance. Authored cards and links cannot modify canonical records. A concept card opens the exact committed chunk or scopes a question to its documents. New board changes stay in memory for the current page session. The versioned document can be persisted by the planned board store in Phase 3. 3D simulation positions are transient.

## Review and evidence

Two authorized Impeccable reviewers assessed the first working build independently. The design reviewer scored the pre-polish workspace 25/40 across the ten Nielsen heuristics. The detector returned zero source findings. Browser review found that default note placement could cover existing architecture cards, long answers opened midway through their text, the narrow inspector could cover the selected card and connection inspection omitted its endpoints. Polish placed new notes in available space, anchored the latest question at the start of its answer, reserved narrow inspector space, shortened verbatim passage previews and added endpoint names. The detector used the source tree, and Chrome inspection and screenshots supplied the rendered evidence. The Browser tool's read-only page evaluation limited the review to those methods.

Verification used installed Chrome with Playwright against a disposable localhost server, plus direct Chrome Browser inspection. The browser suite exercises these paths:

- Initial board fit and padding at 1440 × 900 and 1280 × 720, cursor-anchored zoom within two CSS pixels, two-axis wheel pan, pinch-style input and the hand tool.
- Drag, cancellation, resize, undo and redo, keyboard movement, marquee, Shift selection, grouping and ungrouping. It checks that new authored cards avoid existing cards.
- Authored connection creation and editing, exact source inspection, a scoped mock answer and correct answer framing, canonical selection across 2D and 3D, and failed 3D load recovery.
- A 390 × 844 touch-emulated viewport with reduced motion, no horizontal overflow, outline search and a selected card visible above the inspector.
- Real multipart upload, streamed completion, duplicate identity and removal of the disposable test document. A clean-library check also imported the bundled note and confirmed that one document card and nine extracted concepts fit automatically. The existing API regression suite covers document replacement, saved conversations, storage, provider output validation, source scope, OCR boundaries and citation integrity.

The mock regression run passed 72 Python tests, 23 Node tests, generated contract drift checks and strict TypeScript. The production build and all seven browser scenario groups passed. Run `python scripts/check.py` in mock mode and `npm run build` to repeat the standard gates. The browser suite uses a development-only installation in an ignored directory:

```powershell
npm install --prefix work/grasp-v2-phase1/browser-tools playwright-core --no-save --no-package-lock
$env:GRASP_TEST_URL='http://127.0.0.1:5189'
node scripts/tests/canvas-browser.cjs
```

Start the isolated mock server with `WEB_PORT=5189` for that command. Use `GRASP_CHROME` to override the Chrome executable path. PNGs are saved under `work/grasp-v2-phase1/`, including the Knowledge board at both desktop sizes, Engineering in both palettes, Questions, the 3D explorer and the phone inspector.

## Limits and next review

- Board edits and history reset on reload. Database migration, revision conflicts and explicit recovery of orphaned board objects are planned for board persistence.
- The Engineering seed is an editable composition of six existing implementation components. The full guided walkthrough, frames and presenter notes belong to Phase 2.
- Concept extraction and retrieval retain their existing behavior. The bounded PDF thumbnail route from the alternate branch was left for the later source workspace integration. Exact extracted text and the existing authenticated original-PDF reader are available now.
- The browser suite simulates pinch-style and two-axis wheel events. A physical trackpad and touchscreen, sustained larger-board performance, and paid provider behavior were outside this check.
- The production build succeeds with warnings from React Flow's client directive/source-map handling, the existing lazy 3D chunk size and stale Browserslist data. The Python tests emit the existing LangChain Community PDF-loader deprecation warning.
