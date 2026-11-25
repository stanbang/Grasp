# Phase 3 · Local CLI and Codex MCP

**Checkpoint for review, 25 November 2026.** The Windows CLI and stdio MCP adapter use the same FastAPI service as the browser. The official MCP Python SDK is pinned to `2.3.0` in its own Python 3.11 environment. [SDK release](https://github.com/modelcontextprotocol/python-sdk/releases/tag/v2.3.0)

## Install on Windows

From the repository root, use PowerShell 7.

```powershell
py -3.11 -m venv .venv-mcp
.\.venv-mcp\Scripts\python.exe -m pip install -e .\apps\agent
$grasp = '.\.venv-mcp\Scripts\grasp.exe'
```

Keep distinct `ACCESS_TOKEN` and `GRASP_AGENT_TOKEN` values in the project's ignored `.env`. Start GRASP with `py -3.11 scripts/dev.py`. Use `--setup` on the first checkout. The default development API is `http://127.0.0.1:8000`, and the web workspace is on port 5173. A production build serves both from one origin and adds `/api` to the API base.

In a second PowerShell window, open the repository root and check the connection.

```powershell
$grasp = '.\.venv-mcp\Scripts\grasp.exe'
& $grasp doctor
& $grasp init
```

`grasp init` prints the absolute Python executable, working directory and path to the project's `.env`. Merge its GRASP section into the trusted project's `.codex/config.toml`. If it already contains GRASP, replace both old GRASP sections together. The project configuration on the acceptance machine has already been updated. Run `codex.cmd mcp list` from the repository, then start `codex.cmd` and type `/mcp`. Ask Codex to call `list_boards` to check access. [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli#configure-in-configtoml)

The development connection reads `API_PORT` and the agent token from `.env` in a fresh shell. Start Codex from the trusted GRASP directory to use the project registration. A process-level `GRASP_AGENT_TOKEN` or `GRASP_API_URL` takes precedence, so clear stale overrides if the wrong instance or token is selected. For a production instance, generate a pinned config with `grasp --api-url http://127.0.0.1:8019/api init`, using that instance's actual address. Restart the API after editing its `.env`, and launch a new Codex session after changing its MCP config.

Codex may ask for approval for `apply_canvas_operations` because batches can change or remove saved objects. Approve the intended call when prompted. The verification used the installed CLI's `--approve-for-me` option for the disposable write session. A noninteractive session that disables approvals can discover and read the board while a mutation awaits approval.

## CLI commands

| Command | Behavior |
| --- | --- |
| `grasp init` | Print the local Codex MCP configuration. |
| `grasp open [BOARD_ID]` | Open the workspace or the saved Project board. `--print-url` prints the link. |
| `grasp doctor` | Check API health and credential access to board listing. |
| `grasp board list` | List summaries with optional `--offset` and `--limit`. |
| `grasp board create "TITLE"` | Create a board at revision 0. |
| `grasp board read BOARD_ID` | Read the current saved snapshot. |
| `grasp board apply BOARD_ID BATCH.json` | Apply a Phase 2 batch. Use `-` for JSON on stdin. |
| `grasp search "QUERY" --doc DOCUMENT_ID` | Search explicitly shared documents. Repeat `--doc` to add scope. |
| `grasp source REFERENCE.json` | Read an exact quote from a search reference. Use `-` for JSON on stdin. |
| `grasp mcp serve` | Serve GRASP tools over stdio. Codex starts this command. |

`board apply` uses the documented `baseRevision`, `mutationId` and `operations` HTTP shape. A stale write returns the current revision and a prompt to read the board again. Reuse a mutation ID only when retrying the exact same batch. JSON results go to stdout, and errors include a code and a message on stderr. [Canvas operation contract](phase-2.md#http-contract-for-phase-3)

## MCP tools and authority

| Tool | Input | Result |
| --- | --- | --- |
| `list_boards` | Optional `offset`, `limit` | Summaries and the next offset. |
| `create_board` | `title` | A new board with agent attribution. |
| `get_board` | `board_id` | The saved snapshot, including questions and answers. |
| `get_selection` | `board_id` | Recent selected object IDs, their revision and availability. |
| `apply_canvas_operations` | `board_id`, `base_revision`, `mutation_id`, `operations` | The atomic commit receipt or a structured error such as `staleRevision`. |
| `get_annotations` | `board_id`, optional `author` | Annotation objects, their attribution and the board revision. The role filter matches the creator or last editor. |
| `get_requirements` | `board_id` | Saved requirements, decisions, criteria and attribution at the current revision. |
| `search_knowledge` | `query`, explicit `doc_ids`, optional `top_k` | Ranked excerpts and references from the existing index. |
| `read_source` | `reference` from search | Availability, exact quote, source name, one-based page and exclusive-end Unicode span. |

The Phase 2 service remains responsible for all mutations and permissions. Its agent role can make draft canvas edits. The workspace owner retains answers, requirement decisions and revision restoration. The adapter uses fixed HTTP routes on `127.0.0.1` and loads the agent token from the local settings or its process environment. Prototype asset registration and approved specification export belong to Phase 5.

The active visible Project tab periodically shares selected object IDs with the API. Selection can expire 25 seconds after the last heartbeat and is available only at the current revision. It uses memory and leaves the board revision untouched.

To share indexed sources, use the owner API's `GET /documents` or the Knowledge workspace to identify the intended ready documents, set their IDs in `GRASP_AGENT_SOURCE_DOC_IDS` on the API, and restart. The agent supplies a subset of those IDs to `search_knowledge`. An empty scope returns no results. The server resolves the exact source text from the original stored page and chunk. Search accepts up to 20 requested IDs and 10 hits, and reports whether GRASP used mock or live retrieval. The same source scope governs agent reads and new source references in board context.

## Verification

### Protocol and application checks

```powershell
.\.venv-mcp\Scripts\python.exe -m unittest discover -s apps/agent/tests -v
py -3.11 scripts/check.py
npm run build
node scripts/tests/project-browser.cjs
```

The SDK test launches the stdio server and a disposable FastAPI process. It checks legacy handshake and discovery, an applied batch, identical replay, stale revisions, an invalid operation, unavailable service and the installed CLI's configuration and read/write path. The API tests cover owner-only selection, expiry, revision matching, explicit source scopes and exact Unicode spans. The Chrome regression checks the same browser renderer, failed-draft recovery and API restart.

The Phase 3 checkpoint passed four adapter tests, 80 API tests, 24 Node checks, contract drift, strict TypeScript and the production build. The Chrome Project, Knowledge and Engineering regressions passed.

### Live Codex integration

The installed `codex-cli 0.171.0-alpha.13.2` discovered the project-registered server in independent CLI sessions. The sessions used a disposable GRASP library and synthetic input. GRASP retrieval ran in mock mode while Codex made real MCP calls.

- Codex listed boards and created **Phase 3 — Codex Live Verification** at revision 0. After a supported approval and a validation correction, one MCP batch saved three objects and two connections at revision 1. Codex read the saved IDs. The running browser showed the same illustration, cards and relationship labels.
- Codex called `search_knowledge` against the real index, then `read_source` on the returned reference. The quote matched the stored `video-editor-review.md` page 1, span `[0, 336)`. The installed CLI independently retrieved the same exact text.
- The browser owner session added **Owner acceptance note** and selected **Editable captions**. A fresh Codex session called `get_selection`, `get_annotations`, `get_requirements` and `get_board`. It matched the selection ID to **Editable captions** at revision 4 and quoted the user-attributed note exactly. The installed CLI read the same board and revision. The browser showed the saved note and architecture again after reload.

Board ID `059f2e47-f2eb-496d-8865-8f461a587404`. Local session receipts are under `work/phase3-live-878ea239/`. [Short guide for agents](agent-guide.md)

### Standalone Windows acceptance repair

Startup records from standalone Codex `0.172.0` showed `missingToken` immediately followed by a closed connection during `initialize`. The trusted project registration forwarded a shell variable that was absent and still targeted the disposable API on port 8033. The development API and Vite were listening on ports 8000 and 5173. The previous bundled verification supplied temporary credentials to its terminal.

The corrected registration uses the project's ignored `.env` and derives the development address from `API_PORT`. Configuration and HTTP errors now appear on tool invocation, after stdio initialization can report the tool catalog. All six adapter tests passed, including a fresh-shell authenticated request and a structured missing-token response. Two fresh standalone `codex.cmd` sessions successfully called an empty-scope `search_knowledge` on the development API with no shell-exported credentials. GRASP was restarted between those sessions. Anonymous and deliberately invalid requests returned `401`.

Phase 4 begins after the owner's review. Claude Code verification is a stretch item.
