# Architecture

The React app talks to the local FastAPI server through Vite's `/api` proxy. API keys stay in the repository-root `.env`; the frontend does not read them. The two development servers bind to 127.0.0.1.

## Contracts

Pydantic models in `apps/api/app/schemas.py` define the public shapes. `scripts/generate_contracts.py` writes the TypeScript mirror and [schema reference](schemas.md). `--check` fails if either generated file differs. Response models are declared on every endpoint.

The final mastery specification takes precedence over the earlier XP wording. No XP, levels, streaks or cross-document bonus calculation is included.

## Storage

SQLite holds documents, extracted source pages, chunks, nodes, edges, concept embeddings, cross-document provenance, event history and a single progress record. SQLModel creates missing tables at startup. Foreign keys and WAL are enabled. There are no layout-coordinate columns. Changes to existing columns need explicit migrations before existing study data can be reused.

Chroma stores chunk vectors in `data/chroma`. The collection name includes a hash of the embedding provider/model identity. Mock embeddings use a separate collection so changing to a live provider cannot silently mix vector spaces. Chroma's default embedding function is disabled; reading health does not download a model. The LangChain Chroma wrapper receives the configured Embeddings implementation when needed.

The sample reader reads `samples/memory-and-learning.md`. Reading it does not index the note or change progress. Uploading through **POST /documents** starts ingestion. Original upload copies are stored under generated names in `data/uploads`.

## Ingestion

Uploads create a queued Document and a durable event, then enter a single worker. PDFs use PyPDFLoader in page mode; UTF-8 text and Markdown form one page. RecursiveCharacterTextSplitter preserves whitespace and adds each chunk's start index. Every span is checked against the extracted source page before indexing.

Chroma receives chunk text, IDs and source metadata through the configured Embeddings implementation. Extraction runs in batches of eight chunks with a remaining concept budget. Output must pass Pydantic validation, use source IDs from its batch and refer only to returned concept labels. Schema or grounding failures get one retry.

Mock extraction creates deterministic fixtures from the uploaded headings and passages, then runs them through FakeListChatModel and the same validation. It does not pretend to perform semantic extraction. Mock relationships describe adjacent concepts in source order.

Concept matching uses normalized labels first and embedding similarity second. Merges retain canonical text and mastery while unioning document and chunk IDs. Embedding identities isolate provider/model spaces. Cross-document counts derive from each node's distinct document IDs.

One SQLite transaction commits pages, chunks, graph changes, provenance, progress and node/edge/completion events. Status events are available before that commit; graph events become visible only after it succeeds. Failed jobs delete their staged Chroma vectors. Later retrieval must resolve vector matches against committed SQLite chunks because the stores do not share a transaction.

Event IDs support SSE replay through Last-Event-ID or an after cursor. On restart, interrupted jobs are marked failed with durable error events; completed graph records remain available. There is no distributed job coordinator or multi-worker merge locking in this checkpoint.

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
| POST | /documents | File upload; queued Document with HTTP 202 |
| GET | /documents | Uploaded documents and statuses |
| GET | /documents/{doc_id} | One Document |
| GET | /documents/{doc_id}/events | SSE progress and graph updates |
| GET | /documents/{doc_id}/chunks | Stored exact-offset chunks |
| GET | /documents/{doc_id}/pages/{page} | Extracted source page text |
| GET | /graph | Committed nodes and edges |
| GET | /progress | Graph size, coverage and cross-document counts |

Health checks verify local stores and the presence of provider configuration. They do not validate a live provider key or make a paid request. FastAPI's API reference is at `/docs`.

## Later phases

Phase 3 adds the lazy-loaded 3D canvas and its source inspector. Phase 4 adds grounded chat. Phase 5 adds quiz grading and mastery updates. Phase 6 adds retrieval evaluation and shipping limits. The current React workspace remains the Phase 1 preview.

For PDF text, PyPDFLoader page metadata is zero-based. Ingestion converts it to the public one-based page convention. Character offsets are Unicode code points in the extracted page text; they are not byte positions or PDF text-box coordinates. The browser must account for JavaScript's UTF-16 indexing when applying them.
