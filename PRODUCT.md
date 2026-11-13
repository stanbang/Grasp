# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite, React 18, strict TypeScript, Tailwind CSS, Zustand, Lucide and react-force-graph-3d/Three.js. Python 3.11, FastAPI, Pydantic v2, LangChain, persistent local ChromaDB and SQLite through SQLModel. Providers are Gemini or OpenAI. A deterministic mock mode works without a key.

## Users

Students studying their own PDF, Markdown and text notes. Portfolio visitors also need to understand the project through a lightweight runnable preview.

## Product Purpose

Help students understand how concepts connect, ask questions with exact source citations and check their understanding with grounded quizzes.

## Positioning

The same source chunks support the knowledge graph, answer citations and mastery checks. A student can trace a concept or an answer back to its source passage.

## Operating Context

The repository is named Grasp. The user wants quiet naming and an attractive workspace, not a branding-heavy landing page. The opening headline is "drop folder to get started". Importing notes reveals a document mindmap, with Q&A as the primary panel. Local development is the initial delivery target. Public hosting and portfolio embedding are later deployment decisions.

## Capabilities and Constraints

The user authorized completion of all six phases. The app includes ingestion, the interactive map, cited conversational Q&A, mastery quizzes, retrieval evaluation and self-hosting controls. Dropping a file reveals the question box on the same page, with the graph behind it. Source lists, saved conversations and quizzes belong in explicitly opened dialogs.

The final Progress schema has masteredCount, exploredCount, totalNodes, coveragePercent and crossDocLinks. XP, levels, streaks and bonuses are excluded. Node positions are computed on the client and never stored. Every node retains source chunk IDs. Real document text stays local in mock mode; live mode sends selected text to the configured provider.

## Brand Commitments

Dark, calm, scientific star-chart feel. One cool accent for selected content and actions. Gold is reserved for mastered concepts. Plain copy. No generic metric-card dashboard. The first preview must remain lightweight.

## Evidence on Hand

The user's supplied specification establishes the behavior and schemas. Two original notes demonstrate cross-document merging. Automated tests verify provenance, conversations, lifecycle and mastery. The 20-question retrieval check uses only three sample chunks, so it measures pipeline behavior rather than broad semantic quality. There are no user-study results to claim.

## Product Principles

- Show the source behind an answer.
- Make document questions the primary activity, with the graph providing source context.
- Keep mastery separate from activity counts.
- Keep mock data and live results distinguishable.
- Ship a runnable checkpoint before expanding scope.
