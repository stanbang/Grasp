# Interactive workspace delivery

The user authorized completion of all redesign phases together. Work remains on `feature/interactive-workspace-ui`, with separate design, backend, canvas, workspace and polish commits. The existing backend and core schemas were retained. The only new package is the approved development type dependency `@types/three`.

| Phase | Implemented work |
| --- | --- |
| Audit/design | Existing-source audit, event mapping, five-state browser proposal and five editable Figma frames. |
| Composer/ingestion | Real SSE lifecycle, indeterminate loop, filenames, per-file errors/retry, batch statuses, preserved conversation and replay-safe reducer. |
| Document orbit | Three.js CSS3D scene, stable ID slots, authenticated first-page PDF thumbnails, text excerpts, successful-upload arrival and constrained-screen/list fallback. |
| Connected views | Retained force graph, source selection and associated-node highlights, concept-to-source navigation, mastery retained. |
| Chat/inspector | Immediate outgoing question, pending assistant state, complete generated answers, named exact citations, native PDF page viewer, extracted-page quote highlighting, explicit source scope and source removal. Shared icon controls have visible hover/focus tooltips and accessible labels. |
| Polish/delivery | Reduced motion, page-visibility suspension, lazy preview loading, disposal, mobile focus containment, duplicate arrival guard, pending-stream recovery, tests and local Docker build. |

## Run

`python scripts/dev.py --setup` starts the native development preview at http://127.0.0.1:5173. `docker compose up --build -d` serves the full application at http://127.0.0.1:8080. The Docker image includes Poppler and Tesseract; enable `OCR_ENABLED=1` for scanned PDFs. Development machines without those tools retain text/excerpt fallbacks.

## Verify

Upload a note, watch actual statuses, wait for completion and inspect its card. Ask a question, upload the same file again and confirm both history and the composer remain available. Click a named citation and verify the source/page/quote; choose Ask this document and return to all sources. Switch to Knowledge, select a concept and inspect its supporting source. Use settings for quizzes and saved conversations.

`python scripts/check.py` passed 75 backend tests, 13 Node tests and strict TypeScript. The seven added API preview tests cover metadata, caching, invalid IDs, missing tools, render failures and removal cleanup. Six new reducer tests cover replay, terminal success/failure, batch counts and identity. `npm run build` and the Docker build passed. The final bundled Impeccable scan of apps/web/src returned no findings.

Browser verification exercised real duplicate ingestion, preserved saved turns, a new Gemini answer with citations and the processing/composer return. Independent review found and verified fixes for duplicate-arrival deadlock, scope changes after replacement, interrupted resume feedback and historical-source citation fallback. The earlier design review verified source identity, focus restoration and compact mobile layout. Actual OS drag gestures, broad device performance and 60 FPS are not claimed as measured.

## Design references and limits

[Figma draft](https://www.figma.com/design/LJok1ZuyYyd9wdEIP6AAqT) contains editable Empty, Processing, Orbit, Chat and Inspector frames. Its Starter tool quota prevented a final paper-text reflow correction; the running browser application is the implementation reference. Figma uses Inter because Segoe UI was unavailable there; the application retains its local font stack.

The document scene uses CSS3DRenderer, so it does not require WebGL. The Knowledge View retains the existing Three/WebGL force graph. PDF cards render only page one, bounded to 600px, with a 20-second render deadline and 2MB image cap. Originals load only on inspection. Exact quote matching proves provenance, not every inference in an answer. Native PDF page presentation depends on browser viewer support; the extracted quote remains readable beside it.

The existing provider, owner-token, single-worker and local-storage limits still apply. This delivery updates the local app and feature branch, not a public host. The old phase documents are historical checkpoints; the user removed their stop-for-approval requirement for this completion run.
