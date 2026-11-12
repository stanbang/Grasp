import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")

if __name__ == "__main__" and Path(sys.executable).resolve() != PYTHON.resolve():
    if not PYTHON.exists():
        raise SystemExit("Run python scripts/dev.py --setup first.")
    raise SystemExit(subprocess.run([str(PYTHON), __file__, *sys.argv[1:]], cwd=ROOT).returncode)

import httpx
from dotenv import load_dotenv

sys.path.insert(0, str(ROOT / "apps/api"))
from app.schemas import ChunksResponse, Document, GraphResponse, HealthResponse, IngestionEvent, PageResponse


def upload_sample(client: httpx.Client, path: Path) -> Document:
    with path.open("rb") as source:
        response = client.post("/documents", files={"file": (path.name, source, "text/markdown")})
    response.raise_for_status()
    document = Document.model_validate(response.json())
    events: list[IngestionEvent] = []
    with client.stream("GET", f"/documents/{document.id}/events") as stream:
        stream.raise_for_status()
        for line in stream.iter_lines():
            if line.startswith("data: "):
                events.append(IngestionEvent.model_validate_json(line[6:]))
    if not events or events[-1].type != "complete":
        message = events[-1].message if events else "No terminal event arrived."
        raise SystemExit(f"{path.name}: {message}")
    final = events[-1]
    replay = client.get(f"/documents/{document.id}/events", headers={"Last-Event-ID": str(final.id)})
    replay.raise_for_status()
    assert "data: " not in replay.text, "Completed events should not replay after their cursor."
    print(f"{path.name}: chunks={final.chunkCount}, concepts={final.nodeCount}, relationships={final.edgeCount}")
    return document


def verify_sources(client: httpx.Client, document: Document) -> None:
    response = client.get(f"/documents/{document.id}/chunks")
    response.raise_for_status()
    chunks = ChunksResponse.model_validate(response.json()).chunks
    assert chunks, "The sample needs at least one chunk."
    pages: dict[int, PageResponse] = {}
    for chunk in chunks:
        if chunk.page not in pages:
            response = client.get(f"/documents/{document.id}/pages/{chunk.page}")
            response.raise_for_status()
            pages[chunk.page] = PageResponse.model_validate(response.json())
        assert pages[chunk.page].text[chunk.charStart:chunk.charEnd] == chunk.text


def main() -> None:
    load_dotenv(ROOT / ".env", override=False)
    parser = argparse.ArgumentParser(description="Upload two original samples and verify sources, merges and SSE replay.")
    parser.add_argument("--base-url", default=f"http://127.0.0.1:{os.getenv('API_PORT', '8000')}")
    args = parser.parse_args()
    with httpx.Client(base_url=args.base_url, timeout=30, trust_env=False) as client:
        response = client.get("/health")
        response.raise_for_status()
        health = HealthResponse.model_validate(response.json())
        if health.llm.provider != "mock":
            raise SystemExit("Use MOCK_LLM=1 and restart the API before running this fixture verification.")
        documents = [upload_sample(client, ROOT / "samples" / name) for name in ("memory-and-learning.md", "retrieval-review.md")]
        for document in documents:
            verify_sources(client, document)
        response = client.get("/graph")
        response.raise_for_status()
        graph = GraphResponse.model_validate(response.json())
        uploaded_ids = {document.id for document in documents}
        merged = [node for node in graph.nodes if uploaded_ids <= set(node.docIds)]
        assert merged, "The samples must share at least one concept."
        print(f"Cross-document merged concepts: {len(merged)}")
        print("Exact chunk spans and completed-stream replay passed. The two sample uploads remain in local storage.")


if __name__ == "__main__":
    main()
