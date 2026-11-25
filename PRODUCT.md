# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite, React 18, strict TypeScript, Tailwind CSS, Zustand, Lucide, React Flow for the 2D canvas and react-force-graph-3d/Three.js on demand. Python 3.11, FastAPI, Pydantic v2, LangChain, persistent local ChromaDB and SQLite through SQLModel. Gemini and OpenAI are supported providers. A deterministic mock mode works without a key. A local CLI and stdio MCP adapter are proposed for Developer Preview v0.1. [Canvas decision](docs/grasp-v2/references.md#canvas-library-decision) · [Preview specification](docs/grasp-v2/developer-preview.md)

## Users

Developers and project owners shaping an idea with an external coding agent. Students can still study PDF, Markdown and text notes. Interviewers can review the design work and the evidence behind the existing RAG implementation.

## Product Purpose

Give the user an editable visual proposal before implementation. Work through questions and requirements on the canvas, try the prototype and approve a versioned specification the coding agent can pick up. [Vision](VISION.md)

## Positioning

GRASP owns the shared board, evidence, feedback and approval record. Codex or another MCP-capable coding agent does the implementation. Indexed sources can inform a proposal and expose exact quotes. Questions, decisions and visual feedback remain useful for projects without documents.

## Operating Context

The preview adds persistent **Project boards** to the approved whiteboard. The **Knowledge Canvas** remains available for import, scoped questions, exact source inspection and 3D graph exploration. The **Engineering Canvas** presents the existing pipeline using repository-backed objects and its presentation views.

The initial target is a local single-owner workspace and a five-minute HTX demonstration on 7 December 2026. Use an isolated demo library and project board. Label live agent calls, local mock processing, simulated prototype behavior and recorded replay where they occur. The public static showcase retains its offline route.

## Capabilities and Constraints

Preserve file and folder import, graph exploration, cited Q&A, source lifecycle, saved conversations, quizzes, retrieval evaluation and self-hosting controls. Preview delivery adds typed board operations, durable questions and decisions, one isolated prototype workflow and a versioned approval export. Each phase requires the owner's go. [Baseline](docs/grasp-v2/baseline.md) · [Roadmap](docs/grasp-v2/roadmap.md)

Progress retains `masteredCount`, `exploredCount`, `totalNodes`, `coveragePercent` and `crossDocLinks`. Mastery remains grounded in quizzes. Keep canonical concepts, document provenance and exact source spans intact. Persist 2D board geometry independently. 3D force positions stay transient. Documents stay local in mock mode. Live mode sends selected text to the configured provider. Collaboration, tenant isolation and public hosting are outside this plan.

## Brand Commitments

Direction A+ uses warm charcoal, editorial titles, drawn technical figures, handwritten annotations and restrained semantic color. Gold marks mastery in the knowledge view. Keep inspectors contextual, camera motion purposeful and the whiteboard visible throughout the workflow. [Approved design](DESIGN.md#shared-whiteboard)

## Evidence on Hand

The existing notes, reports and recorded traces support the presentation. The fresh baseline verifies all four branch snapshots and a local mock import-to-citation flow. Archived evaluations report retrieval relevance on authored examples. Learning outcomes and held-out factual answer quality remain unmeasured. [Evidence register](docs/facts.md) · [Phase 0 review](docs/grasp-v2/README.md)

## Product Principles

- Put clarifying questions next to the objects and steps they affect.
- Distinguish proposals, assumptions, user decisions and source evidence.
- Let the user choose the revision they approve. Keep the approved specification readable after later edits.
- Use real events for demonstrations and identify mock, simulated and recorded behavior.
- Verify complete journeys at each runnable checkpoint.
