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

## Register once for Codex desktop and CLI

In a second PowerShell window, open the repository root and run the following commands. The registration uses the existing Python environment and the absolute path to the ignored `.env`.

```powershell
$grasp = '.\.venv-mcp\Scripts\grasp.exe'
& $grasp doctor
$graspPython = (Resolve-Path -LiteralPath '.venv-mcp/Scripts/python.exe').Path
$graspSettings = (Resolve-Path -LiteralPath '.env').Path
codex.cmd mcp add grasp --env "GRASP_ENV_FILE=$graspSettings" -- $graspPython -m grasp_agent mcp serve
codex.cmd mcp list
```

`codex.cmd mcp add` writes to `%USERPROFILE%\.codex\config.toml` by default, or to `$env:CODEX_HOME\config.toml` if set. Use the same Codex home for desktop and CLI. The registration is available to local Codex chats opened from other directories. If you move this GRASP checkout or recreate its Python environment at a different path, run the registration again with the new paths. [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp#connect-codex-to-an-mcp-server)

In Codex desktop, open **Settings → MCP servers** and check that `grasp` is enabled. Select **Restart** if offered. If GRASP is still missing, quit Codex completely, including from the Windows notification area if it is still running there, then reopen it from Start. Open a new **local** Codex chat, type `/mcp` and ask the agent to list your GRASP boards. In the standalone CLI, start a new session and use the same check. [Desktop MCP setup](https://learn.chatgpt.com/docs/extend/mcp#configure-in-the-chatgpt-desktop-app)

The user-level registration reads the agent token and `API_PORT` from `.env`. For a production instance served under `/api`, add `--env "GRASP_API_URL=http://127.0.0.1:8019/api"` before `--`, using the actual address. Restart the API after editing its `.env`.

For project-only registration, `grasp init` still prints a TOML snippet for the trusted project's `.codex/config.toml`. If both registrations exist, the trusted project's entry takes precedence inside that checkout. That entry can forward `GRASP_AGENT_TOKEN` and `GRASP_API_URL` from the launching process. Check for stale overrides if the project connects to a different instance.

Codex may ask for approval for `apply_canvas_operations` because batches can change or remove saved objects. Approve the intended call when prompted. The verification used the installed CLI's `--approve-for-me` option for the disposable write session. A noninteractive session that disables approvals can discover and read the board while a mutation awaits approval.

## CLI commands

| Command | Behavior |
| --- | --- |
| `grasp init` | Print the local Codex MCP configuration. |
| `grasp setup` | Configure the workspace, register MCP and install the GRASP skill for detected agents. |
| `grasp open [BOARD_ID]` | Open the workspace or the saved Project board. `--print-url` prints the link. |
| `grasp doctor` | Check API access, the browser endpoint and the installed agent configuration. |
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
| `get_board_context` | Optional `board_id` and `since_revision` | Active-board resolution, the saved snapshot and selection, and attributed changes since the given revision. |
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

### Windows desktop registration

The trusted GRASP checkout had the only registration. Standalone Codex CLI `0.172.0` and the desktop bundle `0.171.0-alpha.13.2` both found it inside the checkout and missed it from the parent directory. No `CODEX_HOME` override was set. Recent Codex logs recorded successful GRASP initialization after the standalone repair. Both clients use the existing Python 3.11 environment and the same development API on port 8000.

After adding the user-level registration, fresh standalone and desktop-bundled sessions from outside the checkout made authenticated `list_boards` and `get_annotations` calls, respectively. The active desktop chat listed the existing boards and created **Codex Desktop MCP Verification**. It saved three architecture objects, two connections and an annotation in one batch, retrieved the annotation, edited an object and read back revision 2.

The owner's acceptance check is to repeat the workflow in a fresh desktop chat after refreshing MCP, then add a note in the browser and ask the chat to read it with the `author: user` filter. The verification board's note is agent-authored.

Phase 4 begins after the owner's review. Claude Code verification is a stretch item.

### Phase 3.1 collaboration

The browser shares the board ID, saved revision and selected object IDs under a per-tab identity. Closing or leaving Projects releases that tab's context. An inactive tab expires after 25 seconds without a heartbeat. With overlapping boards, the context tool returns candidate titles and IDs. When two tabs share the same board, the tool reports an ambiguous selection. A conversation can keep its resolved board ID even when the browser changes.

The context tool reads the saved head and history in one transaction. History comes from existing snapshots, with the revision author and the changed fields of each object or connection. The browser uses the existing revision poll to show agent edits. [Install the reusable skill and run acceptance](agent-guide.md)

The 26 November check passed 82 API tests, 24 Node tests, TypeScript and contract checks, the production build, all six stdio MCP tests, and the two-tab browser regression. A fresh session in the desktop-bundled Codex runtime discovered the user-level skill from outside the checkout. Through MCP it saved the video-editor layout at revision 1, explained the browser selection, recognized the owner note, arrow and moved card at revision 5, and applied an approval gate at revision 6. The same browser tab showed the gate without a refresh. MCP readback confirmed that the owner edits and unrelated cards survived. The same Codex session explained the gate after it was selected. The Claude Code installer was checked against a disposable configuration directory.

### Phase 3.2 workspace integration

`grasp setup` now configures and checks the existing local app, MCP entry and skill from one command. The real Codex CLI registered a fresh profile without changing an unrelated entry. A second run left the configuration and credentials byte-for-byte identical. The installed CLI ran setup, doctor and open from outside the checkout.

GRASP provides the board's live URL through MCP. The user-level skill opens that URL in Codex's built-in browser and keeps using the same board. A fresh local Codex chat outside the checkout loaded the skill, saved the video-editor design and queued its browser panel while the chat was hidden. Automatic browser review rejected opening the separate fixture because its review usage limit was reached. Direct selection, owner edits and a follow-up update in the fresh chat remain for acceptance. [Workspace walk-through](agent-guide.md#try-a-collaboration) · [Codex split view](https://learn.chatgpt.com/docs/browser#arrange-tabs-and-chat)
