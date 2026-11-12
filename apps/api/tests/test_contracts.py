import unittest

from pydantic import ValidationError

from app.schemas import Chunk, GraphNode, Progress, Quiz


class ContractTests(unittest.TestCase):
    def test_chunk_offsets_count_unicode_characters(self) -> None:
        chunk = Chunk(id="c", docId="d", page=1, text="A🧠é", charStart=4, charEnd=7)
        self.assertEqual(chunk.charEnd - chunk.charStart, 3)

    def test_chunk_rejects_an_incorrect_span(self) -> None:
        with self.assertRaises(ValidationError):
            Chunk(id="c", docId="d", page=1, text="notes", charStart=0, charEnd=4)

    def test_nodes_cannot_store_layout_positions(self) -> None:
        with self.assertRaises(ValidationError):
            GraphNode(
                id="n", label="Memory", summary="A concept", docIds=["d"],
                sourceChunkIds=["c"], masteryState="unexplored", x=12,
            )

    def test_quiz_has_exactly_three_options(self) -> None:
        with self.assertRaises(ValidationError):
            Quiz(question="Which?", options=["one", "two"], answerIndex=0)

    def test_progress_rejects_impossible_counts_and_old_xp(self) -> None:
        with self.assertRaises(ValidationError):
            Progress(masteredCount=2, exploredCount=1, totalNodes=1, coveragePercent=100, crossDocLinks=0)
        with self.assertRaises(ValidationError):
            Progress(masteredCount=0, exploredCount=0, totalNodes=0, coveragePercent=0, crossDocLinks=0, xp=5)
