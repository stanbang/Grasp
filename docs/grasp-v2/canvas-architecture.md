# Shared canvas architecture

Proposed for review. The 2D board is a view and an editable composition around GRASP's existing data. SQLite and Chroma continue to serve their current roles. The static showcase remains a portable replay while the new presentation uses shared canvas primitives.

```mermaid
flowchart LR
  E[Versioned architecture content] --> EA[Engineering board adapter]
  G[Graph and source APIs] --> KA[Knowledge board adapter]
  G --> V[On-demand 3D graph]
  D[Versioned board document] --> EA
  D --> KA
  EA --> C[Shared board shell and React Flow renderer]
  KA --> C
  C --> P[Inspector, search and presentation controls]
  C --> H[Board transactions and history]
  H --> D
  P --> G
```

## Responsibilities and identity

| Layer | Owns |
| --- | --- |
| Knowledge domain | Existing graph node and edge IDs, `docIds`, `sourceChunkIds`, mastery, documents, exact pages, citations and saved conversations. Only existing domain services may write these records. |
| Engineering content | Versioned repository-authored architecture node IDs, descriptions, typed relations, run mode, and source references. A source reference includes path, commit and optional line or symbol, or a named report and evidence status. |
| Board document | Board/workspace identity, object instances, user content, world geometry, presentation arrows, regions, frames, navigation links and revision. Multiple object instances can refer to one canonical concept. |
| Session and renderer | Selection by board object ID, pointer capture, draft geometry, hover, current camera and focused panel. React Flow receives derived nodes and edges. Selection, measurements and force simulation positions stay transient. |
| Operation and history | A validated board transaction changes the board document. A single finished gesture or approved AI batch produces one revision and undo unit. Persist the approved board delta or snapshot. In-memory undo history can reset on reload for the first release. |

A knowledge view initially materializes a deterministic overview of documents and selected concept neighborhoods. Use a stable order and seed positions so a refresh does not shuffle the map. Preserve saved placements when new nodes appear. A generated link carries its canonical edge ID and existing `docIds`. Link directly to source passages only where source provenance can be established. A user or AI visual connector is a presentation edge with its own ID and origin. Archived or missing bindings stay visible as unavailable and can be removed or relinked. Never rematch stale references by label or silently reuse an old citation after replacement. The optional 3D view consumes the canonical graph and receives the selected canonical node, while its camera and force coordinates are transient.

Engineering uses the same board, selection, search, camera, frame and inspector primitives. Its default seed is repository versioned. Edits create an editable board copy. Source-backed claims remain derived from the seed or an explicitly revised, versioned content record. Personal notes are visibly separate from architecture evidence.

## Camera and interaction

- Use one affine camera in CSS pixels for the usable board rectangle. With viewport translation `tx,ty`, zoom `z` and pane client origin `L,T`, world coordinates are `((clientX-L-tx)/z, (clientY-T-ty)/z)`. The inverse uses the same pane origin. At a zoom change keep the world point under the cursor fixed by solving the new translation from that point. Let React Flow handle its viewport math and use `screenToFlowPosition` at the boundary. A second subtraction would shift drops when panels open.
- Persist stable world geometry. Store groups in the same world coordinate space as their member bounds and derive the parent-relative positions React Flow expects. Reparenting and ungrouping preserve world positions. Track drag from pointer start to commit, roll back on cancel, and restore focus after dialogs close. Keep undo independent of camera navigation.
- Fit uses the visible pane after reserved panels, safe inset and padding. Calculate bounds from valid measured items. Empty selection keeps the camera, with an explicit **Fit board** action. Frame navigation stores `frameId`, fits its world rect with stable padding and cancels on user pan. Reduced motion jumps to the target. Back from a subboard, 3D or the demo restores board, frame, camera and available selection.
- Prefer typed orthogonal connections for technical flow and simple curves for concepts. Show arrows where direction matters. Place concise labels on a backing with enough clearance, with full relation text reachable from the inspector and outline. Custom card controls prevent pan or drag when interacting with content. Keep freehand points in world coordinates and cap length, bounds and point count.

## Proposed contracts and storage

These names and payloads are proposals. Implement Pydantic models and regenerate TypeScript only after the applicable phase approval. Existing generated schemas, identifiers, user data, mastery and citation semantics remain the compatibility baseline.

| Shape | Fields and invariants |
| --- | --- |
| `BoardDocumentV1` | `schemaVersion: 1`, `id`, server-bound workspace ID, `kind: engineering | knowledge`, title, monotonic `revision`, objects, connections, regions and ordered frames. Stored as a bounded versioned document with primary key and workspace ownership metadata in SQLite. |
| `BoardObject` | Opaque instance ID, discriminated type (`concept`, `document`, `component`, `note`, `stroke`, `portal`), finite bounded world rectangle, optional group ID and typed binding. Only note/annotation and other authored fields carry editable content. Provide provenance kind (`repository`, `semantic`, `user`, `aiProposal`), derived and verified at the appropriate boundary. |
| `BoardConnection`, `Region`, `PresentationFrame` | Connections reference two existing object IDs and carry a label and optional semantic edge binding. Regions name member IDs. Frames have stable ID, title, world bounds and optional target object. Presenter notes use a distinct display surface. Portals may reference another board in the same workspace and use bounded back navigation. |
| `BoardWrite` | Full versioned snapshot plus `baseRevision` and unique client mutation ID initially. Proposed `GET /boards/{boardId}`, `PUT /boards/{boardId}` and minimal list/create for approved user-created boards. Compare and swap atomically. A stale revision gives `409` and the current revision. Repeating the same mutation and payload returns its committed result. A mutation ID with a different body fails. Return only authorized board state. |
| `CanvasProposalV1` | Version, proposal ID, board ID, base revision, bounded discriminated operations and validated evidence refs. Operations add/move/update authorized presentation objects, link/group objects, create a subboard or highlight evidence. Preview a semantic diff. Apply the accepted list atomically under the same permission and revision check, with current graph/source references revalidated. |
| `PipelineObservationV1` | Optional additive, opt-in instrumented response or stream with run ID, type, source mode, stable stage name/status, safe counters and evidence IDs. Duration is optional, measured around real work. Keep this surface separate from existing chat response and ingestion event schemas. |

Phase 1 keeps edits session-local. In Phase 3, introduce an explicit versioned migration for the board store. Test it against a copy of a v1 database and an empty database. Avoid changing current rows and back up SQLite, Chroma and uploads together. Use one serialized write per board, debounce a finished edit, preserve an unsaved draft on failure, and offer reload or compare when a revision is stale. Do not apply silent last-writer-wins. Keep the last viewport as a local per-board preference if useful. A presentation frame is deliberate board content, so its bounds persist with the board. Engineering seed content can load from the build without a model request.

## Real observability and grounded AI

The existing ingestion stream reports queued/chunking/extracting batch progress, nodes, edges, complete and error. Use these events as recorded, with the existing replay cursor and terminal semantics. Do not imply separate OCR, embed, index or validation phases from a coarse event. Phase 4 can add safe spans around actual work and indicate skipped, measured or unavailable. Read pages and chunks once committed. Embedding model identity or dimension may be displayed when recorded. Never expose raw vectors, provider keys, private prompts or arbitrary document snippets in telemetry.

Instrument the existing retrieval path around query embedding/search, committed SQLite resolution, grounded generation and validation. If the adapter cannot distinguish substeps, show the combined stage. Display rank in committed retrieval order. Distances only appear when the actual path supplies a named metric and its direction. Citation provenance, retrieval relevance and claim support are separate checks. Ask through the existing route until an additive trace contract is approved.

Selection initially suggests a visible source scope from selected concepts' provenance. The user can confirm or adjust it, and stale or empty scoped selection requires a visible recovery path. Never broaden it silently to all documents. Personal or model-authored notes stay outside the trusted corpus. Support explicit broader lookup later without coupling board geometry to retrieval.

Validate AI output with Pydantic and the existing structured-output path. Treat evidence as untrusted text. Accept no executable content, unknown operation types, external file references or canonical graph edits. Check object types, finite geometry, limits, evidence membership, workspace, board revision and ownership again at apply time. If grouping and new child-board creation cross records, commit the approved batch in one database transaction. Record the operations and their inverse for undo. A generated idea with no matching source is labeled as a suggestion, never inserted as canonical knowledge. A declined or invalid proposal leaves storage untouched.
