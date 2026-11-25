import argparse
import json
import sys
from pathlib import Path
from typing import Any

from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.schemas import PUBLIC_MODELS
from app.canvas_contracts import CANVAS_MODELS
from app.conversations import Conversation, Conversations, Turn, Turns
from app.study_routes import ChatRequest, NodeRequest, Question, QuizResponse, GradeRequest, GradeResponse
from app.showcase_models import SHOWCASE_MODELS
PUBLIC_MODELS = (*PUBLIC_MODELS, Conversation, Conversations, Turn, Turns, ChatRequest, NodeRequest, Question, QuizResponse, GradeRequest, GradeResponse)


def typescript_type(schema: dict[str, Any], *, optional: bool = False) -> str:
    if "$ref" in schema:
        return schema["$ref"].split("/")[-1]
    if "const" in schema:
        return json.dumps(schema["const"])
    if "enum" in schema:
        return " | ".join(json.dumps(value) for value in schema["enum"])
    if "anyOf" in schema or "oneOf" in schema:
        variants = schema.get("anyOf", schema.get("oneOf", []))
        if optional:
            variants = [item for item in variants if item.get("type") != "null"]
        return " | ".join(typescript_type(item) for item in variants)
    kind = schema.get("type")
    if kind == "array":
        if "prefixItems" in schema:
            return "[" + ", ".join(typescript_type(item) for item in schema["prefixItems"]) + "]"
        return f"Array<{typescript_type(schema.get('items', {}))}>"
    if kind == "object":
        additional = schema.get("additionalProperties", {})
        value_type = typescript_type(additional) if isinstance(additional, dict) else "unknown"
        return f"Record<string, {value_type}>"
    return {"integer": "number", "number": "number", "string": "string", "boolean": "boolean", "null": "null"}.get(kind, "unknown")


def generate_types(
    models: tuple[type[BaseModel], ...] = PUBLIC_MODELS, imports: str = "", *, preserve_null: bool = False,
) -> str:
    lines = ["// Generated from Pydantic by scripts/generate_contracts.py; change the source schema.", ""]
    if imports:
        lines.extend([imports, ""])
    for model in models:
        schema = model.model_json_schema()
        required = set(schema.get("required", []))
        lines.append(f"export interface {model.__name__} {{")
        for name, field in schema["properties"].items():
            optional = name not in required
            suffix = "?" if optional else ""
            lines.append(f"  {name}{suffix}: {typescript_type(field, optional=optional and not preserve_null)};")
        lines.extend(["}", ""])
    return "\n".join(lines)


def generate_docs() -> str:
    public_names = {"Quiz", "GraphNode", "GraphEdge", "Chunk", "Document", "Citation", "ChatResponse", "Progress"}
    definitions = "\n\n".join(
        f"### {model.__name__}\n\n```json\n{json.dumps(model.model_json_schema(), indent=2, ensure_ascii=False)}\n```"
        for model in PUBLIC_MODELS if model.__name__ in public_names
    )
    return (
        "# Data contracts\n\nThe Python source is `apps/api/app/schemas.py`. "
        "Run `python scripts/generate_contracts.py --check` with the project virtual environment "
        "to check the TypeScript mirror and this document.\n\n"
        "Pages are one-based. Chunk offsets count Unicode code points within the extracted page text, "
        "and charEnd is exclusive. A browser must use `Array.from(pageText)` before applying those offsets. "
        "PDF citations refer to extracted text, not coordinates on a rendered PDF.\n\n"
        "exploredCount includes learning and mastered nodes. coveragePercent is the percentage of nodes "
        "explored, or zero for an empty graph. crossDocLinks counts each extra document attached to a "
        "concept after its first document. Reprocessing the same concept/document pair does not add another link. "
        "Ingestion updates totalNodes and crossDocLinks. Exploration and mastery updates arrive in later phases.\n\n"
        "Quiz.answerIndex is an internal answer key. The quiz delivery endpoint in Phase 5 will use "
        "a separate public question model so the answer key is not sent before grading.\n\n"
        + definitions + "\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = {
        ROOT / "apps/web/src/types/contracts.ts": generate_types(),
        ROOT / "apps/web/src/types/canvas-contracts.ts": generate_types(CANVAS_MODELS, preserve_null=True),
        ROOT / "apps/web/src/showcase/trace-types.ts": generate_types(
            SHOWCASE_MODELS, 'import type { ChatResponse, Chunk, GraphResponse, PageResponse } from "../types/contracts";',
        ),
        ROOT / "docs/schemas.md": generate_docs(),
    }
    stale = []
    for path, content in outputs.items():
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")
    if stale:
        raise SystemExit("Regenerate out-of-date contracts: " + ", ".join(stale))
    print("Contracts match Pydantic." if args.check else "Generated TypeScript contracts and schema documentation.")


if __name__ == "__main__":
    main()
