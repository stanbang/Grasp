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

The repository is named Grasp. The user wants quiet naming and an attractive workspace, not a branding-heavy landing page. Local development is the initial delivery target. Public hosting and portfolio embedding are later deployment decisions.

## Capabilities and Constraints

Work in six phases and stop for approval between them. Phase 1 includes schemas, local storage initialization, provider/mock configuration, sample notes, a health endpoint and a lightweight workspace preview. Upload and ingestion begin in Phase 2. Interactive 3D begins in Phase 3. Chat begins in Phase 4. Mastery quizzes begin in Phase 5. Evaluation and shipping checks finish Phase 6.

The final Progress schema has masteredCount, exploredCount, totalNodes, coveragePercent and crossDocLinks. XP, levels, streaks and bonuses are excluded. Node positions are computed on the client and never stored. Every node retains source chunk IDs. Real document text stays local in mock mode; live mode sends selected text to the configured provider.

## Brand Commitments

Dark, calm, scientific star-chart feel. One cool accent for selected content and actions. Gold is reserved for mastered concepts. Plain copy. No generic metric-card dashboard. The first preview must remain lightweight.

## Evidence on Hand

The user's supplied specification establishes the behavior and schemas. The repository starts empty. The sample study note is original demonstration material. There are no user study results, retrieval benchmarks or completed mastery results to claim.

## Product Principles

- Show the source behind an answer.
- Make exploration the main activity.
- Keep mastery separate from activity counts.
- Keep mock data and live results distinguishable.
- Ship a runnable checkpoint before expanding scope.
