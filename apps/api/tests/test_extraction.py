import pytest
from langchain_core.exceptions import OutputParserException

from app.extraction import mock_extraction, validate_extraction
from app.llm import FixtureChatModel, LLMClient
from app.schemas import Chunk, ExtractedConcept, ExtractionResult


def chunks() -> list[Chunk]:
    text = "## Retrieval practice\n\nRecall an idea before checking the source."
    return [Chunk(id="c1", docId="d", page=1, text=text, charStart=0, charEnd=len(text))]


def test_mock_fixture_comes_from_the_uploaded_text() -> None:
    result = mock_extraction(chunks(), 40)
    assert result.concepts[0].label == "Retrieval practice"
    assert "Recall an idea" in result.concepts[0].summary
    validate_extraction(result, chunks(), 40)
    assert mock_extraction(chunks(), 40) == result


def test_hallucinated_sources_are_rejected_and_retried_once() -> None:
    invalid = ExtractionResult(concepts=[ExtractedConcept(label="Memory", summary="Summary", sourceChunkIds=["invented"])], relationships=[])
    valid = mock_extraction(chunks(), 40)
    model = FixtureChatModel(responses=[invalid.model_dump_json(), valid.model_dump_json(), "{}"])
    result = LLMClient(model).generate("extract", ExtractionResult, validate=lambda value: validate_extraction(value, chunks(), 40))
    assert result == valid
    assert model.i == 2


def test_repeated_grounding_failures_surface_after_one_retry() -> None:
    invalid = ExtractionResult(concepts=[ExtractedConcept(label="Memory", summary="Summary", sourceChunkIds=["invented"])], relationships=[])
    model = FixtureChatModel(responses=[invalid.model_dump_json(), invalid.model_dump_json(), "{}"])
    with pytest.raises(OutputParserException):
        LLMClient(model).generate("extract", ExtractionResult, validate=lambda value: validate_extraction(value, chunks(), 40))
    assert model.i == 2


def test_mock_obeys_the_remaining_node_budget() -> None:
    text = "## First\n\nOne idea.\n\n## Second\n\nAnother idea."
    chunk = Chunk(id="c", docId="d", page=1, text=text, charStart=0, charEnd=len(text))
    assert len(mock_extraction([chunk], 1).concepts) == 1
