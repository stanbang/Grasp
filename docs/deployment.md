# Deployment

`docker compose up --build -d` builds the web bundle and Python API, then serves both at http://127.0.0.1:8080. Docker Desktop or another Linux Docker engine must be running. The image contains Poppler and Tesseract English OCR. Enable it through `OCR_ENABLED=1`; language packs beyond English require an image change.

The service has one Uvicorn worker and one ingestion worker. SQLite and local Chroma are intended for one owner on one machine. Do not scale multiple API replicas against this data directory. Compose sets a 2 GB memory limit and two CPUs; large scans may need more memory. Each OCR render and recognition command has a 60-second page deadline; model generation has a 90-second deadline with no automatic network retry.

## Access

Keep the default loopback binding for local use. For remote hosting, put the service behind an HTTPS reverse proxy and set a random, long `ACCESS_TOKEN` in `.env`. The app asks for that token and retains it only in memory. The token protects API access, including original documents and progress streams; static application assets and `/api/health` remain public. Configure the proxy to pass Authorization headers, permit SSE streaming and enforce its own connection limits.

Requests that change state are limited to `REQUESTS_PER_MINUTE` per remote client address (default 120). The counter is process-local and resets on restart. Behind a proxy it may group users by the proxy address. This is an owner access gate, not user isolation, roles or account recovery.

Uploads default to 10 MB, PDFs to 250 pages and extracted documents to 500,000 characters. PDF passwords, unsupported extensions, empty files and invalid UTF-8 produce errors. Request bodies also have streamed byte limits. Exact quotes are rendered as text; document content is treated as untrusted model input.

## Data

The `grasp-data` volume stores SQLite, Chroma and original uploads. Stop the service before backing up the entire volume so the two stores form one consistent snapshot. Restore the complete snapshot together. `.env` and access tokens need a separate private backup.

Removing a source updates shared graph provenance and invalidates quizzes whose evidence was removed. Conversation answers retain their historical quotes even after source removal; remove the conversation separately if those quotes must also be erased. Failed original/vector cleanup is recorded durably and retried when the API restarts. The API reports `cleanupPending` rather than claiming the physical files were purged.

Replacing and re-indexing ingest the new source first. The old source is removed only after success. A failed attempt remains visible for inspection. Duplicate uploads are detected by raw file bytes; different exports of the same text can still be separate sources.

## Verify

```sh
docker compose ps
docker compose logs --tail 30
```

Check `/api/health`, upload a note, ask a cited question and refresh. Test the access-token gate in a clean browser session. Run `scripts/verify_ocr.py --base-url http://127.0.0.1:8080/api` using Python with the repository dependencies and Poppler installed. The script generates an image-only PDF, uploads it and checks recognized text and exact chunk offsets. It leaves that test source in the library.

The repository includes local build and verification evidence, not a public hosted deployment. A public portfolio demo still needs a chosen host, HTTPS, a cost limit and a decision about who may upload documents.
