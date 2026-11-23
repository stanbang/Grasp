# How Grasp answers from notes

Grasp gives students a way to question their own notes and inspect the passage behind an answer. For a general explanation, a plain model can be enough. For repeated questions across a collection, Grasp trades indexing effort for document-scoped search, source links and a reusable map. The [facts and evidence](facts.md) document the design rationale and its limits.

| Responsibility | Implemented boundary | How to inspect it |
| --- | --- | --- |
| Read | Parse PDF pages or UTF-8 text. Optional OCR fills textless pages. | [Parser](../apps/api/app/parsing.py) and [OCR adapter](../apps/api/app/ocr.py) |
| Split | Use overlapping, page-local spans into extracted text. | [Chunk tests](../apps/api/tests/test_chunking.py) |
| Embed and index | Ask a configured LangChain embedder for vectors and store them in local Chroma. Keep canonical text and graph provenance in SQLite. | [Ingestion](../apps/api/app/ingestion.py) and [storage](../apps/api/app/storage.py) |
| Retrieve | Search similar vectors with an optional document filter. Resolve matches to ready documents in SQLite. | [Retrieval](../apps/api/app/retrieval.py) |
| Generate | Give the model the question, selected evidence and recent conversation for context. Treat source text as untrusted. | [Chat route](../apps/api/app/study_routes.py) and [provider adapter](../apps/api/app/llm.py) |
| Verify | Check cited chunk membership, document, page and exact quote. Require a citation for a supported answer. Retry invalid structured output once. | [Chat validator](../apps/api/app/study_routes.py) and [model tests](../apps/api/tests/test_llm.py) |
| Display and trace | Show exact source quotes. Highlight graph nodes by links to the retrieved chunks. Open original PDFs when available. | [Chat route](../apps/api/app/study_routes.py) and [source dialog](../apps/web/src/WorkspaceDialogs.tsx) |

The knowledge graph helps a reader navigate the sources. The retriever starts from text chunks and vector similarity. Related graph nodes come from the retrieved chunks after the search. A more involved graph traversal could be tested if the application struggles with questions that need several passages. **Considered.**

## Chat and the offline showcase

Live chat sends a bounded prompt through Gemini or OpenAI. A lightweight follow-up heuristic can append prior questions to retrieval input. The generator receives recent turns separately so it can interpret the question. Only retrieved passages count as evidence. If retrieval returns nothing, the API can decline without calling the generator. The live prompt also requests abstention when the available passages are insufficient. Exact quote checks cannot decide whether a generated claim follows from the quote. [Chat implementation](../apps/api/app/study_routes.py)

The workspace's **Implemented** mock mode returns deterministic excerpts using local storage and hash vectors. The public showcase is a browser-only replay of recorded mock ingestion. Suggested questions return recorded source excerpts. A typed question uses term overlap to find an excerpt in that sample. The browser derives the highlighted stars from the cited chunk links. [Trace recorder](../scripts/record_showcase_traces.py) · [Browser matching](../apps/web/src/showcase/evidence.ts)

**Considered** A plain LLM or a pasted note can serve short general questions with less setup. Fine-tuning can help with output format or tone, but updating source text is easier through the index. Agentic retrieval could help with multi-step searches, at the expense of additional calls and failure paths. A controlled plain-model comparison and an answer-support evaluation are still pending. [Tradeoffs](tradeoffs.md)

## Change one component

1. State the miss or cost you want to reduce, and pick a test that could disprove the change.
2. Freeze the questions, document scope, exact gold quotes and model. Build an isolated index for changed chunking or embeddings.
3. Run the same labelled retrieval cases. If testing reordering, save the candidate pool and compare two orderings against the same pool.
4. Exercise complete answers separately. Review source support, cost and latency before switching defaults.
5. Record the decision and what evidence would change it. [Decision records](decisions/)

**Measured example.** The [portfolio evaluator](../apps/api/eval/portfolio.py) compares the default split with a shorter split. Each index supplies the same candidate list for vector order and term-overlap order. Both changes recovered the baseline's missed live retrieval query. Keeping defaults lets a later test on unseen notes compare both candidates without changing the workspace first. [Evaluation](evaluation.md)

For an embedding swap, use the `Embeddings` boundary in [llm.py](../apps/api/app/llm.py), create an isolated index for the new identity and rerun the labelled cases. Parsers, ranking and citation verification are separate functions. Each change can be tested at its boundary even where there is no public plug-in API.
