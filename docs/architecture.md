# Phase 1 architecture

The React app talks to the local FastAPI server through Vite's `/api` proxy. API keys stay in the repository-root `.env`; the frontend does not read them. The two development servers bind to 127.0.0.1.

## Contracts

Pydantic models in `apps/api/app/schemas.py` define the public shapes. `scripts/generate_contracts.py` writes the TypeScript mirror and [schema reference](schemas.md). `--check` fails if either generated file differs. Response models are declared on every endpoint.

The final mastery specification takes precedence over the earlier XP wording. No XP, levels, streaks or cross-document bonus calculation is included.

## Storage

SQLite holds documents, chunks, nodes, edges, cross-document provenance and a single progress record. SQLModel creates the initial schema at startup. Foreign keys and WAL are enabled. There are no layout-coordinate columns. Later schema changes need explicit migrations before existing study data can be reused.

Chroma stores chunk vectors in `data/chroma`. The collection name includes a hash of the embedding provider/model identity. Mock embeddings use a separate collection so changing to a live provider cannot silently mix vector spaces. Chroma's default embedding function is disabled; reading health does not download a model. The LangChain Chroma wrapper receives the configured Embeddings implementation when needed.

The sample reader reads `samples/memory-and-learning.md`. It does not ingest or index the note, populate a graph or change progress. Actual ingestion begins in Phase 2.

## Model adapters

`LLMClient` accepts a LangChain BaseChatModel. Live providers use `.with_structured_output()` with a Pydantic schema. Invalid output is retried once. Provider network errors are surfaced without a hidden retry loop.

FakeListChatModel does not implement structured tool binding, so `FixtureChatModel` composes it with LangChain's PydanticOutputParser. This keeps the same `with_structured_output` call and validation in mock mode. Fixtures are supplied for the requested schema; the mock never pretends to answer an arbitrary document question.

The mock Embeddings implementation hashes normalized tokens into 256 dimensions and normalizes the vector. It is deterministic and makes no network calls. It supports storage and pipeline tests, not claims about semantic retrieval quality. Live retrieval quality must be measured separately in Phase 6.

## Current endpoints

| Method | Path | Result |
| --- | --- | --- |
| GET | /health | SQLite, Chroma and provider-configuration checks |
| GET | /schemas | Public Pydantic JSON schemas |
| GET | /samples/study-note | Original demonstration note |

Health checks verify local stores and the presence of provider configuration. They do not validate a live provider key or make a paid request. FastAPI's API reference is at `/docs`.

## Later phases

Phase 2 adds upload, page parsing, chunking, extraction, deduplication and SSE. Phase 3 adds the lazy-loaded 3D canvas and its source inspector. Phase 4 adds grounded chat. Phase 5 adds quiz grading and progress updates. Phase 6 adds retrieval evaluation and shipping limits.

For PDF text, PyPDFLoader page metadata is zero-based. Ingestion will convert it to the public one-based page convention. Character offsets are Unicode code points in the extracted page text; they are not byte positions or PDF text-box coordinates. The browser must account for JavaScript's UTF-16 indexing when applying them.
