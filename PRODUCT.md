# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite, React 18, strict TypeScript, Tailwind CSS, Zustand, Lucide and react-force-graph-3d/Three.js. Python 3.11, FastAPI, Pydantic v2, LangChain, persistent local ChromaDB and SQLite through SQLModel. Providers are Gemini or OpenAI. A deterministic mock mode works without a key. Phase 0 proposes React Flow for the shared 2D canvas. [Canvas decision](docs/grasp-v2/references.md#canvas-library-decision)

## Users

Students studying their own PDF, Markdown and text notes, and interviewers reviewing the project's engineering decisions. A portfolio visitor can use the lightweight recorded showcase.

## Product Purpose

Help students organize connected ideas, ask questions in context and check the supporting evidence. Let an interviewer follow the same application's architecture and observe how a source becomes a grounded answer.

## Positioning

The same source chunks support the knowledge graph, answer citations and mastery checks. A student can move a concept card, inspect it and return to the source passage. An interviewer can move from a system diagram into the real workflow and return to the same frame.

## Operating Context

The Phase 0 proposal opens into a canvas-first **Knowledge Canvas** for study. Students can open a board, add sources, explore progressively revealed concepts, organize the board and ask a question with visible source scope. **Engineering Canvas** shares the interaction model and adds a repository-backed architecture walkthrough, inspectable pipeline and guided presentation across seven frames.

The primary target is the local single-owner workspace and a projector-ready HTX demonstration. The existing 3D graph remains available on demand. The existing static replay remains useful for portfolio visitors with no backend. Opening the architecture boards requires no model request. Use explicit labels for live provider, local mock processing and recorded replay. The interview demo uses an isolated library and disposable board state.

## Capabilities and Constraints

The verified v1 baseline includes file and folder import, graph exploration, cited Q&A, source lifecycle, saved conversations, quizzes, retrieval evaluation and self-hosting controls. The v2 milestones preserve those capabilities and progressively integrate them into the canvas. Phase 0 is documentation and verification. Each subsequent phase requires the owner's go. [Baseline](docs/grasp-v2/baseline.md) · [Roadmap](docs/grasp-v2/roadmap.md)

Progress retains `masteredCount`, `exploredCount`, `totalNodes`, `coveragePercent` and `crossDocLinks`. Mastery remains grounded in quizzes. Keep canonical concepts, document provenance and exact source spans intact. Persist 2D board geometry independently. 3D force positions stay transient. Documents stay local in mock mode. Live mode sends selected text to the configured provider. Collaboration, tenant isolation and public hosting are outside this plan.

## Brand Commitments

Calm dark navy, restrained canvas geometry, one cool accent, gold for mastery and a light palette for projection. The board carries the story. Controls and inspectors appear where the user can act. Keep plain copy, purposeful motion and a lightweight first view.

## Evidence on Hand

The existing notes, reports and recorded traces support the presentation. The fresh baseline verifies all four branch snapshots and a local mock import-to-citation flow. Archived evaluations report retrieval relevance on authored examples. Learning outcomes and held-out factual answer quality remain unmeasured. [Evidence register](docs/facts.md) · [Phase 0 review](docs/grasp-v2/README.md)

## Product Principles

- Let users organize and explore the canvas before asking a question.
- Keep explanations one interaction from their source.
- Use real events for demonstrations and make the current mode visible.
- Keep meaningful assisted edits previewable, scoped and reversible.
- Verify complete journeys at each runnable checkpoint.
