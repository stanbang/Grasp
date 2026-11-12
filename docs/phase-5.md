# Phases 3–5 checkpoint

The user authorized these phases together. The study workspace now contains an interactive Three.js force graph, document upload with SSE updates, source reading, chat and mastery quizzes. Phase 6 remains outstanding.

Run `python scripts/dev.py --setup`, then open http://127.0.0.1:5173. On later runs use `python scripts/dev.py`.

## Verify the workflow

1. Click Sample graph. Existing stored concepts load immediately; an empty mock library loads the bundled pre-built graph and source passages without an LLM call.
2. Orbit, pan and zoom the canvas. Select a concept on the graph or in the keyboard-accessible concept list. Source names and exact passages appear beside it.
3. Add a PDF, Markdown or TXT note. Its processing status streams over SSE, with node and edge upserts. Refresh recovers stored results after a disconnected upload.
4. Ask a question. In mock mode the response displays deterministic retrieved excerpts. With a configured provider, structured generated output must cite exact substrings from the retrieved chunks. Citation buttons open the quoted text. Linked concepts pulse and become learning.
5. Start a quiz for the selected concept. It contains three questions with three options each. The browser receives no answer keys. Submit all answers; passing at least two marks the selected concept mastered. A failed attempt leaves it learning. Submitted attempts cannot be reused.
6. Refresh the page. Mastery and coverage remain stored in SQLite. Positions remain transient client state.

## Changes

The web workspace uses Zustand for shared graph data, lazy-loads react-force-graph-3d, preserves layout objects during form input, and offers a stacked mobile layout. Motion is reduced when requested. Dim, teal and gold distinguish unexplored, learning and mastered concepts.

POST /chat retrieves Chroma chunks and resolves them against committed SQLite records. Citation quotes are validated before returning. referencedNodeIds comes from chunk-to-node links, independent of model output. POST /quiz uses a concept and neighbour passages. Evidence IDs and exact quotes validate generated questions. POST /quiz/grade grades server-stored answers, consumes the attempt and persists mastery and progress in one transaction.

Backend additions: study_routes.py, quiz_models.py, study tests and ingestion mastery preservation. Frontend additions: the study canvas and panels, study-store.ts, responsive styles and generated API contracts.

## Verification and limits

51 tests pass, including end-to-end cited chat, passing/failing quizzes, hidden answer keys and reused-attempt rejection. Strict TypeScript and the production build pass. The 3D library is a separate lazy bundle. The two independent Impeccable reviews identified layout resets, source races, provenance labels, upload disconnect handling, reduced motion and mobile coverage; these were addressed in the polish pass. The detector produced one advisory for unused historical canvas-grid styles. Questions skipped: the user requested completion through Phase 5 using the already specified direction.

The browser workflow was exercised with the local samples. Mock quizzes are deterministic source-recognition fixtures, not a measure of educational quality. Live provider calls, semantic answer quality, authentication, production hosting, rate limiting and retrieval evaluation remain unverified or deferred to Phase 6. The demo includes a bundled pre-built graph and uses deterministic local vectors for its source chunks. The current student workspace is for one local user.

The follow-up design review scored all seven original findings resolved. Desktop and 390px mobile captures showed no document overflow; browser checks exercised concept selection, cited chat and quiz submission. No live-provider quality claim is made.
