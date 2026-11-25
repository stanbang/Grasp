# Phase 2 · Shared canvas service

**Approved on 25 November 2026.** Projects use the same React Flow renderer as the Knowledge and Engineering canvases. The browser and external HTTP clients read and write the same saved project board. Knowledge and Engineering retain their existing projections and session-local edits.

## Run the workspace

```powershell
py -3.11 scripts/dev.py
```

Run `py -3.11 scripts/dev.py --setup` on a fresh checkout. Open `http://127.0.0.1:5173` or the web URL printed at startup. Select **Projects**, create a board, and add or move a note. The URL carries the board ID so the same board opens after a reload. The revision in the bottom corner shows the latest saved edit.

For an attributed HTTP test, set two different values for `ACCESS_TOKEN` and `GRASP_AGENT_TOKEN` in the local environment and restart. Unlock the browser with the owner token. An external client sends `Authorization: Bearer <agent token>` to the API. The agent can read and make draft edits across project boards in this local workspace. Its credential does not open the study, document or conversation routes. With both tokens unset, the loopback-only development session acts as the owner.

## HTTP contract for Phase 3

Paths below are relative to the API base. The default development API base is `http://127.0.0.1:8000`. The web proxy and production app mount the same routes under `/api`. The [Pydantic models](../../apps/api/app/canvas_contracts.py) define the contract. TypeScript contracts are [generated separately](../../apps/web/src/types/canvas-contracts.ts) from the existing study contracts.

| Method and route | Request | Result |
| --- | --- | --- |
| `GET /boards` | Optional `offset` and `limit`. The default limit is 50 and the maximum is 100. | `BoardList` with summaries and `nextOffset`, or `null` on the final page. |
| `POST /boards` | `CreateBoard` with a title of 1–96 characters. | `201 ProjectBoard` with server-assigned board and project IDs and revision 0. |
| `GET /boards/{boardId}` | Optional `afterRevision`. | The current `ProjectBoard`, or `204` when `afterRevision` equals the current revision. |
| `GET /boards/{boardId}/revisions/{revision}` | A saved revision number. | The project snapshot at that revision. |
| `GET /boards/{boardId}/objects/{objectId}/context` | An object ID on the selected board. | The current revision, object, incident connections, direct related objects, exact evidence and linked canonical concept and relationship data. |
| `POST /boards/{boardId}/ops` | `CanvasBatch` with `baseRevision`, a fresh `mutationId` and a nonempty array of typed operations. | `BoardCommit` with board ID, base revision, committed revision, mutation ID, actor, timestamp and the exact committed board. |

The editor gives every object and connection a stable ID. Follow the same practice in external clients and generate a new UUID when adding a distinct object, connection or mutation. References in an operation resolve on the target board. Send content in plain text and use the supplied technical illustration names.

| Operation | Payload and effect |
| --- | --- |
| `addObject`, `updateObject` | Supply `object` as `CanvasObjectData`. Use a new ID for an add. An update supplies the complete editable object under the same ID and kind. |
| `placeObject` | Supply `objectId` and `placement` to move, resize or group an existing object. |
| `removeObject` | Supply `objectId`. The service removes incident connections and detaches children when removing a group. Update explicit object or prototype references in the same batch before removing their target. |
| `addConnection`, `updateConnection` | Supply `connection` with its ID, source and target object IDs, relationship label and optional role and canonical edge reference. A directed pair can have one connection. |
| `removeConnection` | Supply `connectionId`. |
| `answerQuestion` | Supply `objectId` and `text`. The owner credential records the answer, role and time. |
| `restoreRevision` | Supply an earlier revision in a batch of its own. The owner credential restores the snapshot as a new revision, preserving object IDs and attribution. Browser Undo and Redo use this operation. |

```json
{
  "baseRevision": 0,
  "mutationId": "1b6472ad-4d14-4276-a2cd-387dd15ce05a",
  "operations": [
    {
      "type": "addObject",
      "object": {
        "id": "caption-review",
        "kind": "annotation",
        "title": "Review captions",
        "description": "Let the user correct a caption before export.",
        "placement": { "x": 80, "y": 100, "width": 228, "height": 116 },
        "noteStyle": "underline"
      }
    }
  ]
}
```

Operations run in order. The final board must have valid references and geometry. Each batch can contain up to 240 operations, and HTTP request bodies are limited to 64 KiB. A saved snapshot can contain up to 200 objects and 400 connections, with a serialized limit of 512 KiB. The canvas supports finite world coordinates and one level of grouping. Board revision changes, snapshot storage and the retry receipt commit in one SQLite transaction. Every rejected batch leaves the saved board and its revision history intact.

On `409`, read `detail.code` and `detail.currentRevision`. A `staleRevision` means the client should read the current board and review its intended changes before submitting a new mutation. Retrying the same validated batch under the same mutation ID and role returns the original receipt, even after later writes. `mutationIdReused` means the original ID belongs to different content or a different role. Missing boards, revisions and context objects return `404`. Invalid batches return `422`. Invalid credentials return `401`, and disallowed operations return `403`.

Attribution comes from the bearer credential. Agents can add proposed requirements and questions, create annotations and change board geometry. The owner decides requirements, answers questions and edits or removes recorded owner decisions and owner-authored annotations. Prototype records hold metadata such as the preview ID, revision, digest, entry point and related requirements. A metadata record does not serve or execute a prototype.

An evidence reference holds the canonical document and chunk IDs, one-based page, and the page-local Unicode code-point span with an exclusive end. The server verifies the span against both the committed page and chunk. Object context returns an exact quote or `available: false` if the source is later removed. Semantic links and concepts remain in the study graph. A board can link to their IDs and read their current provenance through object context.

## Synchronization and storage

The active browser board checks its revision every 1.5 seconds. An unchanged revision returns no snapshot body. The browser defers incoming changes while an object drag, resize or inspector edit is active. It commits one batch when the gesture finishes. Polling fits the local preview and shares its existing bearer handling.

Local edits render immediately. The client sends them in order and retains the same mutation ID for retries. A failed save keeps the draft on the canvas and in tab session storage when available. On conflict, download it for comparison or discard it to open the latest saved board. Applying a remote revision clears the browser undo stack so Undo cannot revert unseen work. Camera position, selection and intermediate gesture geometry stay in the browser.

The version 1 migration creates `project_boards`, `board_revisions` and `canvas_schema` in the existing SQLite store. Existing study tables, Chroma collections and source files keep their current format. Board and history data live in `grasp.sqlite3`. Back up the database, uploads and Chroma directory together for a complete workspace copy.

## Verification and boundary

```powershell
python scripts/check.py
npm run build
node scripts/tests/project-browser.cjs
```

The production browser check uses the repository's existing Playwright Core test tooling and Chrome. It starts and restarts a loopback API with a disposable library under `work/`. Override `GRASP_PLAYWRIGHT`, `GRASP_CHROME` or `GRASP_TEST_API_PORT` when needed. The existing [canvas browser regression](../../scripts/tests/canvas-browser.cjs) continues to cover the Knowledge and Engineering paths.

- Contract drift, 78 Python tests, 24 Node checks, strict TypeScript and the production build passed.
- Chrome verified browser edits through the service, live agent updates, persisted undo and redo, stale draft recovery after reload, and stable IDs, geometry and revision after an API restart. A repeated quote was highlighted at its exact Unicode span.
- The Knowledge and Engineering browser regression passed, including camera and editing gestures, presentation, source inspection, scoped chat, ingest progress and the 3D fallback. The Project canvas was also checked at 390 × 844.
- The migration preserved the contents of all 14 existing tables in a copy of the Phase 1.1 SQLite library. The copy held two documents and four chunks. A new board saved successfully, and SQLite integrity and foreign key checks passed.

### Manual acceptance

The agent credential created **Phase 2 — Agent Collaboration Test** and added the video-editor architecture in one batch. Revision 1 held nine objects, eight connections and an unanswered cut-policy question. The owner moved four objects, edited the publishing annotation and recorded an answer through the owner API. An agent-authenticated HTTP read after restarting the isolated server found all three kinds of changes at revision 8. The annotation read “Review AI-generated cuts manually before approving the final export.” The saved answer attributed to the user permitted silence removal, duplicate removal and high-confidence scene transitions, with human approval for narrative or creative cuts.

The owner approved the checkpoint, including its polling-based synchronization.
