# Preserve exact source spans

**Status:** Implemented.

Students need the passage behind an answer. Store page text and Unicode offsets in SQLite and index the same chunks in Chroma. Resolve vector hits back to committed source rows before generation. Validate cited document, page, chunk and exact quote before returning an answer.

The stores have separate transactions, so ingestion explicitly cleans up staged vectors on failure. Provenance checks establish where a quote came from. They do not establish that every answer claim follows from it. Revisit the verifier when a labelled set can measure claim support. [Parser and tests](../facts.md#what-the-workspace-does)
