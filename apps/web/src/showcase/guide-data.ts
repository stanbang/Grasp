export const guideTopics = [
  { id: "pipeline", label: "Student need", title: "How does Grasp answer from your notes?" },
  { id: "tradeoffs", label: "Tradeoffs", title: "What changes when you change retrieval?" },
  { id: "adapt", label: "Adaptation", title: "How do you test a replacement?" },
  { id: "evaluation", label: "Evaluation", title: "What does the evidence actually show?" },
  { id: "production", label: "Production", title: "What happens when Grasp runs for real?" },
] as const;

export const guideStages = {
  prepare: [
    { title: "Read pages", tools: "FastAPI · PyPDFLoader · Poppler and Tesseract", description: "FastAPI accepts PDF, Markdown and UTF-8 text. The parser keeps page text. For a PDF page without text, optional local OCR recognizes the words before chunking.", file: "apps/api/app/parsing.py" },
    { title: "Split text", tools: "LangChain text splitter · Pydantic", description: "A chunk is a short passage. Grasp keeps its page and exact character range. Overlap carries part of one chunk into the next so evidence near a split can stay together.", file: "apps/api/app/parsing.py" },
    { title: "Index and link", tools: "LangChain embeddings · Chroma · SQLite and SQLModel", description: "Chroma indexes chunk vectors for search. SQLite stores page text and concept provenance. Concept extraction links the map's nodes and relationships back to the same passages.", file: "apps/api/app/ingestion.py" },
  ],
  question: [
    { title: "Find evidence", tools: "Chroma · Document filter", description: "The retriever embeds the question and looks up similar chunks. In the workspace, readers can restrict the search to selected notes. Graph links help with browsing after retrieval.", file: "apps/api/app/retrieval.py" },
    { title: "Build the prompt", tools: "FastAPI · LangChain · Gemini or OpenAI", description: "Grasp adds the retrieved passages and their identifiers to the question. In live mode, the model returns a structured answer and citations. A short note can also be pasted into a plain chat for a one-off question.", file: "apps/api/app/study_routes.py" },
    { title: "Check the source", tools: "Pydantic · React and TypeScript · Three.js", description: "Grasp checks each citation against the retrieved chunk's document, page and exact text. React opens that passage and highlights linked concepts on the map. The reader still needs to check what the quote supports.", file: "apps/api/app/study_routes.py" },
  ],
} as const;

export const replacementExamples = {
  chunking: { label: "Chunking", change: "Try shorter passages.", keep: "Freeze the notes, questions, gold quotes, embedding model and ranking method.", check: "Compare hits, index size and the amount of evidence supplied to the model.", file: "apps/api/eval/portfolio.py" },
  ranking: { label: "Ranking", change: "Reorder the existing candidates by shared words.", keep: "Keep the query and candidate list identical. Reuse each candidate's existing text.", check: "See which misses move into the context window. Compare a held-out set before replacing the default.", file: "apps/api/eval/portfolio.py" },
  embeddings: { label: "Embeddings", change: "Try a different embedding model in a separate index.", keep: "Fix the source chunks, query set and document scopes. Rebuild the index for the new model.", check: "Compare retrieval on the same labels. Measure complete answer latency and token usage separately.", file: "apps/api/app/llm.py" },
} as const;
