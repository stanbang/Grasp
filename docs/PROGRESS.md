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

## Needs owner approval

- License choice. The default branch has no tracked license and the goal leaves that decision to the owner.
- A held-out live embedding experiment has a proposed USD 0.015 cap. A live answer comparison and answer-support review has a proposed USD 0.115 provider cap. The inputs and rate sources are in [Proposed measurements and cost](facts.md#proposed-measurements-and-cost).
