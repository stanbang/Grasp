# GRASP Developer Preview v0.1

Approved plan for the post-Phase-1.1 sequence, 25 November 2026. It governs wherever it differs from the original spatial knowledge workspace plan. [Vision](../../VISION.md) · [Approved whiteboard](phase-1-1/README.md) · [Phase 2 service checkpoint](phase-2.md)

## The product

A user brings a software idea to an external coding agent. The agent opens a GRASP project board, records unresolved questions and proposes a diagram. The user resolves the questions on the board and can see which objects, steps or prototype regions they affect. The agent can use indexed sources when relevant. It builds an isolated prototype, registers a revision and reads the user's visual feedback. The user approves a specific board revision. GRASP exports the approved requirements, decisions, prototype revision and acceptance criteria for implementation.

Show externally communicated work on the board. Separate source-backed facts, user decisions, unresolved questions and agent proposals by type and provenance. A project without indexed documents can complete the same flow. Local-first describes the board and source stores. A configured external agent or live provider can receive the supplied prompt and authorized evidence. Rehearse using public or synthetic fixtures and disclose the active mode.

## Phase 1.1 reuse audit

Review baseline `ea8e246`, recorded at `ae76ddb`. The audit below distinguishes what the code does today from what the preview needs. It extends the [architecture inventory](baseline.md#implementation-inventory) and [Phase 1.1 results](phase-1-1/README.md).

| Area | Observed in the approved checkpoint | Plan |
| --- | --- | --- |
| Whiteboard shell and interactions | `App` uses separate Knowledge and Engineering sessions. `CanvasBoard` owns React Flow gestures, selection, fit, outline and presentation. `CanvasObjects` and `CanvasInspector` render distinct object roles, handwritten notes, edges, technical illustrations and evidence. | Add a project board entry to the same shell. Reuse selection, drag, keyboard, visibility, undo affordances, object primitives and original illustrations. Add focused inputs for requirements, questions, feedback and prototype viewing. [Shell](../../apps/web/src/App.tsx) · [Canvas](../../apps/web/src/canvas/CanvasBoard.tsx) · [Inspector](../../apps/web/src/canvas/CanvasInspector.tsx) |
| Board state and board identity | `BoardDocument` and `projectBoard` separate authored state from the seed scene. `useBoard` holds an in-memory revision counter, 60-entry undo history, gesture state, selection and viewport. The app has two board kinds rather than durable project IDs. | Use this split at the client boundary. A finished gesture translates to a typed operation batch. The server owns saved revisions and IDs. Keep camera, active gestures and unsaved drafts in the browser. Publish a minimal, expiring selection only on a project board. [Board model](../../apps/web/src/canvas/board.ts) · [Session hook](../../apps/web/src/canvas/use-board.ts) |
| Knowledge and source evidence | Existing retrieval takes document IDs, resolves ranked hits to committed records and filters by library status. The source routes expose stored pages and chunks. The study route checks exact quotes before returning cited answers. Missing pinned source IDs are filtered from the Knowledge projection. | Add a scoped retrieval endpoint over the existing retrieval function and a bounded evidence lookup with server-derived quote and offsets. Project evidence stores canonical references. Source loss is surfaced on the board and during approval. Preserve study responses, mastery and 3D. [Retrieval](../../apps/api/app/retrieval.py) · [Source routes](../../apps/api/app/document_routes.py) · [Answer validation](../../apps/api/app/study_routes.py) |
| Durable data and contracts | FastAPI owns the current `Storage` lifecycle. SQLite uses SQLModel and WAL. Chroma owns the embedding index. The generator derives TypeScript and schema docs from Pydantic models. Existing rate and body limits apply, and workspace bearer auth is optional today. | Add tables and API contracts through the existing FastAPI application. Use the current SQLite engine with additive setup and migrations. Keep Chroma and study rows independent. Add a scoped agent capability and required workspace access for the preview profile before enabling prototypes. [API](../../apps/api/app/main.py) · [Storage](../../apps/api/app/storage.py) · [Contracts](../../scripts/generate_contracts.py) · [Request controls](../../apps/api/app/request_controls.py) |
| Agent and prototype integration | The approved build contains a local development launcher and frontend-only illustrative interactions. Its project contract, agent transport, persistent prototype registration and approval export are outstanding. The three visual prototypes are isolated design references. | Use a thin local CLI and a stdio MCP adapter over the same service. Ship one static preview workflow and one human approval route. Keep the archived design previews and recorded RAG showcase. [Local launcher](../../scripts/dev.py) · [Approved review](phase-1-1/README.md) |

## Minimal shared service

Use one FastAPI board service in the existing server. The web client, local CLI and MCP adapter call the same typed routes. The service validates operations, handles conflicts and owns the SQLite transaction. The adapter translates transport inputs and returns structured results. It does not open SQLite or Chroma. Keep the existing Knowledge and Engineering seed adapters in the frontend for v0.1, and use the shared service for persistent project boards. [Canvas architecture and proposed contracts](canvas-architecture.md#developer-preview-service)

### Agent integration

Use the official Python MCP SDK v2 and its stdio transport. The stable v2 line supports Python 3.11 and the `MCPServer` interface. Phase 3 pins the compatible patch release after resolving the current lockfile and verifying `initialize`, `tools/list` and one read/write round trip in the installed Codex client on Windows. Prefer an isolated adapter virtual environment if SDK resolution would change the API environment. The CLI uses one shared, fixed-endpoint HTTP client and Python's argument parsing. No dependency has been installed for this plan. Adding the MCP SDK requires owner approval under the repository's dependency rule. [Official MCP Python SDK](https://py.sdk.modelcontextprotocol.io/)

Configure a trusted local Codex project with a launch command pointing to the approved virtual environment and module. This is the proposed shape, with paths and port supplied during Phase 3. The local agent token is forwarded by name. Codex documents `command`, `args`, `cwd` and `env_vars` for stdio MCP. [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli#configure-in-configtoml)

```toml
[mcp_servers.grasp]
command = 'C:\path\to\Grasp\.venv-mcp\Scripts\python.exe'
args = ["-m", "grasp_agent", "mcp"]
cwd = 'C:\path\to\Grasp'
env_vars = ["GRASP_AGENT_TOKEN"]

[mcp_servers.grasp.env]
GRASP_API_URL = "http://127.0.0.1:8019"
```

The installed Windows Codex CLI reported `0.171.0-alpha.13.2` and exposed the `mcp` command. A GRASP server handshake has yet to be tested. In Phase 3, verify the trusted project configuration with `codex mcp list`, check `/mcp` in a fresh TUI session, then make an actual tool call and confirm the result after a browser reload. Test Claude Code after the Codex flow passes. [Codex CLI setup](https://learn.chatgpt.com/docs/extend/mcp?surface=cli#configure-with-the-cli)

| Tool capability | First verified phase | Authorization and contract |
| --- | --- | --- |
| List, create and read boards | 3 | Scope reads to the configured local workspace. New project boards get durable IDs and its draft access. Keep list and snapshots bounded. |
| Apply canvas operations | 3 | Validate a bounded batch, explicit board ID, `baseRevision` and `mutationId`. Return committed revision or typed conflict. |
| Read current selection | 3 | Return board-scoped object IDs from the active browser session or an explicit unavailable result. Keep presence transient. |
| Search knowledge and read exact evidence | 4 | Search explicit allowed document IDs. Return rank and stable source handles. Resolve exact spans from stored text. An empty scope means no search. |
| Read annotations, open questions and resolved requirements | 4 | Return typed records and object associations from the same board revision. User answers and decisions carry server-verified attribution. |
| Register an isolated prototype | 5 | Register a staged bundle ID, attachment, related requirements and content digest. The tool accepts no arbitrary filesystem paths or remote endpoints. |
| Export an approved specification | 5 | Read an immutable approved snapshot by ID. Only a user action through the workspace can approve it. The adapter has no publish or implementation tool. |

The agent capability grants scoped HTTP reads and draft writes through the API. It carries no filesystem, shell, deployment or generic network operations. Agent output, retrieved text and prototype files remain untrusted content. Review private source access and retention before experimenting with a configured external model. The default preview fixture set is synthetic or public.

### Prototype workflow

The external agent builds a plain static HTML/CSS/JavaScript bundle in an explicitly authorized staging directory. Server registration validates a bounded manifest, relative entry point, allowed assets, digest and total size. Publish a copy into a dedicated preview root keyed by ID and digest. The preview server exposes only registered assets. Reject paths outside its root, symlinks or junctions that escape it, redirects, dynamic executables and directory listings. GRASP never runs build commands supplied by a board or agent tool.

Serve previews on a separate loopback origin without application cookies or injected API tokens. Require the application workspace bearer token on its private routes. Use a sandboxed iframe with scripts only, a restrictive preview CSP, a dedicated frame-source allowlist in the host and no parent message bridge. Permit only the static assets needed by the preview, with outbound application connections and external asset requests denied. Exercise forms, navigation, network access, cross-origin application reads and file boundaries in the target browser before allowing in-canvas preview. If isolation fails, keep the card registration and feedback available and use the recorded fallback for presentation. [HTML iframe sandbox](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox) · [Content Security Policy](https://www.w3.org/TR/CSP3/)

The board stores a prototype object ID and immutable prototype revision with its entry point, digest and requirement references. **Interact** hands pointer and keyboard control to the preview. **Annotate** captures feedback on the host canvas. Use an optional normalized rectangle over the visible preview linked to the exact prototype revision. Record feedback against the stable object, even after the agent registers a replacement preview. Keep old revisions inspectable by ID only while their assets are retained.

## Interview scope

- **Essential:** One Codex-driven project from brief through human approval and versioned export. Use real persisted questions, decisions, board edits, prototype interaction, one feedback-driven revision and exact citations when a fixture is in scope. Keep a no-source route.
- **Video editor demo:** Import a bundled sample, play it, select a timeline range, simulate a cut, edit and restyle captions, choose an export format and require a simulated publishing approval. Use sample data and label simulated AI and Instagram steps. Prepare the existing Engineering walkthrough and the recorded retrieval evaluation for technical follow-ups.
- **Stretch:** Claude Code verification, a second generic project fixture, more prototype regions and export formats, richer trace overlays, stronger automated contrast and physical projection checks. Complete the scheduled regression and rehearsal before adding these items.
- **Deferred:** npm publication, desktop installers, collaboration, distributed infrastructure, agent orchestration, repository-wide indexing, a full prototype editor, public deployment and production video or Instagram integration.

[Delivery sequence and gates](roadmap.md) · [Five-minute run and rehearsal plan](storyboard.md)
