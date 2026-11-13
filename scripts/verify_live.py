"""Exercise the configured provider against original notes in an isolated library."""

import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api"))

from fastapi.testclient import TestClient
from sqlmodel import Session
from app.config import get_settings
from app.main import app
from app.quiz_models import QuizAttemptRow


def checked(response):
    response.raise_for_status()
    return response.json()


def verify_answer(client: TestClient, answer: dict) -> None:
    assert answer["answer"].strip() and answer["citations"]
    for citation in answer["citations"]:
        chunks = checked(client.get(f"/documents/{citation['docId']}/chunks"))["chunks"]
        chunk = next(chunk for chunk in chunks if chunk["id"] == citation["chunkId"])
        assert citation["quote"] in chunk["text"]
        assert citation["page"] == chunk["page"]


def main() -> None:
    settings = get_settings()
    if settings.mock_llm:
        raise SystemExit("Set MOCK_LLM=0 and configure the chosen provider in .env first.")
    report = {"provider": settings.llm_provider, "model": settings.llm_model}
    with tempfile.TemporaryDirectory(prefix="grasp-live-", ignore_cleanup_errors=True) as folder:
        # Keep provider verification separate from the user's study library.
        os.environ["DATA_DIR"] = folder
        get_settings.cache_clear()
        with TestClient(app) as client:
            if settings.access_token:
                client.headers["Authorization"] = f"Bearer {settings.access_token}"
            path = ROOT / "samples/memory-and-learning.md"
            document = checked(client.post("/documents", files={"file": (path.name, path.read_bytes())}))
            events = client.get(f"/documents/{document['id']}/events")
            events.raise_for_status()
            final = checked(client.get(f"/documents/{document['id']}"))
            assert final["status"] == "done", "Live extraction failed; inspect local API logs."
            conversation = checked(client.post("/conversations"))["id"]
            questions = ["What is retrieval practice?", "Explain that more simply."]
            for question in questions:
                answer = checked(client.post("/chat", json={"question": question, "conversationId": conversation, "docIds": [document["id"]]}))
                verify_answer(client, answer)
            unsupported = checked(client.post("/chat", json={"question": "Who won the intergalactic pickleball championship?", "docIds": [document["id"]]}))
            assert not unsupported["citations"], "An unsupported question should abstain."
            graph = checked(client.get("/graph"))
            node = next(node for node in graph["nodes"] if "retrieval" in node["label"].lower())
            quiz = checked(client.post("/quiz", json={"nodeId": node["id"]}))
            assert len(quiz["questions"]) == 3
            assert all("answerIndex" not in question for question in quiz["questions"])
            with Session(client.app.state.storage.engine) as session:
                attempt = session.get(QuizAttemptRow, quiz["attemptId"])
                correct = [question["answerIndex"] for question in attempt.questions]
            grade = checked(client.post("/quiz/grade", json={"attemptId": quiz["attemptId"], "answers": correct}))
            assert grade["score"] == 3 and grade["passed"]
            assert len(checked(client.get(f"/conversations/{conversation}"))["turns"]) == 2
            report.update({"extractedNodes": len(graph["nodes"]), "citedAnswers": 2, "unsupportedAbstained": True, "quizQuestions": 3, "masteryPassed": True})
    (ROOT / "docs/live-verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
