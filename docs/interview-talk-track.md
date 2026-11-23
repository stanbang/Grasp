# Grasp interview talk track

Open the [recorded showcase](http://127.0.0.1:5173/showcase/) and keep [facts and evidence](facts.md) and [evaluation](evaluation.md) in nearby tabs. The times below are rehearsal targets.

## 1. How did I build around student needs? Would a plain LLM be better?

**30 seconds**

I started with a student who needs to check an answer against lecture notes. Grasp searches the student's notes, answers from the passages it found and opens the cited page. A plain LLM is a good choice for general explanations. I'd paste a short note for a one-off question. Grasp is for revisiting a collection and tracing the evidence each time.

**Two minutes**

Suppose I'm studying networks and I want to see how my notes distinguish routing from name resolution. I can get a general explanation from a plain model. If I care about the wording in my course, I need to give the model my notes and then find the passage it used. For a single short note, pasting it into a chat is a reasonable way to do that.

Grasp is set up for repeated questions across files. It extracts pages and splits them into passages. Each passage has a document, a page and offsets. A question can search the whole collection or stay within chosen notes. The answer points to exact text and the source view shows it in place. I can also start from a concept and see what else it links to in the note.

I kept the knowledge map and citations tied to the same chunks. That makes it possible to demonstrate the path from question to text and back to a concept. It also gives a clear failure case. If the relevant chunk doesn't make it into the prompt, the model has less to work with. And even when the quote passes validation, I still need to judge whether it actually supports the answer.

**Point to** the [product brief](../PRODUCT.md), [chat route](../apps/api/app/study_routes.py) and [source dialog](../apps/web/src/WorkspaceDialogs.tsx). Show the router citation in the recorded demo.

**Limitation.** This is a student-centered design goal. I have not measured student adoption or learning outcomes.

- **When would you use a plain model?** When the question is general or the reader can easily paste and check a short source. That avoids an import and index.
- **Why add a graph?** It lets a reader navigate related concepts and open their source passages. The current answer retriever searches chunks, and the graph highlights come from their links.

## 2. How did I weigh cost, speed and quality?

**30 seconds**

I compared chunk size and ordering before touching the generator. Shorter chunks reduced the number of characters returned in the same top-three window, and they increased the number of index entries. A term reorder recovered the archived live miss using the same candidates. I kept defaults until I can check on unseen notes and measure complete requests and token use.

**Two minutes**

The first cost is preparing a document. Local text extraction keeps the workflow simple. Scanned pages can fall back to CPU-based OCR. It adds work and the recognition can be wrong, so the reader sees the recognized text behind a citation. At indexing time I picked a recursive splitter with overlap to preserve text near a boundary. SQLite holds the text, and Chroma holds its index.

For questions I bound how much evidence goes to generation. The default asks for up to five passages. More context can help when evidence is scattered, but it also gives the model more irrelevant material and may cost more. I compared two chunk shapes and used the same set of candidates for vector and word-overlap order. In the archived Gemini run, the shorter chunks grew the index from eight to eighteen entries and lowered the mean top-three characters. A local rerank also recovered the miss with the default chunk size.

I separate those observations from pricing and speed claims. The archived latency is warm retrieval over one network run. It doesn't include generation. Character counts are a rough size measure. Next I'd log tokens and stage times on the same questions and generator, then review answer support before changing defaults.

**Point to** [all recorded runs](facts.md#earlier-portfolio-runs) and [tradeoffs](tradeoffs.md). Use the default-versus-shorter chunk rows.

**Limitation.** End-to-end latency and provider bills are not measured yet.

- **Why not rerank everything with another model?** First establish how much a local reorder helps. A learned reranker adds work, so it needs a larger, independent comparison to justify the cost.
- **Which choice saves the most money?** I don't have a measured answer. I'd separate ingestion from questions and log query embedding usage, generation tokens and retries.

## 3. What framework lets me adapt to new tools?

**30 seconds**

I test changes at a boundary. I state the problem, change one part, compare on the same labelled questions and write down the decision. To try another embedding model, I create a separate index and hold chunking and prompts fixed. That gives me a fairer comparison and a way back to the previous index.

**Two minutes**

The main boundaries are reader, splitter, embedding adapter, index, retriever, generator and citation verifier. They share a common representation of the source chunk. That keeps a change to the vector model from changing what the source view means by a page or passage. LangChain supplies the model interfaces, and Pydantic validates the output we use in app code.

The diagram's bottom row is the decision loop. I start with a specific miss and keep a small, reproducible set of questions and expected passages. If I change ordering, I save the candidates and compare the two rankings on the same pool. For a new embedding model I'd create a separate collection, use the same chunks and record the model identity. The local workspace can continue using its old collection while I test the alternative.

After retrieval I check answers separately. Does the quote identify the right passage? Does it support the claim? How long did the whole request take, and did it use more tokens? The result goes into a decision record with a practical trigger for changing course. The chunk and reorder comparison is a concrete example of that loop. It found candidates worth testing and a reason to keep the baseline while I do that.

**Point to** the [framework diagram](assets/framework.svg), [embedding adapter](../apps/api/app/llm.py) and [retrieval decision](decisions/ADR-002-retrieval-baseline.md).

**Limitation.** The adapters are replaceable at code boundaries. Some changes need code edits and a fresh index.

- **How would you swap the vector database?** Keep chunk IDs, stored texts and the scope predicate stable. Build a parallel index, compare result IDs and scoped relevance, then plan a cutover at the storage boundary.
- **What would make you add agentic RAG?** Repeated misses on questions that need several dependent searches. I'd first compare a bounded second search and measure added latency, calls and errors.

## 4. How did I evaluate it and choose components?

**30 seconds**

I test source integrity and retrieval separately. In the exploratory set, the archived live baseline put the expected passage in the top three for nineteen of twenty questions. Shorter chunks or a word-overlap reorder each reached twenty. I kept defaults because I wrote the small test set and used it to pick the variants. I verified quote membership end to end separately.

**Two minutes**

I split the evidence into three parts. The automated checks verify the things I can specify as invariants, such as an offset slice matching the page, a scoped query staying in its document, and quiz answers staying server-side before grading. The original retrieval checker has only three chunks. It helps catch wiring failures.

The second part is the portfolio experiment. I labelled twenty questions across four notes using a source file and exact quote. A hit means a returned chunk from that source contains the quote. The baseline hit the top three in nineteen cases. Reordering the same candidates by words shared with the question hit all twenty. The shorter chunk choice also hit all twenty in Gemini. It missed a concept-map question in the mock setting. Those are retrieval outcomes. They don't tell me whether a model interpreted a quote correctly.

For the third part, the earlier Gemini check looked at a pair of cited answers, including a follow-up, then exercised unsupported input and a quiz. It verifies exact citations and no citations on the unsupported case. I would ask someone who didn't write the system to label questions from unseen lecture notes and judge whether each answer claim follows from the cited text. Then I'd compare the same generator across retrieval choices and keep the change only if it helps at an acceptable time and cost.

**Point to** the [labels](../apps/api/eval/portfolio-questions.json), [live retrieval report](evaluation-portfolio-live.json), [mock rerun](facts.md#reproduce-the-four-note-mock-report) and [live acceptance script](../scripts/verify_live.py).

**Limitation.** The authored fixture is small and near the top-three ceiling. The study has no held-out split or automated claim-support measure.

- **Why use Hit@3 and MRR?** Hit@3 checks whether evidence entered a small context window at all. MRR makes earlier evidence count more, so differently ordered results can differ while both hit.
- **What specifically failed?** The larger-chunk Gemini baseline missed the labelled passage about checking a recalled answer for missing details. The report shows the returned chunk IDs and rank. A narrower window or word overlap helped in that run.

## 5. What are the production concerns?

**30 seconds**

Grasp is set up for one owner. It can run behind an optional access token, limits uploads and requests, and uses a non-root container. I can inspect local logs and ingestion events. A shared service needs user and document isolation, stage monitoring, backups and a budget for model calls. I would prove those before opening it to private uploads.

**Two minutes**

The current deployment is a local workspace with SQLite and Chroma. The container has one API worker and one ingestion worker. It binds to loopback by default in Compose and runs as a non-root user. An optional owner token guards the API, and the service has body and mutation limits. I would put an HTTPS reverse proxy in front before remote use and back up the complete data directory together.

In mock mode document processing and answers stay local. In live mode embedding requests use extracted text and the query. Concept extraction and chat pass text to the configured provider, and chat includes bounded recent context when it needs it. That means the deployment needs a deliberate provider and data-retention decision before anyone imports restricted notes.

For operations I can see process logs, health and durable ingestion events. I'd add structured stage timings, errors, retries and token counts. I'd want to know whether the tail is in the local index, in the provider or in repeated retries. For multiple owners, I'd enforce identity and partition storage and retrieval by tenant. I'd test who can read which document before scaling or exposing an upload endpoint. The public replay gives someone a way to inspect the product using its bundled samples.

**Point to** [deployment](deployment.md), the [Dockerfile](../Dockerfile), [request controls](../apps/api/app/request_controls.py) and [proposed measurements](facts.md#proposed-measurements-and-cost).

**Limitation.** The optional token is an owner gate. It gives no per-user isolation or account recovery.

- **How would you secure public use?** Keep the demo static. For a live service use authenticated accounts and explicit document authorization, isolate storage, set upload and provider limits and monitor abuse.
- **What would you measure first?** Minutes and errors by ingestion stage, complete question latency and input/output tokens by route. Add a held-out source-support check before tuning for speed.

## One-page cheat sheet

| Number | What to say | Evidence |
| --- | --- | --- |
| 20 case labels, four notes, five scoped cases | It's a small author-labelled retrieval set. | [Portfolio questions](../apps/api/eval/portfolio-questions.json) · [Facts](facts.md#measured-results) |
| 19/20 → 20/20 Hit@3 | Archived Gemini result after either shorter chunks or term reordering. | [Archived results](facts.md#earlier-portfolio-runs) |
| 900/150 → 360/60 and 8 → 18 chunks | Shorter windows increase index size and can return less evidence text per query. | [Recorded runs](facts.md#earlier-portfolio-runs) |
| Five passages by default, one invalid-output retry | Workspace limits on retrieval and structured validation. | [Runtime facts](facts.md#what-the-workspace-does) |
| Two cited live answers, one unsupported case, three quiz questions | Acceptance evidence for a narrow workflow. | [Live report](live-verification.json) · [Facts](facts.md#measured-results) |
| Two of three quiz answers | A passing grade sets a concept to mastered. It does not establish long-term retention. | [Study tests](../apps/api/tests/test_study.py) · [Facts](facts.md#what-the-workspace-does) |

## Quick answers

- **What did I build?** Ingestion orchestration, exact source checks, the storage and citation path, graph and study UI, evaluation, and the demo playback. FastAPI, LangChain, Chroma, SQLModel, React and the 3D renderer supply infrastructure and primitives.
- **How would I scale it?** Measure the local bottleneck first. Move durable ingestion work behind a queue, isolate tenants and introduce shared storage and vector indexing only as measured capacity requires.
- **How would I secure it?** Keep the static demo separated from real uploads. Add identity, enforce source authorization on every route and retrieval call, set quotas, and review provider retention before accepting private data.
- **How would I know it's hallucinating?** Mark each answer claim as supported, unsupported or unclear by comparing it with the quoted passage. Exact citation validation catches a fabricated quote. It cannot score the relationship between claim and quote.

## Things I would do next

- Label an unseen retrieval set that includes ambiguous and unsupported questions.
- Compare vector search, different chunk sizes and term reordering on those same cases.
- Compare claim support for RAG, a plain model and pasted context while holding the model fixed.
- Capture cold and warm latency, provider token counts and retry rates.
- Test the security boundaries before accepting multiple owners' documents.
