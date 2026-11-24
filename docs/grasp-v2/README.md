# GRASP 2.0 Phase 0

Research and implementation proposal for review, 24 November 2026 (Singapore). The source brief is [GRASP_V2_SPEC.md](../GRASP_V2_SPEC.md). The [handover](../HANDOVER.md) describes prior work. The current request authorizes Phase 0 documentation and baseline verification. Later implementation, publication and provider runs require their own approval.

Phase 0 was approved. The [Phase 1 checkpoint](phase-1.md) records the shared canvas implementation, review evidence and run instructions. Phase 2 awaits approval of the running workspace.

| Review | What it covers |
| --- | --- |
| [Reference investigation](references.md) | Enso browser and REA evidence, PayNow repository and demo, reference comparison, canvas library selection |
| [Architecture and branch audit](baseline.md) | Branch histories, reusable code, current data flow, baseline results and limits |
| [Product and interaction brief](../../PRODUCT.md) and [design specification](../../DESIGN.md) | The two workspaces, initial journey, visual system and interaction states |
| [Shared canvas and contracts](canvas-architecture.md) | Rendering, identity, storage, compatibility, observability and AI changes |
| [Roadmap and verification](roadmap.md) | Phase order, dependencies, measurable acceptance and work still pending |
| [HTX storyboard](storyboard.md) | Five-minute route, claims, presenter prompts, failure recovery and optional depth |

## Decision for review

Start from `showcase-overhaul` at `98f8cda`. It preserves the runnable `main` workspace and the strongest collection of replay, evaluation and interview evidence. The other feature line has working additions that should be ported selectively, especially upload status handling, adjacent source inspection and bounded PDF previews. Review each candidate against the new canvas and existing API contracts. [Branch comparison](baseline.md#branch-recommendation)

Use React Flow for the shared 2D editor, pending the interaction spike in Phase 1. Keep canonical knowledge IDs in the existing graph, version board edits separately, and load the existing Three.js graph when requested. Start with a single real graph rendered on the shared board and validate camera and selection behavior before adding authoring features. [Decision and alternatives](references.md#canvas-library-decision) · [Phase 1 gate](roadmap.md)
