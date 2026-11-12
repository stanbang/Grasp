# Phase 2 checkpoint

## Scope

PDF, Markdown and text uploads now produce persistent source pages, exact-offset chunks, Chroma vectors, concept nodes and relationships. Shared concepts merge across documents while retaining their document and chunk IDs. SQLite stores progress events for replay after a client reconnects.

This phase exposes ingestion through the API. The web workspace keeps its Phase 1 layout. The upload controls and interactive 3D display join it in Phase 3.

## Run and verify

From the repository root, use Python 3.11 and a supported Node.js release:

```sh
python scripts/dev.py --setup
```

Keep that terminal open. In a second terminal:

```sh
python scripts/verify_ingestion.py
python scripts/check.py
npm run build
```

The verification script requires mock mode and uploads `memory-and-learning.md` and `retrieval-review.md`. It validates event payloads, completed-stream replay and every chunk's exact source span, then checks that the samples share a merged node. Both uploads remain in the local library. Repeated runs create new document records; they do not erase existing study data.

On the default configuration, the demonstration produced three chunks and nine concepts for the first note, one chunk and four concepts for the second, and three shared concepts. The combined graph had ten nodes. These are fixture results, not an extraction-quality benchmark.

For a manual upload, open `http://127.0.0.1:8000/docs`, expand **POST /documents**, select **Try it out**, choose a `.pdf`, `.md` or `.txt` file, and execute. The HTTP 202 response contains a queued Document and its ID.

Open **GET /documents/{doc_id}/events** using that ID, or run this in PowerShell after assigning the returned ID to `$documentId`:

```powershell
curl.exe -N "http://127.0.0.1:8000/documents/$documentId/events"
```

Processing ends with a `complete` or `error` event. A failed PDF or text decode produces an error message. Use **GET /documents/{doc_id}/chunks** and **GET /documents/{doc_id}/pages/{page}** to compare exact spans. **GET /graph** shows the committed nodes and edges; **GET /progress** shows graph size and cross-document links.

## Event contract

Each SSE message has a numeric `id`, a named `event` and JSON `data` validated against IngestionEvent. The generated TypeScript model is in `apps/web/src/types/contracts.ts`; **GET /schemas** includes its full JSON schema.

| Event | Payload |
| --- | --- |
| status | Document snapshot, message, optional extraction-batch counts |
| node | Complete node record, including its canonical ID and merged sources |
| edge | Complete edge record, including its canonical ID and document provenance |
| complete | Done Document and chunk, concept and relationship counts for this upload |
| error | Failed Document and a message describing the failure |

Treat node and edge events as upserts by ID. A cross-document merge emits the updated canonical record. Connect with `Last-Event-ID` or `?after=` to receive only events after a saved cursor. The server sends heartbeat comments while processing and closes a terminal stream. Clients should close their EventSource after a terminal `complete` or JSON `error` payload. Transport errors can reconnect with Last-Event-ID.

Status events are committed during processing. Nodes and edges are published after the document's graph transaction commits, followed by `complete`. This prevents a failed transaction from placing uncommitted nodes on a client canvas.

## Storage and recovery

The API uses one ingestion worker. Chroma indexing happens before one SQLite transaction commits pages, chunks, graph changes, provenance, counts and final events. Failed jobs remove their staged vectors and keep the existing graph. Retrieval in later phases must resolve vector matches against committed SQLite chunks; SQLite and Chroma do not share a transaction.

On restart, queued or active jobs become failed records with replayable error events. Upload those files again to retry. Completed documents remain available. The original uploads are stored under generated names in `data/uploads`; extracted pages preserve the text used for offsets.

Phase 2 adds source-page, concept-embedding and event tables through additive table creation. It does not rebuild existing Phase 1 tables or remove data. Future changes to existing columns still need migrations.

## Configuration and limits

| Setting | Default |
| --- | --- |
| MAX_NODES_PER_DOCUMENT | 40 |
| CONCEPT_SIMILARITY_THRESHOLD | 0.90 |
| CHUNK_SIZE | 900 characters |
| CHUNK_OVERLAP | 150 characters |
| MAX_UPLOAD_BYTES | 10485760 bytes |

The parser accepts up to 250 PDF pages and 500,000 extracted characters. Text files must be UTF-8; a UTF-8 BOM is removed before offsets are calculated. Password-protected PDFs and pages without readable text require an unlocked or OCR-processed copy. Chunk overlap must be smaller than chunk size.

Matching first checks normalized labels, then cosine similarity against concept embeddings from the current embedding identity. A merge keeps the canonical label, summary and mastery state, and unions source IDs. The document cap includes concepts merged with existing nodes. Once reached, remaining chunks are still indexed but are not extracted into additional concepts.

## Checks and limitations

The checkpoint passed 49 tests covering chunk offsets, repeated text, Unicode, PDF page numbering, structured-output retries, threshold matching, provenance, upload validation, SSE replay, failure cleanup and transaction rollback. Contract synchronization, strict TypeScript, the production build and dependency consistency also passed. The verification script passed against the running local API. Restarting it preserved all ten sample nodes, eleven edges and both completed documents. Upload timestamps remain UTC when records are read back from SQLite.

Live provider extraction has not been exercised with a real key. Mock embeddings do not establish semantic similarity quality; mock relationships describe source order. Exact source IDs are validated, but semantic correctness of live summaries and relationships needs evaluation. Normalized label matching can merge ambiguous concepts that share a name.

There is no OCR, cancellation, delete/retry endpoint, multi-worker coordination, chat, quiz flow, public hosting or production rate limiter in this phase. Event history and uploaded originals remain in local storage. Full upload hardening and retrieval evaluation remain part of Phase 6.
