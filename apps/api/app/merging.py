import math
import re
import unicodedata
from uuid import NAMESPACE_URL, uuid5

from .schemas import ExtractedConcept, ExtractionResult, GraphEdge, GraphNode


def normalize_label(label: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", label).casefold()).strip()


def concept_text(label: str, summary: str) -> str:
    return f"{label}\n{summary}"


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right):
        raise ValueError("Concept embeddings must have matching dimensions.")
    numerator = sum(a * b for a, b in zip(left, right))
    denominator = math.sqrt(sum(a * a for a in left) * sum(b * b for b in right))
    return numerator / denominator if denominator else 0.0


def edge_key(source: str, target: str, relationship: str) -> tuple[str, str, str]:
    return source, target, normalize_label(relationship)


class GraphMerger:
    def __init__(
        self, doc_id: str, nodes: list[GraphNode], edges: list[GraphEdge],
        vectors: dict[str, list[float]], threshold: float, limit: int,
    ):
        self.doc_id = doc_id
        self.nodes = {node.id: node.model_copy(deep=True) for node in nodes}
        self.edges = {edge_key(edge.source, edge.target, edge.relationshipLabel): edge.model_copy(deep=True) for edge in edges}
        self.vectors = dict(vectors)
        self.threshold = threshold
        self.limit = limit
        self.touched_nodes: dict[str, GraphNode] = {}
        self.touched_edges: dict[str, GraphEdge] = {}
        self.labels = {normalize_label(node.label): node.id for node in sorted(nodes, key=lambda node: node.id)}

    @property
    def remaining(self) -> int:
        return self.limit - len(self.touched_nodes)

    def find_match(self, concept: ExtractedConcept, vector: list[float]) -> str | None:
        exact = self.labels.get(normalize_label(concept.label))
        if exact:
            return exact
        scores = [(cosine_similarity(vector, candidate), node_id) for node_id, candidate in sorted(self.vectors.items())]
        if not scores:
            return None
        score, node_id = max(scores)
        return node_id if score >= self.threshold else None

    def merge_concept(self, concept: ExtractedConcept, vector: list[float]) -> GraphNode:
        node_id = self.find_match(concept, vector)
        if node_id not in self.touched_nodes and self.remaining <= 0:
            raise ValueError("The document concept limit was exceeded.")
        if node_id is None:
            node_id = str(uuid5(NAMESPACE_URL, f"grasp:{self.doc_id}:{normalize_label(concept.label)}"))
            self.nodes[node_id] = GraphNode(
                id=node_id, label=concept.label.strip(), summary=concept.summary.strip(),
                docIds=[], sourceChunkIds=[], masteryState="unexplored",
            )
            self.vectors[node_id] = vector
        node = self.nodes[node_id]
        node.docIds = list(dict.fromkeys([*node.docIds, self.doc_id]))
        node.sourceChunkIds = list(dict.fromkeys([*node.sourceChunkIds, *concept.sourceChunkIds]))
        self.labels[normalize_label(concept.label)] = node_id
        self.touched_nodes[node_id] = node
        return node

    def merge_batch(self, result: ExtractionResult, vectors: list[list[float]]) -> None:
        if len(result.concepts) != len(vectors):
            raise ValueError("Each extracted concept needs one embedding.")
        resolved = {concept.label: self.merge_concept(concept, vector).id for concept, vector in zip(result.concepts, vectors)}
        for relationship in result.relationships:
            source, target = resolved[relationship.sourceLabel], resolved[relationship.targetLabel]
            if source == target:
                continue
            key = edge_key(source, target, relationship.relationshipLabel)
            edge = self.edges.get(key)
            if edge is None:
                edge = GraphEdge(
                    id=str(uuid5(NAMESPACE_URL, "grasp-edge:" + "|".join(key))),
                    source=source, target=target,
                    relationshipLabel=relationship.relationshipLabel.strip(), docIds=[],
                )
                self.edges[key] = edge
            edge.docIds = list(dict.fromkeys([*edge.docIds, self.doc_id]))
            self.touched_edges[edge.id] = edge
