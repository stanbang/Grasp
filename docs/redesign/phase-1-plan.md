# Interactive workspace: Phase 1

This is the design and audit checkpoint for the existing Grasp app. Functional phases 1–6 are already implemented. The new UI redesign has its own six phases. Work is on `feature/interactive-workspace-ui`; the existing app at port 8080 remains the working product during this checkpoint.

## Proposed interaction

Keep the existing navy surfaces, pale teal accent, local sans-serif fonts and gold mastery state. Let a small question composer sit inside a document workspace rather than cover most of it. Documents occupy a quiet orbital field above and around it. The inspector opens on the right; the remaining canvas and composer resize cleanly. On phones, document cards become a horizontal strip and the inspector becomes a full-height sheet.

The signature motion preserves one visible document object: attachment inside the composer, composer contracting into a loop, loop active until a successful terminal SSE event, preview resolving, one curved transfer into its assigned slot, then composer restoration. Durations describe presentation only. No animation advances a backend status or turns failure into success.

The Phase 1 browser prototype exposes five sample states with explicit preview controls. It is a visual proposal, makes no upload or model requests and cannot be mistaken for live indexing. Processing stays active until the viewer changes the selected sample state. Real ingestion integration starts in Phase 2 after approval.

## Current implementation audit

| Area | Current code and behavior | Decision |
| --- | --- | --- |
| Workspace | `apps/web/src/App.tsx` owns ingestion, chat, selection, auth and dialogs | Split gradually into composer, upload coordinator, orbit, inspector and chat. Keep the app functional after each commit. |
| Graph state | `study-store.ts` holds the canonical graph and functional upserts | Reuse it. Add a small workspace store for selected document, view and per-job presentation state. Keep File objects, blobs, timers and Three objects out of persistent global state. |
| File drops | `folder-upload.ts` recursively reads all directory batches and prevents native navigation | Reuse its capture handlers and partial-failure behavior. Add size validation before upload using the configured server limit, not a competing hardcoded limit. |
| Upload | `POST /documents` returns a stable document ID and reuses duplicate raw bytes | Key orbit cards and jobs by server document ID; duplicates focus the existing object rather than create another card. |
| SSE | `client.ts` reads authenticated fetch streams with replay cursors and bounded reconnects | Reuse transport. Feed typed events into a testable lifecycle reducer. Replay must be idempotent and terminal errors must retain filename/retry context. |
| Graph renderer | `Mindmap.tsx` caches node objects and computes client positions | Preserve renderer identity and camera state across view changes. Keep mastery colors and backend `referencedNodeIds`. No backend layout columns. |
| Conversation | `App.tsx` persists server conversations but resets them inside `importFiles` | Remove the reset in Phase 2. Keep existing messages and show a document scope control. New conversation remains an explicit action. |
| Chat request | `POST /chat` returns complete JSON, exact quotes and linked node IDs | Show the user's question immediately with a pending assistant row. Display the whole answer when returned; no fake token streaming. |
| Sources | `SourceView` fetches exact page text and original PDF as an authenticated Blob URL | Move this into the inspector. Preserve exact-quote highlighting in extracted text; do not invent PDF rectangle coordinates. Revoke object URLs on source change/removal. |
| Concepts | `ConceptView` shows summary, chunks and related concepts | Retain these paths in Knowledge View and allow source-document navigation. Add a keyboard-accessible concept selector. |
| Management | `WorkspaceSettings` supports replacement, re-indexing, removal and saved conversations | Retain safety and cleanup feedback. Successful removals reconcile orbit, selection and scope. |
| Mastery | Existing three-question server grading and progress persistence | Preserve. No XP, levels or streaks. |
| Tokens | `DESIGN.md` has the requested palette but some layout prose describes the old scaffold | Keep tokens; this proposal's surface brief governs the redesigned composition. Capture the implemented layout in a later phase rather than claiming old prose is current. |

## Real lifecycle mapping

| Signal | UI text | Evidence / presentation |
| --- | --- | --- |
| Local request in flight | Uploading document | Indeterminate; the current fetch API does not expose upload byte progress. |
| `status` with `document.status=queued` | Waiting to process | Server has accepted the document. |
| `status` with `chunking` | Reading pages and locating chunks | Parsing and chunking share this status. |
| `status` with `extracting`, completedBatches=0 | Indexing sources and extracting concepts | Embedding, vector insertion and initial extraction share this stage. Do not split them into invented stages. |
| `status` with `extracting`, completedBatches/totalBatches | Extracted source batches: n of m | This is a batch count, not a whole-document percentage. The node cap may stop extraction before all batches. |
| `node` / `edge` | Update linked knowledge | Idempotent upsert. Events are committed graph data, not estimated progress. |
| `complete` with done document | Ready to explore | Only this success permits resolve/transfer motion. Counts may be shown when provided. |
| `error` or known failed status | Processing failed | Stop loop, retain filename and server message, show Retry and Dismiss. Never enter orbit. |
| Stream interruption | Reconnecting to processing | Keep indeterminate state; replay from last cursor. If retries exhaust, offer resume from stored status. |

After reload, fetch `/documents`, restore done cards immediately and attach streams to nonterminal documents. Never replay the arrival animation for every stored source. A duplicate done upload resolves by selecting its existing card. The backend uses one ingestion worker; batch UI may monitor several documents without claiming they process in parallel.

## Motion contract

- A single upload uses the complete composer transformation. A batch uses one shared processing tray with independently keyed items; the entire composer does not morph repeatedly.
- Contraction takes about 320 ms, loop morph about 400 ms, success resolve about 300 ms, transfer about 850 ms and restoration about 300 ms. These are targets for the later implementation.
- Use CSS transitions/animation events for ordinary UI. Use Three.js for spatial orbit/camera motion. No animation library is required.
- Keep a single visual owner during transfer. Measure composer/card anchors using ResizeObserver and recalculate targets when the viewport or inspector changes. Do not render a duplicate destination card until handoff.
- Orbit slots derive from stable document IDs and use a retained allocation map. New files fill free slots; ordinary chat updates never reseed placement. Pause on hover, keyboard focus, inspection and page invisibility.
- Reduced motion keeps readable status text and instant spatial handoff. It must not hide a failed or pending state.

## Document previews and necessary API extension

The current API serves original files, chunks and extracted pages; it has no thumbnail endpoint, reliable total PDF page count or PDF text-box coordinates. A browser PDF iframe displays a file but cannot reliably render its first page into a texture.

For Phase 3, add a narrowly scoped authenticated preview route using the already approved Poppler tool. Render only page one at a bounded size, with timeout, a cache keyed by original document ID and no external OCR/image service. Return a typed metadata response for MIME type, PDF page count and chunk count. This is the only anticipated backend change and directly supports the requested preview. Preserve the existing public Document/Chunk/ChatResponse contracts. Keep a document-style text fallback when Poppler is unavailable, a PDF cannot render or a bundled demo has no original. Preview failures must not mark successfully indexed sources failed.

The first-page texture will be cached locally and disposed on removal. Load original PDF only when opening its inspector; navigate one page at a time using the existing native viewer and show the exact extracted quote beside it. Do not load all page images. Text/Markdown cards derive excerpts from existing stored chunks.

Use the installed Three.js/CSS3DRenderer or equivalent Three-backed document plane with a DOM keyboard/list mirror. Confirm the available TypeScript declarations before implementation; ask before adding a type package if required. No PDF.js, animation library, new state library or runtime dependency is authorized by this plan.

## Component boundaries

- `WorkspaceShell`: view selector, canvas region, composer region, responsive inspector.
- `WorkspaceToolbar` / `IconButton`: consistent Lucide actions, accessible names and hover/focus tooltip.
- `ChatComposer` / `ConversationThread`: auto-height input, immediate outgoing message, complete generated answer and named citation buttons.
- `UploadCoordinator` / `ProcessingMorph`: typed real-event lifecycle and per-document retries; presentation completion cannot mutate ingestion status.
- `DocumentOrbit` / `DocumentPreview`: retained spatial layout, cached preview resources and accessible list fallback.
- `DocumentInspector`: document metadata, original page, extracted quote, concepts, scope and management actions.
- Existing `Mindmap`, `study-store`, API transport and mastery components remain in use.

## Delivery checkpoints

1. Audit, editable Figma frames, a separate working state preview and this integration plan. Stop for review.
2. Extract composer and ingestion coordinator; preserve conversations; connect morph/error/batch states to actual SSE. Add reducer/replay tests. Stop for review.
3. Add bounded first-page previews, stable interactive document orbit and successful upload handoff. Test identity, ordering, removal and resource cleanup. Stop for review.
4. Connect Document/Knowledge views without remounting the graph; maintain document/concept selection and mastery. Stop for review.
5. Finish chat, tooltips and inspector; verify named citations, page navigation, keyboard focus and source return. Stop for review.
6. Verify desktop/tablet/mobile and reduced motion, visibility suspension, WebGL fallback, long titles and many documents. Run repository checks/build, focused tests and Impeccable audit. Record actual results and update the README.

## Phase 1 verification scope

Run the existing `python scripts/check.py` and `npm run build`. Test all five preview states, mouse/keyboard selection and narrow-layout overflow. The prototype is a state viewer, not real file ingestion or proof of live animation performance. Backend live-provider, native OCR and production checks from the prior completed version remain documented separately. No paid provider request is needed for Phase 1.
