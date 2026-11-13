# Grasp

A document Q&A app with an interactive 3D mindmap. Drop notes onto the page, ask a question and inspect the exact passages behind the answer. PDF, Markdown and UTF-8 text files are supported. The full pipeline also runs offline with deterministic fixtures.

## Run

Install Python 3.11 and Node.js 20.19+ or 22.12+, then run from the repository root:

```sh
python scripts/dev.py --setup
```

On Windows with several Python versions, use `py -3.11 scripts/dev.py --setup`. Setup creates `.venv`, installs the locked dependencies, copies `.env.example` when needed and starts both servers. Open [the workspace](http://127.0.0.1:5173). Later runs use `python scripts/dev.py`. Ctrl+C stops both servers.

The default `MOCK_LLM=1` needs no key. Mock answers show retrieved excerpts; they do not simulate generated explanations.

## Use

The workspace opens with a question/upload composer. Drop PDF, Markdown or TXT notes anywhere, or use the file and folder actions. During ingestion, the composer contracts into a processing loop driven by actual SSE events. Completed sources enter the document orbit; failed files retain their names and offer Retry/Dismiss. Adding notes preserves the current conversation.

Documents use a Three.js CSS3D orbit with stable server IDs, hover/focus pause and reduced-motion support. Narrow screens and large libraries use a scrollable document strip. Switch to Knowledge to explore the existing force graph without discarding its layout. Selecting a document highlights its concepts.

Ask a question; your message appears immediately while the API retrieves evidence. Answers appear as complete responses because the current chat API does not stream tokens. Named citations open the original PDF page and exact extracted quote in a side inspector. Use Ask this document to change scope explicitly, or return to all sources. Exact quotes are highlighted in extracted text; no PDF rectangle positions are fabricated.

Workspace settings retains saved conversations, replacement, re-indexing, removal and mastery quizzes. Passing at least two of three questions marks the assessed concept mastered. Duplicate files select their existing source rather than create another card.

See [the completed UI redesign](docs/redesign/delivery.md). A separate manual design-state viewer remains at `/design-preview.html`; it is labelled as sample content and makes no AI/upload requests.

## Configure AI and OCR

Keep keys in the ignored root `.env`, never in frontend variables. For Gemini:

```dotenv
MOCK_LLM=0
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.1-flash-lite
EMBEDDING_MODEL=gemini-embedding-001
GOOGLE_API_KEY=your-key
DATA_DIR=data/gemini
```

Model availability depends on the account; consult [Google's model reference](https://ai.google.dev/gemini-api/docs/models). OpenAI uses `LLM_PROVIDER=openai`, `OPENAI_API_KEY` and matching chat/embedding model names. Restart after changing configuration. Keep a separate data directory when switching embedding providers, or re-index existing notes.

Live mode sends selected passages and recent conversation context to the configured provider. Mock mode keeps document processing local. Native OCR also stays local: the container includes Poppler and Tesseract with English recognition. Set `OCR_ENABLED=1` to read PDF pages without extractable text. Other languages need their Tesseract language packs. On a native installation, install both tools and place them on PATH first.

## Check

```sh
python scripts/check.py
npm run build
```

The check command verifies generated Pydantic/TypeScript contracts, backend tests, folder traversal and file-drop tests, and strict TypeScript. The web bundle is written to `apps/web/dist`; the 3D engine is loaded separately.

Using the repository's virtual-environment Python, run `apps/api/eval/run.py` for the 20-case offline retrieval check. Add `--live --output docs/evaluation-live.json` for configured provider embeddings. `scripts/verify_live.py` checks generated answers, exact citations, follow-up persistence, unsupported questions and quiz grading in a temporary library. Live checks make provider requests and can incur charges.

## Self-host

With Docker running:

```sh
docker compose up --build -d
```

Open [the container preview](http://127.0.0.1:8080). The frontend and API share one origin, the container runs as a non-root user and local study data uses a named volume. Compose reads provider configuration from `.env` and binds only to loopback.

This is a single-owner app. Set a long `ACCESS_TOKEN` before exposing the API, use HTTPS at the host's reverse proxy and keep backups of the complete data volume. Token access is not a multi-user account system. See [deployment](docs/deployment.md) for limits, backup and verification instructions.

## Layout

```text
apps/api/app/       API, ingestion, provenance, conversations and mastery
apps/api/tests/     Storage, source spans, merging and HTTP checks
apps/api/eval/      Original 20-case retrieval evaluation
apps/web/src/       React canvas, questions, source dialogs and contracts
docs/              Schemas, architecture, checks and demo instructions
samples/           Original demonstration notes
scripts/           Setup, contracts and repeatable verification
```

All six phases are implemented. [Phase 6](docs/phase-6.md) records verification and remaining deployment limits. Earlier phase documents describe their historical checkpoints. See [the demo script](docs/demo.md), [architecture](docs/architecture.md), [contracts](docs/schemas.md) and [working rules](AGENTS.md).
