# GRASP 2.0 planning and evidence

The owner approved Phase 0, the Direction A+ [Phase 1.1 whiteboard](phase-1-1/README.md), the [Developer Preview v0.1 specification](developer-preview.md) and the [Phase 2 service checkpoint](phase-2.md) for the 7 December 2026 HTX interview.

The original Phase 0 source brief is [GRASP_V2_SPEC.md](../GRASP_V2_SPEC.md). The [handover](../HANDOVER.md) describes earlier work. The [Phase 1 checkpoint](phase-1.md) records the first shared canvas implementation. The [Phase 1.1 design review](phase-1-1/README.md) preserves the audit and compares all three rendered directions.

| Review | What it covers |
| --- | --- |
| [Reference investigation](references.md) | Enso browser and REA evidence, PayNow repository and demo, reference comparison, canvas library selection |
| [Architecture and branch audit](baseline.md) | Branch histories, reusable code, current data flow, baseline results and limits |
| [Vision](../../VISION.md), [product brief](../../PRODUCT.md) and [design specification](../../DESIGN.md) | Developer Preview direction, preserved workspace roles, visual system and interaction states |
| [Shared canvas and contracts](canvas-architecture.md) | Rendering, identity, storage, compatibility, observability and AI changes |
| [Phase 2 service checkpoint](phase-2.md) | Project board HTTP operations, revision checks, browser synchronization and local verification |
| [Roadmap and verification](roadmap.md) | Phase order, dependencies, measurable acceptance and work still pending |
| [HTX storyboard](storyboard.md) | Five-minute route, claims, presenter prompts, failure recovery and optional depth |

## Phase 0 decisions

Start from `showcase-overhaul` at `98f8cda`. It preserves the runnable `main` workspace and the strongest collection of replay, evaluation and interview evidence. The other feature line has working additions that should be ported selectively, especially upload status handling, adjacent source inspection and bounded PDF previews. Review each candidate against the new canvas and existing API contracts. [Branch comparison](baseline.md#branch-recommendation)

The approved implementation uses React Flow for the shared 2D editor. It keeps canonical knowledge IDs in the existing graph and loads the Three.js graph when requested. The revised plan adds persistence and agent operations above that renderer. [Decision and alternatives](references.md#canvas-library-decision) · [Phase 1.1 verification](phase-1-1/README.md#verification-on-25-november-2026)
