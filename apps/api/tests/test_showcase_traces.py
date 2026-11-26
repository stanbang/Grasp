import json

import pytest
from pydantic import ValidationError

from app.config import PROJECT_ROOT
from app.showcase_models import ShowcaseTrace


TRACE_DIRECTORY = PROJECT_ROOT / "apps/web/src/showcase/traces"
SAMPLE_IDS = ("computer-networks", "memory-and-learning", "retrieval-review")


@pytest.mark.parametrize("sample_id", SAMPLE_IDS)
def test_bundled_trace_preserves_pages_links_and_citations(sample_id: str) -> None:
    trace = ShowcaseTrace.model_validate_json((TRACE_DIRECTORY / f"{sample_id}.json").read_bytes())
    assert trace.id == sample_id
    assert (PROJECT_ROOT / trace.sourcePath).is_file()
    assert trace.prompts and trace.graph.nodes and trace.graph.edges
    assert any(
        left.page == right.page and left.charEnd > right.charStart
        for left, right in zip(trace.chunks, trace.chunks[1:])
    ), "A sample needs an observable overlap for the replay."
    if sample_id == "computer-networks":
        assert len(trace.pages) == 2 and trace.fileName.endswith(".pdf")


def test_trace_rejects_a_changed_citation_and_an_invalid_offset() -> None:
    path = TRACE_DIRECTORY / "computer-networks.json"
    trace = json.loads(path.read_bytes())
    trace["prompts"][0]["answer"]["citations"][0]["quote"] += " This wording was invented."
    with pytest.raises(ValidationError, match="quote the cited chunk exactly"):
        ShowcaseTrace.model_validate(trace)

    trace = json.loads(path.read_bytes())
    trace["chunks"][0]["charStart"] += 1
    trace["chunks"][0]["charEnd"] += 1
    with pytest.raises(ValidationError, match="match its exact page span"):
        ShowcaseTrace.model_validate(trace)
