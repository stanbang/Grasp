# GRASP Goal 4 engineering handover

26 November 2026. The owner reported that the pre-Goal 4 remediation passed independent acceptance. This handover records the accepted application baseline and the work available for reuse when Goal 4 starts.

## Repository checkpoint

| Item | Verified state |
| --- | --- |
| Current branch | `feature/grasp-v2-canvas` |
| Application HEAD at the start of this handover | `015206697c7f885e1db58bd90c8c97c40a7f2b6f` |
| Authentication remediation | `da6b343` is an ancestor of HEAD. |
| Canvas layout and semantic zoom remediation | `0152066` is the application HEAD. |
| Upstream | The local branch was seven commits ahead of its local `origin/feature/grasp-v2-canvas` tracking ref before the handover. |
| Working tree before authoring | The tracked files and index were clean. The pre-existing untracked file was `docs/GRASP_V2_SPEC.md`. |
| Recommended starting branch | Create `codex/goal-4-questions-requirements-context` from the local `feature/grasp-v2-canvas` tip when the owner gives the go. This includes the accepted application commits and this handover. |

The checked-in Developer Preview roadmap is the scope reference for Goal 4. The untracked specification has its own phase numbering and remains a separate draft. [Roadmap](roadmap.md) · [Preview specification](developer-preview.md)

## Implemented architecture and entry points

| Area | Current implementation | Code |
| --- | --- | --- |
| Web shell | Vite serves a client-side React 18 and strict TypeScript app with Tailwind, Lucide and a Zustand study store. The shell switches among Knowledge, Engineering and Projects. The 3D knowledge explorer loads on demand. | [main.tsx](../../apps/web/src/main.tsx) · [App.tsx](../../apps/web/src/App.tsx) · [study-store.ts](../../apps/web/src/study-store.ts) · [Mindmap.tsx](../../apps/web/src/Mindmap.tsx) |
| Canvas | React Flow renders all three workspaces. Knowledge projects the canonical graph and documents onto an editable scene. Engineering uses the shipped teaching scene. Those two canvas editing sessions are local to the page. Projects load saved board snapshots through the same renderer. | [board.ts](../../apps/web/src/canvas/board.ts) · [engineering-board.ts](../../apps/web/src/canvas/engineering-board.ts) · [use-board.ts](../../apps/web/src/canvas/use-board.ts) · [CanvasBoard.tsx](../../apps/web/src/canvas/CanvasBoard.tsx) |
| Project state | `ProjectCanvas` opens boards and publishes presence. `project-board.ts` translates snapshots and local edits into typed operations. `useProjectBoard` queues optimistic writes, keeps unsent drafts in session storage, and polls the head every 1.5 seconds when the page can safely adopt an update. A revision conflict stops the queue and keeps the draft available. | [ProjectCanvas.tsx](../../apps/web/src/canvas/ProjectCanvas.tsx) · [project-board.ts](../../apps/web/src/canvas/project-board.ts) · [use-project-board.ts](../../apps/web/src/canvas/use-project-board.ts) |
| Layout and inspection | The server optionally sizes and places new cards, including anchored additions. React Flow renders Project connector routes and tries label positions around card bounds. The outline searches object titles and relationship labels. The inspector opens full text and contextual feedback. Project zoom and pan are viewport state. | [canvas_layout.py](../../apps/api/app/canvas_layout.py) · [canvas-view.ts](../../apps/web/src/canvas/canvas-view.ts) · [CanvasObjects.tsx](../../apps/web/src/canvas/CanvasObjects.tsx) · [CanvasInspector.tsx](../../apps/web/src/canvas/CanvasInspector.tsx) |
| Service and storage | A single Python 3.11 FastAPI service owns board writes, ingestion, study routes and scoped knowledge reads. SQLModel maps to SQLite with foreign keys and WAL. Board heads and full JSON revisions are stored in `project_boards` and `board_revisions`. Chroma and original document files live alongside SQLite under `DATA_DIR`. | [main.py](../../apps/api/app/main.py) · [storage.py](../../apps/api/app/storage.py) · [canvas_storage.py](../../apps/api/app/canvas_storage.py) · [canvas_routes.py](../../apps/api/app/canvas_routes.py) |
| Authorization | The browser exchanges the owner token for a host- and port-bound, HTTP-only, SameSite Strict session cookie. SQLite stores a digest with a 30-day expiry. The owner can sign out this browser or all sessions. Token rotation invalidates earlier sessions. The agent presents its separate bearer token and is restricted to board and scoped knowledge routes. | [owner_sessions.py](../../apps/api/app/owner_sessions.py) · [request_controls.py](../../apps/api/app/request_controls.py) · [client.ts](../../apps/web/src/client.ts) |
| Serving and showcase | Development runs Uvicorn and Vite on loopback. Vite proxies `/api` to Uvicorn. The production wrapper serves the built web app and mounts the API at `/api`. The public showcase has a separate static entry and plays bundled sample traces. | [dev.py](../../scripts/dev.py) · [vite.config.ts](../../apps/web/vite.config.ts) · [production.py](../../apps/api/app/production.py) · [Showcase entry](../../apps/web/src/showcase/main.tsx) · [Dockerfile](../../Dockerfile) |

The board service applies batches under `BEGIN IMMEDIATE`. A batch supplies `baseRevision`, `mutationId`, and 1 to 240 typed operations. An identical retry returns the original receipt. A stale base or reuse of the mutation ID with a different request returns a typed conflict. Undo and redo on Project boards use owner-only revision restoration, which creates a new head. Board limits are 200 objects, 400 connections and a 512 KiB serialized snapshot. [Canvas service](../../apps/api/app/canvas_service.py)

## Canvas object and connection contracts

`ProjectBoard` has `id`, `projectId`, `schemaVersion` (currently 1), `title`, `revision`, `createdAt`, `updatedAt`, `createdBy`, and ID-keyed `objects` and `connections` maps. Pydantic is authoritative. The TypeScript mirror is generated. [Canvas contracts](../../apps/api/app/canvas_contracts.py) · [Generated TypeScript](../../apps/web/src/types/canvas-contracts.ts) · [Generator](../../scripts/generate_contracts.py)

| Contract | Fields and rules |
| --- | --- |
| `CanvasObjectData` | `id`, `kind`, `title`, `description`, `placement`, optional `canonicalNodeId`, `evidence`, `relatedObjectIds`, `relatedConnectionIds`, optional `sizing` (`auto` or `manual`), and kind-specific fields. Titles have a 96-character limit and descriptions have a 4,000-character limit. |
| Object kinds and details | `explanation`, `annotation`, `group`, `heading`, `text`, `illustration`, `evidence`, `requirement`, `question`, `prototype`. Annotation `noteStyle` is `plain`, `underline` or `callout`. An illustration uses a predefined ID. An evidence card needs a source span. Only notes, requirements and questions can attach to connections. |
| `CanvasPlacement` | World-space `x`, `y`, `width`, `height`, and optional `groupId`. Coordinates are bounded by ±1,000,000 and extents are greater than zero and at most 20,000. Groups have a single membership level. Automatic layout preserves old positions. An owner resize marks an automatically sized card as manually sized. |
| Requirement, question and prototype metadata | A requirement carries `status` (`proposed`, `accepted` or `rejected`) and `acceptanceCriteria`. A question has `required`. A prototype carries `previewId`, `revision`, `digest`, a relative HTML `entryPoint`, and `requirementIds`. |
| Saved `CanvasObject` | The server adds `createdBy` and `updatedBy` (`user` or `agent`). A saved answer has `text`, `answeredBy: "user"`, and `answeredAt`. A requirement decision has `decidedBy: "user"`. |
| Connection | `CanvasConnectionData` contains `id`, directed `source` and `target` object IDs, a nonblank `label`, `role` (`structural`, `data`, `process` or `annotation`) and optional `canonicalEdgeId`. A saved connection adds `createdBy` and `updatedBy`. Endpoints must exist on the same board, be distinct and avoid groups. Directed endpoint pairs are unique. |

The browser can create notes, questions and requirements attached to objects or relationships. It can reroute an authored connection while keeping its ID and feedback. Removing that arrow clears the live feedback association and retains the feedback and revision history. The owner can decide a requirement in the inspector. The service protects answers, decided requirements and owner-authored annotation content. It accepts the owner-only `answerQuestion` operation. The browser displays saved answers and criteria. Answer submission and criteria editing remain open for the browser workflow. [Inspector](../../apps/web/src/canvas/CanvasInspector.tsx) · [Mutation and permission rules](../../apps/api/app/canvas_service.py)

## MCP tools, CLI and installed skill

The `grasp-local-agent` Python package uses the MCP SDK pinned to 2.3.0 in its own environment. Stdio MCP and the `grasp` command share `GraspClient`, which calls the existing loopback API. `grasp setup` detects Codex and Claude Code, registers the launch command through the host, and installs the packaged `grasp-canvas` skill at user scope. Codex registration honors `CODEX_HOME` and the skill installs under `~/.agents/skills`. Local settings come from the ignored checkout `.env` or `GRASP_ENV_FILE`. Setup preserves existing credentials and reports registration or skill conflicts. `grasp doctor` checks service access and installation. `grasp open` resolves a Projects or board URL. [Package](../../apps/agent/pyproject.toml) · [Setup](../../apps/agent/src/grasp_agent/setup.py) · [Settings](../../apps/agent/src/grasp_agent/workspace.py) · [Client](../../apps/agent/src/grasp_agent/client.py) · [CLI](../../apps/agent/src/grasp_agent/cli.py)

| MCP tools | Implemented behavior |
| --- | --- |
| `list_boards`, `create_board`, `get_board` | Paginate board summaries, create an empty revision-zero board, or read a named board's head. |
| `get_board_context`, `get_selection` | Resolve the active board or return named candidates. Read selected objects and connections, nearby related items and feedback, decision and proposal IDs, and optional paged history since a known revision. Connection changes have before-and-after endpoints and labels. Item changes distinguish visual, semantic and mixed edits. The adapter supplies live workspace and board URLs. |
| `apply_canvas_operations` | Commit revision-checked draft edits with a mutation ID. `auto_layout` supplies size and placement for new items. `expand_from_object_id` requires an additive, explicitly labeled path from an existing object and validates overlap. Owner decisions and answers stay on the owner path. |
| `get_annotations`, `get_requirements` | Read saved notes and requirements at the current revision. Notes can be filtered by creator or last editor role. Question records and answers are available on the board snapshot. |
| `search_knowledge`, `read_source` | Search explicit shared documents and reopen a stable, exact text span. Both operations enforce the document allowlist. |

The skill resolves one board, opens its live URL alongside Codex Desktop when available, and keeps the board ID and inspected revision across turns. Before a write it reads context again. After the write it reads back the saved board and checks the rendered canvas when available. Browser presence comes from revision-bound heartbeats and expires after 25 seconds. Multiple plausible tabs yield an explicit ambiguity. [MCP catalog](../../apps/agent/src/grasp_agent/mcp_server.py) · [Packaged skill](../../apps/agent/src/grasp_agent/skills/grasp-canvas/SKILL.md) · [Presence and history](../../apps/api/app/board_context.py) · [Agent guide](agent-guide.md)

## Document ingestion and RAG implementation

### Upload through graph commit

1. `App.importFiles` filters PDF, Markdown and TXT. It sends multipart `file` requests to `POST /documents` and consumes the document's event stream. `document_routes.upload_document` validates the extension, filename and byte size. The default file limit is 10 MiB. `create_upload` hashes the bytes with SHA-256, reuses a matching active upload when available, saves the original as `DATA_DIR/uploads/<docId><extension>`, and commits the queued document and initial event before scheduling work. [Browser importer](../../apps/web/src/App.tsx) · [Upload route](../../apps/api/app/document_routes.py) · [Configuration](../../apps/api/app/config.py)
2. `IngestionQueue` serializes processing through one worker so concurrent uploads cannot race concept merges. `ingest_document` moves the document through `chunking` and `extracting`. It reads source pages, splits them, indexes chunk vectors, extracts and merges concepts, then commits the graph. On failure it attempts vector cleanup and saves a terminal error. Startup recovery marks interrupted uploads failed and removes partial vectors from the active collection. The event endpoint reads persisted events and resumes from `Last-Event-ID` or `after`. [Ingestion](../../apps/api/app/ingestion.py) · [SSE implementation](../../apps/api/app/events.py) · [Browser stream client](../../apps/web/src/client.ts)
3. `parsing.read_pages` uses `pypdf.PdfReader` to check PDF encryption and page count, then `PyPDFLoader` in page mode. It converts the loader's page number to one-based. Markdown and text decode as UTF-8 with optional BOM and become page 1. The parser limits PDF inputs to 250 pages and extracted text to 500,000 characters. The OCR path runs only when `OCR_ENABLED` is set and a PDF page has no extracted text. `ocr_page` rasterizes the page with Poppler `pdftoppm` at 150 DPI, caps the output at 2,200 pixels, and runs Tesseract with `OCR_LANGUAGE` (default `eng`). Intermediate PNGs live in a temporary directory. [Parsing](../../apps/api/app/parsing.py) · [OCR](../../apps/api/app/ocr.py) · [Container OCR dependencies](../../Dockerfile)
4. `chunk_pages` runs LangChain's `RecursiveCharacterTextSplitter` independently per page. Defaults are 900 characters with 150 characters of overlap. Whitespace is preserved. The returned start index and text are checked against the exact page substring before creating an ID of the form `<docId>:p<page>:<charStart>-<charEnd>`. Offsets count Unicode code points and `charEnd` is exclusive. [Chunking](../../apps/api/app/parsing.py) · [Stored rows](../../apps/api/app/models.py)
5. `index_chunks` embeds batches of up to 64 texts and checks count, nonempty vectors and finite values. It upserts IDs, text, vectors and source metadata to a persistent Chroma collection under `DATA_DIR/chroma`. `Storage` selects a collection keyed by the embedding identity. The default, `MOCK_LLM=1`, uses normalized 256-dimensional signed SHA-256 term vectors and fixture responses through `FakeListChatModel`. Live mode uses OpenAI or Gemini LangChain model and embedding adapters selected in configuration. The shared `LLMClient` calls `with_structured_output`, validates with Pydantic and retries once on invalid output. [Embedding and model adapters](../../apps/api/app/llm.py) · [Indexing](../../apps/api/app/ingestion.py) · [Chroma storage](../../apps/api/app/storage.py)
6. Concept extraction sends up to eight source chunks at a time and validates that returned concepts cite those chunks and edges name returned concepts. The document cap defaults to 40 touched concepts. `GraphMerger` matches normalized labels first and otherwise compares cosine similarity against concept embeddings with the configured threshold (default 0.90). Nodes accumulate `docIds` and `sourceChunkIds`. Directed graph edges accumulate document IDs. `commit_document` saves pages, chunks, graph records, concept vectors and final events to SQLite, preserves prior mastery, and marks the document ready. Concept vectors in SQLite support merging. Chunk vectors in Chroma support retrieval. [Extraction](../../apps/api/app/extraction.py) · [Merging](../../apps/api/app/merging.py) · [Graph commit](../../apps/api/app/graph_repository.py)

Reindex and replace process a replacement before removing the old source when processing succeeds. Delete removes the document's provenance from the graph and updates retained nodes and edges. File and vector cleanup across collections has a durable retry record. [Document routes](../../apps/api/app/document_routes.py) · [Lifecycle cleanup](../../apps/api/app/document_lifecycle.py)

### Retrieval and source verification

| Path | Code behavior |
| --- | --- |
| Shared retrieval | `retrieve_chunks` embeds the query through the active Chroma store and applies a `docId` filter when IDs are supplied. It preserves vector result order while resolving matches to SQLite chunks whose documents are `done`. Mock mode also checks exact term overlap when the query has significant terms. |
| Knowledge Q&A | Owner `POST /chat` uses the supplied document IDs or the ready library when the request scope is empty. It loads up to six saved turns and uses the last two questions to extend retrieval on detected follow-ups. Retrieved chunks are the evidence sent to the structured answer generator. When retrieval is empty, the route returns a decline. The validator checks citation membership, document, page and quote. Highlighted concept IDs are derived by intersecting graph `sourceChunkIds` with retrieved chunk IDs. |
| Project and MCP retrieval | `POST /knowledge/search` checks the explicit IDs against `GRASP_AGENT_SOURCE_DOC_IDS` for agent requests, limits input to 20 documents and results to 10, and searches ready documents. Empty scope returns an empty result. It returns ranked excerpts, source names and typed references with a mock or live flag. `POST /knowledge/source` reopens one reference under the same scope check. |

[Retriever](../../apps/api/app/retrieval.py) · [Study Q&A](../../apps/api/app/study_routes.py) · [Scoped knowledge routes](../../apps/api/app/knowledge_routes.py) · [Agent scope contract](../../apps/api/app/agent_contracts.py)

`CanvasEvidenceRef` has `chunkId`, `docId`, `page`, `charStart` and `charEnd` and is limited to a 4,000-code-point span. `resolve_evidence` checks ready document status, the chunk's document and page, chunk bounds, and equality between the stored page slice and the chunk slice. Removed or missing sources resolve as unavailable while the board still retains its durable reference. New canonical concept and edge bindings are validated against the source graph, including document scope for agent writes. [Evidence and binding validation](../../apps/api/app/canvas_service.py)

The Knowledge inspector opens source passages and pins an evidence card to its local canvas. The Project inspector opens exact spans on saved evidence. `SourceView` can show the original PDF in a Blob-backed frame and highlight extracted text. For an explicit span it uses `Array.from(pageText)` so browser offsets match Python code points. Study chat's legacy `Citation` carries a quote with chunk, document and page IDs. Its display fallback searches for the quote in the page text. [SourceView](../../apps/web/src/WorkspaceDialogs.tsx) · [Inspectors](../../apps/web/src/canvas/CanvasInspector.tsx) · [Study contracts](../schemas.md)

## Existing file and image capabilities

The Knowledge workspace has a file picker, a folder picker and recursive drag-and-drop ingestion for PDF, Markdown and UTF-8 TXT. Workspace options can replace, reindex and remove sources. The application can serve stored originals and extracted pages. The public showcase accepts bundled sample selections and rejects external file drops. [Folder import](../../apps/web/src/folder-upload.ts) · [Workspace options](../../apps/web/src/WorkspaceDialogs.tsx) · [Document API](../../apps/api/app/document_routes.py) · [Showcase drop handling](../../apps/web/src/showcase/drop.ts)

Project illustrations use a fixed set of technical drawings. PDF OCR interprets rasterized PDF pages as text and discards its temporary images. Image upload, screenshot ingestion, image or multimodal retrieval, and a persisted canvas attachment store remain proposed capabilities. Prototype cards currently display metadata. Bundle registration and serving, region feedback, approval and immutable export belong to the later Phase 5 plan. [Illustrations](../../apps/web/src/canvas/TechnicalIllustration.tsx) · [Canvas contracts](../../apps/api/app/canvas_contracts.py) · [Proposed prototype workflow](developer-preview.md#prototype-workflow)

## Verification and acceptance

| Evidence | Result at the checkpoint |
| --- | --- |
| Owner acceptance | The owner confirmed that the pre-Goal 4 remediation passed independent acceptance. This supersedes the pending status in the historical run plan. |
| Handover rerun | `scripts/check.py` passed contract generation drift, 84 Python tests, 25 Node tests and strict TypeScript. The separate agent environment passed 12 stdio MCP, CLI adapter and setup tests. The production build passed. |
| Recorded browser regressions | The Project and zoom Chrome regressions passed. They exercised owner session restoration, persisted draft conflict recovery, live board updates, connection edits, retained accepted requirements, exact Unicode citations and zoom without a revision change. The wallet fixture retained all 16 visible title elements at 32%. The rendered test found zero label-box overlaps at the three sampled zooms. A 160-card, 240-connection fixture exercised dense-board zoom. |
| Recorded live integration | Phase 3.2 proved same-tab live updates outside the checkout. During remediation a new projectless desktop chat created and read back 11 automatically placed cards and 14 relationships. The standalone Codex smoke test created and read its board. Its unattended approval policy blocked the write. The stdio suite separately verified actual mutation, automated layout and readback. |
| Retrieval evidence | The rerun used local fixtures. The repository also holds earlier native OCR and live-provider records. The static showcase is a recorded replay. |

[Pre-Goal 4 acceptance record](pre-goal-4.md) · [Phase 3 desktop verification](phase-3.md#phase-32-workspace-integration) · [OCR record](../ocr-verification.json) · [Live-provider record](../live-verification.json)

Start the local app from the checkout on Windows in one terminal. Use a second terminal for the checks with the existing environments. `grasp doctor` checks the live local app and installed adapter. The browser regressions use disposable libraries and the built frontend. Their Chrome and Playwright paths can be supplied through `GRASP_CHROME` and `GRASP_PLAYWRIGHT`.

```powershell
py -3.11 scripts/dev.py
```

```powershell
.\.venv-mcp\Scripts\grasp.exe doctor
.\.venv\Scripts\python.exe scripts/check.py
.\.venv-mcp\Scripts\python.exe -m unittest discover -s apps/agent/tests -v
npm run build
node scripts/tests/project-browser.cjs
node scripts/tests/zoom-browser.cjs
```

## Known limitations and follow-up

- The preview is single-owner and local. Board validation enforces same-board relationships and revision isolation. The workspace agent token grants board access within the local workspace. The source allowlist governs requests for indexed evidence. Production multi-tenant access control is outside the current deployment model.
- Codex Desktop uses the built-in Browser beside the chat. Browser sessions are specific to one origin and browser profile. Native embedding and a direct agent-session bridge remain deferred. The standalone CLI write in the unattended smoke test remains unverified through that host approval path. Claude Code setup has fixture coverage and actual Windows Claude Code interaction remains unverified. [Windows setup and acceptance](agent-guide.md)
- Automatic layout estimates text size and finds bounded local space. Manual cards can need the inspector to show all content. Dense edge routing can fall back to crossings or omit a label whose box cannot fit. Use the outline or connection inspector for the full relationship label. [Canvas remediation](pre-goal-4.md)
- Reindex when changing embedding identity. Retrieval filters Chroma candidates against finalized SQLite rows and can return fewer than `topK`. The chat validator proves source provenance and quote accuracy. Entailment of every generated statement is a separate evaluation task. [Retrieval audit](../facts.md)
- OCR reads blank PDF text layers when enabled. A partially wrong existing text layer can bypass OCR. OCR citations refer to recognized text, which can contain recognition errors. Study chat's page-level quote search can highlight the first occurrence of a repeated quote. Exact Project evidence avoids that ambiguity with offsets.
- The baseline still reports a deprecation warning from the LangChain community PDF import and build warnings for Browserslist data, React Flow bundling metadata, and the existing large lazy-loaded 3D bundle. [Parser](../../apps/api/app/parsing.py) · [Build configuration](../../apps/web/vite.config.ts)

## Proposed Goal 4 scope and preservation requirements

The tracked Goal 4 gate is to resolve two questions in the browser, have Codex read the saved owner answers and update the linked objects, and demonstrate both an authorized exact source and a project with an empty source scope. Reuse `answerQuestion`, `CanvasRequirement`, and the existing object and evidence context endpoints. Extend the browser workflow around those contracts and carry the architecture and user journey on the same board. The accepted checkpoint already includes requirement decisions, feedback associations and agent readback. Browser question resolution and the full contextual evidence workflow are the remaining Goal 4 work. [Roadmap](roadmap.md) · [Preview scope](developer-preview.md)

Preserve the following during implementation.

- The approved React Flow canvas, saved object and connection IDs, existing manual placements, semantic zoom and viewport-only camera changes. Keep automatic layout and anchored expansion safe for existing content.
- SQLite revision history, atomic batches, idempotent retries, stale-draft recovery and same-board reference checks. Keep statements of owner intent attributable across sessions. Preserve owner-authored feedback, selected connections and before-and-after history when routes change.
- User-level stdio MCP registration, the CLI, the single-board skill workflow, and owner session restoration and revocation. Keep bearer agent and browser owner capabilities separate.
- The existing Knowledge and Engineering workspaces, static showcase, document lifecycle, study chat and mastery flow. Keep the public Pydantic schemas and generated TypeScript in sync.
- Exact page-local Unicode spans, canonical graph provenance, scoped evidence reads, local data handling and the distinction between live retrieval, mock mode and recorded replay. Preserve the design workflow for projects with zero shared sources.
