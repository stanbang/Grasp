# GRASP progress

## Developer Preview v0.1

- **Phase 0 complete:** Audited four branches, verified the baseline, captured public reference evidence and selected the showcase baseline and React Flow. The [research index](grasp-v2/README.md) points to the branch audit, REA findings and design decisions.
- **Phase 1 complete:** `dcc8c6a` and `8cd9582` delivered the runnable shared canvas foundation. The owner requested a different visual direction in Phase 1.1, which retained the working interaction and source features. [Checkpoint](grasp-v2/phase-1.md)
- **25 November 2026, approved:** The owner approved the Phase 1.1 Direction A+ whiteboard. The local feature branch contains the implementation (`ea8e246`) and its review record (`ae76ddb`). The checkpoint passed 72 Python tests, 24 Node tests, contract and TypeScript checks, production build and the disposable Chrome suite. Physical projector and screen-reader review remained unverified. [Checkpoint](grasp-v2/phase-1-1/README.md)
- **25 November 2026, planning:** Audited reuse for the local developer preview. Proposed one FastAPI board service, additive SQLite project state, thin CLI and Codex MCP adapters, one sandboxed prototype path and a human-approved export. The SDK choice is documented from official sources. Windows compatibility, the adapter handshake and isolation are planned gates. [Specification](grasp-v2/developer-preview.md) · [Architecture](grasp-v2/canvas-architecture.md#developer-preview-service)
- **25 November 2026, handoff prepared:** The plan is at `6301b1c` on `feature/grasp-v2-canvas`. The handoff records approval history, code and contract entry points, the persistence boundary, reuse decisions, and the starting scope for Phases 2 and 3. The mock-mode handoff rerun passed contract drift, 72 Python tests, 24 Node tests and strict TypeScript. [Implementation handover](HANDOVER.md#start-here-for-developer-preview-phases-2-and-3)
- **25 November 2026, Phase 2 approved:** The owner accepted the saved Project board workflow and approved starting Phase 3. [Phase 2 checkpoint](grasp-v2/phase-2.md) · [Handover](HANDOVER.md#phase-2-service-acceptance)
- **25 November 2026, Phase 3 ready for desktop acceptance:** The existing stdio server is registered once at user level. Fresh standalone and desktop-bundled sessions made real MCP calls from outside the checkout. The active desktop chat created, annotated and edited a verification board. The owner will check a fresh desktop chat before Phase 4. [Setup and verification](grasp-v2/phase-3.md#windows-desktop-registration)
- **26 November 2026, Phase 3.1 ready for independent acceptance:** The owner approved active-board resolution, an attributed revision-aware MCP read and a shared Codex and Claude Code skill. The Codex skill is installed at user scope. Phase 4 awaits the owner's acceptance. [Collaboration check](grasp-v2/agent-guide.md#try-a-collaboration)
- **26 November 2026, Phase 3.2 integration:** `grasp setup` configures the local workspace and installs the user-level MCP registration and skill. A fresh Codex desktop chat outside the checkout discovered GRASP, saved the video-editor design and queued its live canvas. Automatic browser review hit its usage limit before the in-pane interaction check. [Setup and acceptance](grasp-v2/agent-guide.md)

The schedule targets the complete slice by 4 December and reserves 5–6 December for integration and rehearsal ahead of the 7 December interview. [Roadmap](grasp-v2/roadmap.md) · [HTX presentation](grasp-v2/storyboard.md)

## Showcase history

The remainder records the original showcase work and its approval history. The current Developer Preview follows the gates above.

## Audit

- Created `showcase-overhaul` from the current default branch. GitHub reported no open issues, so the Grasp prompt is the work list.
- Read the product, design and surface guidance and checked the workspace, evaluation runners, reports and test coverage. [Facts and evidence](facts.md) records claims, verification commands, stale copy and measurement gaps.
- Found earlier interview work on `origin/feature/rag-interview-showcase`. Reconstructed chunks from the archived note bytes and verified gold matches, context counts and scopes. Recomputed archived Hit@1, Hit@3 and MRR@3. The two existing notes match the recorded hashes as Git blobs. The two portfolio-specific fixtures match with CRLF line endings.
- Reproduced the original offline retrieval result. `python scripts/check.py` and `npm run build` passed. The built workspace and mock API passed a loopback smoke check. The build warned about the size of the existing lazy-loaded 3D bundle and stale Browserslist data. Python warned that the current PDF loader's package is deprecated.
- Reran the earlier four-note benchmark in mock mode with the exact archived input bytes. The report matched the archived mock report after removing timing fields. [Reproduction steps](facts.md#reproduce-the-four-note-mock-report) document the line endings needed to recover the stored chunk IDs.
- Keep the default branch's study workspace as the integration baseline. Reuse the earlier evaluation artifacts where compatible. The older `/about` walkthrough and the proposed `/showcase` replay serve different purposes.
- Treat the author's description of student needs as a design goal. There is no user research result to cite.
- Reviewed the audit and progress prose against the Humanizer skill linked from the repository's original checkpoint.

## Working assumptions

- The owner authorized continuing through all phases with self-review at each checkpoint.
- The original project [checkpoint](phase-1.md) records the Impeccable setup. The showcase follows the existing visual system and uses bundled notes for the trace.
- The networking fixture remains provisional until the owner supplies the final note text.

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
- Self-reviewed desktop and 390-pixel browser layouts. Exercised keyboard sample selection, reduced-motion steps, pause, speed, restart, skip, 3D and 2D star clicks, a cited answer, Escape and question history.
- Fixed touch drag cancellation and made the active pointer retain ownership through release. The offline check and build passed. Chrome opened the router citation after the fix. A physical touch check is pending.
- Added regression coverage for sample taps, pointer ownership, drag cancellation and duplicate clicks. The tests call the same handlers used by the sample buttons. The built app opened notes from a desktop drag, a click and the keyboard. Run `node --test scripts/tests/showcase.test.cjs`.
- Reproduced the panel animation continuing after Pause. The replay now holds the visuals when paused, changes animation rates in place and restores the frame when returning from the guide. I verified these behaviors, same-stage restart and manual reduced-motion steps in the browser. [Replay timing check](showcase-review.md#replay-timing)
- Recorded browser frame intervals on the available Lenovo laptop and wrote the steps for reproducing the test. The mid-range hardware target still needs verification. [Browser sample and probe commands](showcase-review.md#browser-frame-sample)
- Checked the build and full suite in mock mode. Impeccable source detection reported no regex-matched findings. Rendered scans identified small format labels and a mobile line wrap. Fixed both and reran desktop and mobile scans. [Self-review](showcase-review.md)

## Case study

- Drafted the five interview answers, diagrams, evaluation, component tradeoffs and decision records. The README links to the archived reports and the runnable mock reproduction.
- Recorded a short GIF from the local showcase and wrote the staged walkthrough, portfolio snippet and interview talk track.
- Added the owner's architecture image and used the shared review to shape an interactive guide. Read selected official transcripts across the five course modules using the existing account. Added a prompt comparison to show what the model receives before and after retrieval. The guide uses original diagrams and examples from the Grasp repository. [Lessons reviewed](course-walkthrough.md)
- Verified the five walkthrough topics, both retrieval settings, claim feedback and the router citation handoff in a browser. Local checks, production build and Impeccable scans passed. [Walkthrough review](showcase-review.md#interactive-course-walkthrough)

## GitHub

- Pushed `showcase-overhaul` and the annotated tag `v0.6.0-showcase.1`. Verified the corrected repository description and topics. GitHub Actions passed the offline tests, build and Pages artifact step on the published branch. The deployment job hit the Pages branch restriction.
- Downloaded the Pages artifact from Actions and tested its actual `/Grasp/` path. The root redirect, direct walkthrough link, recorded ranking comparison, 3D map and exact citation worked on the static server. Added the favicon to the redirect entry after the first package logged a missing icon request. [Artifact check and commands](showcase-review.md#github-pages-artifact)

## Completion audit

| Requirement | Evidence on hand | Remaining |
| --- | --- | --- |
| Evidence, README and course walkthrough | The README answers the five questions and links to the sources, recorded results, diagrams and decision records. The original walkthrough uses selected DeepLearning.AI lessons across the five modules. [Facts](facts.md) · [Course sources](course-walkthrough.md) | Add a public demo link after a deployment succeeds. |
| Figma and brand assets | The Figma capture tool added the design drafts. The repository has original SVG and PNG diagrams, Mermaid versions and the brand assets. [Figma draft](https://www.figma.com/design/3rtdi0qiFA8f6ct5MlOp76) · [Asset provenance](assets/README.md) | The connected account still has a View seat. Native prototype transitions and Figma-sourced diagram exports remain pending. |
| Browser prototype | The local and packaged builds opened and replayed bundled notes, showed citations and loaded the 3D map. Browser checks exercised playback, mouse drag and keyboard controls. The drop tests cover external files and touch-handler events. [Browser review](showcase-review.md) · [Tests](../scripts/tests/showcase.test.cjs) | The available laptop exposed no touchscreen in the Windows device list. Confirm the gesture on a touch device and the frame-rate target on representative hardware. |
| GitHub and interview material | The repository description and topics, release tag, About copy, demo script and talk track are in place. GitHub Actions passed the offline checks, built the static package and uploaded its artifact. [About copy](about-snippet.md) · [Talk track](interview-talk-track.md) · [Actions run](https://github.com/stanbang/Grasp/actions/runs/45344457592) | Pages still allows `main` only. GitHub reports no custom social preview. Both changes require owner approval. |

## Needs owner approval

- License choice. The default branch has no tracked license and the goal leaves that decision to the owner.
- Public Pages deployment. The existing environment allows `main`. Automatic approval review rejected adding `showcase-overhaul` without explicit approval for that publishing rule.
- Public social preview. The PNG is in `docs/assets/social-preview.png`. Automatic approval review requires explicit approval to set it as the public link preview for `stanbang/Grasp`.
- A held-out live embedding experiment has a proposed USD 0.015 cap. A live answer comparison and answer-support review has a proposed USD 0.115 provider cap. The inputs and rate sources are in [Proposed measurements and cost](facts.md#proposed-measurements-and-cost).
