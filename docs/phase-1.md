# Phase 1 checkpoint

This historical checkpoint describes commit `d3672d8`. Current development is at [Phase 2](phase-2.md), where the health response reports `phase: 2`.

## Scope

This checkpoint includes the repository scaffold, schema contracts, local stores, model configuration, mock adapters, sample note, health endpoint and a small workspace preview. Upload, interactive 3D, chat and quizzes are not implemented in this phase.

## Verify it

1. Run `python scripts/dev.py --setup` from the repository root with Python 3.11 and a supported Node.js release (20.19+ or 22.12+).
2. Open `http://127.0.0.1:5173` and select **Read sample notes**. Check that the source panel displays Memory and learning. Download the note and compare it with the file in `samples`.
3. Select **Contracts** and inspect GraphNode, Chunk and Progress. Progress should contain five fields and no XP, level or streak.
4. Open **Local workspace ready** in the document rail, or **Status** in the mobile header. SQLite and ChromaDB should both say Connected, and the model should say Deterministic mock.
5. Open `http://127.0.0.1:8000/health`. The JSON should have `status: "ok"`, `phase: 1`, `sqlite: "ok"`, `chroma: "ok"` and `llm.provider: "mock"`.
6. Run `python scripts/check.py` in a second terminal, followed by `npm run build`.
7. Press Escape to close a side panel. On a narrow screen the source panel should take the workspace width, and its close button should return to the canvas.

Changing API_PORT or WEB_PORT in `.env` changes the local URLs. Restart both servers after changing `.env`. Ctrl+C in the launcher stops both processes.

## Limitations

Mock embeddings are deterministic test vectors, not a semantic model. Live provider configuration is present, but a live request requires a key and has not been verified by mock tests. Reading the sample does not ingest it. There is no user authentication, production hosting, upload limit, rate limiter, retrieval evaluation or mastery computation yet. Those belong to later checkpoints.

The frontend production build produces static files. It still needs a separately running API and an `/api` reverse proxy when hosted. Set VITE_API_REFERENCE_URL to the public backend documentation URL before a hosted build; local development derives it from API_PORT. The Python process and local Chroma/SQLite stores cannot run as a Vercel static page.

## Checks performed

The dependency setup, root development launcher and production build passed on Windows with Python 3.11. All 13 backend tests passed, including persistence across two separate Chroma processes. Contract drift, strict TypeScript and `pip check` also passed. Both live provider adapters were constructed with test credentials without making a model request. Browser checks covered the sample, schemas, status, API reference, narrow layouts and panel focus. See the [design review](design-review-phase-1.md) for its scope and remaining verification limits.

## Development tools

The project uses Impeccable for shaping, critique and polish, and Humanizer for prose review. These are optional development tools and are excluded from app dependencies. Product and design records are committed; local tool binaries and review captures are ignored.

Install Impeccable for this checkout with `npx impeccable@4.8.2 install --providers=codex --scope=project --no-hooks --yes`. Humanizer is available from `https://github.com/blader/humanizer`. It was loaded from a workspace-local skill installation for this checkpoint.

For the current interactive workspace, see [Phases 3–5](phase-5.md).
