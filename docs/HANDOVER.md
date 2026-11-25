# Grasp handover

## Phase 2 service acceptance

The owner approved Phase 2 after manual acceptance and engineering review. The agent created the acceptance board at revision 1, and HTTP readback verified the owner's changes at revision 8. The owner approved keeping the polling sync and starting Phase 3. [Phase 2 checkpoint and API contract](grasp-v2/phase-2.md)

## Developer Preview handoff before Phase 2

**Handoff snapshot, 25 November 2026 (Singapore).** The HTX interview is **7 December 2026**. The plan targets a complete preview by 4 December and reserves 5–6 December for integration and rehearsal. Phase 1.1 has the owner's explicit visual approval. The revised implementation plan was delivered for review. This handover records no separate go for Phase 2, so confirm the owner's latest instruction when the new thread starts. Finish and verify Phase 2 before taking up Phase 3, and obtain the owner's go at the boundary.

Read [AGENTS.md](../AGENTS.md), the [Developer Preview specification](grasp-v2/developer-preview.md), the [shared service design](grasp-v2/canvas-architecture.md#developer-preview-service) and the [roadmap](grasp-v2/roadmap.md). Use [VISION.md](../VISION.md), [PRODUCT.md](../PRODUCT.md), [DESIGN.md](../DESIGN.md#shared-whiteboard) and the [shared canvas brief](../.impeccable/surfaces/shared-canvas.md) for product and UI decisions. The earlier study-centric roadmap is historical where it conflicts. The [HTX storyboard](grasp-v2/storyboard.md) includes the live flow and labeled fallback.

### Git checkpoint and working files

- Use `feature/grasp-v2-canvas`, tracking `origin/feature/grasp-v2-canvas`. At the start of this handoff, HEAD was `6301b1c31e82e1ca34decd2ed2f557305446e6e3` and the branch was three commits ahead of its local tracking ref. `6301b1c` is the last pre-handoff checkpoint. Use `git status --short --branch` and `git log -1 --oneline` to see the current tip, including this documentation handoff.
- The feature branch started from `showcase-overhaul` at `98f8cda`. Keep `main`, `feature/interactive-workspace-ui`, `feature/rag-interview-showcase` and `showcase-overhaul` as historical checkpoints. Their histories diverge, and reusable features were audited individually. No branch consolidation is needed. [Branch comparison](grasp-v2/baseline.md#branch-recommendation)
- `docs/GRASP_V2_SPEC.md` was already untracked and is the owner's original brief. Preserve it. `docs/HANDOVER.md` was also untracked before this requested update. At handoff start there were no tracked modifications or staged files. Local captures, test browser tools and disposable databases under `work/` are ignored and might be absent in a new checkout. Pushes and publication require separate authorization.

### Completed work and approval history

| Phase | Delivered |
| --- | --- |
| 0 · Research | Audited all four branches, tested the baseline, examined Enso's public canvas material with Browser and REA, reviewed the PayNow repository and recorded how FigJam, Obsidian and NotebookLM informed the design. Chose the showcase baseline and React Flow. Native Enso editing remained unverified. Reuse the [reference ledger](grasp-v2/references.md) and [architecture and branch audit](grasp-v2/baseline.md). |
| 1 · Canvas foundation | `dcc8c6a` and `8cd9582` added the shared 2D board, deterministic Knowledge and Engineering seeds, selection, geometry, grouping, undo and redo, evidence inspection and the lazy 3D round trip. The owner declined the first visual treatment, which led to the Phase 1.1 redesign. [Checkpoint](grasp-v2/phase-1.md) |
| 1.1 · Direction A+ | Three rendered directions were reviewed. The owner chose Direction A with warmer charcoal, original illustrations, semantic connection colors and handwritten annotation. The actual implementation `ea8e246` and verification `ae76ddb` were approved on 25 November. The two independent Impeccable reviews, polish and before-and-after captures are in the [Phase 1.1 record](grasp-v2/phase-1-1/README.md). |
| Revised preview plan | `6301b1c` records the reuse audit, architecture, SDK research and delivery gates. GRASP now helps a user clarify a software idea with an external coding agent, review an editable proposal and prototype, and approve a versioned specification. Retrieval supplies context when relevant. The video editor is the interview example and stays outside the generic board service. |

### What is already reusable

- **Direction A+.** Keep the canvas visually dominant. Use warm charcoal, Source Serif 4 headings, Caveat handwriting, off-white technical drawings, restrained evidence and process colors, and gold for mastery. Both fonts are local with OFL notices. Keep tools and inspectors contextual. Enso informs the composition, Figma editing, Obsidian organization and NotebookLM evidence inspection. [Design system](../DESIGN.md#shared-whiteboard)
- **Renderer and objects.** [CanvasBoard.tsx](../apps/web/src/canvas/CanvasBoard.tsx) handles gestures, outline, selection, fit and presentation. [CanvasObjects.tsx](../apps/web/src/canvas/CanvasObjects.tsx), [CanvasInspector.tsx](../apps/web/src/canvas/CanvasInspector.tsx) and [canvas.css](../apps/web/src/canvas/canvas.css) define the object rendering and inspection surface. [TechnicalIllustration.tsx](../apps/web/src/canvas/TechnicalIllustration.tsx) contains 16 original SVG illustrations. [engineering-board.ts](../apps/web/src/canvas/engineering-board.ts) provides the seeded pipeline. Its [vector demonstration](../apps/web/src/canvas/CanvasVisualization.tsx) is illustrative. Preserve React Flow attribution.
- **State and projection.** [board.ts](../apps/web/src/canvas/board.ts) separates `BoardDocument` from `BoardScene`. It projects stable canonical concept/document IDs into the scene and overlays authored cards, links and placements. [use-board.ts](../apps/web/src/canvas/use-board.ts) keeps the current document, an in-memory revision counter, a 60-entry undo history, gesture state, selection and viewport. The revision is local. [App.tsx](../apps/web/src/App.tsx) holds separate Knowledge and Engineering sessions. Board edits and evidence pins are lost on reload. No durable project boards exist to migrate.
- **Renderer regression to keep.** During Phase 1.1 verification, engineering connectors could disappear after returning from 3D and switching boards. `CanvasBoard` now derives explicit ports and measured dimensions from the current world geometry. Keep those values in the renderer projection when replacing the state source. Exercise board switching, connection rendering and resize together in the browser suite.
- **Workspace integration.** Preserve [client.ts](../apps/web/src/client.ts), [study-store.ts](../apps/web/src/study-store.ts), [upload-state.ts](../apps/web/src/upload-state.ts), [WorkspaceDialogs.tsx](../apps/web/src/WorkspaceDialogs.tsx) and the on-demand [Mindmap.tsx](../apps/web/src/Mindmap.tsx). Knowledge can open and pin exact source evidence. Engineering has focused presentation paths. `/showcase/` remains a separate offline replay using bundled material.
- **Existing persistence.** [main.py](../apps/api/app/main.py) owns FastAPI and the storage lifecycle. [storage.py](../apps/api/app/storage.py) initializes SQLite with WAL and foreign keys, plus persistent ChromaDB. [models.py](../apps/api/app/models.py) and [workspace_models.py](../apps/api/app/workspace_models.py) persist library, source spans, graph provenance, mastery, ingestion events, file digests, cleanup and conversations. Original files sit under the configured data directory. Phase 2 adds project state to this foundation. It does not require a second database or Chroma collection.
- **Existing HTTP and contracts.** [document_routes.py](../apps/api/app/document_routes.py) handles document lifecycle, exact source reads and ingestion SSE. [study_routes.py](../apps/api/app/study_routes.py), [retrieval.py](../apps/api/app/retrieval.py) and [conversations.py](../apps/api/app/conversations.py) handle scoped retrieval, cited chat, mastery and saved conversations. `/graph` and `/progress` are defined in [main.py](../apps/api/app/main.py). [request_controls.py](../apps/api/app/request_controls.py) supplies body and rate limits and optional workspace bearer auth. Treat [schemas.py](../apps/api/app/schemas.py), [schemas.md](schemas.md), and the [generated TypeScript contracts](../apps/web/src/types/contracts.ts) as the compatibility baseline. Use [generate_contracts.py](../scripts/generate_contracts.py) for additive shapes and drift checks.

### Phase 2 · Persistent project canvas and typed operations

1. Keep one FastAPI application and one SQLite engine. Add versioned project/board records and mutation receipts alongside existing rows. Start with a single board per project and stable IDs. Wire the approved shared renderer to one project board while keeping Knowledge, Engineering and replay working.
2. Use typed, bounded list/create/read and operation routes, with `POST /boards/{boardId}/ops` as the proposed write boundary. Validate the complete operation batch and references, permissions, geometry and size. Apply `baseRevision`, `mutationId`, the updated snapshot and its receipt atomically. Competing writes at the same revision yield one commit and one `409`. Retry returns the original receipt. Reusing a mutation ID with different content fails. Derive attribution from credentials.
3. Send one operation batch for a finished gesture. Retain local drafts on failure and keep viewport, hover and intermediate drag state out of persistence. A saved undo uses a new inverse operation against the current revision. Prove browser reload and API restart preserve IDs and geometry. Verify a clean database and a copy of a populated study database. Include malformed, cross-board, unauthorized, stale and retry tests, plus existing study and rendering regressions.

### Phase 3 · CLI and Codex MCP

1. After Phase 2 review, route the local CLI and stdio MCP adapter through the same FastAPI service. The adapter must not bypass service validation, open SQLite or Chroma directly, or expose generic filesystem, shell or network access. Give the agent a separate scoped credential for authorized reads and draft mutations. Human approval is reserved for the owner's workspace in a later phase.
2. Implement list, create and read boards, apply a validated operation batch, and read the current board-scoped selection when available. Selection is transient and may explicitly be unavailable. Verify stale-write responses through both clients. Requirements, contextual retrieval, prototype registration and approval export belong to Phases 4–5.
3. The researched candidate is the official Python MCP SDK v2 over stdio. Adding it requires owner approval. Confirm lockfile compatibility and pin the compatible patch release. A separate adapter environment is an option if required. The Windows Codex CLI reported `0.171.0-alpha.13.2` with MCP commands, and the proposed TOML parsed. Installation, trusted project setup and a real server handshake are pending. Verify discovery, one Codex mutation, matching CLI output and the saved result after a browser reload. [MCP configuration and gates](grasp-v2/developer-preview.md#agent-integration)

### Guardrails and remaining gaps

- Keep canonical graph/source IDs and exact quote semantics stable. Page numbers start at one. Offsets are page-local Unicode code points with an exclusive end. Derive `referencedNodeIds` from retrieved chunks. Preserve mastery, saved conversations, SSE replay and the offline mock path. Project writes have no authority over canonical study records. Never persist 3D layout coordinates. Keep secrets, private uploads, databases and generated embeddings out of Git.
- Preview security and revisions are future gates. Keep the app loopback-bound. Preserve the boundary between illustrative UI, real records and recorded replay. The future iframe must use an isolated asset origin with no app credentials, and the video editor must clearly label simulated processing and publishing. No real Instagram credentials are needed. The fallback never counts as a successful live MCP or iframe check.
- Physical projector and screen-reader review remain open. Browser checks covered responsive layouts and keyboard interactions. Known build and dependency warnings include Browserslist data, the React Flow bundle directive, large lazy 3D output and the deprecated PDF loader dependency. Local-first single-owner storage, the authorized preview scope and the rehearsal window are deliberate constraints. No public deployment, paid provider run or earlier branch change is part of this handoff.

### Verification and local reproduction

The handoff reran `python scripts/check.py` in local mock mode. Contract drift, 72 Python tests, 24 Node tests and strict TypeScript passed. The production build and disposable Chrome flow passed during Phase 1.1 verification. That browser run covered gestures, evidence pin/reopen, import/SSE, source lifecycle and 2D/3D recovery. Impeccable captured 1440 × 900, 1280 × 720 and 390 × 844. Review the [original commands and capture index](grasp-v2/phase-1-1/README.md#verification-on-25-november-2026), and use [the Phase 1 setup](grasp-v2/phase-1.md#review-and-evidence) if the ignored Playwright install is missing.

Run `python scripts/dev.py` in Python 3.11 with `MOCK_LLM=1` and a disposable `DATA_DIR`. Use the displayed loopback URL. `?board=engineering` opens the presentation board. The review used web port `5189` and API port `8019`, but check current listeners before using them. Run `python scripts/check.py` and `npm run build` at each implementation boundary. If the sandbox stalls mock ingestion, the prior verification succeeded with an approved local run that allowed the ingestion worker and temporary ChromaDB to operate. Preserve the mock and disposable data settings.

## Earlier showcase handover

The section below preserves the original 24 November handover. Its branch, approvals, test counts and proposed visual direction describe that historical checkpoint.

**Snapshot recorded 24 November 2026.** The current branch is `showcase-overhaul`, tracking `origin/showcase-overhaul`, at `98f8cda`. The worktree was clean before this document was created. At handoff, the only uncommitted change is this new file. `f2a66fb` is the original workspace checkpoint. `v0.6.0-showcase.1` tags an earlier showcase preview.

### Product intent and next overhaul

Grasp was built for students who want to ask questions across their own notes, see how concepts connect, inspect the exact passage behind an answer, and check understanding with grounded quizzes. The HTX showcase was a separate goal. It gives an interviewer a short case study, a five-minute walkthrough and evidence to probe the RAG design, tradeoffs, adaptation process, evaluation and production limits. Student needs came from the owner's brief. There are no measured adoption or learning outcomes.

**Proposed for the next thread.** Build an Enso-inspired infinite whiteboard and an interactive technical presentation for HTX. The owner named Figma, Obsidian and NotebookLM as interaction references. Treat any proposed canvas manipulation, linked-note navigation and source-centered Q&A patterns as design hypotheses. The next agent should decide which patterns help the study and presentation flows. Whiteboard objects, coordinates, persistence, editing, collaboration and presentation mechanics have no approved implementation or schema yet.

**Scope change from this conversation.** The owner released the previous UI direction as a fixed requirement. Independently reassess the layout, visual identity, entry flow and role of the 3D graph. The existing backend behavior, source contracts, data integrity and offline demo boundary are the engineering foundation to preserve. Read [AGENTS.md](../AGENTS.md), [PRODUCT.md](../PRODUCT.md), [DESIGN.md](../DESIGN.md) and the [surface briefs](../.impeccable/surfaces/) for history and existing repo rules. Reconcile any historical visual mandates with this newer direction before shaping the overhaul.

### Current implementation and checkpoints

| Checkpoint | Implemented or delivered |
| --- | --- |
| Workspace phase 1 | Loopback app skeleton, typed API contracts, initial workspace UI and product/design direction. [Checkpoint](phase-1.md) |
| Workspace phase 2 | Real file ingestion, page extraction and chunk offsets, local vector indexing, concept merges, progress events and failure recovery. [Checkpoint](phase-2.md) |
| Workspace phases 3–5 | Interactive concept graph, cited Q&A, source inspection and mastery quizzes. [Checkpoint](phase-5.md) |
| Workspace phase 6 | Same-page folder import, source management, saved conversations and scoped follow-ups, optional OCR, Docker self-hosting and verification. [Checkpoint](phase-6.md) · [Folder workflow](folder-first.md) |
| Showcase overhaul | Evidence audit and reproduced offline retrieval experiment, Figma captures and local brand assets, three recorded traces, offline replay and source inspection, interactive RAG guide, interview kit, GitHub metadata, release tag and CI artifact. Public deployment and native Figma completion remain open. [Progress and acceptance audit](PROGRESS.md#completion-audit) |

### Architecture and entry points

- **Client.** Vite, React 18, strict TypeScript, Tailwind CSS, Zustand, Lucide, Three.js and `react-force-graph-3d`. Both entries are client-rendered. Development uses Vite's `/api` proxy. Production serves the built client and mounts the API at `/api`.
- **Server.** Python 3.11, FastAPI, Pydantic v2, SQLModel and SQLite, persistent ChromaDB, and LangChain adapters for Gemini or OpenAI. `.env.example` defaults to offline mock mode with OpenAI model names. Live Gemini evidence comes from archived runs. Optional OCR uses Poppler and Tesseract. The Docker service runs as non-root with one API worker and one ingestion worker.
- **Storage.** SQLite holds document and page records, exact chunks, graph and provenance, events, conversations, quiz attempts, progress and cleanup records. Chroma stores chunk vectors in provider/model-specific collections. Originals live under `data/uploads`. SQLite uses WAL and foreign keys. Existing-column changes need an explicit migration. Back up SQLite, Chroma and originals together.
- **Local workspace `/`.** Supports file and folder imports of PDF, Markdown and UTF-8 text, a persistent study library, source lifecycle operations, scoped conversations, the interactive graph, extracted-page and original-PDF inspection, and quizzes. [Architecture](architecture.md) · [Deployment](deployment.md)
- **Static showcase `/showcase/`.** Uses bundled mock traces and runs without a backend or key. It replays pages, overlapping chunks, projected embeddings and concept links, then opens the map and exact citations. Recorded starter answers and local text matches are distinct from live generation. The 3D engine loads on demand; a 2D view and reduced-motion stepping are available. `?view=guide` opens the interactive five-topic explanation, including a plain-versus-grounded prompt comparison and archived retrieval settings.

| Area | Start here |
| --- | --- |
| Workspace UI and data flow | [App.tsx](../apps/web/src/App.tsx), [WorkspaceDialogs.tsx](../apps/web/src/WorkspaceDialogs.tsx), [Mindmap.tsx](../apps/web/src/Mindmap.tsx), [folder-upload.ts](../apps/web/src/folder-upload.ts), [client.ts](../apps/web/src/client.ts), [study-store.ts](../apps/web/src/study-store.ts) and `useStudyGraph` |
| Upload, indexing and recovery | [document_routes.py](../apps/api/app/document_routes.py), [parsing.py](../apps/api/app/parsing.py), [ocr.py](../apps/api/app/ocr.py), [ingestion.py](../apps/api/app/ingestion.py) and `ingest_document` / `IngestionQueue`, [merging.py](../apps/api/app/merging.py), [document_lifecycle.py](../apps/api/app/document_lifecycle.py), [events.py](../apps/api/app/events.py) |
| Retrieval and study | [retrieval.py](../apps/api/app/retrieval.py) and `retrieve_chunks`, [study_routes.py](../apps/api/app/study_routes.py) and `chat` / `quiz` / `grade`, [conversations.py](../apps/api/app/conversations.py), [llm.py](../apps/api/app/llm.py) and `LLMClient`, [storage.py](../apps/api/app/storage.py) and `Storage` |
| Public contracts and deployment | [schemas.py](../apps/api/app/schemas.py), [schemas.md](schemas.md), [generated contracts.ts](../apps/web/src/types/contracts.ts), [generate_contracts.py](../scripts/generate_contracts.py), [production.py](../apps/api/app/production.py), [request_controls.py](../apps/api/app/request_controls.py), [CI workflow](../.github/workflows/checks.yml) |
| Replay, guide and interview assets | [Showcase.tsx](../apps/web/src/showcase/Showcase.tsx), [replay.ts](../apps/web/src/showcase/replay.ts), [drop.ts](../apps/web/src/showcase/drop.ts), [evidence.ts](../apps/web/src/showcase/evidence.ts), [RagGuide.tsx](../apps/web/src/showcase/RagGuide.tsx), [showcase_models.py](../apps/api/app/showcase_models.py), [trace exporter](../scripts/record_showcase_traces.py), [talk track](interview-talk-track.md), [About copy](about-snippet.md) and [assets](assets/README.md) |

### Engineering decisions and non-regression checks

- **Keep exact source provenance.** Pages are one-based. Chunk offsets are page-local Unicode code points with an exclusive end, measured against extracted or OCR text. They are different from PDF screen coordinates and JavaScript UTF-16 indices. Citations must match retrieved chunk ID, document, page and an exact substring. Derive `referencedNodeIds` from retrieved chunks. The graph provides navigation; Chroma supplies retrieval candidates. Exact provenance and support for an answer claim are separate checks. [ADR 001](decisions/ADR-001-source-provenance.md)
- **Preserve ingestion consistency.** Uploads deduplicate by SHA-256 of the original bytes. The default limit is 40 extracted concepts per document. Merge normalized labels first, then use a configurable embedding similarity threshold. Retain mastery and union source provenance on merges. Commit pages, chunks, graph updates and completion events together in SQLite. Retrieval resolves vector hits against committed chunks. Clean up staged vectors on failure, replay SSE by cursor and retain durable interrupted-job and cleanup records. Replacements and re-indexes finish the new version before deleting the previous one.
- **Keep model modes honest.** Configure LangChain chat and embedding adapters through server settings. Live output uses structured output, local Pydantic and grounding validation, and one retry for invalid output. Mock mode uses deterministic embeddings and fixtures through `FakeListChatModel`, without a provider key or network call. Keep embedding spaces isolated and re-index when changing the model. Follow-up turns supply context; source passages supply evidence.
- **Keep retrieval defaults distinct from experiments.** The workspace uses a recursive 900-character target, up to 150 characters of overlap, and bounded vector retrieval with document scope. The archived Gemini experiment found 19/20 at Hit@3 with the baseline and 20/20 with either shorter chunks or term reordering. The cases were authored and used to inspect variants. Both changes remain experiments. The original one-note Hit@5 run is a wiring check. [ADR 002](decisions/ADR-002-retrieval-baseline.md) · [Evaluation](evaluation.md)
- **Preserve mastery and public contracts.** Generate TypeScript and the schema reference from Pydantic and run the drift check. Keep `sourceChunkIds`, graph provenance and the public mastery values `unexplored`, `learning`, `mastered`. Progress fields are `masteredCount`, `exploredCount`, `totalNodes`, `coveragePercent` and `crossDocLinks`. Three grounded quiz questions, a pass threshold of two and server-only keys until grading are established behavior. There is no XP or streak system. Force-graph layout positions stay transient. Any future persistent whiteboard geometry needs its own design and migration decision.
- **Keep public replay isolated.** Inspect drag metadata only far enough to reject external files. The demo must never read real dropped items, filenames or bytes. Only bundled IDs can start a replay. Preserve exact source opening, keyboard selection, reduced-motion controls, pause and rate continuity, and touch cancellation without duplicate playback. Keep provider keys, private uploads, local databases and generated embeddings out of Git. [ADR 003](decisions/ADR-003-provider-and-replay.md) · [Browser checks](showcase-review.md)

### Design and conversation context

- The owner originally favored a quiet dark star chart, restrained branding, one cool accent, gold for mastered concepts and slow purposeful motion. They wanted imports to reveal Q&A on the same page without navigating or opening an implicit picker. Source lists, saved conversations and quizzes lived behind explicit controls. The visual decisions are historical. Preserve the ability to reach sources and study actions while reassessing where those actions belong.
- The owner chose their personal Figma workspace and authorized self-review across the earlier showcase phases. The [Figma draft](https://www.figma.com/design/3rtdi0qiFA8f6ct5MlOp76) contains six captured designs. The local React showcase has the working interaction. Native Figma prototype links and Figma-origin exports are still pending.
- The owner supplied the [shared ChatGPT review](https://chatgpt.com/share/6b04afc4-939c-83ec-99ab-1b58f98d5dba) and requested its architecture image in the README. They asked for a student-friendly prototype that shows the technologies, follows one example and answers the interview questions. The guide draws on selected DeepLearning.AI transcripts across the five course modules using original Grasp examples and diagrams. There is no claim of course completion or certification. [Course sources](course-walkthrough.md)
- The earlier chat reference informed the composer, prompt suggestions and collapsible history. Grasp has its own implementation and branding. The new HTX presentation is proposed. Reuse the [talk track](interview-talk-track.md), [facts](facts.md), [archived evaluation](evaluation.md) and verified source examples as material.

### Open work and limits

- **GitHub Pages.** CI packaged the static demo, and the artifact was tested locally under `/Grasp/`. The public walkthrough returned 404 at the last audit. The Pages environment allows only `main`. Adding `showcase-overhaul` and uploading the custom social preview each require explicit owner approval. The repository had no open issues or custom social image at that audit.
- **Figma.** The connected seat was View on the selected Starter plan. Editing and native exports were blocked. Checked-in SVGs are original local diagrams and the PNGs were rendered from them. [Asset provenance](assets/README.md)
- **Device verification.** Browser checks and automated gesture-handler tests passed. Physical touchscreen behavior and sustained 60 fps on representative mid-range hardware remain unverified. The frame probe measured browser callbacks on one Lenovo laptop; later runs varied. [Frame probe and limitations](showcase-review.md#browser-frame-sample)
- **Data and production.** The networking note is provisional. Folder import support varies by browser, and the library stores filenames without full directory hierarchy. The server is single-owner. It has health checks, saved events and an optional owner token, with no tenant isolation, alerting or distributed job coordination. Historical quotes remain in conversations after source deletion. The PDF loader package is deprecated, and the lazy 3D bundle produces a size warning.
- **Evidence and approvals.** Held-out retrieval, claim-support, plain-model comparisons, billed cost, end-to-end latency and learner outcomes remain unmeasured. Proposed paid runs and the license choice are in [Needs owner approval](PROGRESS.md#needs-owner-approval). The earlier showcase goal was marked blocked on external gates and later cleared. This handover grants no publication, licensing or spending approval.

### Run and verify

From the repo root, use Python 3.11 and a supported Node version. The launcher checks Node 20.19+, 22.12+ or newer supported releases.

```sh
python scripts/dev.py --setup
python scripts/dev.py
python scripts/check.py
npm run build
```

Use `--setup` for the first run and `dev.py` alone on subsequent runs. Open [workspace](http://127.0.0.1:5173/), [showcase](http://127.0.0.1:5173/showcase/) or [guide](http://127.0.0.1:5173/showcase/?view=guide). The API listens on loopback port 8000 in development. With web dependencies installed, `npm --prefix apps/web run dev` serves the static showcase; `docker compose up --build -d` serves the full app on loopback port 8080.

The last code revision `a28e37d` passed 72 Python tests, 17 Node checks, contract validation, strict TypeScript and the production build. The [hosted offline job](https://github.com/stanbang/Grasp/actions/runs/45344457592) passed and uploaded the Pages artifact. Deployment failed at the branch gate. The following commit and this handover change documentation only. Backend tests cover parsing, offsets, storage, merge/scope rules, retry validation, quizzes, lifecycle and trace provenance. Node tests cover folder import, drop safety, touch handler behavior, replay controls and archived guide evidence.

```sh
python scripts/generate_contracts.py --check
node --test scripts/tests/folder-upload.test.cjs scripts/tests/showcase.test.cjs
python apps/api/eval/run.py --output work/original-mock.json
python apps/api/eval/portfolio.py --output work/portfolio-mock.json
npx impeccable detect apps/web/src
```

Keep `MOCK_LLM=1` for offline verification. Use [facts.md](facts.md) to compare archived runs and [showcase-review.md](showcase-review.md) for browser, animation, frame and package checks. `scripts/verify_live.py` requires a live provider and can incur charges.

### Tools and design workflow

- **GitHub MCP and `gh` CLI.** Used to inspect repository state, issues and metadata, verify Actions and download the Pages artifact. Git handled conventional commits and the preview tag.
- **Figma MCP.** The official capture workflow created the draft in the selected personal workspace. Figma write/design and export capabilities depend on the connected seat and plan. Use the relevant Figma skill before tool calls that require it.
- **Computer Use and browser tools.** Used for reference research, responsive checks, replay controls, citations and package testing. Use isolated bundled notes for demo verification.
- **Impeccable and Humanizer.** Impeccable shaping, critique, polish, audit and detector checks informed the workspace and showcase. Humanizer guided plain technical copy and evidence review. Recheck skill availability and instructions in the next thread. [Original design tooling](phase-1.md#development-tools) · [Showcase review](showcase-review.md)
