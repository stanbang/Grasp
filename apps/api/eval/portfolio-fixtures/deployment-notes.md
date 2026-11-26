# Web application deployment

## Local workspace
A development server binds to loopback so a browser on the same machine can reach it. A reverse proxy sends API requests to the backend. A container can serve frontend assets and API endpoints on the same origin.

## Storage
Keep original documents, metadata, and search indexes together when backing up a single-owner application. Stop writes before taking a snapshot so files and index records refer to the same set of sources. Restore the snapshot in an isolated test workspace first.

## Retrieval service maintenance
Record the embedding model and chunk configuration with an index. Build a parallel index before changing models. Compare the new index with the old one on fixed questions before directing traffic to it.

## Feedback
Deployment feedback includes health checks, server errors, and elapsed time. A health check indicates service readiness. A working health endpoint cannot demonstrate that answers are grounded in the relevant passage.
