# Grasp evaluation

The two retrieval checks answer different questions. The one-note run checks that the system can index and retrieve a known passage. The portfolio run compares chunking and ordering against a wider fixture. Neither measures how often a generated answer is correct. [Evidence register](facts.md#measured-results)

| Evidence | Scope | How to reproduce |
| --- | --- | --- |
| Component and integration tests | Exact page offsets, UTF-8, storage, graph merging, structured output, source scope, quiz grading and replay safety | `python scripts/check.py` |
| Original retrieval check | 20 questions and three chunks from one note. Archived mock Hit@5 1.000 and MRR 0.950. Archived Gemini Hit@5 1.000 and MRR 0.875. | `python apps/api/eval/run.py --output work/original-mock.json` |
| Portfolio retrieval comparison | 20 author-labelled questions across four public repository notes. Five cases specify a document. | `python apps/api/eval/portfolio.py --output work/portfolio-mock.json` |
| End-to-end live acceptance | Two answers with exact citation text and pages, one follow-up among them, one unsupported response without citations and a three-question quiz with passing grading. | Read [the result](live-verification.json) and [the script](../scripts/verify_live.py). Running the script live sends provider requests. |
| Native OCR in the container | An image-only upload, local OCR and exact offsets. A separate container check recorded a cited provider answer and original PDF access. | Read [the OCR result](ocr-verification.json) and [the container check](production-verification.json). |

## Portfolio method

Each label identifies the source note and a quote that must appear in a chunk. Hit@1 and Hit@3 count questions with a matching chunk in the first result or first three results. MRR@3 averages the reciprocal first relevant rank, with zero for misses. The runner also counts out-of-scope results and estimates evidence volume in characters. It uses the same up-to-eight candidates for both ranking orders within a chunk policy. The mock retriever also applies a term filter after vector search, so the mock and Gemini runs cannot isolate the effect of swapping the embedding model.

| Gemini configuration | Hit@3 | Warm retrieval p95 | Mean top-three characters |
| --- | ---: | ---: | ---: |
| 900/150, vector order | 19/20 | 713.04 ms | 1814 |
| 900/150, term reordering | 20/20 | 713.10 ms | 1786 |
| 360/60, vector order | 20/20 | 692.39 ms | 805 |
| 360/60, term reordering | 20/20 | 692.45 ms | 796 |

Read the [Gemini report](evaluation-portfolio-live.json) and [mock report](evaluation-portfolio-mock.json) for individual questions, ranks and timings. [All eight configurations](facts.md#earlier-portfolio-runs) are listed in the evidence register. The portable mock rerun recovered the archived corpus hashes and all non-timing fields.

The timing includes the query embedding call and local ranking, when used. It excludes ingest, answer generation and the browser. A single warm run on one machine cannot establish a latency advantage. The lower character count is a proxy for input size. Actual tokens and billed cost are not measured yet. The five scoped cases had no out-of-scope results in the reports. This is a relevance check on fixture data.

## Decision and limits

The larger-chunk vector baseline missed the question about checking a recalled answer for missing details. Reordering or shorter chunks each recovered that query in the archived Gemini run. The shorter mock setting missed the concept-map question. Both changes warrant an independent test. The app still uses vector order and the larger-chunk default. [Retrieval decision](decisions/ADR-002-retrieval-baseline.md)

The case set was written by the project author and used to inspect the configurations. It has no held-out split. Most settings are close to the maximum Hit@3, so one question can change the conclusion. The end-to-end script validates exact quotes and page membership. Its unsupported check tests for an empty citation list. It does not score the meaning of the response or how well the answer's claims follow from the quotes.

Start with an independent set drawn from unseen lecture notes. Include paraphrases, exact terms, questions that need multiple passages and questions the notes cannot answer. Compare ranking variants, then keep retrieval fixed and label claim support for RAG, plain-model and pasted-context answers. Record request times and tokens per stage. [Measurement and cost plan](facts.md#proposed-measurements-and-cost)
