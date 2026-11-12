import pytest

from app.merging import GraphMerger, cosine_similarity
from app.schemas import ExtractedConcept, ExtractedRelationship, ExtractionResult, GraphEdge, GraphNode


def concept(label: str, chunk: str = "c2") -> ExtractedConcept:
    return ExtractedConcept(label=label, summary="A grounded summary.", sourceChunkIds=[chunk])


def existing_node() -> GraphNode:
    return GraphNode(id="n1", label="Working memory", summary="The original summary.", docIds=["first"], sourceChunkIds=["c1"], masteryState="mastered")


def test_exact_label_merge_preserves_mastery_summary_and_provenance() -> None:
    merger = GraphMerger("second", [existing_node()], [], {"n1": [1.0, 0.0]}, .9, 40)
    node = merger.merge_concept(concept("  WORKING   MEMORY "), [0.0, 1.0])
    assert node.id == "n1"
    assert node.docIds == ["first", "second"]
    assert node.sourceChunkIds == ["c1", "c2"]
    assert node.masteryState == "mastered"
    assert node.summary == "The original summary."
    merger.merge_concept(concept("Working memory"), [1.0, 0.0])
    assert node.docIds == ["first", "second"] and node.sourceChunkIds == ["c1", "c2"]
    assert len(merger.touched_nodes) == 1


@pytest.mark.parametrize("threshold, expected_count", [(.9, 1), (.99, 2)])
def test_embedding_similarity_uses_the_configured_threshold(threshold: float, expected_count: int) -> None:
    merger = GraphMerger("second", [existing_node()], [], {"n1": [1.0, 0.0]}, threshold, 40)
    merger.merge_concept(concept("Short-term storage"), [.95, .3])
    assert len(merger.nodes) == expected_count


def test_new_concepts_are_deduplicated_within_the_same_document() -> None:
    merger = GraphMerger("doc", [], [], {}, .9, 40)
    first = merger.merge_concept(concept("Recall", "c1"), [1.0, 0.0])
    second = merger.merge_concept(concept("Retrieval", "c2"), [.99, .01])
    assert first.id == second.id
    assert first.sourceChunkIds == ["c1", "c2"]


def test_edge_merge_records_cross_document_provenance() -> None:
    right = GraphNode(id="n2", label="Recall", summary="A second idea.", docIds=["first"], sourceChunkIds=["c3"], masteryState="learning")
    edge = GraphEdge(id="edge", source="n1", target="n2", relationshipLabel="supports", docIds=["first"])
    merger = GraphMerger("second", [existing_node(), right], [edge], {"n1": [1., 0.], "n2": [0., 1.]}, .9, 40)
    result = ExtractionResult(concepts=[concept("Working memory"), concept("Recall")], relationships=[ExtractedRelationship(sourceLabel="Working memory", targetLabel="Recall", relationshipLabel="supports")])
    merger.merge_batch(result, [[1., 0.], [0., 1.]])
    assert len(merger.edges) == 1
    assert merger.touched_edges["edge"].docIds == ["first", "second"]


def test_document_cap_counts_merged_nodes_too() -> None:
    merger = GraphMerger("doc", [], [], {}, 1.0, 1)
    merger.merge_concept(concept("First"), [1., 0.])
    assert merger.remaining == 0
    with pytest.raises(ValueError, match="limit"):
        merger.merge_concept(concept("Second"), [0., 1.])
    assert len(merger.nodes) == 1


def test_zero_vectors_do_not_create_false_similarity() -> None:
    assert cosine_similarity([0., 0.], [1., 0.]) == 0
    with pytest.raises(ValueError, match="dimensions"):
        cosine_similarity([1.], [1., 0.])
