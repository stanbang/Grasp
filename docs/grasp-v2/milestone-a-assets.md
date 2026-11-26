# Milestone A manual acceptance

This workspace uses synthetic fixtures, its own SQLite and Chroma stores, disposable owner and agent tokens, and mock processing. The commands leave the regular GRASP library and agent registration alone.

## Start the disposable workspace

Run from the repository root in PowerShell. The existing setup command installs the web and Python dependencies if needed.

```powershell
py -3.11 scripts/dev.py --install-only
npm.cmd run build

$acceptanceRoot = Join-Path (Resolve-Path .).Path ('work/goal4-a-acceptance/' + [Guid]::NewGuid().ToString('N'))
$acceptanceUrl = 'http://127.0.0.1:8086'
$env:DATA_DIR = Join-Path $acceptanceRoot 'library'
$env:MOCK_LLM = '1'
$env:OCR_ENABLED = '0'
$env:MAX_UPLOAD_BYTES = '10485760'
$env:GRASP_AGENT_SOURCE_DOC_IDS = ''
$env:ACCESS_TOKEN = [Guid]::NewGuid().ToString('N')
$env:GRASP_AGENT_TOKEN = [Guid]::NewGuid().ToString('N')

.\.venv\Scripts\python.exe scripts/project-asset-fixtures.py (Join-Path $acceptanceRoot 'fixtures')
$agentSettings = Join-Path $acceptanceRoot '.env'
@(
    'API_PORT=8086'
    'WEB_PORT=8086'
    "GRASP_AGENT_TOKEN=$env:GRASP_AGENT_TOKEN"
) | Set-Content -LiteralPath $agentSettings -Encoding UTF8

Write-Host "Fixtures and data: $acceptanceRoot"
Write-Host "Owner token for this disposable workspace: $env:ACCESS_TOKEN"
Start-Process ($acceptanceUrl + '/?board=project')
.\.venv\Scripts\python.exe -m uvicorn app.production:application --app-dir apps/api --host 127.0.0.1 --port 8086
```

Refresh the page if the browser opens before the API starts. Unlock with the disposable owner token and create a Project board.

## Walk through the board

1. In the canvas toolbar, choose **Import files**. In the generated `fixtures` directory, select `wide.png`, `shapes.webp`, `two-pages.pdf`, `notes.md`, `notes.txt` and `corrupt.png` together. The valid items appear on the board and the corrupt file gets its own error. Try dropping `unsupported.svg` to see the unsupported format error.
2. Drag `portrait.jpg` from Explorer onto an empty part of the canvas. To verify clipboard image paste, open `wide.png` in Paint, press **Ctrl+A**, then **Ctrl+C**. Click an empty part of the GRASP canvas and press **Ctrl+V**. Both gestures place an image. Clipboard software can re-encode pixels, so use the file picker when checking the exact bytes of a disk file.
3. Open the `two-pages.pdf` inspector. Select **PDF page → 2** and choose **Open PDF page**. The browser opens the original on page 2. Wait for **Indexed in Knowledge** if you want to check the text in the existing Knowledge workspace.
4. Import `wide.png` from disk a second time. Keep both placements. Double-click either one and use **Open original** to inspect the authenticated original. Both placements refer to the same asset ID.
5. With the canvas idle, note the revision and placements. In the server terminal, press **Ctrl+C**, then rerun the last Uvicorn command **in that same terminal**. Reload the board. The revision, placements, image previews and selected PDF page should match.

## Verify agent grants

Copy the board ID from the `projectBoard` query parameter and the printed acceptance directory path. In a second PowerShell terminal at the repository root, point the existing CLI at this disposable service.

```powershell
$acceptanceRoot = 'C:\path\shown\in\the\first\terminal'
$boardId = 'board-id-from-the-browser'
$env:GRASP_ENV_FILE = Join-Path $acceptanceRoot '.env'
$env:GRASP_API_URL = 'http://127.0.0.1:8086/api'
$env:GRASP_WEB_URL = 'http://127.0.0.1:8086'
Remove-Item Env:GRASP_AGENT_TOKEN -ErrorAction SilentlyContinue
.\.venv-mcp\Scripts\grasp.exe board read $boardId
```

An unshared image or document appears as **Private source** with its object ID and placement. It has no asset reference or source title in the agent response. Open the image inspector, check **Share this asset with the agent on this board**, and run the same command again. The agent sees the image object and its asset reference. Clear the checkbox and repeat. The placeholder returns, and undoing or restoring a board edit does not reinstate the grant.

## Automated verification

The 26 November 2026 checkpoint passed 92 API tests, 25 Node tests, contract drift and TypeScript checks, the production build, 13 stdio and CLI tests, and the three Chrome scripts below. The signed-in Codex CLI run read the shared image metadata over MCP and added a note that appeared in the open browser tab. The Windows Codex Desktop host was outside that run.

```powershell
.\.venv\Scripts\python.exe scripts/check.py
.\.venv-mcp\Scripts\python.exe -m unittest discover -s apps/agent/tests -v
npm.cmd run build
node scripts/tests/project-assets-browser.cjs
node scripts/tests/project-browser.cjs
node scripts/tests/zoom-browser.cjs
```

The Chrome scripts use the existing local Chrome and `playwright-core` test tools. Set `GRASP_CHROME` or `GRASP_PLAYWRIGHT` if they are in different locations. The new Chrome test includes a deliberate stale revision. Retrying placement retains the intervening agent edit and reuses the original upload and its asset ID. The stdio suite verifies a note attached to an authorized image object and redaction after revocation.

To also run the optional signed-in Codex CLI check, set `GRASP_CODEX_ACCEPTANCE` to the absolute path to your installed `codex.exe` and run `node scripts/tests/project-assets-browser.cjs` again. The test runs a fresh ephemeral session against the synthetic board. It verifies a metadata read over MCP and a note appearing in the same browser tab. Screenshot pixels through MCP, visual understanding and visual retrieval are outside Milestone A.

## Storage and limits

- The default limit is 10 MiB per file using the existing `MAX_UPLOAD_BYTES` setting. Project imports accept up to 30 files at a time. Single-frame PNG, JPEG and WebP images can be up to 8,192 pixels on either side and 16 million pixels in total. Upright WebP previews are at most 1,280 pixels on either side. PDF, Markdown and UTF-8 text use the existing document pipeline. PDFs can have up to 250 pages.
- SQLite records board assets, import order, grant state and a marker for documents imported through Projects. Prior revisions load unchanged. Snapshots that contain assets use board schema 2 and store asset IDs and any selected PDF page.
- Under `DATA_DIR/assets`, raster originals and previews are stored by SHA-256 digest. The existing `DATA_DIR/uploads` directory holds original documents. Existing RAG parsing, chunking and indexing continue to run. Document assets can show their originals even when text indexing fails.
- Grants apply to one board and live outside revision snapshots. Legacy MCP text search continues to use its explicit document allowlist. It has no board argument, so Project-only documents stay out of that tool until a board-scoped retrieval path exists.
- Only expired staging with no historical placement is eligible for cleanup. A failed or stale placement leaves the staged asset reusable. A replay of a successful placement returns the saved receipt subject to the caller's current source access.

## Changed files

- Asset storage, validation and access live in [asset_storage.py](../../apps/api/app/asset_storage.py), [asset_media.py](../../apps/api/app/asset_media.py), [asset_access.py](../../apps/api/app/asset_access.py) and [asset_routes.py](../../apps/api/app/asset_routes.py).
- Board persistence, contracts and permissions change in [canvas_storage.py](../../apps/api/app/canvas_storage.py), [canvas_contracts.py](../../apps/api/app/canvas_contracts.py), [canvas_service.py](../../apps/api/app/canvas_service.py), [canvas_routes.py](../../apps/api/app/canvas_routes.py), [board_context.py](../../apps/api/app/board_context.py) and [request_controls.py](../../apps/api/app/request_controls.py). [main.py](../../apps/api/app/main.py) and [storage.py](../../apps/api/app/storage.py) register the routes and storage lifecycle.
- [document_routes.py](../../apps/api/app/document_routes.py) and [document_lifecycle.py](../../apps/api/app/document_lifecycle.py) reuse original-file storage and document ingestion. [requirements.in](../../apps/api/requirements.in) and [requirements.lock](../../apps/api/requirements.lock) record the approved Pillow dependency.
- The browser wires import into [App.tsx](../../apps/web/src/App.tsx), [folder-upload.ts](../../apps/web/src/folder-upload.ts), [ProjectCanvas.tsx](../../apps/web/src/canvas/ProjectCanvas.tsx), [CanvasBoard.tsx](../../apps/web/src/canvas/CanvasBoard.tsx) and [project-assets.ts](../../apps/web/src/canvas/project-assets.ts). Rendering and inspection use [CanvasObjects.tsx](../../apps/web/src/canvas/CanvasObjects.tsx), [CanvasInspector.tsx](../../apps/web/src/canvas/CanvasInspector.tsx), [ProjectAssetDetails.tsx](../../apps/web/src/canvas/ProjectAssetDetails.tsx) and [canvas.css](../../apps/web/src/canvas/canvas.css). The board projection, draft recovery and generated types are in [board.ts](../../apps/web/src/canvas/board.ts), [project-board.ts](../../apps/web/src/canvas/project-board.ts), [use-project-board.ts](../../apps/web/src/canvas/use-project-board.ts) and [canvas-contracts.ts](../../apps/web/src/types/canvas-contracts.ts).
- Verification and acceptance use this guide, [test_project_assets.py](../../apps/api/tests/test_project_assets.py), [test_protocol.py](../../apps/agent/tests/test_protocol.py), [project-assets-browser.cjs](../../scripts/tests/project-assets-browser.cjs) and [project-asset-fixtures.py](../../scripts/project-asset-fixtures.py).
