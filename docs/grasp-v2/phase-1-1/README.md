# Phase 1.1 · Whiteboard design review

**Review checkpoint, 24 November 2026.** The current Phase 1 frontend is the baseline on `feature/grasp-v2-canvas` at `8cd9582`. The three previews are isolated from the product. Select a visual direction before implementing it in the production frontend.

## Live audit and reference comparison

Opened the existing local workspace in Browser. Tested **Fit board** and opened **Retrieval practice** in the inspector. At an 809 × 881 CSS-pixel viewport, the header used 62 pixels of vertical space. The ten-concept board showed eight summary paragraphs and eleven visible “appears alongside” labels. Opening the inspector reserved roughly 320 pixels of width. At that size, the board behind it was hard to read.

Captured the baseline Knowledge, Engineering and Inspector at 1440 × 900 in Chrome. Evidence is in the ignored `work/grasp-v2-phase1-1/` directory as `before-knowledge.png`, `before-engineering.png` and `before-inspector.png`.

| Design issue | Observed reference or product effect | Decision for the new whiteboard |
| --- | --- | --- |
| Canvas frame | GRASP has a full-width application header with separate workspace and action groups. The inspector claims its own column. The Enso walkthrough puts the object being explained and a nearby disclosure inside the scene. | Place the identity and current board in one floating control. Keep source, questions and settings contextual. Use a narrow overlay or mobile sheet with explicit fit behavior. |
| Hierarchy and density | GRASP applies nearly the same size, fill, title, summary and source-count treatment throughout the overview. Enso uses short labels aligned to the flow, icons or text for smaller elements and open space around the focal branch. | Use free board titles, compact subsystem objects, quieter supporting concepts, distinct documents, notes and evidence. Reveal summaries through camera detail and selection. |
| Connections | GRASP renders generic adjacency with the same prominent repeated label treatment as a named relation. Enso's published figure uses directional paths and sparse verbs to explain the flow. | Draw meaningful directional labels and quiet source-adjacency lines. Keep original edges and their provenance inspectable. Use route corridors around objects in the authored diagram. |
| Composition | The Phase 1 knowledge adapter follows a serpentine topological ordering. That yields a complete map, but it gives equal visual weight to most concepts. | Reserve the authored overview for the main concept and its neighborhood. For generated layouts, group by document membership and use actual graph connections to rank which nodes stay visible at overview zoom. |
| Editing and evidence | GRASP's drag, fit, selection and citations are functional. Public Enso playback illustrates a selected object, annotation and inspector. Figma's FigJam guide describes box selection and Shift editing. Obsidian documents grouping and labelled directed lines. Google's notebook help describes quotes and opening them in source context. | Preserve GRASP's input and retrieval logic. Apply Figma/‎FigJam to selection and tool precision, Obsidian to graph organization, and NotebookLM to source scope and quote inspection. Enso supplies the visual and spatial hierarchy. [FigJam](https://help.figma.com/hc/en-us/articles/1500004292221-Select-move-and-order-objects-in-FigJam) · [Obsidian](https://obsidian.md/help/plugins/canvas) · [Google notebook help](https://support.google.com/gemininotebook/answer/16179559) |

### Targeted Enso check

Phase 0 [evidence E1–E7](../references.md#enso-evidence-ledger) established the distinction between the website and the native editor. In this pass, Browser selected **Rework it by hand** and paused it. The public figure used an SVG view box of 1200 × 675 with six translated groups. Its only button in the sampled paused state resumed the lesson. It is evidence for the composition, label density and staged reveal. Native editing mechanics remain unverified. [Public walkthrough](https://ensocanvas.com/#canvas) · [Public demos](https://ensocanvas.com/demos)

REA captured the current public walkthrough independently at 1440 × 900. Evidence ID `ev_e242b89cf9e0b91b79e659d85561062ceef37b6dcb25882545ed45cc33f7f6dc`. The capture completed in reduced-motion Chromium and the SHA-256 matched `195a5d6467f24e1573a0ddd18a252f1da9cdab70b6198365b9cc65be12d8d83b`. The public capture is saved locally as `work/grasp-v2-phase1-1/enso-walkthrough-1440.png`. The prototypes use original GRASP composition and assets.

## Frontend disposition

| Phase 1 area | Classification | Follow-through after approval |
| --- | --- | --- |
| [Workspace header and actions](../../../apps/web/src/App.tsx) | Replace entirely | Use one corner control for identity and board selection. Place presentation apart from edit tools. Move import and source management behind the board menu or document context. |
| [Current theme and full-screen layout](../../../apps/web/src/canvas/canvas.css) | Replace entirely | Define the approved material, type hierarchy, shared shape rules and camera-safe insets from the new board. Eliminate viewport-sized header and panel lanes. |
| [Old entry, chat and dialog styles](../../../apps/web/src/styles.css) | Remove from the default workspace | Remove inactive entry and composer rules after dependency checks. Rebuild settings, questions and citation chrome. Keep behavior on the paths that still use it until migrated. |
| [React Flow and board transactions](../../../apps/web/src/canvas/CanvasBoard.tsx), [session history](../../../apps/web/src/canvas/use-board.ts) | Preserve functionality | Keep camera conversion, dragging, resize, history, keyboard controls and attribution. Replace the graphics and interface around them. |
| [Object renderer and connection labels](../../../apps/web/src/canvas/CanvasObjects.tsx) | Redesign presentation | Use different anatomy for source files, components, concepts, free text, notes, explanations, evidence and regions. At overview zoom, reveal relation names selectively. |
| [Automatic graph projection](../../../apps/web/src/canvas/board.ts), [Engineering seed](../../../apps/web/src/canvas/engineering-board.ts) | Redesign presentation | Replace the fixed serpentine overview with a semantic layout. Author a separate system-map composition in the same object vocabulary. Keep canonical bindings and saved world positions. |
| [Inspector](../../../apps/web/src/canvas/CanvasInspector.tsx), [questions and dialogs](../../../apps/web/src/WorkspaceDialogs.tsx) | Redesign presentation | Keep exact quotes, selected source scope and the full page behind a citation. Split inspection from reading depth. Keep persisted conversations and document lifecycle available on demand. |
| [3D renderer](../../../apps/web/src/Mindmap.tsx), [recorded showcase](../../../apps/web/src/showcase/Showcase.tsx) | Retain only in a secondary view | Open 3D explicitly with canonical selection. Keep the separately routed recorded showcase available. |
| [App ingestion, provider mode, saved questions](../../../apps/web/src/App.tsx), [SSE reducer](../../../apps/web/src/upload-state.ts), API, data and test suites | Preserve functionality | Keep existing contracts, source scope, errors, exact citation validation and test behavior. Carry them through the production redesign and verify the actual application after approval. |

## Impeccable shape and visual directions

The shape is a full-viewport working board that a student can explore and a presenter can operate without losing the system diagram. Make the graph readable at overview zoom. Reserve contextual UI for selection, navigation and evidence. Align the six comparable captures at 1440 × 900, using the same object set and domain relationships so the composition is the variable.

| Direction | Hierarchy and type | Density and interaction | HTX trade-off |
| --- | --- | --- | --- |
| **A · Technical whiteboard** | Dark olive charcoal, serif title, restrained types and a margin callout. Ingestion above retrieval. | Sparsest shell and quietest supporting concepts. The bottom-center toolbar allows tools to recede during presentation. | Strongest immediate Enso resemblance. Small text and muted paths need a projector check. |
| **B · Precision workspace** | Cool paper, sans-serif title, squared geometry and more visible grid. | Left tool rail, explicit lanes and harder orthogonal edges. Editing controls are quickest to locate. | Easy to teach the controls. The lane and grid treatment looks closest to a conventional diagram editor. |
| **C · Evidence workspace** | Warm paper, editorial type, restrained pine accent and open rules. Maps and retrieved evidence have distinct reading areas. | Focal concepts get space and scale. An exact passage stays attached to the board, with the recorded answer and full page reachable. The tool dock stays low and off the diagram. | Strongest full journey from pipeline to a verifiable answer. Needs a dark variant and responsive positioning during production integration. |

**Recommend C.** It carries the spacing, compact technical objects, directional story and annotation rhythm observed in Enso. A projected viewer can follow the path to an actual GRASP quote without opening a sidebar. Students can inspect the text and return to the diagram. B is the better choice if editing visibility is the highest priority. A is the closest choice to the dark reference.

## Review the running previews

Run from the repository root with the existing Python interpreter:

```powershell
python -m http.server 5191 --bind 127.0.0.1 --directory docs/grasp-v2/phase-1-1/preview
```

Open [A](http://127.0.0.1:5191/?direction=a) · [B](http://127.0.0.1:5191/?direction=b) · [C](http://127.0.0.1:5191/?direction=c). The board switch opens Knowledge. Drag a card or use the hand tool, fit a selection, or add and edit a note. On Knowledge, inspect **Retrieval practice**, open the recorded answer and follow its citation. **Present** hides the editing tools and keeps a route back to the board.

The [preview](preview/index.html) is a standalone prototype with no build or server dependency beyond static file serving. The same nine architecture objects and fourteen Knowledge objects appear in all three directions. The [preview fixture](preview/fixture.js) uses the canonical sample graph and the recorded mock answer. The evidence sentence was matched against its recorded citation, a source chunk linked from the canonical concept, and the original extracted page. Full passages are loaded from the isolated fixture.

Desktop evidence includes `direction-{a,b,c}-engineering.png`, `direction-{a,b,c}-knowledge.png` and selected evidence views in `work/grasp-v2-phase1-1/`. Chromium verification exercised drag and connection updates, undo and redo, cursor-anchored zoom, pan, note editing, presentation and the citation path in each direction. At 390 × 844, a touch-emulated check opened the Knowledge outline, focused the concept and opened the quote without horizontal overflow. The previews use session-local edits and provisional authored layouts.

## Direction A implementation

The owner selected Direction A and asked for warmer charcoal, original SVG technical figures, handwritten annotations and meaningful connection colors. The running app integrates that direction in the shared 2D canvas.

| Evidence | Observed | Applied to Grasp |
| --- | --- | --- |
| Public Enso hero in Browser | The buffer pool and write-ahead log are free-standing and captioned. Processing steps sit in dark cards. Orange and green carry different routes. Handwritten text sits off the main path with curved arrows. The grid almost disappears behind the diagram. | Separate artefact figures from process cards. Use warm ink and restrained data and process colors. Keep authored explanations off the main lanes. |
| REA hero DOM, 1440 × 900 | After `#hero-title` became visible, the dark, reduced-motion Chrome capture contained both technical captions and the handwritten query and index callouts. Evidence `ev_569dddffacd2a80dd4667a0da777d6f90d35a77c285db843c04a0dcf62731ffb`. | Apply the observed hierarchy to an authored Grasp pipeline. Browser established positions and appearance. REA confirmed caption presence. Native editor behavior remains unverified. [Enso hero](https://ensocanvas.com/#top) |

- [Technical illustrations](../../../apps/web/src/canvas/TechnicalIllustration.tsx) supplies 16 original SVG diagrams. **Add object → Illustration** opens the picker in the inspector. Diagrams support the same selection, movement, resize and connections as other objects.
- [Engineering scene](../../../apps/web/src/canvas/engineering-board.ts) follows indexing and question answering. The route to ChromaDB represents the vector search. The separate SQLite branch represents chunk and source records. **Why a passage ranks** opens a selectable vector example whose distances are in diagram units. Live embeddings, storage rows and trace bindings are future work.
- [Shared scene model](../../../apps/web/src/canvas/board.ts) retains canonical concept and edge IDs, source provenance and movable semantic regions. It lays out single-source concepts beside their documents and collects cross-document concepts under a shared heading. Generic adjacency remains inspectable and has a quiet path at overview scale.
- [Canvas inspector](../../../apps/web/src/canvas/CanvasInspector.tsx) supports authored text, notes and arrows. Pin a passage from a Knowledge source to create an evidence object with its exact quote and page. Its source action opens the existing viewer. Removed source IDs suppress their pins. Board edits, including pins, exist in the current session.
- [Design system](../../../DESIGN.md) defines the whiteboard, color roles, typography and annotation rules. Fonts ship locally under the SIL Open Font License. The earlier showcase continues to use its surface brief.

### Run for review

```powershell
$env:MOCK_LLM='1'
$env:DATA_DIR='work/grasp-v2-phase1-1/verification'
$env:ACCESS_TOKEN=''
$env:WEB_PORT='5189'
$env:API_PORT='8019'
python scripts/dev.py
```

Open [Engineering Canvas](http://127.0.0.1:5189/?board=engineering). Double-click an object or press Enter when it has keyboard focus to inspect it. **Present** offers an overview and two focused flows. On a phone, the flow controls can step through individual objects. On [Knowledge](http://127.0.0.1:5189/), open the sample and use the outline to inspect **Retrieval practice** and pin a passage. The mock status identifies the sample processing mode.

### Before and after

| View | Phase 1 capture | Phase 1.1 capture |
| --- | --- | --- |
| Engineering overview | `work/grasp-v2-phase1-1/before-engineering.png` | `work/grasp-v2-phase1-1/after/canvas-engineering.png` |
| Knowledge overview | `work/grasp-v2-phase1-1/before-knowledge.png` | `work/grasp-v2-phase1-1/after/canvas-knowledge.png` |
| Source inspection | `work/grasp-v2-phase1-1/before-inspector.png` | `work/grasp-v2-phase1-1/after/canvas-evidence.png` |

The flat header and equal-weight components in Phase 1 gave way to floating controls, free-standing technical objects, quieter concept labels and distinct content roles. The detailed source and question flows are accessible from the board. The wider paths and selective verbs make the two Engineering flows readable at desktop fit.

### Independent critique and polish

Two reviewers assessed the desktop, phone and projector-sized browser views independently. The design review scored the pre-polish interface 27/40. The ten scores, in rubric order, were `3, 3, 3, 3, 2, 2, 3, 3, 3, 2`. The reviewer found the two paths specific to Grasp and could follow a citation to its source on desktop and phone. The main gaps were an offscreen first concept on phones, small verbs at 1280 × 720, a similarity example without a clear action, and a source dialog that dropped the document name.

The Impeccable detector returned zero source findings on `apps/web/src`. The rendered detector could not start its Chromium Crashpad process. The second reviewer used fresh Chrome tabs for visual and DOM evidence at 1440 × 900 and 390 × 844. This review used the `apps-web-src-canvas-canvasboard-tsx` target and had no ignore file. No browser overlay was injected.

Polish made the first source and its adjacent concept share the narrow view. It added focused presentation paths, keyboard and touch controls for the example, semantic heading markup, source names in the passage viewer and relationship roles in the inspector. The mobile outline has a no-results state and returns focus to its trigger on Escape. The Engineering snapshot retains the React Flow attribution.

Calculated WCAG contrast for card text was 13.35:1 primary and 7.84:1 secondary in dark, and 13.90:1 primary and 6.55:1 secondary in light. The strongest input boundaries were 3.70:1 and 3.60:1 against the canvas. Data connectors reached 8.03:1 and 5.81:1. Processing connectors reached 5.38:1 and 5.56:1. Physical projection and screen-reader announcements still need review on the intended hardware.

### Verification on 25 November 2026

- `python scripts/check.py` passed contract drift, 72 Python tests, 24 Node tests and TypeScript. The initial sandboxed run stalled in the upload stream test. The local mock run with access for the ingestion worker and temporary ChromaDB completed.
- `npm run build` passed. The existing Browserslist notice, React Flow bundle directive warning and large lazy 3D chunk warning remain.
- `node scripts/tests/canvas-browser.cjs` passed in isolated Chrome. It exercised cursor-centred zoom, two-axis pan, resize, undo and redo, selection, authored connectors and regions, illustration choice, note styling, the vector example, desktop and phone presentation, evidence pinning and exact quote reopening, import/SSE, duplicate/removal behavior and the 2D/3D round trip. The browser run uses a disposable fixture database.
- `impeccable shot` captured the actual running Engineering board at 1440 × 900, 1280 × 720 and 390 × 844. The captures are under `work/grasp-v2-phase1-1/impeccable-polish/`. The interaction suite saved presentation, Knowledge, source, light theme and mobile states under `work/grasp-v2-phase1-1/after/`.

To repeat the browser suite against the review server, set `$env:GRASP_EVIDENCE_DIR='work/grasp-v2-phase1-1/after'` and run `node scripts/tests/canvas-browser.cjs`. Use the [Phase 1 setup notes](../phase-1.md#review-and-evidence) for the local Playwright and Chrome paths.

## Approval boundary

The owner approved the running Direction A implementation on 25 November 2026. Its review used offline mock mode and session-local board edits. The approved implementation is `ea8e246`, with its verification record at `ae76ddb`. The [Developer Preview plan](../developer-preview.md) is a separate approval gate for the revised Phase 2 scope.
