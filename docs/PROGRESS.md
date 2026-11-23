# Showcase progress

## Audit

- Created `showcase-overhaul` from the current default branch. GitHub reported no open issues, so the Grasp prompt is the work list.
- Read the product, design and surface guidance and checked the workspace, evaluation runners, reports and test coverage. [Facts and evidence](facts.md) records claims, verification commands, stale copy and measurement gaps.
- Found earlier interview work on `origin/feature/rag-interview-showcase`. Reconstructed chunks from the archived note bytes and verified gold matches, context counts and scopes. Recomputed archived Hit@1, Hit@3 and MRR@3. The two existing notes match the recorded hashes as Git blobs. The two portfolio-specific fixtures match with CRLF line endings.
- Reproduced the original offline retrieval result. `python scripts/check.py` and `npm run build` passed. The built workspace and mock API passed a loopback smoke check. The build warned about the size of the existing lazy-loaded 3D bundle and stale Browserslist data. Python warned that the current PDF loader's package is deprecated.
- Reran the earlier four-note benchmark in mock mode with the exact archived input bytes. The report matched the archived mock report after removing timing fields. [Reproduction steps](facts.md#reproduce-the-four-note-mock-report) document the line endings needed to recover the stored chunk IDs.
- Keep the default branch's study workspace as the integration baseline. Reuse the earlier evaluation artifacts where compatible. The older `/about` walkthrough and the proposed `/showcase` replay serve different purposes.
- Treat the author's description of student needs as a design goal. There is no user research result to cite.
- Reviewed the audit and progress prose against the Humanizer skill linked from the repository's original checkpoint.

## Next

- The owner authorized continuing through all phases with self-review at each checkpoint.
- Use Impeccable shape for the showcase before building UI. The project records its Impeccable setup in [the original checkpoint](phase-1.md).
- Use checked-in notes for the first trace pass and record any provisional notes if the owner has not supplied final copy.

## Retrieval evidence

- Carried the earlier runner, fixtures, labels and recorded reports onto this branch. The runner stages its corpus with the archived line endings in a temporary directory. It leaves working notes, the study library and recorded reports alone.
- The port reproduced every mock result except machine timings. See [the benchmark command](facts.md#reproduce-the-four-note-mock-report).

## Design

- Impeccable shape recorded the [showcase direction](../.impeccable/surfaces/showcase.md) in the existing Grasp visual system. The reference chat was opened in the browser to inspect its composer, starter prompts and history.
- Created the [Figma draft](https://www.figma.com/design/3rtdi0qiFA8f6ct5MlOp76) in the owner's personal workspace. Figma's official capture tool added all six designs. Direct editing and asset export still face the Starter-plan quota. The Prototype page contains the captured sequence. The browser showcase contains the working transitions.
- Authored and visually checked both diagrams and the social preview. The [local assets](assets/README.md) include SVG and PNG diagrams, logo variants and the favicon.

## Traces

- Recorded the actual mock ingestion function with isolated stores on three bundled notes. The network sample uses provisional original text until the owner supplies final copy. The exporter creates its public PDF fixture in a temporary directory.
- The trace uses a narrower chunk target than the workspace default so each sample shows a real overlap. It ships only projected coordinates. The replay timing can differ from the recorded wall time.
- Added schema and provenance tests. Contract drift and the targeted trace suite passed.

## Replay and chat

- Built `/showcase` as a static entry alongside the local workspace. It replays sample pages, text, overlapping passages, projected points and links. The controls support timed and manual playback. Session history, source dialogs and the keyboard concept list run in the browser.
- Attached the file-drop safety test to the page's actual event listener. It rejects an external file even when the transfer also advertises the sample MIME type. Attempts to read file data, items or names would fail the test.
- Self-reviewed desktop and 390-pixel browser layouts. Exercised keyboard sample selection, reduced-motion steps, pause, speed, restart, skip, 3D and 2D star clicks, a cited answer, Escape and question history. The physical touch gesture and mid-range laptop frame rate remain unmeasured.
- Checked the build and full suite in mock mode. Impeccable source detection reported no regex-matched findings. Rendered scans identified small format labels and a mobile line wrap. Fixed both and reran desktop and mobile scans. [Self-review](showcase-review.md)

## Case study

- Drafted the five interview answers, diagrams, evaluation, component tradeoffs and decision records. The README links to the archived reports and the runnable mock reproduction.
- Recorded a short GIF from the local showcase and wrote the staged walkthrough, portfolio snippet and interview talk track.
- Added the owner's architecture image and used the shared course review to shape a first-party interactive guide. The DeepLearning.AI lesson prompts for login, so the guide relies on the public syllabus and evidence from Grasp's source and recorded runs.
- Verified the five walkthrough topics, both retrieval settings, claim feedback and the router citation handoff in a browser. Local checks, production build and Impeccable scans passed. [Walkthrough review](showcase-review.md#interactive-course-walkthrough)

## GitHub

- Pushed `showcase-overhaul` and verified the corrected repository description and topics. GitHub Actions passed the offline tests, build and Pages artifact step on the published branch. The deployment job hit the Pages branch restriction.

## Needs owner approval

- License choice. The default branch has no tracked license and the goal leaves that decision to the owner.
- Public Pages deployment. The existing environment allows `main`. Automatic approval review rejected adding `showcase-overhaul` without explicit approval for that publishing rule.
- A held-out live embedding experiment has a proposed USD 0.015 cap. A live answer comparison and answer-support review has a proposed USD 0.115 provider cap. The inputs and rate sources are in [Proposed measurements and cost](facts.md#proposed-measurements-and-cost).
