import unittest

from pydantic import ValidationError
from langchain_core.exceptions import OutputParserException

from app.config import Settings
from app.llm import DeterministicEmbeddings, FixtureChatModel, LLMClient, build_chat_model
from app.schemas import Quiz


class MockModelTests(unittest.TestCase):
    def test_mock_response_uses_the_requested_schema(self) -> None:
        model = build_chat_model(Settings(), ['{"question":"Which?","options":["a","b","c"],"answerIndex":1}'])
        response = LLMClient(model).generate("Create a quiz.", Quiz)
        self.assertIsInstance(response, Quiz)
        self.assertEqual(response.answerIndex, 1)

    def test_invalid_response_is_retried_once(self) -> None:
        model = FixtureChatModel(responses=[
            '{"question":"Which?","options":["a","b"],"answerIndex":0}',
            '{"question":"Which?","options":["a","b","c"],"answerIndex":0}',
            '{"question":"Not reached","options":["a","b","c"],"answerIndex":2}',
        ])
        response = LLMClient(model).generate("Create a quiz.", Quiz)
        self.assertEqual(response.question, "Which?")
        self.assertEqual(model.i, 2)

    def test_two_invalid_responses_raise(self) -> None:
        model = FixtureChatModel(responses=['{"bad":true}', '{"alsoBad":true}', '{}'])
        with self.assertRaises((ValidationError, OutputParserException)):
            LLMClient(model).generate("Create a quiz.", Quiz)
        self.assertEqual(model.i, 2)

    def test_embeddings_are_stable_and_normalized(self) -> None:
        embedder = DeterministicEmbeddings()
        first = embedder.embed_query("Memory retrieval practice")
        self.assertEqual(first, embedder.embed_query("memory retrieval practice"))
        self.assertAlmostEqual(sum(value * value for value in first), 1)
        self.assertEqual(embedder.embed_query(""), [0.0] * 256)
