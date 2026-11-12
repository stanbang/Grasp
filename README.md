# Grasp

A local study workspace for tracing concepts and answers back to your notes. The current checkpoint is Phase 1: a runnable workspace preview, shared contracts, local storage and mock model adapters.

## Run

Install Python 3.11 and a supported Node.js release (20.19+ or 22.12+), then run this command from the repository root:

```sh
python scripts/dev.py --setup
```

On Windows with several Python versions, use `py -3.11 scripts/dev.py --setup`. The command creates `.venv`, installs the locked dependencies, copies `.env.example` to `.env` if needed and starts both servers. The default `MOCK_LLM=1` needs no API key. Open `http://127.0.0.1:5173`. Ctrl+C stops both servers.

On later runs, use `python scripts/dev.py`. Use `python scripts/dev.py --install-only` to install without starting the app.

## Try the checkpoint

- Read the sample note in the source panel and download its Markdown file.
- Inspect the live Pydantic schemas through **Contracts**.
- Open the workspace connection status to check SQLite, ChromaDB and mock mode.
- Open `http://127.0.0.1:8000/docs` for the API reference.

See [the Phase 1 checks](docs/phase-1.md) for verification and known limitations.

## Check and build

```sh
python scripts/check.py
npm run build
```

The check command verifies generated contracts, runs backend unit tests and checks strict TypeScript. The build writes the web bundle to `apps/web/dist`. Backend requirements are declared in `apps/api/requirements.in` and locked in `apps/api/requirements.lock`. Frontend versions are locked in `apps/web/package-lock.json`.

## Model configuration

Keep keys in the root `.env`. For OpenAI, set `MOCK_LLM=0`, `LLM_PROVIDER=openai`, OPENAI_API_KEY, LLM_MODEL and EMBEDDING_MODEL. For Gemini, use `LLM_PROVIDER=gemini` and GOOGLE_API_KEY with Gemini model names. Restart the servers after changing configuration. Both providers use LangChain interfaces and validate structured responses with Pydantic.

Mock mode uses fixed model responses and local hashed embeddings. It makes no model calls and downloads no embedding model. It does not measure semantic answer quality. Live mode sends the text supplied to a model or embedder to the configured provider. Do not commit `.env`, uploaded notes or the `data` directory.

## Layout

```text
apps/
  api/app/          FastAPI, schemas, stores and model adapters
  api/tests/        Contracts, adapters and storage checks
  web/src/          React workspace and generated TypeScript contracts
docs/              Architecture, schemas and phase verification
samples/           Original sample study note
scripts/           Setup, development launcher and contract generation
```

## Phases

1. Scaffold, contracts, local stores and preview.
2. Document ingestion, extraction, merging and SSE.
3. Interactive 3D canvas and source panels.
4. Grounded chat with exact citations.
5. Mastery quizzes and persistent progress.
6. Retrieval evaluation and shipping checks.

Each phase ends at a runnable checkpoint. The next phase starts after approval. The final mastery specification has no XP, levels or streaks.

[Architecture](docs/architecture.md) · [Data contracts](docs/schemas.md) · [Design review](docs/design-review-phase-1.md) · [Working rules](AGENTS.md) · [Product](PRODUCT.md) · [Design](DESIGN.md)
